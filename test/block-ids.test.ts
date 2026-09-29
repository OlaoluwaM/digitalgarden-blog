/**
 * Render the publisher's block-ID markers (`{ #block-id}`, its rewrite of
 * Obsidian's `^block-id`) through the site's Markdown processor: each
 * becomes the ID of the block it marks, and the marker disappears.
 *
 * Why this level: a block embed's link, and a `[[Note#^block-id]]`
 * wikilink, point at these IDs; only the real processor shows which
 * element carries each one (a tight list renders no paragraph, the table
 * wrapper wraps tables) and that wikilinks agree with it. No published note
 * has a block ID yet, so the markers are written as the publisher writes
 * them.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateConfig } from "astro/config";
import { parse } from "node-html-parser";
import siteConfig from "../astro.config.ts";

const { markdown } = await validateConfig(
  siteConfig,
  fileURLToPath(new URL("../", import.meta.url)),
  "build"
);
const renderer = await markdown.processor.createRenderer(markdown);

async function render(source: string) {
  const { code } = await renderer.render(source);
  return parse(code);
}

describe("block IDs", () => {
  // Why: `text ^id` ends its paragraph; the publisher puts the marker on
  // the paragraph's last line.
  it("puts a trailing marker's ID on its paragraph", async () => {
    const root = await render("Some *text* \n{ #para-id}\n\n");
    const paragraph = root.querySelector("p");
    assert.equal(paragraph?.id, "para-id");
    assert.equal(paragraph?.innerHTML, "Some <em>text</em>");
  });

  // Why: a tight list renders its items without paragraphs, so the ID must
  // go on the list item to exist at all.
  it("puts a list item's ID on the item", async () => {
    const root = await render("- first \n{ #item-id}\n- second");
    const items = root.querySelectorAll("li");
    assert.deepEqual(
      items.map(item => [item.id, item.textContent.trim()]),
      [
        ["item-id", "first"],
        ["", "second"],
      ]
    );
  });

  // Why: `^id` on its own line after a list, quote, or table marks that
  // whole block.
  for (const [name, block, selector] of [
    ["list", "- one\n- two", "ul"],
    ["blockquote", "> quoted", "blockquote"],
    ["table", "| a |\n|---|\n| 1 |", "table"],
  ] as const) {
    it(`puts an own-line marker's ID on the ${name} before it`, async () => {
      const root = await render(`${block}\n\n{ #${name}-id}\n\nAfter.`);
      assert.equal(root.querySelector(selector)?.id, `${name}-id`);
      assert.equal(root.toString().includes("{ #"), false);
    });
  }

  // Why: a heading's ID is what heading links and the table of contents
  // use; a block ID must not replace it.
  it("keeps a heading's own ID", async () => {
    const root = await render("## Setup \n{ #setup-block}\n\nText.");
    assert.equal(root.querySelector("h2")?.id, "setup");
    assert.equal(root.toString().includes("{ #"), false);
  });

  // Why: only the publisher's exact form is a marker; braces in prose stay.
  it("leaves braces in running text alone", async () => {
    const root = await render("Set { #not-an-id} here.");
    assert.equal(
      root.querySelector("p")?.textContent,
      "Set { #not-an-id} here."
    );
    assert.equal(root.querySelector("[id]"), null);
  });

  // Why: `[[Note#^block-id]]` must reach the block the marker labelled.
  it("matches a block wikilink's fragment", async () => {
    const root = await render("[[Outbox/Digital Garden & Blog/Home#^para-id]]");
    assert.equal(root.querySelector("a")?.getAttribute("href"), "/#para-id");
  });
});
