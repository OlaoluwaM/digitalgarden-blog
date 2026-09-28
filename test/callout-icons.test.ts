import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import postcss from "postcss";

import {
  CALLOUT_ICON_NAMES,
  DEFAULT_CALLOUT_ICON_NAME,
  getCalloutIconName,
} from "../src/plugins/hast/callout-icons.ts";

// Sentinel key for the bare `.callout` rule (the default, used by types with
// no specific `[data-callout="..."]` override, e.g. "note").
const DEFAULT_KEY = "__default__";

// Obsidian's base callout types, then this project's custom types synced
// from the vault (the Eleventy styles, kept until cutover; the vendored
// theme declared no icon overrides). A later file overrides an earlier one
// for the same type, as the CSS cascade would for equal-specificity
// `.callout[data-callout="x"]` rules.
const CALLOUT_ICON_SOURCES = [
  "src/site/styles/obsidian-base.scss",
  "src/site/styles/user/callouts.scss",
];

// Parse `--callout-icon: <value>;` declarations out of the CSS/Sass sources
// with a real CSS parser (postcss; already a project dependency) rather than
// a hand-rolled line scanner, so nesting, comments, and multi-line selector
// lists don't need special-casing here. Selector text is then pulled apart
// with a small regex instead of relying on `rule.selector` alone: postcss's
// CSS-mode parser doesn't understand SCSS `//` line comments, so a leading
// `// comment` before a rule's actual selector gets folded into that rule's
// `selector` string. Scanning for `.callout` / `.callout[data-callout="x"]`
// occurrences finds the real selectors regardless of what leading text (if
// any) postcss folded in front of them.
function parseCalloutIconsFromCss(cssPath: string): Map<string, string> {
  const css = readFileSync(cssPath, "utf8");
  const root = postcss.parse(css, { from: cssPath });
  const found = new Map<string, string>();

  root.walkRules(rule => {
    const iconDecl = rule.nodes?.find(
      node => node.type === "decl" && node.prop === "--callout-icon"
    );
    if (iconDecl?.type !== "decl") return;

    const iconName = iconDecl.value.trim().replace(/^lucide-/, "");
    const selectorMatches = rule.selector.matchAll(
      /\.callout(?:\[data-callout="([^"]+)"\])?/g
    );

    for (const match of selectorMatches) {
      const type = match[1];
      found.set(type ?? DEFAULT_KEY, iconName);
    }
  });

  return found;
}

// Deliberate departures from the CSS sources, as [source icon, map icon].
// Obsidian's quote/cite callouts declare `quote-glyph`, which Lucide does
// not ship, so live showed no icon; the Astro site uses Lucide's `quote`
// (ADR 0003 phase 2). Each entry records the source value too, so a change
// to the source still fails the drift check below.
const DELIBERATE_OVERRIDES: Readonly<Record<string, [string, string]>> = {
  quote: ["quote-glyph", "quote"],
  cite: ["quote-glyph", "quote"],
};

function parseCalloutIconsFromAllSources(): Map<string, string> {
  const merged = new Map<string, string>();
  for (const source of CALLOUT_ICON_SOURCES) {
    for (const [type, icon] of parseCalloutIconsFromCss(source)) {
      merged.set(type, icon);
    }
  }
  return merged;
}

describe("callout icon map", () => {
  // Why: the map is hand-authored in TypeScript but must mirror the CSS
  // that actually decides each callout's icon in the browser (Obsidian
  // defaults + `npm run sync-callouts`-generated custom
  // types). Parsing those sources independently and diffing against the
  // exported map is the only thing that catches drift after someone edits
  // one side and forgets the other -- in particular, re-running
  // `npm run sync-callouts` must not be able to silently desync icons.
  it("matches every --callout-icon declaration in the CSS/Sass sources, except the listed overrides", () => {
    const fromCss = parseCalloutIconsFromAllSources();
    const defaultFromCss = fromCss.get(DEFAULT_KEY);
    fromCss.delete(DEFAULT_KEY);

    for (const [type, [sourceIcon, mapIcon]] of Object.entries(
      DELIBERATE_OVERRIDES
    )) {
      assert.equal(
        fromCss.get(type),
        sourceIcon,
        `the source's ${type} icon changed; review DELIBERATE_OVERRIDES`
      );
      fromCss.set(type, mapIcon);
    }

    assert.equal(
      defaultFromCss,
      DEFAULT_CALLOUT_ICON_NAME,
      "DEFAULT_CALLOUT_ICON_NAME must match the bare `.callout` rule's --callout-icon"
    );

    assert.deepEqual(
      { ...CALLOUT_ICON_NAMES },
      Object.fromEntries(fromCss),
      'CALLOUT_ICON_NAMES must match every `.callout[data-callout="..."]` rule\'s --callout-icon'
    );
  });

  // Why: confirms the sources actually contain the rules the fixture below
  // expects, so a broken parser (e.g. one that silently matched nothing)
  // can't pass by both sides being empty.
  it("finds a non-trivial number of declarations in the CSS sources", () => {
    const fromCss = parseCalloutIconsFromAllSources();
    assert.ok(fromCss.size > 10, `expected many types, found ${fromCss.size}`);
  });

  // Why: a name Lucide doesn't ship renders as an empty `<i>` (no icon),
  // which is how live lost the quote icon. Checking the map against the
  // pinned package catches a sync that copies another Obsidian-only name,
  // before it silently drops a callout's icon.
  it("maps every callout type to an icon Lucide's package exports", async () => {
    const lucide = await import("lucide");
    const nonLucideNames = Object.entries(CALLOUT_ICON_NAMES)
      .filter(([, iconName]) => !(toPascalCase(iconName) in lucide))
      .map(([type]) => type);

    assert.deepEqual(nonLucideNames, []);
  });

  for (const [type, expected] of [
    ["note", DEFAULT_CALLOUT_ICON_NAME],
    ["info", "info"],
    ["warning", "alert-triangle"],
    ["aside", "message-square"],
    ["quote", "quote"],
    ["cite", "quote"],
    ["some-completely-unmapped-type", DEFAULT_CALLOUT_ICON_NAME],
  ] as const) {
    it(`resolves "${type}" to "${expected}"`, () => {
      assert.equal(getCalloutIconName(type), expected);
    });
  }

  it("is case-insensitive, matching the already-lowercased data-callout type", () => {
    assert.equal(getCalloutIconName("WARNING"), "alert-triangle");
  });
});

function toPascalCase(kebabName: string): string {
  return kebabName
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
