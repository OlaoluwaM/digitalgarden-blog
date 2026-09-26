// Query terms, excerpts, and highlight ranges for search results, ported
// from Eleventy's `searchScript.njk`. Plain data in and out; the dialog
// (search.ts) turns it into elements.

export interface SearchSegment {
  text: string;
  match: boolean;
}

// Excerpts start this many characters before the first match.
const EXCERPT_LEAD = 50;
const ELLIPSIS = "...";

/**
 * The terms to highlight: words and "quoted phrases", lowercase, without
 * single characters, longest first.
 */
export function searchTerms(query: string) {
  const terms = [...query.matchAll(/"([^"]+)"|(\S+)/g)]
    .map(match => (match[1] ?? match[2]!).toLowerCase())
    .filter(term => term.length > 1);
  return terms.sort((a, b) => b.length - a.length);
}

/**
 * The text around the first match, cut to `maxLength` with ellipses; the
 * opening of the text when nothing matches.
 */
export function excerpt(
  content: string,
  terms: readonly string[],
  maxLength = 120
) {
  const lower = content.toLowerCase();
  const first = Math.min(
    ...terms.map(term => lower.indexOf(term)).filter(index => index !== -1)
  );
  if (!Number.isFinite(first)) {
    return content.length <= maxLength
      ? content
      : content.slice(0, maxLength - ELLIPSIS.length) + ELLIPSIS;
  }
  const start = Math.max(0, first - EXCERPT_LEAD);
  const end = Math.min(content.length, start + maxLength);
  return (
    (start > 0 ? ELLIPSIS : "") +
    content.slice(start, end) +
    (end < content.length ? ELLIPSIS : "")
  );
}

/**
 * Split text into matched and unmatched runs. Matching is on the text
 * alone, case-insensitive and literal; overlapping matches merge.
 */
export function highlightSegments(
  text: string,
  terms: readonly string[]
): SearchSegment[] {
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const term of terms) {
    for (
      let at = lower.indexOf(term);
      term && at !== -1;
      at = lower.indexOf(term, at + 1)
    ) {
      ranges.push([at, at + term.length]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const segments: SearchSegment[] = [];
  let position = 0;
  for (const [start, end] of ranges) {
    const last = segments.at(-1);
    if (start < position && last?.match) {
      // Overlaps the previous match: extend it.
      if (end > position) {
        last.text += text.slice(position, end);
        position = end;
      }
      continue;
    }
    if (start > position) {
      segments.push({ text: text.slice(position, start), match: false });
    }
    segments.push({ text: text.slice(start, end), match: true });
    position = end;
  }
  if (position < text.length) {
    segments.push({ text: text.slice(position), match: false });
  }
  return segments;
}
