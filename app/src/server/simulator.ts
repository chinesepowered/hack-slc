// The crowd: a simulated conference day so the live map moves and the
// scheduler has real work. Each capybara is a group of ten attendees. Before
// every slot they pick a talk (weighted by how popular it is and what they
// like), walk there along the corridors, and get turned away when the room is
// full. Turned-away groups ask the same Plan B scheduler the phone app uses.
// Load is bounded: a fixed number of agents, one Plan B query per full room
// per batch window.
import { trace } from '@opentelemetry/api';
import { clock, DAY_END, DAY_START } from './clock';
import { venue } from './venue-state';
import { loadData } from './data';
import { bindSeats, newRun, previewPlanB, recordPlanB } from './scheduler';
import { hub } from './live';
import { log } from './log';
import { ROOM_BY_ID, ROOMS, walkMinutes } from '../shared/venue';
import type { Talk } from '../shared/api-types';
import type { AgentState, AgentView, LiveSnapshot, PlanBEvent } from '../shared/live-types';

const MIN = 60_000;
const AGENTS = Math.min(Number(process.env.SIM_AGENTS ?? 300), 600);
const PEOPLE_PER_AGENT = 10;
const DECIDE_BEFORE_MIN = 14;
const SKIP_PROBABILITY = 0.12;
const PLANB_BATCH_MS = 25_000; // sim time a group waits at the door before Capy reroutes the batch
const HALLWAY = ['LOUNGE', 'YUZU', 'SPRING'];
const tracer = trace.getTracer('capykube');

interface Agent {
  id: number;
  people: number;
  state: AgentState;
  at: string;
  to?: string;
  depart?: number;
  arrive?: number;
  talkId?: string;
  holdId?: string;
  rerouted?: boolean;
  waitingSince?: number;
  pendingPlanB?: boolean;
  affinity: Map<string, number>;
}

interface Slot {
  id: string;
  start: number;
  end: number;
  talks: Talk[];
}

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];

function weightedPick<T>(items: T[], weight: (t: T) => number): T {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let r = rand() * total;
  for (const t of items) {
    r -= weight(t);
    if (r <= 0) return t;
  }
  return items[items.length - 1];
}

class Simulator {
  private agents: Agent[] = [];
  private slots: Slot[] = [];
  private decided = new Set<string>();
  private changed = new Set<number>();
  private events: PlanBEvent[] = [];
  private turnedAway = 0;
  private timer?: NodeJS.Timeout;
  private lastTick = 0;

  start() {
    const { talks } = loadData();
    const bySlot = new Map<string, Talk[]>();
    for (const t of talks.filter((t) => t.kind === 'session')) {
      bySlot.set(t.slot, [...(bySlot.get(t.slot) ?? []), t]);
    }
    this.slots = [...bySlot.entries()]
      .map(([id, ts]) => ({ id, talks: ts, start: Date.parse(ts[0].start), end: Date.parse(ts[0].end) }))
      .sort((a, b) => a.start - b.start);
    this.resetDay(clock.now());
    this.timer = setInterval(() => this.tick(), 250);
    log.info({ agents: AGENTS, slots: this.slots.length }, 'crowd simulator started');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Fresh day (or a jump): everyone back in the hallways, all seats free. */
  resetDay(at: number) {
    seed = 42;
    venue.reset();
    newRun();
    this.decided.clear();
    this.events = [];
    this.turnedAway = 0;
    const tracks = [...new Set(ROOMS.filter((r) => r.kind === 'session').map((r) => r.track))];
    this.agents = Array.from({ length: AGENTS }, (_, id) => {
      const affinity = new Map(tracks.map((t) => [t, 1]));
      affinity.set(pick(tracks), 4);
      affinity.set(pick(tracks), 3);
      return { id, people: PEOPLE_PER_AGENT, state: 'idle' as AgentState, at: pick([...HALLWAY, 'GB']), affinity };
    });
    // Slots whose decision time already passed are decided now, so a jump
    // into the middle of the day still fills the rooms.
    for (const slot of this.slots) {
      if (at >= slot.start - DECIDE_BEFORE_MIN * MIN && at < slot.end) this.decide(slot, at);
      else if (at >= slot.end) this.decided.add(slot.id);
    }
    this.agents.forEach((a) => this.changed.add(a.id));
  }

  jump(at: number) {
    clock.set(at);
    this.resetDay(at);
    hub.broadcast({ type: 'snapshot', data: this.snapshot() });
  }

  currentTalk(roomId: string, now = clock.now()): string | null {
    for (const slot of this.slots) {
      if (now >= slot.start - 15 * MIN && now < slot.end) {
        return slot.talks.find((t) => t.roomId === roomId)?.id ?? null;
      }
    }
    return null;
  }

  private decide(slot: Slot, now: number) {
    this.decided.add(slot.id);
    for (const a of this.agents) {
      if (a.state === 'waiting' || a.pendingPlanB || a.state === 'seated') continue;
      a.rerouted = false;
      let dest: string;
      if (rand() < SKIP_PROBABILITY) {
        dest = pick(HALLWAY);
        a.talkId = undefined;
      } else {
        const talk = weightedPick(slot.talks, (t) => t.interest * (a.affinity.get(t.track) ?? 1));
        dest = talk.roomId;
        a.talkId = talk.id;
      }
      this.walk(a, dest, now + rand() * 9 * MIN);
    }
  }

  private walk(a: Agent, dest: string, depart: number, stepFree = false) {
    const from = ROOM_BY_ID.get(a.at)!;
    const to = ROOM_BY_ID.get(dest)!;
    a.state = 'walking';
    a.to = dest;
    a.depart = depart;
    a.arrive = depart + walkMinutes(from, to, { stepFree }) * MIN;
    this.changed.add(a.id);
  }

  private settle(a: Agent, state: AgentState, at: string) {
    a.state = state;
    a.at = at;
    a.to = undefined;
    a.depart = undefined;
    a.arrive = undefined;
    this.changed.add(a.id);
  }

  private tick() {
    let now = clock.now();
    if (now >= DAY_END) {
      clock.set(DAY_START);
      now = DAY_START;
      this.resetDay(now);
      hub.broadcast({ type: 'snapshot', data: this.snapshot() });
    }
    venue.expireHolds(now);

    for (const slot of this.slots) {
      if (!this.decided.has(slot.id) && now >= slot.start - DECIDE_BEFORE_MIN * MIN && now < slot.end) {
        this.decide(slot, now);
      }
    }

    const talkEnd = new Map(loadData().talks.map((t) => [t.id, Date.parse(t.end)]));
    const waiting = new Map<string, Agent[]>();
    for (const a of this.agents) {
      if (a.state === 'seated' && a.talkId && (talkEnd.get(a.talkId) ?? 0) <= now) {
        venue.leave(a.at, a.people);
        const nextSlot = this.slots.find((s) => s.start > now);
        const lunch = nextSlot && nextSlot.start - now > 40 * MIN;
        a.talkId = undefined;
        this.settle(a, 'idle', a.at);
        if (lunch || !nextSlot) this.walk(a, lunch ? pick(['GB', 'LOUNGE', 'YUZU']) : 'LOUNGE', now + rand() * 4 * MIN);
      } else if (a.state === 'walking' && a.arrive !== undefined && a.arrive <= now) {
        this.arrive(a, now);
      }
      if (a.state === 'waiting' && !a.pendingPlanB && a.talkId) {
        waiting.set(a.talkId, [...(waiting.get(a.talkId) ?? []), a]);
      }
    }

    for (const [talkId, group] of waiting) {
      const oldest = Math.min(...group.map((a) => a.waitingSince ?? now));
      if (now - oldest >= PLANB_BATCH_MS) void this.reroute(talkId, group);
    }

    if (this.changed.size) {
      const views = [...this.changed].map((id) => this.view(this.agents[id]));
      this.changed.clear();
      hub.broadcast({ type: 'agents', data: views });
    }
    const realNow = performance.now();
    if (realNow - this.lastTick >= 1000) {
      this.lastTick = realNow;
      hub.broadcast({ type: 'tick', data: { clock: clock.state(), rooms: this.rooms(), turnedAway: this.turnedAway } });
    }
  }

  private arrive(a: Agent, now: number) {
    const dest = a.to!;
    const room = ROOM_BY_ID.get(dest)!;
    if (room.kind !== 'session') {
      this.settle(a, 'idle', dest);
      return;
    }
    if (a.holdId) {
      const claimed = venue.claim(a.holdId);
      a.holdId = undefined;
      if (claimed) {
        this.settle(a, 'seated', dest);
        return;
      }
    }
    if (venue.enter(dest, a.people)) {
      this.settle(a, 'seated', dest);
    } else {
      this.turnedAway += a.people;
      a.waitingSince = now;
      this.settle(a, 'waiting', dest);
    }
  }

  /** One Plan B decision for everyone waiting at a full room's door. */
  private async reroute(talkId: string, group: Agent[]) {
    group.forEach((a) => (a.pendingPlanB = true));
    await tracer.startActiveSpan('capykube.sim.reroute', async (span) => {
      const started = performance.now();
      try {
        const now = clock.now();
        const preview = await previewPlanB(talkId, now, { people: PEOPLE_PER_AGENT, limit: 6 });
        const tally = new Map<string, { talkId: string; title: string; roomId: string; people: number; score: number }>();
        let unplaced = 0;
        for (const a of group) {
          const bound = bindSeats(preview.candidates, a.people, clock.now(), 'sim');
          a.pendingPlanB = false;
          a.waitingSince = undefined;
          if (bound) {
            const c = bound.candidate;
            a.holdId = bound.hold.id;
            a.talkId = c.talk.id;
            a.rerouted = true;
            this.walk(a, c.roomId, clock.now());
            const t = tally.get(c.talk.id) ?? { talkId: c.talk.id, title: c.talk.title, roomId: c.roomId, people: 0, score: c.scores.total };
            t.people += a.people;
            tally.set(c.talk.id, t);
          } else {
            unplaced += a.people;
            a.talkId = undefined;
            this.walk(a, pick(['SPRING', 'LOUNGE']), clock.now());
          }
        }
        const event: PlanBEvent = {
          at: now,
          source: 'sim',
          from: { talkId, title: preview.from.title, roomId: preview.from.roomId },
          people: group.length * PEOPLE_PER_AGENT,
          placements: [...tally.values()].sort((x, y) => y.people - x.people),
          unplaced,
          latencyMs: Math.round(performance.now() - started),
        };
        span.setAttributes({ 'capykube.planb.people': event.people, 'capykube.planb.unplaced': unplaced });
        this.pushEvent(event);
        recordPlanB(event, preview.from, { quiet: false, stepFree: false });
      } catch (err) {
        span.recordException(err as Error);
        log.warn({ err: (err as Error).message, talkId }, 'sim reroute failed; will retry');
        group.forEach((a) => {
          a.pendingPlanB = false;
          a.waitingSince = clock.now();
        });
      } finally {
        span.end();
      }
    });
  }

  pushEvent(event: PlanBEvent) {
    this.events = [event, ...this.events].slice(0, 30);
    hub.broadcast({ type: 'planb', data: event });
  }

  private view(a: Agent): AgentView {
    return { id: a.id, people: a.people, state: a.state, at: a.at, to: a.to, depart: a.depart, arrive: a.arrive, rerouted: a.rerouted };
  }

  rooms() {
    return venue.snapshot((id) => this.currentTalk(id));
  }

  snapshot(): LiveSnapshot {
    return {
      clock: clock.state(),
      rooms: this.rooms(),
      agents: this.agents.map((a) => this.view(a)),
      events: this.events,
      turnedAway: this.turnedAway,
    };
  }

  /** People walking or waiting right now, for the occupancy gauges. */
  counts() {
    let walking = 0;
    let waiting = 0;
    for (const a of this.agents) {
      if (a.state === 'walking') walking += a.people;
      if (a.state === 'waiting') waiting += a.people;
    }
    return { walking, waiting };
  }
}

export const simulator = new Simulator();
