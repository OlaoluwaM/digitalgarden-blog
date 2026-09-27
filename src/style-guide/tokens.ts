// The style guide's data: every token in tokens.css, read from the file so
// the page cannot drift from it, and a sentence on what each one is for.
// test/style-guide.test.ts fails when a token has no sentence or a sentence
// has no token.
import postcss from "postcss";

/** Every declaration in tokens.css, in file order, without the resets. */
export function parseTokens(source: string): Map<string, string> {
  const tokens = new Map<string, string>();
  postcss.parse(source).walkDecls(decl => {
    if (!decl.prop.endsWith("*")) {
      tokens.set(decl.prop, decl.value.replace(/\s+/g, " "));
    }
  });
  return tokens;
}

/**
 * The steps whose names start with `prefix`, without their paired values
 * (`--text-sm--line-height` belongs to `--text-sm`).
 */
export function steps(
  tokens: Map<string, string>,
  prefix: string
): [string, string][] {
  return [...tokens].filter(
    ([name]) => name.startsWith(prefix) && !name.includes("--", 2)
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio of two six-digit hex colors, from 1 to 21. */
export function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a
  );
  return (light! + 0.05) / (dark! + 0.05);
}

/** What each token is for, as the page shows it. */
export const tokenNotes: Record<string, string> = {
  "--color-white":
    "Hovers and tints at low opacity: white/5 is the hover fill everywhere.",
  "--color-black":
    "The backdrop behind the mobile file tree and search, at 50%.",
  "--color-gray-50": "Text.",
  "--color-gray-100": "Muted text: dates, tags, and a link on hover.",
  "--color-gray-200": "Links, the focus ring, and tag fills (at 10%).",
  "--color-gray-300":
    "Faint text. The lightest gray that passes AA on both the page and the sidebar; the old site used #666 (2.9:1).",
  "--color-gray-400":
    "Decoration only (list markers, the rule beside a quote), never text.",
  "--color-gray-500": "Unused; it keeps the scale whole.",
  "--color-gray-600": "A border on hover.",
  "--color-gray-700":
    "Borders and rules: code, tables, tags, keys, and the footer.",
  "--color-gray-800":
    "The navbar, the sidebar, and the search field and results.",
  "--color-gray-900": "Raised surfaces: code blocks, inline code, and keys.",
  "--color-gray-950": "The page.",
  "--color-slate-300": "Code text: the syntax theme's foreground.",
  "--color-yellow-400": "Highlighted text, at 40%.",

  "--font-sans": "Interface and note text.",
  "--font-serif":
    "Headings and note titles, in its one weight. A bold would be synthesized.",
  "--font-mono": "Code and keyboard keys.",
  "--font-weight-normal": "Text, and every heading.",
  "--font-weight-medium":
    "Highlighted text, search result titles, and the copy button.",
  "--font-weight-semibold": "Code in code blocks.",
  "--font-weight-bold": "Bold text, table headers, and callout titles.",

  "--text-xs": "Recent Posts dates, the search footer, and the copy button.",
  "--text-sm":
    "Interface text: the file tree, the search button, tags, and note dates. The old site's size, on Tailwind's line height.",
  "--text-base": "The default size: callouts and the search preview.",
  "--text-lg": "h6, and search result titles.",
  "--text-xl": "h5.",
  "--text-2xl": "h4.",
  "--text-3xl": "h3, and the search preview's title.",
  "--text-4xl": "h2, and the Recent Posts heading.",
  "--text-5xl": "h1 and note titles.",

  "--leading-tight": "Tables and callout titles.",
  "--leading-snug": "Unused; Tailwind's step, kept so the scale is whole.",
  "--leading-normal": "Note text.",
  "--leading-relaxed": "The file tree, keys, and the shortcut hint.",

  "--radius-xs": "Search matches.",
  "--radius-sm": "The shortcut hint, the copy button, and checkboxes.",
  "--radius-md": "Keys and code.",
  "--radius-lg": "Tags, the search button, highlights, and cards.",
  "--radius-xl": "The search dialog.",

  "--shadow-2xl":
    "The search dialog. Tailwind's shape at twice the strength, to show on a dark page.",
  "--spacing": "Every gap, margin, and padding is a whole or half step of it.",

  "--container-content": "The note column.",
  "--container-sidebar": "The file tree, as wide as it gets.",
  "--container-sidebar-min": "The file tree, as narrow as it gets.",
  "--container-site-name": "Where the sidebar site name wraps.",
  "--container-6xl": "The search dialog.",

  "--breakpoint-md": "Phones and small tablets end below it.",
  "--breakpoint-lg": "The desktop file tree starts here.",
  "--breakpoint-xl": "The note column stops widening here.",

  "--default-transition-duration": "Every transition: hovers and toggles.",
  "--default-transition-timing-function": "Tailwind's default easing.",
  "--ease-overshoot":
    "The hamburger button: Obsidian's easing, which overshoots a little.",
  "--corner-shape-soft":
    "Softer corners on keys, quotes, images, code, and callouts. Chrome draws them; other browsers keep round corners.",
};
