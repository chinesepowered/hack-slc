import { beforeEach, describe, expect, it } from 'vitest';
import { VenueState } from '../src/server/venue-state';

// Room 151 has 180 seats.
describe('seat accounting', () => {
  let v: VenueState;
  beforeEach(() => {
    v = new VenueState();
  });

  it('never lets walk-ins past capacity', () => {
    expect(v.enter('151', 170)).toBe(true);
    expect(v.enter('151', 20)).toBe(false);
    expect(v.enter('151', 10)).toBe(true);
    expect(v.seatsOpen('151')).toBe(0);
    expect(v.isClosed('151')).toBe(true);
  });

  it('counts held seats against capacity', () => {
    v.enter('151', 150);
    const hold = v.hold('151', 't-151-s4', 25, 1_000, 'sim');
    expect(hold).not.toBeNull();
    expect(v.seatsOpen('151')).toBe(5);
    expect(v.hold('151', 't-151-s4', 10, 1_000, 'sim')).toBeNull();
    expect(v.enter('151', 10)).toBe(false);
  });

  it('turns a claimed hold into occupied seats', () => {
    const hold = v.hold('151', 't-151-s4', 10, 1_000, 'attendee')!;
    expect(v.claim(hold.id)).toBe(true);
    expect(v.claim(hold.id)).toBe(false);
    const status = v.snapshot(() => null).find((r) => r.id === '151')!;
    expect(status.present).toBe(10);
    expect(status.held).toBe(0);
  });

  it('expires holds', () => {
    v.hold('151', 't-151-s4', 30, 1_000, 'sim');
    v.hold('151', 't-151-s4', 30, 5_000, 'sim');
    expect(v.expireHolds(2_000)).toBe(1);
    expect(v.seatsOpen('151')).toBe(150);
  });

  it('lets door staff close a room that still has seats', () => {
    v.setDoorFull('151', true);
    expect(v.enter('151', 1)).toBe(false);
    expect(v.hold('151', 't-151-s4', 1, 1_000, 'attendee')).toBeNull();
    const status = v.snapshot(() => null).find((r) => r.id === '151')!;
    expect(status.full).toBe(true);
    expect(status.fullSource).toBe('door');
  });
});
