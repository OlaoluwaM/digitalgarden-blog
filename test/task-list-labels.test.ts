/**
 * Render through the site's Markdown processor: each task-list checkbox
 * must sit in a <label> with its item's text, so the checkbox has a name
 * (axe `label`; WCAG 4.1.2). These are processor tests;
 * test/layout/task-lists.test.ts checks the names and axe in Chrome.
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

/** Each checkbox's label text, whitespace collapsed. */
async function labels(source: string) {
  const root = await render(source);
  return root.querySelectorAll('input[type="checkbox"]').map(input => {
    const label = input.parentNode;
    assert.equal(label.tagName, "LABEL", root.toString());
    return label.text.replace(/\s+/g, " ").trim();
  });
}

describe("task list labels", () => {
  // Why: an unlabeled checkbox is announced only as "checkbox, not
  // checked", with nothing saying what the task is. Wrapping the box and
  // the item's text in a label names it with that text, formatting and
  // links included.
  it("labels each checkbox with its item's text", async () => {
    assert.deepEqual(
      await labels("- [ ] Todo **bold**\n- [x] Done [link](https://x.y)"),
      ["Todo bold", "Done link"]
    );
  });

  // Why: a nested list belongs to the item, not to its checkbox's name;
  // inside the label it would be read as part of every parent's name.
  it("leaves a nested list outside the label, and labels its items", async () => {
    const source = "- [x] Parent\n  - [ ] Child one\n  - [ ] Child two";
    assert.deepEqual(await labels(source), [
      "Parent",
      "Child one",
      "Child two",
    ]);
    const root = await render(source);
    assert.equal(root.querySelector("label ul"), null);
  });

  // Why: in a loose list each item's text is a paragraph; the label goes
  // inside the paragraph, and later paragraphs stay out of the name.
  it("labels the first paragraph of a loose list's items", async () => {
    const source = "- [ ] Loose one\n\n- [x] Loose two\n\n  Second paragraph";
    assert.deepEqual(await labels(source), ["Loose one", "Loose two"]);
    const root = await render(source);
    assert.equal(root.querySelectorAll("p > label").length, 2);
    assert.equal(root.querySelector("label p"), null);
  });

  // Why: ordered task lists render the same checkboxes.
  it("labels an ordered list's checkboxes", async () => {
    assert.deepEqual(await labels("1. [ ] First\n2. [x] Second"), [
      "First",
      "Second",
    ]);
  });

  // Why: the checkboxes stay disabled, as the renderer makes them: the
  // label only names them, it doesn't make a published note editable.
  it("keeps the checkboxes disabled and their checked state", async () => {
    const root = await render("- [ ] Open\n- [x] Done");
    const boxes = root.querySelectorAll('input[type="checkbox"]');
    assert.deepEqual(
      boxes.map(box => [
        box.hasAttribute("disabled"),
        box.hasAttribute("checked"),
      ]),
      [
        [true, false],
        [true, true],
      ]
    );
  });

  // Why: only task-list checkboxes are the plugin's to label; a list item
  // that merely starts with other markup is left as written.
  it("leaves ordinary list items alone", async () => {
    const root = await render("- Plain item\n- **Bold** item");
    assert.equal(root.querySelector("label"), null);
  });
});
