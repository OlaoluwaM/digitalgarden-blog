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
