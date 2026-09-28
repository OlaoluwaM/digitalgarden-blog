/**
 * Unit tests for `contentsEntries`, which picks the headings a note's table
 * of contents lists from the headings Astro collects while rendering it.
 *
 * Why this level: the choice (which levels, which headings, and when a note
 * gets a table of contents at all) is a pure function of that list, so a
 * unit test pins every rule without building a note.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentsEntries } from "../src/content/table-of-contents.ts";

const heading = (depth: number, text: string, slug = text.toLowerCase()) => ({
  depth,
  slug,
  text,
});

describe("contentsEntries", () => {
  // Why: h2 and h3 are a note's sections and subsections. The note title
  // is the page's h1 (in the header, not the Markdown), and h4 to h6 are
  // too fine-grained for a list meant to be scanned.
  it("lists h2 and h3 headings in order, with their level", () => {
    assert.deepEqual(
      contentsEntries([
        heading(2, "Setup"),
        heading(3, "Nix"),
        heading(4, "Flakes"),
        heading(1, "Stray title"),
        heading(3, "Home Manager"),
        heading(2, "Wrap-up"),
      ]),
      [
        { depth: 2, slug: "setup", text: "Setup" },
        { depth: 3, slug: "nix", text: "Nix" },
        { depth: 3, slug: "home manager", text: "Home Manager" },
        { depth: 2, slug: "wrap-up", text: "Wrap-up" },
      ]
    );
  });

  // Why: a table of contents for one or two sections only repeats what a
  // glance at the note shows (the agreed threshold is three).
  it("returns nothing for fewer than three headings", () => {
    assert.deepEqual(contentsEntries([]), []);
    assert.deepEqual(
      contentsEntries([heading(2, "One"), heading(3, "Two")]),
      []
    );
    assert.equal(
      contentsEntries([heading(2, "One"), heading(2, "Two"), heading(3, "3")])
        .length,
      3
    );
  });

  // Why: the Markdown pipeline labels the footnotes list with an h2 meant
  // for screen readers only (`.sr-only`); it is not a section of the note.
  it("leaves out the footnotes label", () => {
    assert.deepEqual(
      contentsEntries([
        heading(2, "One"),
        heading(2, "Two"),
        heading(2, "Three"),
        heading(2, "Footnotes", "footnote-label"),
      ]).map(entry => entry.slug),
      ["one", "two", "three"]
    );
  });
});
