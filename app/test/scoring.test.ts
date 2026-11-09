import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS, QUIET_WEIGHTS, scoreBreakdown } from '../src/shared/scoring';
import { ROOM_BY_ID, walkMinutes } from '../src/shared/venue';
import { SimClock } from '../src/server/clock';

const from = ROOM_BY_ID.get('155E')!;

describe('walking times', () => {
  it('is quicker next door than two floors up', () => {
    expect(walkMinutes(from, ROOM_BY_ID.get('155F')!)).toBeLessThan(walkMinutes(from, ROOM_BY_ID.get('355A')!));
  });

  it('takes longer by elevator than escalator', () => {
    const up = ROOM_BY_ID.get('251')!;
    expect(walkMinutes(from, up, { stepFree: true })).toBeGreaterThan(walkMinutes(from, up));
  });
});

describe('Plan B scoring', () => {
  // The 2:00 PM demo: the eBPF security talk in 155 E is full.
  const zeroTrust = { cosine: 0.61, walkMinutes: walkMinutes(from, ROOM_BY_ID.get('251')!), seatsOpenRatio: 0.2, minutesLate: -4 };
  const escapes = { cosine: 0.564, walkMinutes: walkMinutes(from, ROOM_BY_ID.get('355A')!), seatsOpenRatio: 0.55, minutesLate: -4 };
  const unrelated = { cosine: 0.4, walkMinutes: 1, seatsOpenRatio: 0.6, minutesLate: -4 };

  it('prefers the closest topic by default', () => {
    expect(scoreBreakdown(zeroTrust, DEFAULT_WEIGHTS).total).toBeGreaterThan(scoreBreakdown(escapes, DEFAULT_WEIGHTS).total);
    expect(scoreBreakdown(escapes, DEFAULT_WEIGHTS).total).toBeGreaterThan(scoreBreakdown(unrelated, DEFAULT_WEIGHTS).total);
  });

  it('picks the emptier room in quiet mode', () => {
    expect(scoreBreakdown(escapes, QUIET_WEIGHTS).total).toBeGreaterThan(scoreBreakdown(zeroTrust, QUIET_WEIGHTS).total);
  });

  it('stops favoring a talk that started long ago', () => {
    const late = scoreBreakdown({ ...zeroTrust, minutesLate: 12 }, DEFAULT_WEIGHTS);
    expect(late.start).toBe(0);
  });
});

describe('demo clock', () => {
  it('runs at speed, pauses and jumps', () => {
    let real = 0;
    const c = new SimClock(1_000, 10, () => real);
    real = 100;
    expect(c.now()).toBe(2_000);
    c.pause();
    real = 500;
    expect(c.now()).toBe(2_000);
    c.resume();
    real = 600;
    expect(c.now()).toBe(3_000);
    c.set(50_000);
    expect(c.now()).toBe(50_000);
  });
});
