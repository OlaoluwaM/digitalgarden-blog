/**
 * Unit tests for the design tokens in `src/styles/tokens.css`.
 *
 * Why this level: tokens are plain values, so their rules (contrast, the
 * cleared Tailwind defaults) can be checked by parsing the file, without a
 * build or a browser. A token change that breaks a rule fails here before
 * any page is rendered.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import postcss from "postcss";

const source = readFileSync("src/styles/tokens.css", "utf8");
const tokens = new Map<string, string>();
postcss.parse(source).walkDecls(decl => tokens.set(decl.prop, decl.value));

/** Follow `var(--x)` references until a literal value remains. */
function resolve(name: string): string {
  const value = tokens.get(name);
  assert.ok(value, `${name} is not defined`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference ? resolve(reference[1]!) : value;
}

function luminance(hex: string): number {
  const match = /^#([\da-f]{6})$/i.exec(hex);
  assert.ok(match, `${hex} is not a six-digit hex color`);
  const [r, g, b] = [0, 2, 4].map(i => {
    const channel = parseInt(match[1]!.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a
  );
  return (light! + 0.05) / (dark! + 0.05);
}

describe("design tokens", () => {
  // Why: WCAG AA needs 4.5:1 for body-size text. The live site's #666 muted
  // text failed at 2.9:1 and was raised deliberately (docs/design-changes.md).
  // Each pair is a text gray on a surface it is actually used on (the roles
  // are listed in tokens.css), so a later token tweak cannot quietly bring
  // the failure back.
  const pairs = [
    // Text on the page, the sidebar, and raised surfaces.
    ["--color-gray-50", "--color-gray-950"],
    ["--color-gray-50", "--color-gray-800"],
    ["--color-gray-50", "--color-gray-900"],
    // Muted text, and link hover.
    ["--color-gray-100", "--color-gray-950"],
    ["--color-gray-100", "--color-gray-800"],
    // Faint text.
    ["--color-gray-300", "--color-gray-950"],
    ["--color-gray-300", "--color-gray-800"],
    // Links.
    ["--color-gray-200", "--color-gray-950"],
    // Inline code.
    ["--color-slate-300", "--color-gray-900"],
  ] as const;
  for (const [text, surface] of pairs) {
    it(`${text} on ${surface} meets WCAG AA (4.5:1)`, () => {
      const ratio = contrast(resolve(text), resolve(surface));
      assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1`);
    });
  }

  // Why: the tokens are meant to be the whole vocabulary. If Tailwind's
  // default palette, fonts, or type scale leaked back in, utilities such as
  // `text-blue-500` or `rounded-2xl` would work and bypass the design system.
  it("clears Tailwind's default namespaces", () => {
    for (const namespace of [
      "--color-*",
      "--font-*",
      "--text-*",
      "--leading-*",
      "--tracking-*",
      "--radius-*",
      "--shadow-*",
      "--container-*",
      "--breakpoint-*",
      "--ease-*",
    ]) {
      assert.equal(tokens.get(namespace), "initial", namespace);
    }
  });
});
