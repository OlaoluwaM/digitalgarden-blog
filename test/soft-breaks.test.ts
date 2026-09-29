/**
 * Render through the site's Astro processor: a single newline inside a
 * paragraph must become a `<br>`, as Obsidian shows it (with "Strict line
 * breaks" off, its default) and as Eleventy rendered it (`breaks: true`).
 * These are processor tests, not full builds.
 *
 * Why this level: line breaks are a Markdown rule, so rendering Markdown
 * through the real pipeline (with the callout and highlight plugins beside
 * it) is the cheapest check that shows the output a note gets.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

/**
 * A callout's title text and its body, without the icon markup or the
 * whitespace around the body.
 */
async function callout(source: string) {
  const html = await render(source);
  return {
    title: /<div class="callout-title-inner">(.*?)<\/div>/.exec(html)?.[1],
    content: /<div class="callout-content">(.*?)<\/div>/s
      .exec(html)?.[1]
      ?.trim(),
  };
}

describe("soft line breaks", () => {
  // Why: the rule itself. CommonMark renders the newline as a space, so
  // lines written one under the other ran together on the page.
  it("breaks a paragraph's lines where the source breaks them", async () => {
    assert.equal(
      await render("First line\nSecond line"),
      "<p>First line<br>\nSecond line</p>"
    );
  });

  // Why: a newline can fall inside bold text or a link; Obsidian and
  // markdown-it break the line there too. A code span can't hold one:
  // CommonMark turns it into a space.
  it("breaks inside inline formatting and links, not code", async () => {
    assert.equal(
      await render("**bold\nnext** `co\nde`"),
      "<p><strong>bold<br>\nnext</strong> <code>co de</code></p>"
    );
    assert.match(
      await render("[link\ntext](https://example.com)"),
      /^<p><a [^>]*>link<br>\ntext<\/a><\/p>$/
    );
  });

  // Why: NixOS part 1 relied on this: lines under a list item's text stay
  // on their own lines.
  it("breaks the lines of a list item", async () => {
    assert.equal(
      await render("- item\n  continued\n- two"),
      "<ul>\n<li>item<br>\ncontinued</li>\n<li>two</li>\n</ul>"
    );
  });

  // Why: a line ending in two spaces is already a hard break; it must not
  // get a second `<br>`.
  it("leaves hard breaks as they are", async () => {
    assert.equal(
      await render("Hard  \nbreak\nsoft"),
      "<p>Hard<br>\nbreak<br>\nsoft</p>"
    );
  });

  // Why: the callout plugin splits a callout's title from its body at the
  // first newline, so that newline must survive; the body's lines break.
  it("keeps a callout's title and breaks its body", async () => {
    assert.deepEqual(await callout("> [!note] Title\n> one\n> two"), {
      title: "Title",
      content: "<p>one<br>\ntwo</p>",
    });
    assert.deepEqual(await callout("> [!note]\n> one\n> two"), {
      title: "Note",
      content: "<p>one<br>\ntwo</p>",
    });
  });

  // Why: an Admonition fence becomes a callout too, but through its own
  // plugin, which puts the `title:` on a line of its own; its title must
  // still come through, and its body's lines break as in any callout.
  it("keeps an admonition's title and breaks its body", async () => {
    assert.deepEqual(await callout("```ad-note\ntitle: Title\none\ntwo\n```"), {
      title: "Title",
      content: "<p>one<br>\ntwo</p>",
    });
  });

  // Why: only a callout's opening line is a title; a plain quote breaks
  // every line.
  it("breaks every line of a plain quote", async () => {
    assert.equal(
      await render("> one\n> two"),
      "<blockquote>\n<p>one<br>\ntwo</p>\n</blockquote>"
    );
  });

  // Why: the plugin runs after highlights, so a highlight spanning lines is
  // still paired, and the break lands inside it.
  it("breaks inside a highlight that spans lines", async () => {
    assert.equal(
      await render("==one\ntwo=="),
      "<p><mark>one<br>\ntwo</mark></p>"
    );
  });

  // Why: the one published note that relied on single newlines. NixOS part
  // 1 put a "package" definition and its tab-indented examples under one
  // list item, and no Markdown parser reads those lines as a list; live
  // showed them on their own lines only because of `breaks: true`. The
  // fixture is the note as published before the vault fix nested the
  // examples, kept out of src/site/notes so publishing never changes it.
  // Live renders this item as these seven lines (their first 40 characters).
  it("breaks NixOS part 1's package examples onto their own lines", async () => {
    const note = await readFile(
      new URL("fixtures/notes/nixos-part-1-soft-breaks.md", import.meta.url),
      "utf8"
    );
    const html = await render(note.replace(/^---\n[\s\S]*?\n---\n/, ""));
    const item = /<li>(A <strong>derivation<\/strong>[\s\S]*?)<\/li>/.exec(
      html
    )?.[1];
    assert.ok(item, "the derivation list item");
    const lines = item
      .split("<br>")
      .map(line =>
        line
          .replace(/<[^>]+>/g, "")
          .replace(/&quot;/g, '"')
          .trim()
      )
      .map(line => line.slice(0, 40));
    assert.deepEqual(lines, [
      "A derivation is a build recipe/blueprint",
      '- I put the term "package" in quotes abo',
      "- a derivation itself (confusing, I know",
      "- the result of a derivation.",
      "- a program or tool (like usual).",
      "- a library (like those libutils or what",
      "- a font, config, man pages, really any ",
    ]);
  });
});
