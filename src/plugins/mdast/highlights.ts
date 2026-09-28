import { defineMdastPlugin } from "satteri";
import type { Heading, Paragraph, TableCell } from "mdast";

// Obsidian's `==highlight==`, as Eleventy's markdown-it-mark rendered it: a
// `<mark>` around the text between two `==` markers. Sätteri has no such
// syntax, so the markers arrive as plain text.
//
// Markers are paired among the inline content of one paragraph, heading, or
// table cell, so a highlight can hold bold text or a link (`==**a** b==`)
// and can sit inside one (`**==a==**`). As in markdown-it-mark, an opening
// marker must be followed by text and a closing one preceded by it, so
// `a == b` stays as written. Code is never text, so `==` in code stays too.
// Runs last, after the plugins that read wikilinks and callout markers.

interface Node {
  type: string;
  value?: string;
  children?: Node[];
  data?: Record<string, unknown>;
}

// Inline parents whose children can hold markers.
const INLINE_PARENTS = new Set([
  "emphasis",
  "strong",
  "delete",
  "link",
  "linkReference",
]);

// A pair of `==` becomes a `<mark>` through Sätteri's custom-node rendering.
function mark(children: Node[]): Node {
  return { type: "mark", children, data: { hName: "mark" } };
}

function hasMarker(node: Node): boolean {
  if (node.type === "text") return (node.value ?? "").includes("==");
  return (
    (node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "tableCell" ||
      INLINE_PARENTS.has(node.type)) &&
    (node.children ?? []).some(hasMarker)
  );
}

type Piece = Node | { marker: number };

/** The node with its highlights marked, its inline parents included. */
function highlight<N extends Node>(node: N): N {
  const children = (node.children ?? []).map(child =>
    INLINE_PARENTS.has(child.type) && hasMarker(child)
      ? highlight(child)
      : child
  );

  // Split text around each `==` (not part of a longer run of `=`) and note
  // whether it can open or close: an opener needs text after it, a closer
  // text before it. Text in a neighbouring node counts.
  const pieces: Piece[] = [];
  const markers: { canOpen: boolean; canClose: boolean }[] = [];
  children.forEach((child, index) => {
    if (child.type !== "text") {
      pieces.push(child);
      return;
    }
    const value = child.value ?? "";
    let from = 0;
    for (const match of value.matchAll(/=+/g)) {
      if (match[0].length !== 2) continue;
      const start = match.index;
      const end = start + 2;
      const before = start > 0 ? value.charAt(start - 1) : index > 0 ? "" : " ";
      const after =
        end < value.length
          ? value.charAt(end)
          : index < children.length - 1
            ? ""
            : " ";
      if (start > from)
        pieces.push({ type: "text", value: value.slice(from, start) });
      pieces.push({ marker: markers.length });
      markers.push({
        canOpen: !/\s/.test(after),
        canClose: !/\s/.test(before),
      });
      from = end;
    }
    if (from < value.length)
      pieces.push({ type: "text", value: value.slice(from) });
  });

  // Pair each opener with the next marker that can close it.
  const paired = new Set<number>();
  let opener: number | undefined;
  markers.forEach(({ canOpen, canClose }, index) => {
    if (opener !== undefined && canClose && index > opener) {
      paired.add(opener).add(index);
      opener = undefined;
    } else if (canOpen) {
      opener = index;
    }
  });

  const result: Node[] = [];
  let open: Node[] | undefined;
  for (const piece of pieces) {
    const target = open ?? result;
    if (!("marker" in piece)) {
      target.push(piece);
    } else if (!paired.has(piece.marker)) {
      target.push({ type: "text", value: "==" });
    } else if (open) {
      result.push(mark(open));
      open = undefined;
    } else {
      open = [];
    }
  }

  return { ...node, children: mergeText(result) };
}

/** Join neighbouring text nodes, such as an unpaired `==` and its words. */
function mergeText(nodes: Node[]): Node[] {
  const merged: Node[] = [];
  for (const node of nodes) {
    const last = merged.at(-1);
    if (node.type === "text" && last?.type === "text" && !last.data) {
      merged[merged.length - 1] = {
        ...last,
        value: (last.value ?? "") + (node.value ?? ""),
      };
    } else {
      merged.push(node);
    }
  }
  return merged;
}

/** The visited node with its highlights marked, or nothing to keep it. */
function visit<N extends Paragraph | Heading | TableCell>(
  node: Readonly<N>
): N | undefined {
  // Sätteri's node types and this file's loose Node describe the same
  // objects; the returned node replaces the visited one.
  const plain = node as unknown as Node;
  return hasMarker(plain) ? (highlight(plain) as unknown as N) : undefined;
}

export const mdastHighlightsPlugin = defineMdastPlugin({
  name: "mdast-highlights",
  paragraph: visit,
  heading: visit,
  tableCell: visit,
});
