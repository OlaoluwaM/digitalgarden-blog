import { createHash } from "node:crypto";
import { defineMdastPlugin } from "satteri";
import { parse } from "node-html-parser";
import { diagramWidth, prepareDiagramSvg } from "../../lib/diagram-svg.ts";

// An embedded Excalidraw drawing (`![[drawing.excalidraw]]`) arrives from
// the Digital Garden publisher as an HTML block: the drawing exported to
// SVG, in `<div class="excalidraw-svg">`, with `max-width: 100%` inline, so
// a wide drawing shrinks until its text is too small to read. This turns it
// into the figure Kroki's diagrams get (diagrams.ts): the stylesheet
// shrinks it to 70% of its drawn width at most and scrolls it past that,
// with the edge fade, a tab stop while it scrolls, and a name ("Excalidraw
// drawing"; the export carries no title).
//
// An embed size (`|500`, `|50%`) sets the drawn width; a height
// (`|500x300`) is dropped, so the drawing keeps its proportions. A drawing
// inline in a paragraph can't become a figure, so it stays as published.

const OPENING = '<div class="excalidraw-svg">';

/** The embed size's width from the publisher's inline style, if any. */
function embedWidth(style: string | undefined): string | undefined {
  return /(?:^|;)\s*width:\s*(\d+(?:\.\d+)?(?:px|%))/.exec(style ?? "")?.[1];
}

export const mdastExcalidrawPlugin = defineMdastPlugin({
  name: "mdast-excalidraw",
  html(node, ctx) {
    if (!node.value.trimStart().startsWith(OPENING)) return;
    if (ctx.parent(node).type === "paragraph") return;

    const svg = parse(node.value).querySelector("div.excalidraw-svg > svg");
    if (!svg) return;
    const markup = svg.toString();

    // Unique on the page (two blocks never share a line) and stable across
    // builds, as for diagrams.
    const line = node.position?.start.line ?? 0;
    const idPrefix = `excalidraw-${line}-${createHash("sha256")
      .update(markup)
      .digest("hex")
      .slice(0, 6)}`;
    const width =
      embedWidth(svg.getAttribute("style")) ?? `${diagramWidth(markup)}px`;

    return {
      type: "html",
      value: `<figure class="diagram" data-diagram="excalidraw" style="--diagram-width: ${width}">${prepareDiagramSvg(
        markup,
        { type: "excalidraw", idPrefix }
      )}</figure>`,
    };
  },
});
