/**
 * Unit tests for `formatNoteDate`, the build-time replacement for Eleventy's
 * browser-side Luxon formatting (`MMM dd, yyyy`), and `noteInstant`, which
 * places a note date in the author's time zone for the feed. Pure functions
 * need no build or browser, so unit tests are the cheapest level that can
 * pin their output exactly.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { noteDateSchema } from "../src/content/note-dates.ts";
import { formatNoteDate, noteInstant } from "../src/lib/dates.ts";

// Why: these are real note values and the strings thunk.blog shows for them
// today. If the format drifts, every timestamp and Recent Posts date changes.
it("matches the live site's rendering of note dates", () => {
  assert.equal(formatNoteDate("2026-03-20T15:42"), "Mar 20, 2026");
  assert.equal(formatNoteDate("2026-08-12T13:49"), "Aug 12, 2026");
  assert.equal(formatNoteDate("2026-05-28T12:19:00"), "May 28, 2026");
});

// Why: Luxon's `dd` pads single-digit days. Without padding, early-month
// dates would render as "May 3, 2026" instead of the live "May 03, 2026".
it("pads single-digit days like Luxon's dd token", () => {
  assert.equal(formatNoteDate("2026-05-03T17:12"), "May 03, 2026");
});

// Why: the calendar date is taken as written, with no time zone conversion.
// A late-evening time must not roll over to the next day in UTC or local
// time, which is the risk of parsing through `Date` with a zone.
it("keeps the written calendar date regardless of the time of day", () => {
  assert.equal(formatNoteDate("2026-05-21T23:59"), "May 21, 2026");
  assert.equal(formatNoteDate("2026-01-01T00:00"), "Jan 01, 2026");
  assert.equal(formatNoteDate("2026-12-31"), "Dec 31, 2026");
});

// Why: a malformed or impossible date should fail the build with the value in
// the message, not silently print "undefined" or a wrong date on a page.
it("rejects malformed and impossible dates with the value in the error", () => {
  assert.throws(() => formatNoteDate("March 20"), /"March 20"/);
  assert.throws(() => formatNoteDate("2026-02-30T10:00"), /"2026-02-30T10:00"/);
  assert.throws(() => formatNoteDate("2026-13-01"), /"2026-13-01"/);
  assert.throws(() => formatNoteDate(""), /""/);
});

// Why: note dates carry no time zone, and they are written in Central time.
// The feed publishes an exact moment, so 15:42 in March (daylight time,
// UTC-5) must become 20:42 UTC, and 09:00 in January (standard time, UTC-6)
// 15:00 UTC. Treating them as UTC, as live did, shifted every post by
// five or six hours.
it("places note dates in Central time, across daylight saving", () => {
  const chicago = (value: string) =>
    noteInstant(value, "America/Chicago").toISOString();
  assert.equal(chicago("2026-03-20T15:42"), "2026-03-20T20:42:00.000Z");
  assert.equal(chicago("2026-01-15T09:00"), "2026-01-15T15:00:00.000Z");
  assert.equal(chicago("2026-05-28T12:19:00"), "2026-05-28T17:19:00.000Z");
  assert.equal(chicago("2026-05-21T23:59"), "2026-05-22T04:59:00.000Z");
});

// Why: a malformed date in a note must fail the build with the value named,
// not publish "Invalid Date" in the feed.
it("rejects a malformed note date with the value in the error", () => {
  assert.throws(() => noteInstant("20 March", "America/Chicago"), /20 March/);
  assert.throws(
    () => noteInstant("2026-02-30T10:00", "America/Chicago"),
    /2026-02-30T10:00/
  );
  // Date.UTC rolls a 75th second over into the next minute; the hour alone
  // would not notice.
  assert.throws(
    () => noteInstant("2026-03-20T10:00:75", "America/Chicago"),
    /2026-03-20T10:00:75/
  );
});

// Why: the content schema checks every note's dates when notes load, so
// Astro's error names the note file and the property. The pages and the
// feed format these dates later, when only the value is known.
describe("noteDateSchema", () => {
  for (const value of ["2026-03-20T15:42", "2026-05-28T12:19:00"]) {
    it(`accepts ${value} unchanged`, () => {
      assert.equal(noteDateSchema.parse(value), value);
    });
  }

  // Why: each is a way a hand-edited property could go wrong. A date
  // without a time would pass the pages but fail the feed, so the schema
  // holds every date to the feed's stricter form.
  for (const value of [
    "",
    "March 20",
    "2026-03-20",
    "2026-02-30T10:00",
    "2026-13-01T10:00",
    "2026-03-20T24:00",
    "2026-03-20T10:60",
    "2026-03-20T10:00:75",
    "2026-03-20T10:00Z",
    " 2026-03-20T10:00",
  ]) {
    it(`rejects ${JSON.stringify(value)}, naming it and the expected form`, () => {
      const result = noteDateSchema.safeParse(value);
      assert.equal(result.success, false);
      const message = result.error?.issues[0]?.message ?? "";
      assert.match(message, /YYYY-MM-DDTHH:MM/);
      assert.ok(message.includes(JSON.stringify(value)), message);
    });
  }
});
