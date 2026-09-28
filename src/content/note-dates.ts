import { z } from "astro/zod";
import { isNoteDateTime, NOTE_DATE_TIME_FORM } from "../lib/dates.ts";

// Validate a note's date properties when notes load, so a bad value fails
// the build with Astro naming the note and the property. Held to the feed's
// form (a time is required), the strictest place a note date is read.
export const noteDateSchema = z.string().refine(isNoteDateTime, {
  error: issue =>
    `Expected a real date as ${NOTE_DATE_TIME_FORM}, got ${JSON.stringify(issue.input)}`,
});
