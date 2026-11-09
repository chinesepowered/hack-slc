// The Plan B scheduler. Like kube-scheduler, in three phases:
//   Filter: talks that start within minutes, in rooms with open seats
//           (step-free only, if asked), excluding the full room.
//   Score:  TopicAffinity + WalkTime + SeatsFit + StartSoon, computed by
//           Elasticsearch in Painless over the talk embeddings.
//   Bind:   hold seats, re-checking the room synchronously so two requests
//           can never promise the same seat.
// Filter and Score are one Elasticsearch query.
import { randomUUID } from 'node:crypto';
import type { estypes } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import { es } from './es';
import { INDEX } from './es-mappings';
import { loadData } from './data';
import { venue } from './venue-state';
import { planbDuration, planbPeople, planbRequests, planbUnplaced } from './metrics';
import { log } from './log';
import { observePlanB } from './capy-mood';
import { ROOM_BY_ID, walkMinutes } from '../shared/venue';
import {
  DEFAULT_WEIGHTS,
  LATE_LIMIT_MIN,
  QUIET_WEIGHTS,
  TOPIC_FLOOR,
  TOPIC_SPAN,
  WALK_DECAY_MIN,
  scoreBreakdown,
  type Weights,
} from '../shared/scoring';
import type { Talk } from '../shared/api-types';
import type { PlanBCandidate, PlanBEvent, PlanBPreview, SeatHold } from '../shared/live-types';

const MIN = 60_000;
/** Plan B considers talks that started up to 10 minutes ago or start within 15. */
const WINDOW_BEFORE_MIN = 10;
const WINDOW_AFTER_MIN = 15;
/** Held seats wait this long past the expected arrival. */
const HOLD_GRACE_MIN = 6;

// Mirrors scoreBreakdown() in app/src/shared/scoring.ts.
const SCORE_SCRIPT = `
  double cos = cosineSimilarity(params.v, 'embedding');
  double topic = Math.min(1.0, Math.max(0.0, (cos - params.topicFloor) / params.topicSpan));
  String room = doc['roomId'].value;
  double walkMin = params.walk.containsKey(room) ? params.walk.get(room) : 30.0;
  double walk = Math.exp(-walkMin / params.walkDecay);
  double seats = params.seats.containsKey(room) ? params.seats.get(room) : 0.0;
  double late = (params.now - doc['start'].value.toInstant().toEpochMilli()) / 60000.0;
  double start = late <= 0 ? 1.0 : Math.max(0.0, 1.0 - late / params.lateLimit);
  return params.w.topic * topic + params.w.walk * walk + params.w.seats * seats + params.w.start * start;
`;

export interface PlanBOptions {
  quiet?: boolean;
  stepFree?: boolean;
  /** People who need seats together; rooms with fewer open seats are filtered out. */
  people?: number;
  limit?: number;
}

function talkById(id: string): Talk | undefined {
  return loadData().talks.find((t) => t.id === id);
}

/** The time Plan B plans for: now, but never more than 20 minutes before the missed talk. */
export function planningTime(now: number, from: Talk): number {
  const start = Date.parse(from.start);
  return Math.min(Math.max(now, start - 20 * MIN), Date.parse(from.end));
}

export async function previewPlanB(fromTalkId: string, now: number, opts: PlanBOptions = {}): Promise<PlanBPreview> {
  const started = performance.now();
  const from = talkById(fromTalkId);
  if (!from) throw Object.assign(new Error('talk not found'), { statusCode: 404 });
  const vector = loadData().vectors.get(from.id);
  if (!vector) throw new Error(`no embedding for ${from.id}`);
  const fromRoom = ROOM_BY_ID.get(from.roomId)!;
  const at = planningTime(now, from);
  const people = Math.max(1, opts.people ?? 1);
  const weights: Weights = opts.quiet ? QUIET_WEIGHTS : DEFAULT_WEIGHTS;

  // Filter inputs: which rooms can take these people right now.
  const filtered: PlanBPreview['filtered'] = [];
  const walk: Record<string, number> = {};
  const seats: Record<string, number> = {};
  const eligible: string[] = [];
  for (const room of ROOM_BY_ID.values()) {
    if (room.kind !== 'session' || room.id === from.roomId) continue;
    if (opts.stepFree && !room.stepFree) {
      filtered.push({ roomId: room.id, reason: room.note ?? 'not step-free' });
      continue;
    }
    const open = venue.seatsOpen(room.id);
    if (venue.isClosed(room.id) || open < people) {
      filtered.push({ roomId: room.id, reason: open === 0 ? 'full' : `only ${open} seats` });
      continue;
    }
    eligible.push(room.id);
    walk[room.id] = walkMinutes(fromRoom, room, { stepFree: opts.stepFree });
    seats[room.id] = open / room.capacity;
  }

  const request: estypes.SearchRequest = {
    index: INDEX.talks,
    size: Math.min(opts.limit ?? 5, 10),
    timeout: '2s',
    _source: { excludes: ['embedding'] },
    fields: [],
    query: {
      script_score: {
        query: {
          bool: {
            filter: [
              { term: { kind: 'session' } },
              { terms: { roomId: eligible } },
              {
                range: {
                  start: {
                    gte: new Date(at - WINDOW_BEFORE_MIN * MIN).toISOString(),
                    lte: new Date(at + WINDOW_AFTER_MIN * MIN).toISOString(),
                  },
                },
              },
            ],
            must_not: [{ term: { id: from.id } }],
          },
        },
        script: {
          source: SCORE_SCRIPT,
          params: {
            v: vector,
            walk,
            seats,
            now: at,
            w: weights,
            topicFloor: TOPIC_FLOOR,
            topicSpan: TOPIC_SPAN,
            walkDecay: WALK_DECAY_MIN,
            lateLimit: LATE_LIMIT_MIN,
          },
        },
      },
    },
  };

  const res = eligible.length ? await es.search<Talk>(request) : null;
  const vectors = loadData().vectors;
  const candidates: PlanBCandidate[] = (res?.hits.hits ?? [])
    .filter((h) => h._source)
    .map((h) => {
      const talk = h._source as Talk;
      const room = ROOM_BY_ID.get(talk.roomId)!;
      const cosine = cosineSimilarity(vector, vectors.get(talk.id) ?? vector);
      const minutesLate = (at - Date.parse(talk.start)) / MIN;
      const scores = scoreBreakdown(
        { cosine, walkMinutes: walk[room.id] ?? 30, seatsOpenRatio: seats[room.id] ?? 0, minutesLate },
        weights,
      );
      return {
        talk,
        roomId: room.id,
        roomName: room.name,
        walkMinutes: walk[room.id] ?? 30,
        seatsOpen: venue.seatsOpen(room.id),
        startsInMinutes: Math.round(-minutesLate),
        scores: { ...scores, total: h._score ?? scores.total },
      };
    });

  const tookMs = Math.round(performance.now() - started);
  trace.getActiveSpan()?.setAttributes({
    'capykube.planb.from_talk': from.id,
    'capykube.planb.from_room': from.roomId,
    'capykube.planb.quiet': Boolean(opts.quiet),
    'capykube.planb.step_free': Boolean(opts.stepFree),
    'capykube.planb.eligible_rooms': eligible.length,
    'capykube.planb.candidates': candidates.length,
  });

  return {
    from,
    fromRoomName: fromRoom.name,
    quiet: Boolean(opts.quiet),
    stepFree: Boolean(opts.stepFree),
    candidates,
    filtered,
    query: shortenVector(request),
    tookMs,
    at,
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function shortenVector(request: estypes.SearchRequest): unknown {
  const copy = JSON.parse(JSON.stringify(request));
  const params = copy.query?.script_score?.script?.params;
  if (params?.v) params.v = [...params.v.slice(0, 3).map((x: number) => Number(x.toFixed(4))), `… ${params.v.length - 3} more`];
  return copy;
}

/** Bind: hold seats in the best candidate that still has room, re-checked now. */
export function bindSeats(
  candidates: PlanBCandidate[],
  people: number,
  now: number,
  source: 'sim' | 'attendee',
  preferTalkId?: string,
): { hold: SeatHold; candidate: PlanBCandidate } | null {
  const ordered = preferTalkId
    ? [...candidates.filter((c) => c.talk.id === preferTalkId), ...candidates.filter((c) => c.talk.id !== preferTalkId)]
    : candidates;
  for (const c of ordered) {
    const expiresAt = now + (c.walkMinutes + HOLD_GRACE_MIN) * MIN;
    const hold = venue.hold(c.roomId, c.talk.id, people, expiresAt, source);
    if (hold) return { hold, candidate: c };
  }
  return null;
}

/** Records one Plan B decision: metrics now, an Elasticsearch document in the background. */
export function recordPlanB(event: PlanBEvent, from: Talk, extra: { quiet: boolean; stepFree: boolean }) {
  const attrs = { source: event.source, quiet: extra.quiet, step_free: extra.stepFree };
  planbRequests.add(1, attrs);
  planbDuration.record(event.latencyMs, { source: event.source });
  observePlanB(event.latencyMs, event.unplaced);
  planbPeople.add(event.people, { track: from.track, source: event.source });
  if (event.unplaced > 0) planbUnplaced.add(event.unplaced, { track: from.track });

  es.index({
    index: INDEX.planb,
    document: {
      '@timestamp': new Date().toISOString(),
      simTime: new Date(event.at).toISOString(),
      runId: currentRunId,
      source: event.source,
      fromTalkId: from.id,
      fromRoomId: from.roomId,
      fromTitle: from.title,
      track: from.track,
      tags: from.tags,
      people: event.people,
      placed: event.people - event.unplaced,
      unplaced: event.unplaced,
      quiet: extra.quiet,
      stepFree: extra.stepFree,
      latencyMs: event.latencyMs,
      placements: event.placements.map((p) => ({ talkId: p.talkId, roomId: p.roomId, people: p.people, score: p.score })),
    },
  }).catch((err) => log.warn({ err: (err as Error).message }, 'could not record a Plan B event'));
}

/** Identifies one simulated day, so insights can ignore earlier runs. */
export let currentRunId = `run-${randomUUID().slice(0, 8)}`;
export function newRun() {
  currentRunId = `run-${randomUUID().slice(0, 8)}`;
}
