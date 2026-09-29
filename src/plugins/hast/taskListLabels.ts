import type { Element, ElementContent } from "hast";
import { defineHastPlugin } from "satteri";

// Name each task-list checkbox with its item's text. The renderer puts the
// disabled checkbox first in the list item (or in its first paragraph, in a
// loose list) with no label, so it is announced only as "checkbox, not
// checked" (axe `label`, WCAG 4.1.2). Wrapping the checkbox and the text
// that follows it in a <label> names it; a nested list stays outside, since
// it belongs to the item, not to the checkbox's name.
export const hastTaskListLabelsPlugin = defineHastPlugin({
  name: "hast-task-list-labels",
  element: {
    filter: ["li", "p"],
    visit(node) {
      const [first] = node.children;
      if (!isTaskCheckbox(first)) return node;

      const listIndex = node.children.findIndex(isList);
      const end = listIndex === -1 ? node.children.length : listIndex;
      const label: Element = {
        type: "element",
        tagName: "label",
        properties: {},
        children: node.children.slice(0, end),
      };
      return { ...node, children: [label, ...node.children.slice(end)] };
    },
  },
});

function isTaskCheckbox(node: ElementContent | undefined): boolean {
  return (
    node?.type === "element" &&
    node.tagName === "input" &&
    node.properties.type === "checkbox"
  );
}

function isList(node: ElementContent): boolean {
  return (
    node.type === "element" && (node.tagName === "ul" || node.tagName === "ol")
  );
}
