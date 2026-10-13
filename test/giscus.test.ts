/**
 * Giscus comments (ADR 0008): the settings the widget is given, when it is
 * allowed to load, the font that draws its reactions, the theme built from
 * the site's tokens, and the two config files giscus.app and Vercel read.
 *
 * Why this level: each is a value or a pure function, so it is checked
 * without a build. The page side (where the section sits, which pages get
 * it, what shows without JavaScript) is test/components/comments.test.ts and
 * test/layout/comments.test.ts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import opentype from "opentype.js";
import postcss from "postcss";
import {
  giscus,
  giscusAttributes,
  giscusEnabled,
  giscusThemeCss,
} from "../src/lib/giscus.ts";
import { lucideFont, reactionIconsFont } from "../src/lib/reaction-icons.ts";
import { parseTokens } from "../src/lib/tokens.ts";

const tokens = parseTokens(readFileSync("src/styles/tokens.css", "utf8"));
const reactionFont = reactionIconsFont(lucideFont());

describe("giscusEnabled", () => {
  // Why: a note's thread is found by its permalink, which previews and
  // localhost share with production, so a comment left anywhere but
  // thunk.blog would land in the real discussion. Only Vercel's production
  // build may load the widget.
  it("allows only Vercel's production build", () => {
    assert.equal(giscusEnabled({ VERCEL_ENV: "production" }), true);
    for (const env of [
      { VERCEL_ENV: "preview" },
      { VERCEL_ENV: "development" },
      {},
    ]) {
      assert.equal(giscusEnabled(env), false, JSON.stringify(env));
    }
  });

  // Why: the giscus preview (scripts/giscus-preview.ts) shows the widget
  // on `astro dev`, which it serves as thunk.blog, and sets
  // GISCUS_PREVIEW to load it there. A build must ignore the variable, or
  // setting it on Vercel would load the widget on every preview.
  it("lets the giscus preview load it on the dev server only", () => {
    assert.equal(giscusEnabled({ GISCUS_PREVIEW: "1" }, { dev: true }), true);
    assert.equal(giscusEnabled({ GISCUS_PREVIEW: "1" }), false);
    assert.equal(
      giscusEnabled({ VERCEL_ENV: "preview", GISCUS_PREVIEW: "1" }),
      false
    );
    assert.equal(giscusEnabled({}, { dev: true }), false);
  });
});

describe("giscusAttributes", () => {
  // Why: these are the ADR's settings, and each one changes what readers
  // get: the wrong category id or term attaches a note to no thread, or to
  // another note's; `strict` keeps GitHub's fuzzy search from matching
  // part 1's permalink to part 2's thread; reactions are the upvotes; the
  // theme must be the site's own stylesheet on thunk.blog.
  it("gives the widget the ADR's settings", () => {
    assert.deepEqual(giscusAttributes("/posts/be-deliberate/"), {
      "data-repo": "OlaoluwaM/digitalgarden-blog",
      "data-repo-id": "R_kgDORsRDnA",
      "data-category": "Comments",
      "data-category-id": "DIC_kwDORsRDnM4DIGmI",
      "data-mapping": "specific",
      "data-term": "/posts/be-deliberate",
      "data-strict": "1",
      "data-reactions-enabled": "1",
      "data-emit-metadata": "0",
      "data-input-position": "top",
      "data-theme": "https://thunk.blog/giscus-theme.css",
      "data-lang": "en",
      "data-loading": "lazy",
    });
  });

  // Why: the live site answers a note at `/x`, `/x/`, and `/x/index.html`.
  // With `pathname` mapping each would get its own thread and its own
  // upvote count, so the term is the note's permalink, whatever URL the
  // reader came in by. It drops a trailing slash, as the site's route
  // check does (content/permalinks.ts), so a permalink that only gains or
  // loses one keeps its thread.
  it("keys a note's thread on its permalink, not the URL used", () => {
    for (const permalink of ["/posts/a/", "/posts/a", "/posts/a//"]) {
      const attributes = giscusAttributes(permalink);
      assert.equal(attributes["data-mapping"], "specific");
      assert.equal(attributes["data-term"], "/posts/a", permalink);
    }
  });

  // Why: without JavaScript the section links readers to the discussions
  // instead; a note's own thread exists only after its first comment, so
  // the link is the category's.
  it("links the category's discussions on GitHub", () => {
    assert.equal(
      giscus.categoryUrl,
      "https://github.com/OlaoluwaM/digitalgarden-blog/discussions/categories/comments"
    );
  });
});

describe("reactionIconsFont", () => {
  // Why: the theme draws giscus's reactions with Lucide icons by giving the
  // emoji this font. A character the font lacks falls back to the reader's
  // color emoji with no error, and the iframe is out of our tests' reach,
  // so a gap would ship unseen. ❤️ is U+2764 then U+FE0F, which asks for
  // color; the font must cover both, or browsers may draw the color heart.
  it("covers every character of giscus's eight reactions", () => {
    const font = opentype.parse(reactionFont);
    for (const reaction of GISCUS_REACTIONS) {
      for (const char of reaction) {
        const codePoint = char.codePointAt(0)!.toString(16).toUpperCase();
        assert.ok(font.hasChar(char), `${reaction} lacks U+${codePoint}`);
      }
    }
  });

  // Why: covering U+FE0F is not enough. Chrome draws a character followed
  // by U+FE0F only from a color font, so a plain font loses ❤️ to the
  // color emoji. Each icon must be a color glyph, and its one layer must be
  // in the text color, or the icons would stop taking the theme's grays.
  it("is a color font drawn in the text color", () => {
    const font = opentype.parse(reactionFont);
    for (const reaction of GISCUS_REACTIONS) {
      const layers = font.layers.get(font.charToGlyph(reaction).index);
      assert.deepEqual(
        layers.map(layer => layer.paletteIndex),
        [0xffff],
        reaction
      );
    }
  });
});

describe("giscusThemeCss", () => {
  const css = giscusThemeCss(tokens, reactionFont);
  const root = postcss.parse(css);
  const variables = new Map<string, string>();
  root.walkRules("main", rule =>
    rule.walkDecls(decl => variables.set(decl.prop, decl.value))
  );
  const token = (name: string) => tokens.get(name)!;

  // Why: the widget must look like the rest of the site (ADR 0008), so its
  // text, surfaces, borders, buttons, and links take the site's grays from
  // tokens.css, read at build time so they cannot drift.
  it("colors the widget with the site's tokens", () => {
    for (const [variable, tokenName] of [
      ["--color-fg-default", "--color-gray-50"],
      ["--color-fg-muted", "--color-gray-300"],
      ["--color-canvas-default", "--color-gray-950"],
      ["--color-canvas-subtle", "--color-gray-900"],
      ["--color-border-default", "--color-gray-700"],
      ["--color-btn-bg", "--color-gray-900"],
      ["--color-btn-border", "--color-gray-700"],
      ["--color-btn-hover-border", "--color-gray-100"],
      ["--color-btn-primary-bg", "--color-gray-700"],
      ["--color-btn-primary-text", "--color-gray-50"],
      ["--color-accent-fg", "--color-gray-100"],
    ]) {
      assert.equal(variables.get(variable!), token(tokenName!), variable);
    }
  });

  // Why: giscus replaces its whole default theme with this file, so every
  // variable its dark theme sets must be set here too, or that part of
  // the widget falls back to nothing.
  it("sets every variable giscus's dark theme sets", () => {
    for (const variable of GISCUS_DARK_VARIABLES) {
      assert.ok(variables.has(variable), `${variable} is missing`);
    }
  });

  // Why: the page is always dark. An iframe whose color scheme differs from
  // the page's is painted with an opaque background, so a reader whose
  // system is in light mode would see a white box.
  it("keeps the widget dark whatever the reader's system setting", () => {
    let scheme: string | undefined;
    root.walkDecls("color-scheme", decl => {
      scheme = decl.value;
    });
    assert.equal(scheme, "dark");
  });

  // Why: the iframe can't use the page's fonts, so the theme loads
  // Instrument Sans itself, by absolute URL (it is read on giscus.app).
  it("sets the site's text font from thunk.blog", () => {
    assert.match(
      css,
      /src: url\("https:\/\/thunk\.blog\/fonts\/instrument-sans\.woff2"\)/
    );
    assert.match(css, /font-family: "Instrument Sans"/);
  });

  // Why: three variables mix a gray with transparency, which needs the
  // gray as six-digit hex. Every other token read fails the build when the
  // token is missing; a gray in another format must fail it too, not turn
  // those colors into `NaN` with a green build.
  it("fails on a gray it can't mix with transparency", () => {
    const changed = new Map(tokens);
    changed.set("--color-gray-200", "oklch(70% 0 0)");
    assert.throws(
      () => giscusThemeCss(changed, reactionFont),
      /--color-gray-200/
    );
  });

  // Why: comments use Markdown, so *emphasis* needs the italic face, or
  // the browser slants the upright one.
  it("loads the italic face for emphasis", () => {
    assert.match(
      css,
      /font-style: italic;[^}]*src: url\("https:\/\/thunk\.blog\/fonts\/instrument-sans-italic\.woff2"\)/
    );
  });
});

describe("giscus.json", () => {
  const config = JSON.parse(readFileSync("giscus.json", "utf8")) as {
    origins?: string[];
    originsRegex?: string[];
    defaultCommentOrder?: string;
  };

  // Why: giscus.app reads this file from the repository and refuses to load
  // on any other origin: previews and localhost can't post to the real
  // threads even if the page let the widget through.
  it("lets only thunk.blog load the discussions", () => {
    assert.deepEqual(config.origins, ["https://thunk.blog"]);
    assert.equal(config.originsRegex, undefined);
  });

  // Why: giscus has no "popular" order; oldest first reads as a
  // conversation (ADR 0008). It is giscus's default too; stated here so a
  // change of default upstream can't flip it.
  it("shows the oldest comments first", () => {
    assert.equal(config.defaultCommentOrder, "oldest");
  });
});

describe("vercel.json", () => {
  const { headers = [] } = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    headers?: { source: string; headers: { key: string; value: string }[] }[];
  };
  const header = (source: string, key: string) =>
    headers
      .find(rule => rule.source === source)
      ?.headers.find(entry => entry.key === key)?.value;

  // Why: giscus loads the theme with `crossorigin="anonymous"`, and the
  // theme loads the fonts, so both must allow giscus.app. Vercel sends
  // `Access-Control-Allow-Origin: *` on static files today; these rules
  // state it for giscus.app so the widget doesn't depend on that default.
  it("lets giscus.app read the theme and the fonts", () => {
    for (const source of ["/giscus-theme.css", "/fonts/(.*)"]) {
      assert.equal(
        header(source, "Access-Control-Allow-Origin"),
        "https://giscus.app",
        source
      );
    }
  });
});

// The reactions giscus shows, as it writes them (`Reactions` in
// lib/reactions.ts, giscus main branch, 2026-10-12).
const GISCUS_REACTIONS = ["👍", "👎", "😄", "🎉", "😕", "❤️", "🚀", "👀"];

// The variables in giscus's dark theme (styles/themes/dark.css, giscus
// main branch, 2026-10-12).
const GISCUS_DARK_VARIABLES = [
  "--color-prettylights-syntax-comment",
  "--color-prettylights-syntax-constant",
  "--color-prettylights-syntax-entity",
  "--color-prettylights-syntax-storage-modifier-import",
  "--color-prettylights-syntax-entity-tag",
  "--color-prettylights-syntax-keyword",
  "--color-prettylights-syntax-string",
  "--color-prettylights-syntax-variable",
  "--color-prettylights-syntax-brackethighlighter-unmatched",
  "--color-prettylights-syntax-invalid-illegal-text",
  "--color-prettylights-syntax-invalid-illegal-bg",
  "--color-prettylights-syntax-carriage-return-text",
  "--color-prettylights-syntax-carriage-return-bg",
  "--color-prettylights-syntax-string-regexp",
  "--color-prettylights-syntax-markup-list",
  "--color-prettylights-syntax-markup-heading",
  "--color-prettylights-syntax-markup-italic",
  "--color-prettylights-syntax-markup-bold",
  "--color-prettylights-syntax-markup-deleted-text",
  "--color-prettylights-syntax-markup-deleted-bg",
  "--color-prettylights-syntax-markup-inserted-text",
  "--color-prettylights-syntax-markup-inserted-bg",
  "--color-prettylights-syntax-markup-changed-text",
  "--color-prettylights-syntax-markup-changed-bg",
  "--color-prettylights-syntax-markup-ignored-text",
  "--color-prettylights-syntax-markup-ignored-bg",
  "--color-prettylights-syntax-meta-diff-range",
  "--color-prettylights-syntax-brackethighlighter-angle",
  "--color-prettylights-syntax-sublimelinter-gutter-mark",
  "--color-prettylights-syntax-constant-other-reference-link",
  "--color-btn-text",
  "--color-btn-bg",
  "--color-btn-border",
  "--color-btn-shadow",
  "--color-btn-inset-shadow",
  "--color-btn-hover-bg",
  "--color-btn-hover-border",
  "--color-btn-active-bg",
  "--color-btn-active-border",
  "--color-btn-selected-bg",
  "--color-btn-primary-text",
  "--color-btn-primary-bg",
  "--color-btn-primary-border",
  "--color-btn-primary-shadow",
  "--color-btn-primary-inset-shadow",
  "--color-btn-primary-hover-bg",
  "--color-btn-primary-hover-border",
  "--color-btn-primary-selected-bg",
  "--color-btn-primary-selected-shadow",
  "--color-btn-primary-disabled-text",
  "--color-btn-primary-disabled-bg",
  "--color-btn-primary-disabled-border",
  "--color-action-list-item-default-hover-bg",
  "--color-segmented-control-bg",
  "--color-segmented-control-button-bg",
  "--color-segmented-control-button-selected-border",
  "--color-fg-default",
  "--color-fg-muted",
  "--color-fg-subtle",
  "--color-canvas-default",
  "--color-canvas-overlay",
  "--color-canvas-inset",
  "--color-canvas-subtle",
  "--color-border-default",
  "--color-border-muted",
  "--color-neutral-muted",
  "--color-accent-fg",
  "--color-accent-emphasis",
  "--color-accent-muted",
  "--color-accent-subtle",
  "--color-success-fg",
  "--color-attention-fg",
  "--color-attention-muted",
  "--color-attention-subtle",
  "--color-danger-fg",
  "--color-danger-muted",
  "--color-danger-subtle",
  "--color-primer-shadow-inset",
  "--color-scale-gray-7",
  "--color-scale-blue-8",
  "--color-social-reaction-bg-hover",
  "--color-social-reaction-bg-reacted-hover",
];
