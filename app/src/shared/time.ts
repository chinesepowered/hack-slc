// Times are stored and compared as UTC (ISO strings or epoch ms). People only
// ever see them through these helpers, which render in the venue's time zone.
export const VENUE_TIME_ZONE = 'America/Denver';
export const VENUE_TZ_LABEL = 'MT';

type TimeInput = string | number | Date;

const toDate = (t: TimeInput): Date => (t instanceof Date ? t : new Date(t));

const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: VENUE_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

const dayFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: VENUE_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

/** "2:05 PM" in Mountain Time. */
export function formatVenueTime(t: TimeInput): string {
  return timeFormat.format(toDate(t));
}

/** "2:00 – 2:30 PM MT" (drops the first meridiem when both match). */
export function formatVenueRange(start: TimeInput, end: TimeInput): string {
  const a = formatVenueTime(start);
  const b = formatVenueTime(end);
  const [aTime, aMer] = a.split(' ');
  const [, bMer] = b.split(' ');
  const left = aMer === bMer ? aTime : a;
  return `${left} – ${b} ${VENUE_TZ_LABEL}`;
}

/** "Wed, Nov 11" in Mountain Time. */
export function formatVenueDay(t: TimeInput): string {
  return dayFormat.format(toDate(t));
}

/** Whole minutes from a to b (negative when b is before a). */
export function minutesBetween(a: TimeInput, b: TimeInput): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 60_000);
}

/** "in 4 min", "now", "started 6 min ago". */
export function relativeStart(now: TimeInput, start: TimeInput): string {
  const m = minutesBetween(now, start);
  if (m > 0) return `in ${m} min`;
  if (m === 0) return 'now';
  return `started ${-m} min ago`;
}
