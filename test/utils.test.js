import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { toTitleCase } = require("../src/helpers/utils");

describe("toTitleCase", () => {
  it("capitalizes a single word", () => {
    expect(toTitleCase("aside")).toBe("Aside");
  });

  it("title-cases a hyphenated type, replacing hyphens with spaces", () => {
    expect(toTitleCase("book-open")).toBe("Book Open");
  });

  it("uses the override for ai-text", () => {
    expect(toTitleCase("ai-text")).toBe("AI Text");
  });

  it("uses the override for AI-TEXT (case-insensitive lookup)", () => {
    expect(toTitleCase("AI-TEXT")).toBe("AI Text");
  });

  it("lowercases non-initial letters", () => {
    expect(toTitleCase("WARNING")).toBe("Warning");
  });

  it("handles multi-hyphen types", () => {
    expect(toTitleCase("my-cool-callout")).toBe("My Cool Callout");
  });

  it("passes through an already title-cased string", () => {
    expect(toTitleCase("Note")).toBe("Note");
  });

  it("handles an empty string", () => {
    expect(toTitleCase("")).toBe("");
  });
});
