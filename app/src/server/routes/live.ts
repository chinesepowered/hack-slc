import type { FastifyInstance, FastifyRequest } from 'fastify';
import { clock } from '../clock';
import { venue } from '../venue-state';
import { simulator } from '../simulator';
import { hub } from '../live';
import { bindSeats, previewPlanB, recordPlanB } from '../scheduler';
import { capyNote } from '../capy-note';
import { insights } from '../insights';
import { localMood } from '../capy-mood';
import { dash0Mood } from '../dash0-slo';
import { ROOM_BY_ID } from '../../shared/venue';
import type { CapyMoodResponse, Insights, LiveSnapshot, PlanBHoldResponse, PlanBPreview } from '../../shared/live-types';

const bool = (v: unknown) => v === true || v === 'true' || v === '1';

/** Demo controls need OPS_KEY when it's set, so passers-by can't move the clock. */
function opsAllowed(req: FastifyRequest): boolean {
  const key = process.env.OPS_KEY;
  return !key || req.headers['x-ops-key'] === key;
}

export async function liveRoutes(app: FastifyInstance) {
  app.get('/api/live/snapshot', async (): Promise<LiveSnapshot> => simulator.snapshot());

  app.get('/api/live/stream', (_req, reply) => {
    hub.add(reply, { type: 'snapshot', data: simulator.snapshot() });
  });

  app.get<{ Querystring: { talkId?: string; quiet?: string; stepFree?: string } }>(
    '/api/planb',
    async (req, reply): Promise<PlanBPreview | void> => {
      if (!req.query.talkId) return reply.code(400).send({ error: 'talkId is required' });
      return previewPlanB(req.query.talkId, clock.now(), {
        quiet: bool(req.query.quiet),
        stepFree: bool(req.query.stepFree),
        limit: 3,
      });
    },
  );

  app.post<{ Body: { fromTalkId?: string; toTalkId?: string; quiet?: boolean; stepFree?: boolean } }>(
    '/api/planb/hold',
    async (req, reply): Promise<PlanBHoldResponse | void> => {
      const { fromTalkId, toTalkId } = req.body ?? {};
      if (!fromTalkId) return reply.code(400).send({ error: 'fromTalkId is required' });
      const started = performance.now();
      const quiet = bool(req.body.quiet);
      const stepFree = bool(req.body.stepFree);
      const preview = await previewPlanB(fromTalkId, clock.now(), { quiet, stepFree, limit: 5 });
      const bound = bindSeats(preview.candidates, 1, clock.now(), 'attendee', toTalkId);
      if (!bound) return reply.code(409).send({ error: 'no seats left in any Plan B room' });
      const note = await capyNote(preview.from, bound.candidate);
      const event = {
        at: clock.now(),
        source: 'attendee' as const,
        from: { talkId: preview.from.id, title: preview.from.title, roomId: preview.from.roomId },
        people: 1,
        placements: [
          {
            talkId: bound.candidate.talk.id,
            title: bound.candidate.talk.title,
            roomId: bound.candidate.roomId,
            people: 1,
            score: bound.candidate.scores.total,
          },
        ],
        unplaced: 0,
        latencyMs: Math.round(performance.now() - started),
      };
      simulator.pushEvent(event);
      recordPlanB(event, preview.from, { quiet, stepFree });
      return { hold: bound.hold, note };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/planb/hold/:id', async (req) => {
    venue.release(req.params.id);
    return { released: true };
  });

  // Door staff: one tap closes a room, even before the counts say it's full.
  app.post<{ Params: { id: string }; Body: { full?: boolean } }>('/api/rooms/:id/door', async (req, reply) => {
    if (!opsAllowed(req)) return reply.code(403).send({ error: 'ops key required' });
    const room = ROOM_BY_ID.get(req.params.id);
    if (!room || room.kind !== 'session') return reply.code(404).send({ error: 'room not found' });
    const full = bool(req.body?.full);
    venue.setDoorFull(room.id, full);
    hub.broadcast({ type: 'door', data: { roomId: room.id, full } });
    return { roomId: room.id, full };
  });

  app.post<{ Body: { at?: string | number; speed?: number; paused?: boolean } }>('/api/sim/clock', async (req, reply) => {
    if (!opsAllowed(req)) return reply.code(403).send({ error: 'ops key required' });
    const { at, speed, paused } = req.body ?? {};
    if (at !== undefined) {
      const t = typeof at === 'number' ? at : Date.parse(at);
      if (!Number.isFinite(t)) return reply.code(400).send({ error: 'at must be a time' });
      simulator.jump(t);
    }
    if (typeof speed === 'number') clock.setSpeed(speed);
    if (paused === true) clock.pause();
    if (paused === false) clock.resume();
    return clock.state();
  });

  app.get('/api/insights', async (): Promise<Insights> => insights());

  app.get('/api/capy', async (): Promise<CapyMoodResponse> => (await dash0Mood()) ?? localMood());
}
