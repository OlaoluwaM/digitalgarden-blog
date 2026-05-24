import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { executeBaseQuery, renderViews } = require("../src/helpers/bases-engine");

describe("bases engine summaries", () => {
  const notes = [
    {
      path: "notes/alpha.md",
      fileSlug: "alpha",
      url: "/alpha/",
      metadata: {
        score: 5,
        priority: "high",
      },
    },
    {
      path: "notes/beta.md",
      fileSlug: "beta",
      url: "/beta/",
      metadata: {
        score: 7,
      },
    },
  ];

  it("merges global and view summaries", () => {
    const result = executeBaseQuery(`
summaries:
  priority: Filled
views:
  - type: table
    order:
      - score
      - priority
    summaries:
      score: Average
`, notes);

    expect(result.views[0].config.summaries).toEqual({
      priority: "Filled",
      score: "Average",
    });
    expect(result.views[0].computedSummaries).toEqual({
      priority: 1,
      score: 6,
    });
  });

  it("uses configured display names in the summary bar", () => {
    const result = executeBaseQuery(`
properties:
  score:
    displayName: Rating
views:
  - type: table
    order:
      - score
    summaries:
      score: Average
`, notes);

    const html = renderViews(result, notes);

    expect(html).toContain('<span class="obsidian-base-summary-col">Rating</span>');
  });
});
