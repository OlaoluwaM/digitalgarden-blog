import { defineHastPlugin } from "satteri";

// Wrap every table in a `div.table-wrapper`, the box that scrolls a table
// wider than the note column (styles/content/typography.css). Without it,
// the page's `overflow-x: hidden` clips a wide table on phones, with no way
// to reach its last columns. scripts/scrollRegions.ts gives the box a tab
// stop and a name while it overflows.
export const hastTableWrapperPlugin = defineHastPlugin({
  name: "hast-table-wrapper",
  element: {
    filter: ["table"],
    visit(node, ctx) {
      ctx.wrapNode(node, {
        type: "element",
        tagName: "div",
        properties: { className: ["table-wrapper"] },
        children: [],
      });
    },
  },
});
