const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { toTitleCase } = require("../src/helpers/utils");

describe("toTitleCase", () => {
  it("capitalizes a single word", () => {
    assert.equal(toTitleCase("aside"), "Aside");
  });

  it("title-cases a hyphenated type, replacing hyphens with spaces", () => {
    assert.equal(toTitleCase("book-open"), "Book Open");
  });

  it("uses the override for ai-text", () => {
    assert.equal(toTitleCase("ai-text"), "AI Text");
  });

  it("uses the override for AI-TEXT (case-insensitive lookup)", () => {
    assert.equal(toTitleCase("AI-TEXT"), "AI Text");
  });

  it("lowercases non-initial letters", () => {
    assert.equal(toTitleCase("WARNING"), "Warning");
  });

  it("handles multi-hyphen types", () => {
    assert.equal(toTitleCase("my-cool-callout"), "My Cool Callout");
  });

  it("passes through an already title-cased string", () => {
    assert.equal(toTitleCase("Note"), "Note");
  });

  it("handles an empty string", () => {
    assert.equal(toTitleCase(""), "");
  });
});
