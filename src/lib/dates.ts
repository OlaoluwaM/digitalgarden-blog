const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

/**
 * Format a note date as Eleventy's Luxon format `MMM dd, yyyy` ("Mar 20, 2026").
 *
 * Note dates are written without a time zone ("2026-03-20T15:42"), so the
 * calendar date is taken as written. Eleventy formatted them in each
 * reader's browser time zone instead; see docs/design-changes.md.
 */
export function formatNoteDate(value: string): string {
  const match = DATE_PREFIX.exec(value);
  if (!match) {
    throw new Error(`Cannot format note date "${value}": expected YYYY-MM-DD.`);
  }

  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  const calendarDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day))
  );
  if (
    !monthName ||
    calendarDate.getUTCMonth() !== Number(month) - 1 ||
    calendarDate.getUTCDate() !== Number(day)
  ) {
    throw new Error(`Cannot format note date "${value}": not a real date.`);
  }

  return `${monthName} ${day}, ${year}`;
}

const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * The moment a note date names, read as wall-clock time in `timeZone`.
 *
 * Note dates are written without a zone ("2026-03-20T15:42"), in the
 * author's local time. The feed needs an exact moment, so the zone's offset
 * on that date (daylight saving included) is applied.
 */
export function noteInstant(value: string, timeZone: string): Date {
  const match = DATE_TIME.exec(value);
  if (!match) {
    throw new Error(
      `Cannot read note date "${value}": expected YYYY-MM-DDTHH:MM.`
    );
  }

  const [year, month, day, hour, minute, second] = match
    .slice(1)
    .map(part => Number(part ?? 0));
  const wallClock = Date.UTC(year!, month! - 1, day!, hour!, minute!, second);
  const written = new Date(wallClock);
  if (
    written.getUTCMonth() !== month! - 1 ||
    written.getUTCDate() !== day! ||
    written.getUTCHours() !== hour!
  ) {
    throw new Error(`Cannot read note date "${value}": not a real date.`);
  }

  // The offset at the wall-clock time taken as UTC is close to the one at
  // the real moment; a second pass corrects it when the two straddle a
  // daylight-saving change.
  const first = wallClock - offset(wallClock, timeZone);
  return new Date(wallClock - offset(first, timeZone));
}

/** How far `timeZone`'s clock is ahead of UTC at `instant`, in ms. */
function offset(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(instant)
      .map(part => [part.type, Number(part.value)])
  );
  const local = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return local - Math.floor(instant / 1000) * 1000;
}
