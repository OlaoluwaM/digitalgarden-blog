/**
 * The rules `npm run sync-callouts` (scripts/sync-callouts.ts) follows to
 * turn the Obsidian vault's custom callout types into the site's: which
 * vault values win, which the site cannot use, and how each output is
 * written. Kept apart from the command so tests can check the rules without
 * a vault on disk (test/sync-callouts.test.ts).
 *
 * The vault defines a type in the Admonition plugin's settings (a color and
 * an icon), and CSS snippets may override either. Obsidian applies enabled
 * snippets over the plugin, a later snippet over an earlier one; the sync
 * does the same, but skips values only Obsidian can use: an inlined SVG or
 * empty icon, or a color from a theme variable.
 */
import * as lucide from "lucide";
import postcss from "postcss";

/** The part of the Admonition plugin's data.json the sync reads. */
export interface AdmonitionSettings {
  userAdmonitions: Record<
    string,
    { color?: string; icon?: { name: string; type: string } }
  >;
}

export interface CustomCallout {
  type: string;
  /** `R, G, B`, as the CSS reads it inside rgba(). */
  color: string;
  /** A Lucide icon name, without the `lucide-` prefix. */
  icon: string;
}

/** Values given on the command line for types the vault cannot supply. */
export interface Overrides {
  icons?: Record<string, string>;
  colors?: Record<string, string>;
}

/** Obsidian's built-in types, which the site styles itself. */
export const STANDARD_CALLOUT_TYPES: ReadonlySet<string> = new Set([
  "note",
  "abstract",
  "summary",
  "tldr",
  "info",
  "todo",
  "tip",
  "hint",
  "important",
  "success",
  "check",
  "done",
  "question",
  "help",
  "faq",
  "warning",
  "caution",
  "attention",
  "failure",
  "fail",
  "missing",
  "danger",
  "error",
  "bug",
  "example",
  "quote",
  "cite",
]);

// The plugin's Font Awesome icons, by their nearest Lucide icon.
const FONT_AWESOME_TO_LUCIDE: Readonly<Record<string, string>> = {
  robot: "bot",
  book: "book-open",
  marker: "highlighter",
  lightbulb: "lightbulb",
  "comment-alt": "message-square",
  comment: "message-circle",
  "exclamation-triangle": "alert-triangle",
  "question-circle": "help-circle",
  "check-circle": "check-circle-2",
  "info-circle": "info",
  star: "star",
  heart: "heart",
  flag: "flag",
  bell: "bell",
  bookmark: "bookmark",
  bolt: "zap",
  fire: "flame",
  globe: "globe",
  clock: "clock",
  calendar: "calendar",
  eye: "eye",
  lock: "lock",
  code: "code",
  terminal: "terminal",
  database: "database",
  "pencil-alt": "pencil",
  edit: "pencil",
};
const FONT_AWESOME_TYPES = new Set(["font-awesome", "fas", "far", "fab"]);

/** Read a vault color (`R, G, B`, `R G B`, `rgb(...)`, or hex) as `R, G, B`. */
export function toRgbTriplet(value: string): string | undefined {
  const text = value.trim();
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(text)?.[1];
  if (hex) {
    const pairs =
      hex.length === 3
        ? [...hex].map(digit => digit + digit)
        : hex.match(/../g)!;
    return pairs.map(pair => parseInt(pair, 16)).join(", ");
  }

  const parts = (/^rgb\((.*)\)$/i.exec(text)?.[1] ?? text)
    .split(/[\s,]+/)
    .filter(Boolean);
  const valid =
    parts.length === 3 &&
    parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  return valid ? parts.join(", ") : undefined;
}

/** A Lucide name from a snippet's `--callout-icon`, if it holds one. */
function snippetIcon(value: string): string | undefined {
  return /^(?:lucide-)?([a-z\d]+(?:-[a-z\d]+)*)$/.exec(value.trim())?.[1];
}

function isLucideIcon(name: string): boolean {
  const pascal = name
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return pascal in lucide;
}

// What the vault says about one type, before it is checked.
interface VaultType {
  color?: string;
  /** The last color given, kept to name it when none can be used. */
  rawColor?: string;
  icon?: string;
  iconProblem?: string;
}

/**
 * Merge the plugin's settings with the enabled snippets (in the order
 * Obsidian applies them) into the site's custom types, in the plugin's
 * order and then the snippets'. A type the site cannot render is left out
 * and described in `problems`; an override resolves it.
 */
export function collectCustomCallouts(
  settings: AdmonitionSettings,
  snippets: readonly string[],
  overrides: Overrides = {}
): { callouts: CustomCallout[]; problems: string[] } {
  const found = new Map<string, VaultType>();

  for (const [type, admonition] of Object.entries(settings.userAdmonitions)) {
    const entry: VaultType = {
      rawColor: admonition.color,
      color: admonition.color ? toRgbTriplet(admonition.color) : undefined,
    };
    const icon = admonition.icon;
    if (icon && (icon.type === "obsidian" || icon.type === "lucide")) {
      entry.icon = icon.name.replace(/^lucide-/, "");
    } else if (icon && FONT_AWESOME_TYPES.has(icon.type)) {
      entry.icon = FONT_AWESOME_TO_LUCIDE[icon.name];
      if (!entry.icon) {
        entry.iconProblem = `Font Awesome icon "${icon.name}" has no Lucide equivalent`;
      }
    } else if (icon) {
      entry.iconProblem = `icon "${icon.name}" (${icon.type}) is not a Lucide icon`;
    }
    found.set(type, entry);
  }

  for (const snippet of snippets) {
    postcss.parse(snippet).walkRules(rule => {
      const types = [
        ...rule.selector.matchAll(/\.callout\[data-callout="([^"]+)"\]/g),
      ].map(match => match[1]!);
      for (const type of types) {
        const entry = found.get(type) ?? {};
        rule.walkDecls("--callout-color", decl => {
          const color = toRgbTriplet(decl.value);
          if (color) entry.color = color;
          else entry.rawColor ??= decl.value;
        });
        rule.walkDecls("--callout-icon", decl => {
          const icon = snippetIcon(decl.value);
          if (icon) {
            entry.icon = icon;
            delete entry.iconProblem;
          }
        });
        found.set(type, entry);
      }
    });
  }

  const callouts: CustomCallout[] = [];
  const problems: string[] = [];
  for (const [type, entry] of found) {
    if (STANDARD_CALLOUT_TYPES.has(type)) continue;

    const overrideColor = overrides.colors?.[type];
    const color = overrideColor ? toRgbTriplet(overrideColor) : entry.color;
    const icon = overrides.icons?.[type]?.replace(/^lucide-/, "") ?? entry.icon;
    const failures: string[] = [];

    if (!color) {
      const given = overrideColor ?? entry.rawColor;
      failures.push(
        `${type}: ${given ? `color ${given} cannot be used` : "no color"}; pass --color ${type}=R,G,B`
      );
    }
    if (!icon) {
      failures.push(
        `${type}: ${entry.iconProblem ?? "no icon"}; pass --icon ${type}=<lucide-name>`
      );
    } else if (!isLucideIcon(icon)) {
      failures.push(
        `${type}: "${icon}" is not a Lucide icon; pass --icon ${type}=<lucide-name>`
      );
    }

    if (failures.length > 0) problems.push(...failures);
    else callouts.push({ type, color: color!, icon: icon! });
  }

  return { callouts, problems };
}

export const MARKERS = {
  css: { start: "/* sync-callouts:start */", end: "/* sync-callouts:end */" },
  ts: { start: "// sync-callouts:start", end: "// sync-callouts:end" },
} as const;

function markerPositions(
  source: string,
  { start, end }: { start: string; end: string }
) {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt);
  if (startAt === -1) throw new Error(`Missing marker ${start}`);
  if (endAt === -1) throw new Error(`Missing marker ${end}`);
  return {
    contentStart: source.indexOf("\n", startAt) + 1,
    contentEnd: source.lastIndexOf("\n", endAt) + 1,
  };
}

/** Replace the lines between the start and end markers with `block`. */
export function replaceGenerated(
  source: string,
  block: string,
  markers: { start: string; end: string }
): string {
  const { contentStart, contentEnd } = markerPositions(source, markers);
  return source.slice(0, contentStart) + block + source.slice(contentEnd);
}

/** The lines between a file's sync markers. */
export function generatedBlock(
  source: string,
  kind: keyof typeof MARKERS
): string {
  const { contentStart, contentEnd } = markerPositions(source, MARKERS[kind]);
  return source.slice(contentStart, contentEnd);
}

/** The color rules for src/styles/content/callouts.css. */
export function renderCss(callouts: readonly CustomCallout[]): string {
  return callouts
    .map(
      ({ type, color }) =>
        `  .callout[data-callout="${type}"] {\n    --callout-color: ${color};\n  }\n`
    )
    .join("");
}

/** The icon map entries for src/plugins/hast/callout-icons.ts. */
export function renderIconEntries(callouts: readonly CustomCallout[]): string {
  return callouts
    .map(
      ({ type, icon }) =>
        `  ${JSON.stringify(type)}: ${JSON.stringify(icon)},\n`
    )
    .join("");
}
