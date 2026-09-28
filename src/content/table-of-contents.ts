import type { MarkdownHeading } from "astro";

/** One line of a note's table of contents. */
export interface ContentsEntry {
  depth: 2 | 3;
  slug: string;
  text: string;
}

// Fewer sections than this and the list only repeats what a glance at the
// note shows.
const MIN_ENTRIES = 3;

// The h2 the Markdown pipeline gives the footnotes list, for screen
// readers only (`.sr-only`); it is not one of the note's sections.
const FOOTNOTES_LABEL = "footnote-label";

const isSection = (
  heading: MarkdownHeading
): heading is MarkdownHeading & { depth: 2 | 3 } =>
  (heading.depth === 2 || heading.depth === 3) &&
  heading.slug !== FOOTNOTES_LABEL;

/**
 * The note's sections (h2) and subsections (h3), in order, or nothing when
 * it has fewer than three.
 */
export function contentsEntries(
  headings: readonly MarkdownHeading[]
): ContentsEntry[] {
  const entries = headings
    .filter(isSection)
    .map(({ depth, slug, text }) => ({ depth, slug, text }));
  return entries.length >= MIN_ENTRIES ? entries : [];
}
