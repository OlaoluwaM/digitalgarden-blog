import { defineMdastPlugin } from "satteri";
import type { WikilinkIndex } from "../generated/wikilink-index.ts";
import type { Link } from "mdast";

export const mkmdastWikilinksPlugin = (wikilinkIndex: WikilinkIndex) =>
  defineMdastPlugin({
    name: "mdast-wikilinks",

    options: {
      position: true,
    },

    link(node, ctx) {
      // This node also matches regular markdown links like "[Example](example.com)" so we need to guard against that to ensure we're only working with wikilinks that look like "[[Example]]". It is also for this reason that nodeSourceText below isn't just equal to `ctx.textContent(node)` because it won't return back the actual different text in all cases
      if (!isWikilinkNode(ctx.source, node)) return;
      const newNode = transformWikilinkNode(wikilinkIndex, node);
      return newNode;
    },
  });

export function isWikilinkNode(
  source: string,
  currentNode: Readonly<Link>
): boolean {
  if (!currentNode.position) return false;

  const { start, end } = currentNode.position;
  // Satteri for some reason doesn't seem to provide the actual node source text so we need to extract it using its absolute position in the overall document text
  const nodeSourceText = source.slice(start.offset, end.offset);

  return nodeSourceText.startsWith("[[") && nodeSourceText.endsWith("]]");
}

export function transformWikilinkNode(
  wikilinkIndex: WikilinkIndex,
  currentNode: Readonly<Link>
) {
  // Satteri currently preserves the escape character from `[[target\|alias]]`
  // in the parsed URL, so remove it before looking up the target.
  const wikilinkTarget = currentNode.url.replace(/\\$/, "");
  const newUrl = wikilinkIndex[wikilinkTarget];
  const isUnresolvedLink = newUrl === undefined;

  return {
    ...currentNode,
    url: newUrl ?? "/404",
    data: {
      ...currentNode.data,
      hProperties: {
        className: [
          "internal-link",
          ...(isUnresolvedLink ? ["is-unresolved"] : []),
        ],
      },
    },
  };
}
