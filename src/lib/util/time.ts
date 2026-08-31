/**
 * Business time.
 *
 * Wash slots are wall-clock times ("09:00") in the timezone the business
 * operates in, not UTC. Treating them as UTC drifts the working day by the
 * zone offset — with a round that runs 7 AM to noon, a 5h30m drift moves half
 * the day into yesterday and breaks both the on-time bonus and "today's cars".
 *
 * Everything that turns a slot into an instant, or asks what day it is,
 * goes through here.
 */
export const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE ?? 'Asia/Kolkata';

/** The zone's offset from UTC, in ms, at a given instant (DST-aware). */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // `hour12: false` renders midnight as 24 in some engines.
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUtc - at.getTime();
}

/**
 * The instant a wall-clock slot occurs, e.g. `2026-08-31` + `09:00` in
 * Asia/Kolkata is 03:30 UTC.
 */
export function slotInstant(
  date: string,
  hhmm: string,
  timeZone = BUSINESS_TIMEZONE,
): Date {
  const naive = new Date(`${date}T${hhmm}:00.000Z`);
  // Offset is computed at the naive instant, which is within a few hours of
  // the true one — close enough that a DST boundary resolves correctly.
  return new Date(naive.getTime() - zoneOffsetMs(naive, timeZone));
}

/** Today's date in the business timezone, `YYYY-MM-DD`. */
export function businessToday(
  now = new Date(),
  timeZone = BUSINESS_TIMEZONE,
): string {
  return new Date(now.getTime() + zoneOffsetMs(now, timeZone))
    .toISOString()
    .slice(0, 10);
}

/** The current billing cycle in the business timezone, `YYYY-MM`. */
export function businessCycle(
  now = new Date(),
  timeZone = BUSINESS_TIMEZONE,
): string {
  return businessToday(now, timeZone).slice(0, 7);
}

/** The current wall-clock time in the business timezone, `HH:mm`. */
export function businessClock(
  now = new Date(),
  timeZone = BUSINESS_TIMEZONE,
): string {
  return new Date(now.getTime() + zoneOffsetMs(now, timeZone))
    .toISOString()
    .slice(11, 16);
}
