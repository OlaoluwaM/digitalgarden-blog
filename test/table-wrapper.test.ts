/**
 * Render through the site's Markdown processor: every table must come out
 * wrapped in a `div.table-wrapper`, the box that scrolls a table wider than
 * the note column (styles/content/typography.css). These are processor
 * tests; test/layout/tables.test.ts checks the scrolling in Chrome.
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

const table = `| Task | Stack | Cabal |
| --- | --- | --- |
| Build | \`stack build\` | \`cabal build all\` |`;

describe("table wrapper", () => {
  // Why: without the wrapper, a table wider than the column is clipped
  // by the page's `overflow-x: hidden` on phones, with no way to reach
  // its last columns. The wrapper is what scrolls.
  it("wraps a table in a table-wrapper div", async () => {
    const root = await render(table);
    const wrapper = root.querySelector("div.table-wrapper");
    assert.ok(wrapper, root.toString());
    assert.equal(wrapper.childNodes.length, 1);
    assert.equal(wrapper.firstElementChild?.tagName, "TABLE");
    assert.equal(root.querySelectorAll("table").length, 1);
  });

  // Why: each table gets its own box, including tables inside callouts,
  // which are rendered by another plugin.
  it("wraps every table, inside callouts too", async () => {
    const root = await render(
      `${table}\n\nBetween.\n\n${table}\n\n> [!note]\n> ${table.replace(/\n/g, "\n> ")}`
    );
    assert.equal(root.querySelectorAll("table").length, 3);
    assert.equal(root.querySelectorAll("div.table-wrapper > table").length, 3);
    assert.ok(root.querySelector(".callout-content div.table-wrapper > table"));
  });

  // Why: the wrapper is a plain box. Keyboard access (a tab stop, a role,
  // and a label) is added by scripts/scrollRegions.ts only while the table
  // overflows, so a table that fits adds no stop to the tab order.
  it("adds no tab stop, role, or label to the markup", async () => {
    const wrapper = (await render(table)).querySelector("div.table-wrapper");
    assert.deepEqual(wrapper?.attributes, { class: "table-wrapper" });
  });
});
