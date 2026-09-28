import { defineHastPlugin, type HastNode } from "satteri";
import type { Element, ElementContent } from "hast";

import { getCalloutIconName } from "./callout-icons.ts";
import { calloutIconToHast } from "./lucide-icon.ts";

export const hastAdmonitionCalloutPlugin = defineHastPlugin({
  name: "hast-admonition-callout",
  element: {
    // Remember that this plugin could also receive non-callout blockquotes
    filter: ["blockquote"],
    visit(node) {
      return transformBlockquoteToCallout(node);
    },
  },
});

function transformBlockquoteToCallout(blockquoteNode: Element): HastNode {
  const parsedCallout = parseCallout(blockquoteNode);

  if (!parsedCallout) return blockquoteNode;

  const {
    titleNodes: calloutTitleNodes,
    calloutContent,
    metadata,
  } = parsedCallout;
  const existingClasses = blockquoteNode.properties.className ?? [];
  const calloutClasses = [
    ...(Array.isArray(existingClasses) ? existingClasses : [existingClasses]),
    "callout",
    "is-collapsible",
    ...(metadata.collapse === "closed" ? ["is-collapsed"] : []),
  ];

  const calloutBodyElement: HastNode = {
    type: "element",
    tagName: "div",
    properties: {
      className: ["callout-content"],
    },
    children: calloutContent,
  };

  return {
    type: "element",
    tagName: "div",
    properties: {
      ...blockquoteNode.properties,
      className: [...new Set(calloutClasses)],
      "data-callout": metadata.type,
      ...(metadata.calloutMetadata !== undefined
        ? { "data-callout-metadata": metadata.calloutMetadata }
        : {}),
    },
    children: [
      wrapCalloutTitleNode(calloutTitleNodes, metadata.type),
      calloutBodyElement,
    ],
  } as HastNode;
}

interface Callout {
  metadata: {
    type: string;
    calloutMetadata?: string;
    collapse: "open" | "closed";
  };
  titleNodes: ElementContent[];
  calloutContent: ElementContent[];
}

function parseCallout(blockquoteNode: Element): Callout | null {
  // The opening paragraph must be the first content after any whitespace.
  const [openingParagraph, remainingBlockquoteChildren] = getOpeningParagraph(
    blockquoteNode.children
  );

  if (!openingParagraph) return null;

  const openingParagraphChildren = openingParagraph.children;

  const [openingTextNodeChild, ...remainingOpeningParagraphChildren] =
    openingParagraphChildren;

  const startsWithCalloutMarker =
    openingTextNodeChild?.type === "text" &&
    openingTextNodeChild.value.startsWith("[!");

  if (!startsWithCalloutMarker) return null;

  const titleNode = openingTextNodeChild as { type: "text"; value: string };

  // Read [!type], optional |metadata, and an optional + or - marker.
  // Require a nonempty type. Stop after the marker, leaving all following
  // whitespace, title text, and body text outside the match.
  const CALLOUT_MARKER =
    /^\[!(?<type>[\w-]+)(?:\|(?<metadata>[^\]\r\n]*))?\](?<collapse>[+-])?/;

  const match = titleNode.value.match(CALLOUT_MARKER);

  if (!match) return null;

  const textAfterCalloutMarker = titleNode.value.slice(match[0].length);

  const textWithoutMarker: ElementContent = {
    type: "text",
    value: textAfterCalloutMarker,
  };

  const childrenWithoutMarker: ElementContent[] = [
    textWithoutMarker,
    ...remainingOpeningParagraphChildren,
  ];

  const titleBodyPartition = splitChildrenAtFirstNewline(childrenWithoutMarker);

  const calloutType = (match.groups?.type ?? "").toLowerCase();
  const calloutMetadata = match.groups?.metadata;
  const titleNodes = trimTitlePadding(titleBodyPartition.titleNodes);

  // Every callout is collapsible; only an explicit minus starts it closed.
  const calloutCollapseMarker = match.groups?.collapse;

  return {
    metadata: {
      type: calloutType,
      calloutMetadata,
      collapse: calloutCollapseMarker === "-" ? "closed" : "open",
    },
    // No wrapping <p>: the title's inline content goes directly inside
    // .callout-title-inner, matching the live site's markup.
    titleNodes:
      titleNodes.length > 0
        ? titleNodes
        : [{ type: "text", value: toTitleCase(calloutType) }],
    calloutContent: [
      ...wrapCalloutContentNodes(titleBodyPartition.contentNodes),
      ...remainingBlockquoteChildren,
    ],
  };
}

function getOpeningParagraph(
  blockquoteNodeChildren: ElementContent[]
): [Element, ElementContent[]] | [null, null] {
  for (const [i, child] of blockquoteNodeChildren.entries()) {
    // Whitespace advances to the next child, skipping the returns below.
    // The loop stops when it reaches the first non-whitespace child.
    if (child.type === "text" && child.value.trim() === "") continue;

    if (child.type === "element" && child.tagName === "p") {
      const remainingChildren = blockquoteNodeChildren.slice(i + 1);
      return [child, remainingChildren];
    }

    // If the first non-whitespace child isn't a paragraph. Stop searching. Going any further could mistake a later paragraph for the header and discard earlier content.
    return [null, null];
  }

  return [null, null];
}

// Order matches the live site's rendered DOM: icon, then title text, then
// the fold chevron. Every callout this plugin builds is collapsible (see
// transformBlockquoteToCallout), so the fold icon is unconditional here too.
function wrapCalloutTitleNode(
  titleNodes: ElementContent[],
  calloutType: string
): HastNode {
  return {
    type: "element",
    tagName: "div",
    properties: {
      className: ["callout-title"],
    },
    children: [
      {
        type: "element",
        tagName: "div",
        properties: { className: ["callout-icon"] },
        children: [calloutIconToHast(getCalloutIconName(calloutType))],
      },
      {
        type: "element",
        tagName: "div",
        properties: {
          className: ["callout-title-inner"],
        },
        children: titleNodes,
      },
      {
        type: "element",
        tagName: "div",
        properties: { className: ["callout-fold"] },
        children: [calloutIconToHast("chevron-down")],
      },
    ],
  };
}

// Restore the paragraph around body nodes split from the opening paragraph.
// Existing body paragraphs are appended separately by the caller.
function wrapCalloutContentNodes(contentNodes: ElementContent[]): Element[] {
  return cloneElementWithChildren(
    { type: "element", tagName: "p", properties: {}, children: [] },
    contentNodes
  );
}

type TitleBodyPartition = {
  titleNodes: ElementContent[];
  contentNodes: ElementContent[];
  foundBoundary: boolean;
};

function splitChildrenAtFirstNewline(
  children: ElementContent[]
): TitleBodyPartition {
  const result: TitleBodyPartition = {
    titleNodes: [],
    contentNodes: [],
    foundBoundary: false,
  };

  for (const child of children) {
    if (result.foundBoundary) {
      result.contentNodes.push(child);
      continue;
    }

    const partition = splitNodeAtFirstNewline(child);

    result.titleNodes.push(...partition.titleNodes);
    result.contentNodes.push(...partition.contentNodes);
    result.foundBoundary ||= partition.foundBoundary;
  }

  return result;
}

function splitNodeAtFirstNewline(node: ElementContent): TitleBodyPartition {
  if ("children" in node && node.children.length > 0) {
    const partition = splitChildrenAtFirstNewline(node.children);

    return {
      titleNodes: cloneElementWithChildren(
        node as Element,
        partition.titleNodes
      ),
      contentNodes: cloneElementWithChildren(
        node as Element,
        partition.contentNodes
      ),
      foundBoundary: partition.foundBoundary,
    };
  } else if (node.type === "text" && node.value.includes("\n")) {
    // split() always returns at least one part.
    const [beforeNewline = "", ...afterNewline] = node.value.split("\n");
    const afterNewlineText = afterNewline.join("\n");
    const noAfterNewlineText = afterNewlineText === "";

    return {
      titleNodes: [{ type: "text", value: beforeNewline }],
      contentNodes: noAfterNewlineText
        ? []
        : [
            {
              type: "text",
              value: afterNewline.join("\n"),
            },
          ],
      foundBoundary: true,
    };
  } else {
    return {
      titleNodes: [node],
      contentNodes: [],
      foundBoundary: false,
    };
  }
}

// Copy the element with replacement children; omit it when the group is empty.
function cloneElementWithChildren(
  parent: Element,
  children: ElementContent[]
): Element[] {
  if (children.length === 0) return [];
  return [
    {
      ...parent,
      children,
    },
  ];
}

const CALLOUT_TITLE_OVERRIDES: Record<string, string> = {
  "ai-text": "AI Text",
};

function toTitleCase(str: string) {
  const calloutTitle = str.toLowerCase();
  // hasOwn skips inherited keys such as "constructor".
  const override = Object.hasOwn(CALLOUT_TITLE_OVERRIDES, calloutTitle)
    ? CALLOUT_TITLE_OVERRIDES[calloutTitle]
    : undefined;

  if (override !== undefined) {
    return override;
  }

  return str
    .replace(/-/g, " ")
    .replace(
      /\w\S*/g,
      word => word.charAt(0).toUpperCase() + word.substring(1).toLowerCase()
    );
}

// Trim only the title's outside edges. Spaces between formatted words stay put.
function trimTitlePadding(nodes: ElementContent[]): ElementContent[] {
  const trimEdge = (
    children: ElementContent[],
    edge: "start" | "end"
  ): ElementContent[] => {
    const trimmed = [...children];

    while (trimmed.length > 0) {
      const index = edge === "start" ? 0 : trimmed.length - 1;
      const node = trimmed[index];
      // Always set while the list is nonempty; this tells the type checker.
      if (node === undefined) break;

      if (node.type === "text") {
        const value =
          edge === "start" ? node.value.trimStart() : node.value.trimEnd();
        if (value !== "") {
          trimmed[index] = { ...node, value };
          break;
        }
      } else if (node.type === "element" && node.children.length > 0) {
        const children = trimEdge(node.children, edge);
        if (children.length > 0) {
          trimmed[index] = { ...node, children };
          break;
        }
      } else {
        // Keep childless elements, such as images, even though they have no text.
        break;
      }

      trimmed.splice(index, 1);
    }

    return trimmed;
  };

  return trimEdge(trimEdge(nodes, "start"), "end");
}
