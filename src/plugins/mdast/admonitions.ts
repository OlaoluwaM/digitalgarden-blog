import { defineMdastPlugin, markdownToMdast } from "satteri";
import type { MdastNode } from "satteri";
import type { WikilinkIndex } from "../../generated/wikilink-index.ts";
import { isWikilinkNode, transformWikilinkNode } from "./wikilinks.ts";
import type { Blockquote, Code } from "mdast";

export const mkmdastAdmonitionCalloutPlugin = (wikilinkIndex: WikilinkIndex) =>
  defineMdastPlugin({
    name: "mdast-admonition-callout",

    code(node) {
      return transformAdmonitionCodeBlock(node, wikilinkIndex);
    },
  });

function transformAdmonitionCodeBlock(
  node: Code,
  wikilinkIndex: WikilinkIndex
): Code | Blockquote {
  const language = node.lang;

  if (!language?.startsWith("ad-")) return node;

  const type = language.slice(3);

  if (!type) {
    throw new Error("An admonition must specify a type after `ad-`");
  }

  const { title, collapse, body } = parseAdmonitionBodyToParts(node.value);

  const calloutMarkdown = [
    `> [!${type}]${collapseStateToSign(collapse)} ${title}`,
    ">",
    ...body.split("\n").map(line => `> ${line}`),
  ].join("\n");

  // Parse the generated callout now, while its wikilinks still have
  // positions relative to the generated Markdown.
  const calloutTree = resolveWikilinksInTree(
    markdownToMdast(calloutMarkdown, {
      features: { wikilinks: true },
      position: true,
    }),
    calloutMarkdown,
    wikilinkIndex
  );

  if (calloutTree.type !== "root" || calloutTree.children.length !== 1) {
    throw new Error("An admonition must produce exactly one callout node");
  }

  const generatedBlockquote = calloutTree.children[0];
  if (generatedBlockquote.type !== "blockquote") {
    throw new Error(
      `Expected ad-${type} to produce a blockquote, but got "${generatedBlockquote.type}"`
    );
  }

  return {
    ...generatedBlockquote,
    children: generatedBlockquote.children.map(child => {
      if (child.type === "code") {
        return transformAdmonitionCodeBlock(child, wikilinkIndex);
      }

      return child;
    }),
  };
}

function resolveWikilinksInTree(
  node: MdastNode,
  source: string,
  wikilinkIndex: WikilinkIndex
): MdastNode {
  if (node.type === "link" && isWikilinkNode(source, node)) {
    return transformWikilinkNode(wikilinkIndex, node);
  }

  if (!("children" in node)) return node;

  return {
    ...node,
    children: node.children.map(child =>
      resolveWikilinksInTree(child, source, wikilinkIndex)
    ),
  } as MdastNode;
}

interface AdmonitionParts {
  title: string;
  collapse: Collapse;
  body: string;
}

type Collapse = "open" | "closed";

function parseAdmonitionBodyToParts(body: string): AdmonitionParts {
  const metadataLine = /^(title|collapse):[ \t]*(.*)$/;
  const carriageReturn = /\r$/;

  let cursor = 0;

  const admonitionParts: AdmonitionParts = {
    // The HAST callout plugin supplies the default title.
    title: "",
    collapse: "open",
    body,
  };

  while (cursor < body.length) {
    // Find the first newline character starting from the cursor's current position
    const firstNewlineIdx = body.indexOf("\n", cursor);
    const noNewline = firstNewlineIdx === -1;

    // "line" here, represents the piece of the overall input string that we have in focus between cursor and lineEnd
    const lineEnd = noNewline ? body.length : firstNewlineIdx;
    const line = body.slice(cursor, lineEnd).replace(carriageReturn, "");

    const match = metadataLine.exec(line);
    if (!match) break;

    const [_, _key, val] = match;

    // This is safe because the regex explicitly checks for the words "title" or "collapse"
    // and if we get to this point, then either of those words should be the value for _key
    const key = _key as "title" | "collapse";

    switch (key) {
      case "title":
        admonitionParts[key] = val;
        break;
      case "collapse":
        admonitionParts[key] = resolveCollapseKeyValToState(val);
        break;
      default:
        throw new Error(
          `${key} is not recognized as a valid admonition metadata tag`
        );
    }

    // If everything went well, then the lineEnd index above points at the index of the newline character, so (+ 1) would shift it to point at the next character
    cursor = noNewline ? body.length : lineEnd + 1;
  }

  admonitionParts["body"] = body.slice(cursor);

  return admonitionParts;
}

function resolveCollapseKeyValToState(val: string): Collapse {
  const defaultState: Collapse = "open";

  switch (val) {
    case "true":
      return "closed";

    case "false":
      return "open";

    default:
      return defaultState;
  }
}

function collapseStateToSign(collapse: Collapse): string {
  switch (collapse) {
    case "open":
      return "";

    case "closed":
      return "-";

    default:
      throw new Error(
        `Invalid collapse state: ${collapse}. Could not convert it to a sign`
      );
  }
}
