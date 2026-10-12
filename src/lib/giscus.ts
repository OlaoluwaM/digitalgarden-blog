// Giscus comments and reactions (ADR 0008): the widget's settings, when it
// may load, and its theme, built from the site's tokens.
import { tokenValue } from "./tokens.ts";
import { site } from "./site.ts";

export const giscus = {
  repo: "OlaoluwaM/digitalgarden-blog",
  repoId: "R_kgDORsRDnA",
  category: "Comments",
  categoryId: "DIC_kwDORsRDnM4DIGmI",
  /** Where readers without JavaScript find the discussions. A note's own
   * thread exists only after its first comment, so there is no per-note
   * link to give. */
  categoryUrl:
    "https://github.com/OlaoluwaM/digitalgarden-blog/discussions/categories/comments",
  /** Served by pages/giscus-theme.css.ts. giscus.app loads it from
   * thunk.blog on every deployment, so a theme change shows after release. */
  themeUrl: new URL("/giscus-theme.css", site.url).href,
} as const;

/**
 * Whether this build may load the widget: Vercel's production build only.
 * A note's thread is found by its permalink, which previews and localhost
 * share with production, so a comment left there would land in the real
 * discussion. giscus.json refuses other origins too.
 */
export function giscusEnabled(
  env: Record<string, string | undefined>
): boolean {
  return env.VERCEL_ENV === "production";
}

/**
 * The `data-*` settings on giscus's script tag for the note at `permalink`.
 * The thread is keyed on the permalink, not the URL the reader came in by:
 * thunk.blog answers a note at `/x`, `/x/`, and `/x/index.html`, and
 * pathname mapping would give each its own thread and upvote count. The
 * term drops a trailing slash, as the site's route check does
 * (content/permalinks.ts), so a permalink that only gains or loses one
 * keeps its thread.
 */
export function giscusAttributes(permalink: string): Record<string, string> {
  return {
    "data-repo": giscus.repo,
    "data-repo-id": giscus.repoId,
    "data-category": giscus.category,
    "data-category-id": giscus.categoryId,
    // Public URLs are stable, so a note keeps its thread.
    "data-mapping": "specific",
    "data-term": permalink.replace(/\/+$/, ""),
    // GitHub's search is fuzzy: one note's permalink could match another's
    // thread. Strict matching compares a SHA-1 hash of the term.
    "data-strict": "1",
    // The reaction bar is the upvote.
    "data-reactions-enabled": "1",
    "data-emit-metadata": "0",
    "data-input-position": "top",
    "data-theme": giscus.themeUrl,
    "data-lang": site.lang,
    "data-loading": "lazy",
  };
}

/**
 * giscus's theme for this site: the variables of giscus's dark theme
 * (styles/themes/dark.css), with the site's grays and text font in place of
 * GitHub's. giscus replaces its whole default theme with this file, so every
 * variable the dark theme sets is set here. Code highlighting and the
 * success, attention, and danger colors keep GitHub's dark values.
 * `reactionFont` (reaction-icons.ts) draws the reactions as Lucide icons.
 */
export function giscusThemeCss(
  tokens: Map<string, string>,
  reactionFont: ArrayBuffer
): string {
  const gray = (step: number) => tokenValue(tokens, `--color-gray-${step}`);
  const mix = (step: number, percent: number) =>
    withAlpha(`--color-gray-${step}`, gray(step), percent);
  const none = "0 0 transparent";
  const variables: Record<string, string> = {
    ...GITHUB_DARK_SYNTAX,
    "--color-btn-text": gray(50),
    "--color-btn-bg": gray(900),
    "--color-btn-border": gray(700),
    "--color-btn-shadow": none,
    "--color-btn-inset-shadow": none,
    "--color-btn-hover-bg": gray(800),
    "--color-btn-hover-border": gray(100),
    "--color-btn-active-bg": gray(800),
    "--color-btn-active-border": gray(200),
    "--color-btn-selected-bg": gray(800),
    // "Sign in with GitHub" and "Comment": GitHub's green becomes the
    // site's raised gray.
    "--color-btn-primary-text": gray(50),
    "--color-btn-primary-bg": gray(700),
    "--color-btn-primary-border": gray(600),
    "--color-btn-primary-shadow": none,
    "--color-btn-primary-inset-shadow": none,
    "--color-btn-primary-hover-bg": gray(600),
    "--color-btn-primary-hover-border": gray(100),
    "--color-btn-primary-selected-bg": gray(700),
    "--color-btn-primary-selected-shadow": none,
    "--color-btn-primary-disabled-text": gray(300),
    "--color-btn-primary-disabled-bg": gray(800),
    "--color-btn-primary-disabled-border": gray(700),
    "--color-action-list-item-default-hover-bg": gray(800),
    "--color-segmented-control-bg": gray(900),
    "--color-segmented-control-button-bg": gray(800),
    "--color-segmented-control-button-selected-border": gray(600),
    "--color-fg-default": gray(50),
    // Muted and subtle text both use the muted gray, the lightest that
    // keeps 4.5:1 on the widget's surfaces.
    "--color-fg-muted": gray(300),
    "--color-fg-subtle": gray(300),
    "--color-canvas-default": gray(950),
    "--color-canvas-overlay": gray(900),
    "--color-canvas-inset": gray(950),
    "--color-canvas-subtle": gray(900),
    "--color-border-default": gray(700),
    "--color-border-muted": gray(800),
    "--color-neutral-muted": mix(100, 20),
    // Links and the reaction a reader picked: the site's link grays.
    "--color-accent-fg": gray(100),
    "--color-accent-emphasis": gray(200),
    "--color-accent-muted": mix(200, 40),
    "--color-accent-subtle": mix(200, 10),
    "--color-success-fg": "#3fb950",
    "--color-attention-fg": "#d29922",
    "--color-attention-muted": "rgb(187 128 9 / 40%)",
    "--color-attention-subtle": "rgb(187 128 9 / 15%)",
    "--color-danger-fg": "#f85149",
    "--color-danger-muted": "rgb(248 81 73 / 40%)",
    "--color-danger-subtle": "rgb(248 81 73 / 10%)",
    "--color-primer-shadow-inset": none,
    "--color-scale-gray-7": gray(800),
    "--color-scale-blue-8": gray(700),
    "--color-social-reaction-bg-hover": "var(--color-scale-gray-7)",
    "--color-social-reaction-bg-reacted-hover": "var(--color-scale-blue-8)",
  };
  const font = (file: string) => new URL(`/fonts/${file}`, site.url).href;
  return [
    "/*",
    " * giscus theme for thunk.blog, built from src/styles/tokens.css",
    " * (src/lib/giscus.ts). Based on giscus's dark theme: code colors",
    " * MIT License, Copyright (c) 2018 GitHub Inc.,",
    " * https://github.com/primer/primitives/blob/main/LICENSE",
    " * Reaction icons from Lucide: ISC License, Copyright (c) 2026 Lucide",
    " * Icons and Contributors; face-slightly-frowning from Feather: MIT",
    " * License, Copyright (c) 2013-present Cole Bemis,",
    " * https://github.com/lucide-icons/lucide/blob/main/LICENSE",
    " */",
    "",
    // The page is always dark. An iframe whose color scheme differs from
    // the page's is painted opaque: a white box in light mode.
    ":root {",
    "  color-scheme: dark;",
    "}",
    "",
    ...(["normal", "italic"] as const).flatMap(style => [
      "@font-face {",
      '  font-family: "Instrument Sans";',
      `  font-style: ${style};`,
      "  font-weight: 400 700;",
      "  font-display: swap;",
      `  src: url("${font(style === "italic" ? "instrument-sans-italic.woff2" : "instrument-sans.woff2")}") format("woff2");`,
      "}",
      "",
    ]),
    "main {",
    // The site's text stack, which leads with Instrument Sans.
    `  font-family: ${tokenValue(tokens, "--font-sans")};`,
    ...Object.entries(variables).map(([name, value]) => `  ${name}: ${value};`),
    "}",
    "",
    "main .pagination-loader-container {",
    '  background-image: url("https://github.com/images/modules/pulls/progressive-disclosure-line-dark.svg");',
    "}",
    "",
    "main .gsc-loading-image {",
    '  background-image: url("https://github.githubassets.com/images/mona-loading-dark.gif");',
    "}",
    "",
    // The reactions as Lucide icons, the site's icon set, in the text's
    // gray. The font travels inside the theme, so it needs no file, route,
    // or CORS rule of its own. If it fails to load, the reader's emoji show
    // instead.
    "@font-face {",
    '  font-family: "Reaction Icons";',
    `  src: url("data:font/otf;base64,${Buffer.from(reactionFont).toString("base64")}") format("opentype");`,
    "}",
    "",
    // 14px keeps the icons' strokes inside the 16px box giscus gives each
    // emoji.
    "main .gsc-direct-reaction-button-emoji,",
    "main .gsc-emoji {",
    '  font-family: "Reaction Icons", sans-serif;',
    "  font-size: 14px;",
    "}",
    "",
    // The buttons line up with the comments below them; giscus centers
    // them. The pills carry their counts, so the "N reactions" heading
    // goes, and the comment count still links to the discussion.
    "main .gsc-reactions {",
    "  align-items: flex-start;",
    "}",
    "",
    "main .gsc-reactions-count {",
    "  display: none;",
    "}",
    "",
  ].join("\n");
}

/** The `#rrggbb` color of token `name` at `percent` opacity. Any other format
 * fails the build, as a missing token does. */
function withAlpha(name: string, hex: string, percent: number): string {
  if (!/^#[\da-f]{6}$/i.test(hex)) {
    throw new Error(`${name} is not a six-digit hex color: ${hex}`);
  }
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r} ${g} ${b} / ${percent}%)`;
}

// Code highlighting inside comments, as in giscus's dark theme.
const GITHUB_DARK_SYNTAX: Record<string, string> = {
  "--color-prettylights-syntax-comment": "#8b949e",
  "--color-prettylights-syntax-constant": "#79c0ff",
  "--color-prettylights-syntax-entity": "#d2a8ff",
  "--color-prettylights-syntax-storage-modifier-import": "#c9d1d9",
  "--color-prettylights-syntax-entity-tag": "#7ee787",
  "--color-prettylights-syntax-keyword": "#ff7b72",
  "--color-prettylights-syntax-string": "#a5d6ff",
  "--color-prettylights-syntax-variable": "#ffa657",
  "--color-prettylights-syntax-brackethighlighter-unmatched": "#f85149",
  "--color-prettylights-syntax-invalid-illegal-text": "#f0f6fc",
  "--color-prettylights-syntax-invalid-illegal-bg": "#8e1519",
  "--color-prettylights-syntax-carriage-return-text": "#f0f6fc",
  "--color-prettylights-syntax-carriage-return-bg": "#b62324",
  "--color-prettylights-syntax-string-regexp": "#7ee787",
  "--color-prettylights-syntax-markup-list": "#f2cc60",
  "--color-prettylights-syntax-markup-heading": "#1f6feb",
  "--color-prettylights-syntax-markup-italic": "#c9d1d9",
  "--color-prettylights-syntax-markup-bold": "#c9d1d9",
  "--color-prettylights-syntax-markup-deleted-text": "#ffdcd7",
  "--color-prettylights-syntax-markup-deleted-bg": "#67060c",
  "--color-prettylights-syntax-markup-inserted-text": "#aff5b4",
  "--color-prettylights-syntax-markup-inserted-bg": "#033a16",
  "--color-prettylights-syntax-markup-changed-text": "#ffdfb6",
  "--color-prettylights-syntax-markup-changed-bg": "#5a1e02",
  "--color-prettylights-syntax-markup-ignored-text": "#c9d1d9",
  "--color-prettylights-syntax-markup-ignored-bg": "#1158c7",
  "--color-prettylights-syntax-meta-diff-range": "#d2a8ff",
  "--color-prettylights-syntax-brackethighlighter-angle": "#8b949e",
  "--color-prettylights-syntax-sublimelinter-gutter-mark": "#484f58",
  "--color-prettylights-syntax-constant-other-reference-link": "#a5d6ff",
};
