/**
 * Unit tests for the style guide's token data (`src/style-guide/tokens.ts`).
 *
 * Why this level: the style guide reads every value from tokens.css, but the
 * sentence beside each token and the contrast ratios it prints come from
 * code. Both can be checked against the file directly, without a build.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  contrastRatio,
  parseTokens,
  steps,
  tokenNotes,
} from "../src/style-guide/tokens.ts";

const tokens = parseTokens(readFileSync("src/styles/tokens.css", "utf8"));

describe("style guide tokens", () => {
  // Why: the page lists what tokens.css defines. A new token would appear
  // with no explanation, and a removed one would leave a note describing
  // nothing, so the two lists must match.
  it("explains every token in tokens.css, and only those", () => {
    assert.deepEqual(
      Object.keys(tokenNotes).sort(),
      steps(tokens, "--")
        .map(([name]) => name)
        .sort()
    );
  });

  // Why: a step's paired values (`--text-sm--line-height`) are shown with
  // the step, not as tokens of their own, and the namespace resets
  // (`--color-*: initial`) are not tokens at all.
  it("lists steps without their paired values or the resets", () => {
    const names = steps(tokens, "--text-").map(([name]) => name);
    assert.ok(names.includes("--text-sm"));
    assert.ok(!names.some(name => name.includes("--", 2)), String(names));
    assert.ok(![...tokens.keys()].some(name => name.endsWith("*")));
    assert.equal(tokens.get("--text-sm--line-height"), "calc(1.25 / 0.85)");
  });

  // Why: the page prints each text gray's contrast on the page color as an
  // accessibility claim, so the formula must be WCAG's. #767676 on white is
  // the well-known 4.54:1, the lightest gray that passes AA there.
  it("computes WCAG contrast ratios", () => {
    assert.equal(contrastRatio("#ffffff", "#000000"), 21);
    assert.equal(contrastRatio("#000000", "#ffffff"), 21);
    assert.equal(contrastRatio("#1e1e1e", "#1e1e1e"), 1);
    assert.equal(contrastRatio("#767676", "#ffffff").toFixed(2), "4.54");
  });
});
