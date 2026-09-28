// Maps each Obsidian callout `data-callout` type to its Lucide icon name,
// without the "lucide-" prefix. Live resolved each callout's
// `--callout-icon` in the browser and swapped in the icon; Astro resolves it
// here, once, at build time.
//
// Two parts:
//   - Obsidian's built-in types, with the icons Obsidian gives them (taken
//     from Obsidian's stylesheet, which the Eleventy site shipped).
//     `test/callout-icons.test.ts` holds the same table and fails on drift.
//   - Custom types from the Obsidian vault, between the sync markers below.
//     `npm run sync-callouts` writes them, and their colors in
//     src/styles/content/callouts.css.
//
// One deliberate departure: Obsidian's `quote`/`cite` callouts use
// `quote-glyph`, an Obsidian-only icon that Lucide does not ship, so live
// rendered no icon for them. They use Lucide's `quote` icon instead (ADR
// 0003 phase 2).
//
// `getCalloutIconName` returns the name as-is; resolving it to an actual
// icon (or the empty-`<i>` fallback for a name Lucide doesn't have) is
// `lucide-icon.ts`'s job.

// Obsidian's default icon: used by any type with no entry of its own (for
// example "note").
export const DEFAULT_CALLOUT_ICON_NAME = "pencil";

export const CALLOUT_ICON_NAMES: Readonly<Record<string, string>> = {
  // Obsidian's built-in types.
  abstract: "clipboard-list",
  summary: "clipboard-list",
  tldr: "clipboard-list",
  info: "info",
  todo: "check-circle-2",
  important: "flame",
  tip: "flame",
  hint: "flame",
  success: "check",
  check: "check",
  done: "check",
  question: "help-circle",
  help: "help-circle",
  faq: "help-circle",
  warning: "alert-triangle",
  caution: "alert-triangle",
  attention: "alert-triangle",
  failure: "x",
  fail: "x",
  missing: "x",
  danger: "zap",
  error: "zap",
  bug: "bug",
  example: "list",
  // Deliberate override: the source declares `quote-glyph` (see above).
  quote: "quote",
  cite: "quote",

  // Custom types from the Obsidian vault, with their colors in
  // src/styles/content/callouts.css. `npm run sync-callouts` writes the
  // entries between the markers; do not edit them by hand.
  // sync-callouts:start
  "ai-text": "bot",
  wikipedia: "book-open",
  highlight: "highlighter",
  remember: "lightbulb",
  aside: "message-square",
  exercise: "pencil-line",
  // sync-callouts:end
};

/** Resolve a `data-callout` type (already lowercased upstream) to the icon
 * name its `--callout-icon` declares, falling back to the default icon for
 * a type with no specific rule. */
export function getCalloutIconName(calloutType: string): string {
  const type = calloutType.toLowerCase();
  // A callout type such as "constructor" is an *inherited* property of any
  // plain object (Object.prototype.constructor), not a missing one, so a
  // bare CALLOUT_ICON_NAMES[type] lookup would silently return that
  // built-in instead of falling through to the default. Object.hasOwn
  // checks the map's own keys only, the same guard `toTitleCase` in
  // callout.ts uses for its title-case override lookup.
  return Object.hasOwn(CALLOUT_ICON_NAMES, type)
    ? CALLOUT_ICON_NAMES[type]!
    : DEFAULT_CALLOUT_ICON_NAME;
}
