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

/** The form every note date takes; seconds are optional. */
export const NOTE_DATE_TIME_FORM = "YYYY-MM-DDTHH:MM[:SS]";

/**
 * The wall-clock time a note date names, as milliseconds on the UTC scale,
 * or `undefined` when the value is malformed or not a real date and time
 * (February 30th, 24:00, a 75th second).
 */
function readWallClock(value: string): number | undefined {
  const match = DATE_TIME.exec(value);
  if (!match) return undefined;

  // A missing group reads as NaN, which the check below rejects. Only the
  // seconds are optional.
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second);
  // Date.UTC rolls overflowing fields over (February 30th becomes March
  // 2nd), so a real date reads back exactly as written.
  const written = new Date(wallClock);
  if (
    Number.isNaN(wallClock) ||
    written.getUTCMonth() !== month - 1 ||
    written.getUTCDate() !== day ||
    written.getUTCHours() !== hour ||
    written.getUTCMinutes() !== minute ||
    written.getUTCSeconds() !== second
  ) {
    return undefined;
  }
  return wallClock;
}

/** Whether `value` is a real date and time in {@link NOTE_DATE_TIME_FORM}. */
export function isNoteDateTime(value: string): boolean {
  return readWallClock(value) !== undefined;
}

/**
 * The moment a note date names, read as wall-clock time in `timeZone`.
 *
 * Note dates are written without a zone ("2026-03-20T15:42"), in the
 * author's local time. The feed needs an exact moment, so the zone's offset
 * on that date (daylight saving included) is applied.
 */
export function noteInstant(value: string, timeZone: string): Date {
  const wallClock = readWallClock(value);
  if (wallClock === undefined) {
    throw new Error(
      `Cannot read note date "${value}": expected a real date as ${NOTE_DATE_TIME_FORM}.`
    );
  }

  // The offset at the wall-clock time taken as UTC is close to the one at
  // the real moment; a second pass corrects it when the two straddle a
  // daylight-saving change.
  const first = wallClock - offset(wallClock, timeZone);
  return new Date(wallClock - offset(first, timeZone));
}

/** How far `timeZone`'s clock is ahead of UTC at `instant`, in ms. */
function offset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const found = parts.find(candidate => candidate.type === type);
    const value = Number(found?.value);
    // Number() never throws; a missing or non-numeric part is NaN.
    if (Number.isNaN(value)) {
      throw new Error(
        `No numeric ${type} when formatting a date in ${timeZone}.`
      );
    }
    return value;
  };
  const local = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second")
  );
  return local - Math.floor(instant / 1000) * 1000;
}
