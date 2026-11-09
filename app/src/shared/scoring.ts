// The scheduler's Score phase, like kube-scheduler score plugins. These
// weights are the only place scoring is tuned. Elasticsearch computes the
// same formula in Painless (app/src/server/scheduler.ts) to rank candidates;
// scoreBreakdown() mirrors it so people can see why a talk won.

export interface Weights {
  /** TopicAffinity: how close the talk is in meaning to the one you missed. */
  topic: number;
  /** WalkTime: shorter walks score higher. */
  walk: number;
  /** SeatsFit: emptier rooms score higher (like NodeResourcesFit LeastAllocated). */
  seats: number;
  /** StartSoon: talks that haven't started, or only just did. */
  start: number;
}

export const DEFAULT_WEIGHTS: Weights = { topic: 0.55, walk: 0.2, seats: 0.15, start: 0.1 };
/** Quiet mode trades a little topic match for a calmer, emptier room. */
export const QUIET_WEIGHTS: Weights = { topic: 0.45, walk: 0.15, seats: 0.3, start: 0.1 };

/** Cosine similarities between talk embeddings sit between ~0.25 and ~0.75. */
export const TOPIC_FLOOR = 0.25;
export const TOPIC_SPAN = 0.5;
/** Walk score halves roughly every 2.8 minutes. */
export const WALK_DECAY_MIN = 4;
/** A talk that started this long ago scores zero on StartSoon. */
export const LATE_LIMIT_MIN = 10;

export interface ScoreInputs {
  cosine: number;
  walkMinutes: number;
  /** Open seats as a fraction of capacity, 0..1. */
  seatsOpenRatio: number;
  /** Minutes since the talk started; negative if it hasn't. */
  minutesLate: number;
}

export interface ScoreBreakdown {
  topic: number;
  walk: number;
  seats: number;
  start: number;
  total: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function scoreBreakdown(inputs: ScoreInputs, weights: Weights): ScoreBreakdown {
  const topic = clamp01((inputs.cosine - TOPIC_FLOOR) / TOPIC_SPAN);
  const walk = Math.exp(-inputs.walkMinutes / WALK_DECAY_MIN);
  const seats = clamp01(inputs.seatsOpenRatio);
  const start = inputs.minutesLate <= 0 ? 1 : clamp01(1 - inputs.minutesLate / LATE_LIMIT_MIN);
  const total = weights.topic * topic + weights.walk * walk + weights.seats * seats + weights.start * start;
  return { topic, walk, seats, start, total };
}
