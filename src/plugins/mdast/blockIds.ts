import type { Paragraph, Parents, RootContent } from "mdast";
import { defineMdastPlugin, type MdastVisitorContext } from "satteri";

// Give Obsidian's block IDs (`^block-id`) their anchors, so a link to a
// block (`[[Note#^block-id]]`, or a block embed's link) lands on it. The
// Digital Garden plugin rewrites each ID as attribute syntax, `{ #block-id}`,
// which the Eleventy site read with markdown-it-attrs:
//
// - At the end of a paragraph or list item (`text ^id`): the marker is the
//   paragraph's last line, `text\n{ #id}`. The ID goes on the paragraph, or
//   on the list item (a tight list renders no paragraph).
// - On its own line after a list, quote, or table: the marker is a
//   paragraph of its own, `{ #id}`. The ID goes on the block before it.
//
// The marker is removed either way. A heading keeps its own ID, which
// heading links use; a block ID after one is dropped.

const TRAILING_MARKER = /\n\{ #([A-Za-z0-9-]+)\}$/;
const MARKER = /^\{ #([A-Za-z0-9-]+)\}$/;

export const mdastBlockIdsPlugin = defineMdastPlugin({
  name: "mdast-block-ids",

  paragraph(node, ctx) {
    const last = node.children.at(-1);
    if (last?.type !== "text") return;

    const parent = ctx.parent(node);
    const alone = node.children.length === 1 && MARKER.exec(last.value);
    if (alone) {
      const index = ctx.indexOf(node) ?? 0;
      const previous = parent.children[index - 1];
      if (previous && previous.type !== "heading") {
        setId(ctx, previous, alone[1]);
      }
      ctx.removeNode(node);
      return;
    }

    const trailing = TRAILING_MARKER.exec(last.value);
    if (!trailing) return;
    const paragraph: Paragraph = {
      ...node,
      children: [
        ...node.children.slice(0, -1),
        { ...last, value: last.value.slice(0, trailing.index) },
      ],
    };
    if (parent.type === "listItem") {
      setId(ctx, parent, trailing[1]);
      return paragraph;
    }
    return withId(paragraph, trailing[1]);
  },
});

function setId(
  ctx: MdastVisitorContext,
  node: RootContent | Parents,
  id: string | undefined
) {
  if (id === undefined) return;
  ctx.setProperty(node, "data", dataWithId(node, id));
}

function withId(paragraph: Paragraph, id: string | undefined): Paragraph {
  if (id === undefined) return paragraph;
  return { ...paragraph, data: dataWithId(paragraph, id) };
}

// The node's data with `id` added to the element properties it renders
// with.
function dataWithId(
  node: RootContent | Parents,
  id: string
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...node.data };
  const hProperties = data.hProperties as Record<string, unknown> | undefined;
  return { ...data, hProperties: { ...hProperties, id } };
}
