/**
 * Render through the site's Astro processor: `==text==` must become
 * `<mark>text</mark>`, as Eleventy's markdown-it-mark and Obsidian render
 * it. These are processor tests, not full builds.
 *
 * Why this level: highlighting is a Markdown rule, so rendering Markdown
 * through the real pipeline (with the wikilink and callout plugins beside
 * it) is the cheapest check that shows the output a note gets.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateConfig } from "astro/config";
import siteConfig from "../astro.config.ts";

const { markdown } = await validateConfig(
  siteConfig,
  fileURLToPath(new URL("../", import.meta.url)),
  "build"
);
const renderer = await markdown.processor.createRenderer(markdown);

async function render(source: string): Promise<string> {
  const { code } = await renderer.render(source);
  return code.trim();
}

describe("highlights", () => {
  // Why: the basic Obsidian syntax; before this plugin Sätteri printed the
  // equals signs.
  it("marks ==text==", async () => {
    assert.equal(
      await render("Read ==this part== first."),
      "<p>Read <mark>this part</mark> first.</p>"
    );
  });

  // Why: a paragraph can hold several highlights; each pair of markers
  // closes its own.
  it("marks several highlights in one paragraph", async () => {
    assert.equal(
      await render("==One== and ==two=="),
      "<p><mark>One</mark> and <mark>two</mark></p>"
    );
  });

  // Why: Obsidian and markdown-it-mark let a highlight hold other inline
  // formatting and links, and sit inside bold or italics.
  it("spans inline formatting and nests inside it", async () => {
    assert.equal(
      await render("==**bold** and _italic_=="),
      "<p><mark><strong>bold</strong> and <em>italic</em></mark></p>"
    );
    assert.equal(
      await render("**Bold ==and marked==**"),
      "<p><strong>Bold <mark>and marked</mark></strong></p>"
    );
    assert.match(
      await render("==see [the docs](https://example.com)=="),
      /^<p><mark>see <a [^>]*class="external-link"[^>]*>the docs<\/a><\/mark><\/p>$/
    );
  });

  // Why: headings, list items, table cells, and callouts hold text too.
  it("marks text in headings, lists, tables, and callouts", async () => {
    assert.match(
      await render("## A ==key== idea"),
      /<h2[^>]*>A <mark>key<\/mark> idea<\/h2>/
    );
    assert.match(
      await render("- a ==list== item"),
      /<li>a <mark>list<\/mark> item<\/li>/
    );
    assert.match(
      await render("| A |\n| - |\n| ==cell== |"),
      /<td><mark>cell<\/mark><\/td>/
    );
    assert.match(
      await render("> [!note]\n> A ==marked== note."),
      /<p>A <mark>marked<\/mark> note\.<\/p>/
    );
  });

  // Why: code shows the source as written; `==` is common in code
  // (comparisons), so it must never turn into a highlight there.
  it("leaves code alone", async () => {
    assert.equal(
      await render("`a == b` and `==x==`"),
      "<p><code>a == b</code> and <code>==x==</code></p>"
    );
    // Shiki splits the code into token spans, so check for the absence of a
    // highlight rather than for the literal text.
    assert.doesNotMatch(
      await render("```js\nif (a == b) return ==x==;\n```"),
      /<mark>/
    );
  });

  // Why: markers must hug the text, as in markdown-it-mark, so prose like
  // "a == b" or a lone "==" stays as written.
  it("needs markers that hug the text, and a closing marker", async () => {
    for (const source of [
      "a == b",
      "== spaced ==",
      "==open only",
      "empty ====",
    ]) {
      assert.doesNotMatch(await render(source), /<mark>/, source);
    }
  });
});
