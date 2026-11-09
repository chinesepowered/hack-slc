import { describe, expect, it } from 'vitest';
import { DAY_END, DAY_START, loopWindow, wrapTarget } from '../src/server/clock';

const at = (iso: string) => Date.parse(iso);
const rush = { start: at('2026-11-11T20:42:00Z'), end: at('2026-11-11T21:14:00Z') };

describe('loopWindow', () => {
  it('is off unless both ends are set', () => {
    expect(loopWindow({})).toBeNull();
    expect(loopWindow({ SIM_LOOP_START: '2026-11-11T20:42:00Z' })).toBeNull();
  });

  it('reads a window inside the day', () => {
    expect(loopWindow({ SIM_LOOP_START: '2026-11-11T20:42:00Z', SIM_LOOP_END: '2026-11-11T21:14:00Z' })).toEqual(rush);
  });

  it('ignores a window that is outside the day, backwards or too short', () => {
    expect(loopWindow({ SIM_LOOP_START: '2026-11-10T20:42:00Z', SIM_LOOP_END: '2026-11-11T21:14:00Z' })).toBeNull();
    expect(loopWindow({ SIM_LOOP_START: '2026-11-11T21:14:00Z', SIM_LOOP_END: '2026-11-11T20:42:00Z' })).toBeNull();
    expect(loopWindow({ SIM_LOOP_START: '2026-11-11T20:42:00Z', SIM_LOOP_END: '2026-11-11T20:44:00Z' })).toBeNull();
    expect(loopWindow({ SIM_LOOP_START: 'soon', SIM_LOOP_END: 'later' })).toBeNull();
  });
});

describe('wrapTarget', () => {
  it('keeps going in the middle of the day', () => {
    expect(wrapTarget(rush.start, rush.start + 1000, null)).toBeNull();
    expect(wrapTarget(rush.start, rush.start + 1000, rush)).toBeNull();
  });

  it('wraps the day to its start', () => {
    expect(wrapTarget(DAY_END - 1000, DAY_END, null)).toBe(DAY_START);
  });

  it('restarts the replay window when the clock runs past its end', () => {
    expect(wrapTarget(rush.end - 1000, rush.end + 4000, rush)).toBe(rush.start);
  });

  it('leaves a jump beyond the window alone', () => {
    const later = at('2026-11-11T22:16:00Z');
    expect(wrapTarget(later, later + 5000, rush)).toBeNull();
  });

  it('returns to the replay window when the day ends', () => {
    expect(wrapTarget(DAY_END - 1000, DAY_END, rush)).toBe(rush.start);
  });
});
