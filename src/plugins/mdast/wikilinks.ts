import { defineMdastPlugin } from "satteri";
import type { WikilinkIndex } from "../../generated/wikilink-index.ts";
import type { Link } from "mdast";
import { slug } from "github-slugger";

export const mkmdastWikilinksPlugin = (wikilinkIndex: WikilinkIndex) =>
  defineMdastPlugin({
    name: "mdast-wikilinks",

    options: {
      position: true,
    },

    link(node, ctx) {
      // Sätteri uses link nodes for both Markdown links and wikilinks.
      if (!isWikilinkNode(ctx.source, node)) return;
      return transformWikilinkNode(wikilinkIndex, node);
    },
  });

export function isWikilinkNode(
  source: string,
  linkNode: Readonly<Link>
): boolean {
  if (!linkNode.position) return false;

  const { start, end } = linkNode.position;
  // Read the original syntax; the node's text contains only the visible label.
  const linkSource = source.slice(start.offset, end.offset);

  return linkSource.startsWith("[[") && linkSource.endsWith("]]");
}

export function transformWikilinkNode(
  wikilinkIndex: WikilinkIndex,
  linkNode: Readonly<Link>
) {
  // Satteri currently preserves the escape character from `[[target\|alias]]`
  // in the parsed URL, so remove it before looking up the target.
  const wikilinkTarget = linkNode.url.replace(/\\$/, "");
  const { url: resolvedUrl, isUnresolved } = resolveWikilinkTarget(
    wikilinkTarget,
    wikilinkIndex
  );

  return {
    ...linkNode,
    url: resolvedUrl,
    data: {
      ...linkNode.data,
      hProperties: {
        className: [
          "internal-link",
          ...(isUnresolved ? ["is-unresolved"] : []),
        ],
      },
    },
  };
}

function resolveWikilinkTarget(
  wikilinkTarget: string,
  wikilinkIndex: WikilinkIndex
): {
  url: string;
  isUnresolved: boolean;
} {
  const unresolvedNoteUrl = "/404";

  const [noteTarget, ...fragmentParts] = wikilinkTarget.split("#");
  // Only the first # separates the note from the heading; preserve later ones.
  const headingText = fragmentParts.join("#");
  const headingId = slug(headingText);

  const isSamePageTarget = noteTarget === "";

  if (isSamePageTarget) {
    return {
      url: headingId ? `#${headingId}` : "",
      isUnresolved: false,
    };
  }

  const noteUrl = wikilinkIndex[noteTarget];
  if (!noteUrl)
    return {
      url: unresolvedNoteUrl,
      isUnresolved: true,
    };
  return {
    url: headingId ? `${noteUrl}#${headingId}` : noteUrl,
    isUnresolved: false,
  };
}
