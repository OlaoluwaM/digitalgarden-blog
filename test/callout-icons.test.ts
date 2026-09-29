/**
 * Unit tests for the callout icon map (`src/plugins/hast/callout-icons.ts`).
 *
 * Why this level: the map is plain data, so it can be checked against its
 * two sources without a build. Obsidian's built-in types keep the icons
 * Obsidian gives them, recorded below from the Eleventy site's copy of
 * Obsidian's stylesheet (obsidian-base.scss, before it was deleted). Custom
 * types come from the vault through `npm run sync-callouts`, which
 * test/sync-callouts.test.ts covers.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  CALLOUT_ICON_NAMES,
  DEFAULT_CALLOUT_ICON_NAME,
  getCalloutIconName,
} from "../src/plugins/hast/callout-icons.ts";
import {
  generatedBlock,
  STANDARD_CALLOUT_TYPES,
} from "../scripts/callout-sync.ts";

// Obsidian's icon for each built-in type (its `.callout[data-callout]`
// rules), and for any other type (the bare `.callout` rule: pencil).
// One departure: quote and cite declare `quote-glyph`, an Obsidian-only
// icon that Lucide does not ship, so live showed none; the site uses
// Lucide's `quote` (ADR 0003 phase 2).
const OBSIDIAN_ICONS: Readonly<Record<string, string>> = {
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
  quote: "quote",
  cite: "quote",
};

// The custom types `npm run sync-callouts` wrote between the map's markers.
const customTypes = [
  ...generatedBlock(
    readFileSync("src/plugins/hast/callout-icons.ts", "utf8"),
    "ts"
  ).matchAll(/^\s*"?([\w-]+)"?:/gm),
].map(match => match[1]!);

describe("callout icon map", () => {
  // Why: a built-in callout must show the icon Obsidian shows for it, and
  // `note` (no rule of its own) Obsidian's default, so a note reads the
  // same in the vault and on the site.
  it("gives Obsidian's built-in types Obsidian's icons", () => {
    const builtIn = Object.fromEntries(
      Object.entries(CALLOUT_ICON_NAMES).filter(
        ([type]) => !customTypes.includes(type)
      )
    );
    assert.deepEqual(builtIn, OBSIDIAN_ICONS);
    assert.equal(DEFAULT_CALLOUT_ICON_NAME, "pencil");
  });

  // Why: the sync skips the types it treats as Obsidian's own, so the map
  // must cover exactly those (with note on the default), or a type would
  // get no icon from either side.
  it("covers the same built-in types the sync skips", () => {
    assert.deepEqual(
      [...STANDARD_CALLOUT_TYPES].sort(),
      [...Object.keys(OBSIDIAN_ICONS), "note"].sort()
    );
  });

  // Why: guards the check above; an empty custom block would let every
  // type pass as built-in.
  it("finds the custom types between the sync markers", () => {
    assert.ok(customTypes.length > 0);
    for (const type of customTypes) assert.ok(!(type in OBSIDIAN_ICONS), type);
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
