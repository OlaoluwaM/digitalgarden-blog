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

/**
 * The key under which the Markdown pipeline records the positions, in
 * Astro's `headings`, of headings that belong to embedded notes
 * (plugins/mdast/transclusions.ts). Astro returns it from `render()` in
 * `remarkPluginFrontmatter`.
 */
export const EMBEDDED_HEADINGS = "embeddedHeadings";

/** The recorded positions of embedded headings; none when absent. */
export function embeddedHeadingPositions(
  frontmatter: Record<string, unknown>
): ReadonlySet<number> {
  const positions = frontmatter[EMBEDDED_HEADINGS];
  if (positions === undefined) return new Set();
  if (
    !Array.isArray(positions) ||
    !positions.every(position => Number.isInteger(position))
  ) {
    throw new Error(
      `${EMBEDDED_HEADINGS} must be a list of heading positions, not ${JSON.stringify(positions)}`
    );
  }
  return new Set(positions as number[]);
}

const isSection = (
  heading: MarkdownHeading
): heading is MarkdownHeading & { depth: 2 | 3 } =>
  (heading.depth === 2 || heading.depth === 3) &&
  heading.slug !== FOOTNOTES_LABEL;

/**
 * The note's sections (h2) and subsections (h3), in order, or nothing when
 * it has fewer than three. Headings of embedded notes (at `embedded`
 * positions) are the other note's sections, not this one's.
 */
export function contentsEntries(
  headings: readonly MarkdownHeading[],
  embedded: ReadonlySet<number> = new Set()
): ContentsEntry[] {
  const entries = headings
    .filter((_, position) => !embedded.has(position))
    .filter(isSection)
    .map(({ depth, slug, text }) => ({ depth, slug, text }));
  return entries.length >= MIN_ENTRIES ? entries : [];
}
