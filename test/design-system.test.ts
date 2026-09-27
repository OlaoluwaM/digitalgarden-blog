/**
 * The design system's rules, checked on the source files: tokens follow
 * Tailwind's namespaces and step names, and stylesheets and templates use
 * the scales instead of one-off values.
 *
 * Why this level: each rule is about how a value is written, not how a page
 * renders, so reading the files catches a stray `gap-[3px]` or `#333` at
 * once, without a build or a browser. Screenshots show whether the values
 * look right; this test keeps them on the scales afterwards.
 *
 * The rules (src/styles/README.md explains them):
 * - tokens.css declares only Tailwind's namespaces, with Tailwind's step
 *   names; no token is named after a component.
 * - The interface steps, leading, radii, spacing unit, and default motion are
 *   Tailwind's values, except `sm`, which is live's 0.85rem (headings,
 *   grays, fonts, and widths are ours too).
 * - Stylesheets write colors, lengths, and durations through tokens,
 *   `--spacing(n)`, and `--alpha()`, never as literals; rendered Markdown
 *   keeps em-based sizes, like Tailwind Typography.
 * - Spacing uses whole or half steps (no `py-0.75`).
 * - Templates use no arbitrary values, except the ones listed below.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import postcss from "postcss";

const root = new URL("../", import.meta.url).pathname;

function files(directory: string, extension: string): string[] {
  return readdirSync(join(root, directory), {
    recursive: true,
    withFileTypes: true,
  })
    .filter(entry => entry.isFile() && entry.name.endsWith(extension))
    .map(entry => relative(root, join(entry.parentPath, entry.name)))
    .sort();
}

const read = (path: string) => readFileSync(join(root, path), "utf8");

const tokens = new Map<string, string>();
postcss
  .parse(read("src/styles/tokens.css"))
  .walkDecls(decl => tokens.set(decl.prop, decl.value));

/** Tailwind's step names, in its order. */
const SIZES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];
const STEPS = [
  "50",
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}00`),
  "950",
];

/**
 * Every token name tokens.css may declare. Tailwind's namespaces with its
 * step names; `container` also takes the site's layout widths, which are
 * ours by design (src/styles/README.md).
 */
const NAMESPACES: RegExp[] = [
  /^--(color|font|text|leading|tracking|radius|shadow|container|breakpoint|ease)-\*$/,
  new RegExp(`^--color-(white|black|[a-z]+-(${STEPS.join("|")}))$`),
  /^--font-(sans|serif|mono)$/,
  /^--font-weight-(normal|medium|semibold|bold)$/,
  new RegExp(`^--text-(${SIZES.join("|")})(--(line-height|letter-spacing))?$`),
  /^--leading-(tight|snug|normal|relaxed|loose)$/,
  /^--radius-(xs|sm|md|lg|xl|2xl|3xl|4xl)$/,
  /^--shadow-(2xs|xs|sm|md|lg|xl|2xl)$/,
  /^--container-(3xs|2xs|xs|sm|md|lg|xl|[2-7]xl|content|sidebar|sidebar-min|site-name)$/,
  /^--breakpoint-(sm|md|lg|xl|2xl)$/,
  /^--spacing$/,
  /^--default-transition-(duration|timing-function)$/,
  // Custom namespaces Tailwind allows: the hamburger's easing, and the
  // live theme's softer corners (read by an arbitrary property).
  /^--ease-overshoot$/,
  /^--corner-shape-soft$/,
];

/** Values in templates that no scale covers, each with its reason. */
const ARBITRARY_ALLOWED = new Map([
  // Chrome's squircle corners; no utility exists for `corner-shape`.
  ["[corner-shape:var(--corner-shape-soft)]", "corner-shape"],
  // No utility exists for `scrollbar-width`.
  ["[scrollbar-width:thin]", "scrollbar-width"],
  // The search panels' height follows the viewport (live: 60vh).
  ["max-h-[60vh]", "viewport height"],
  // Key caps are 0.8em of their hint, below any step (D3).
  ["text-[0.8em]", "key caps"],
  // The search button's shortcut hint, 0.75em of the button's label.
  ["text-[0.75em]", "shortcut hint"],
  // The site name, the brand mark: live's 2rem and 1.1 line height,
  // between the heading steps (3xl is 1.92rem).
  ["text-[2rem]", "site name"],
  ["leading-[1.1]", "site name"],
]);

/** Literal lengths that stylesheets may keep, by file. */
const LENGTHS_ALLOWED = new Map([
  // The note text: the one size between steps (kept, defining).
  ["src/styles/layout.css", ["1.03rem"]],
]);

/** Tailwind's duration steps. */
const DURATIONS = new Set([0, 75, 100, 150, 200, 300, 500, 700, 1000]);

const stylesheets = files("src/styles", ".css").filter(
  path => !path.endsWith("tokens.css")
);
const templates = [
  ...files("src/components", ".astro"),
  ...files("src/layouts", ".astro"),
  ...files("src/pages", ".astro"),
  ...files("src/style-guide", ".astro"),
];

/** The CSS in a stylesheet or in an Astro file's <style> blocks. */
function css(path: string): string {
  const source = read(path);
  if (path.endsWith(".css")) return source;
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map(match => match[1])
    .join("\n");
}

/** Declarations outside comments, with the file they come from. */
function declarations(path: string) {
  const found: { prop: string; value: string; line: number }[] = [];
  postcss
    .parse(css(path))
    .walkDecls(decl =>
      found.push({
        prop: decl.prop,
        value: decl.value,
        line: decl.source!.start!.line,
      })
    );
  return found;
}

/** The markup and frontmatter of a template, without <style> blocks. */
function markup(path: string): string {
  return read(path).replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

const where = (path: string, line: number) => `${path}:${line}`;

/** Multiples of the spacing unit in `--spacing(n)` and `calc(var(--spacing) * n)`. */
function spacingSteps(value: string): number[] {
  return [
    ...value.matchAll(/--spacing\((-?[\d.]+)\)/g),
    ...value.matchAll(/var\(--spacing\)\s*\*\s*(-?[\d.]+)/g),
  ].map(match => Number(match[1]));
}

const isHalfStep = (step: number) => Number.isInteger(step * 2);

describe("tokens", () => {
  // Why: Tailwind's namespaces decide which utilities a token makes, and
  // its step names are what anyone who knows Tailwind reaches for. A token
  // named after one component (`--text-result-title`) is a one-off value
  // with a name, which the scales exist to prevent.
  it("uses only Tailwind's namespaces and step names", () => {
    const stray = [...tokens.keys()].filter(
      name => !NAMESPACES.some(pattern => pattern.test(name))
    );
    assert.deepEqual(stray, []);
  });

  // Why: these steps are incidental to the site's look, so they are
  // Tailwind's own; a later tweak would make `text-sm` or `rounded-lg` mean
  // something other than it does everywhere else.
  it("keeps Tailwind's values for the interface steps", () => {
    const adopted = {
      "--spacing": "0.25rem",
      "--text-xs": "0.75rem",
      "--text-xs--line-height": "calc(1 / 0.75)",
      "--text-base": "1rem",
      "--text-base--line-height": "calc(1.5 / 1)",
      "--text-lg": "1.125rem",
      "--text-lg--line-height": "calc(1.75 / 1.125)",
      "--leading-tight": "1.25",
      "--leading-snug": "1.375",
      "--leading-normal": "1.5",
      "--leading-relaxed": "1.625",
      "--radius-xs": "0.125rem",
      "--radius-sm": "0.25rem",
      "--radius-md": "0.375rem",
      "--radius-lg": "0.5rem",
      "--radius-xl": "0.75rem",
      "--container-6xl": "72rem",
      "--default-transition-duration": "150ms",
      "--default-transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
    };
    assert.deepEqual(
      Object.fromEntries(
        Object.keys(adopted).map(name => [name, tokens.get(name)])
      ),
      adopted
    );
  });

  // Why: small interface text (the file tree, the search button, dates) is
  // live's 0.85rem, the site's own value on Tailwind's step: 14px read a
  // size too big in the sidebar. Its line stays 20px, as Tailwind pairs it.
  it("keeps live's size for the sm step", () => {
    assert.deepEqual(
      [tokens.get("--text-sm"), tokens.get("--text-sm--line-height")],
      ["0.85rem", "calc(1.25 / 0.85)"]
    );
  });
});

describe("stylesheets", () => {
  // Why: a color written as a literal bypasses the palette, so it never
  // changes with it and its contrast is never checked. Callout colors are
  // the vault's data, one per callout type, not design tokens.
  it("write colors through tokens", () => {
    const literals = stylesheets.concat(templates).flatMap(path =>
      declarations(path)
        .filter(
          ({ prop, value }) =>
            !prop.startsWith("--callout-color") &&
            !value.includes("var(--callout-color)") &&
            /#[\da-f]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/i.test(
              value
            )
        )
        .map(({ line, value }) => `${where(path, line)} ${value}`)
    );
    assert.deepEqual(literals, []);
  });

  // Why: lengths come from the spacing unit, a size step, or the text
  // (em), so spacing stays on one grid. 1px and 2px are border widths,
  // which Tailwind also writes as literals.
  it("write lengths through the scales", () => {
    const literals = stylesheets.concat(templates).flatMap(path => {
      const allowed = LENGTHS_ALLOWED.get(path) ?? [];
      return declarations(path).flatMap(({ line, value }) =>
        [...value.matchAll(/(?<![\w.-])-?\d*\.?\d+(px|rem)\b/g)]
          .map(match => match[0])
          .filter(
            length => !/^-?[12]px$/.test(length) && !allowed.includes(length)
          )
          .map(length => `${where(path, line)} ${length}`)
      );
    });
    assert.deepEqual(literals, []);
  });

  // Why: quarter steps (3px, 7px) are the one-off values the spacing
  // scale replaces; half steps are the finest the scale goes.
  it("use whole or half spacing steps", () => {
    const off = stylesheets.flatMap(path =>
      declarations(path).flatMap(({ line, value }) =>
        spacingSteps(value)
          .filter(step => !isHalfStep(step))
          .map(step => `${where(path, line)} ${step}`)
      )
    );
    assert.deepEqual(off, []);
  });

  // Why: transitions share Tailwind's duration steps, so motion feels the
  // same across the site.
  it("use Tailwind's durations", () => {
    const off = stylesheets.flatMap(path =>
      declarations(path).flatMap(({ line, value }) =>
        [...value.matchAll(/(?<![\w.-])(\d+)ms\b/g)]
          .filter(match => !DURATIONS.has(Number(match[1])))
          .map(match => `${where(path, line)} ${match[0]}`)
      )
    );
    assert.deepEqual(off, []);
  });

  // Why: renaming a token leaves `var(--old-name)` behind, which the
  // browser silently drops, so the rule loses its value without an error.
  it("read only tokens that exist", () => {
    const missing = stylesheets.concat(templates).flatMap(path => {
      const local = new Set(declarations(path).map(({ prop }) => prop));
      return declarations(path).flatMap(({ line, value }) =>
        [...value.matchAll(/var\((--[\w-]+)/g)]
          .map(match => match[1]!)
          .filter(
            name =>
              !tokens.has(name) && !local.has(name) && !name.startsWith("--tw-")
          )
          .map(name => `${where(path, line)} ${name}`)
      );
    });
    assert.deepEqual(missing, []);
  });
});

describe("templates", () => {
  // Why: an arbitrary value (`gap-[3px]`, `w-(--x)`, `text-sm/[normal]`) is a
  // one-off outside the scales. The few that no utility covers are listed,
  // with reasons.
  it("use no arbitrary values beyond the listed ones", () => {
    const found = templates.flatMap(path =>
      [
        ...markup(path).matchAll(
          /[\w:*&./-]*(?:[-/]\[[^\]\s"'`]+\]|\[[\w&:-]+:[^\]\s"'`]+\](?::[\w-]+)?|[-/]\(--[\w-]+\))/g
        ),
      ]
        .map(match => match[0].replace(/^(?:[\w-]+:)*(?=[\w[*&])/, ""))
        .filter(candidate => !ARBITRARY_ALLOWED.has(candidate))
        .map(candidate => `${path} ${candidate}`)
    );
    assert.deepEqual(found, []);
  });

  // Why: the same grid as the stylesheets: `py-0.75` (3px) is a quarter step.
  it("use whole or half spacing steps", () => {
    const off = templates.flatMap(path =>
      [
        ...markup(path).matchAll(
          /(?<![\w-])-?(?:[pm][xytrblse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left|[wh]|size|min-[wh]|max-[wh]|basis|translate-[xy]|indent)-(\d+\.\d+)(?![\w.])/g
        ),
      ]
        .filter(match => !isHalfStep(Number(match[1])))
        .map(match => `${path} ${match[0]}`)
    );
    assert.deepEqual(off, []);
  });

  // Why: as in the stylesheets, motion uses Tailwind's duration steps.
  it("use Tailwind's durations", () => {
    const off = templates.flatMap(path =>
      [...markup(path).matchAll(/(?<![\w-])duration-(\d+)(?![\w.])/g)]
        .filter(match => !DURATIONS.has(Number(match[1])))
        .map(match => `${path} ${match[0]}`)
    );
    assert.deepEqual(off, []);
  });
});
