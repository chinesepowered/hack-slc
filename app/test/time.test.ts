import { describe, expect, it } from 'vitest';
import { formatVenueDay, formatVenueRange, formatVenueTime, minutesBetween, relativeStart } from '../src/shared/time';

describe('venue time', () => {
  // KubeCon NA 2026 is after the Nov 1 DST change, so Salt Lake City is UTC-7.
  it('renders UTC instants in Mountain Time', () => {
    expect(formatVenueTime('2026-11-11T21:00:00Z')).toBe('2:00 PM');
    expect(formatVenueTime('2026-11-11T16:05:00Z')).toBe('9:05 AM');
  });

  it('formats ranges with one meridiem when both ends match', () => {
    expect(formatVenueRange('2026-11-11T21:00:00Z', '2026-11-11T21:30:00Z')).toBe('2:00 – 2:30 PM MT');
    expect(formatVenueRange('2026-11-11T18:45:00Z', '2026-11-11T19:15:00Z')).toBe('11:45 AM – 12:15 PM MT');
  });

  it('labels the venue day, not the UTC day', () => {
    // 11:30 PM MT on Wednesday is already Thursday in UTC.
    expect(formatVenueDay('2026-11-12T06:30:00Z')).toBe('Wed, Nov 11');
  });

  it('describes relative start times', () => {
    expect(minutesBetween('2026-11-11T21:00:00Z', '2026-11-11T21:04:00Z')).toBe(4);
    expect(relativeStart('2026-11-11T21:00:00Z', '2026-11-11T21:04:00Z')).toBe('in 4 min');
    expect(relativeStart('2026-11-11T21:06:00Z', '2026-11-11T21:00:00Z')).toBe('started 6 min ago');
  });
});
