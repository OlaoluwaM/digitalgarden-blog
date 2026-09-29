import { defineMdastPlugin } from "satteri";
import type { Paragraph } from "mdast";

// Obsidian shows a single newline inside a paragraph as a line break (its
// "Strict line breaks" setting, off by default), and Eleventy matched it
// with markdown-it's `breaks: true`. CommonMark, which Sätteri follows,
// renders the newline as a space. This turns each newline in a paragraph's
// text into a `<br>`, inside bold, links, and highlights too. Code spans
// never hold a newline (CommonMark turns it into a space), and raw HTML is
// left as written.
//
// A callout's opening paragraph keeps its first newline: the callout plugin
// splits the title from the body there.
// Runs last, after the plugins that read paragraph text.

interface Node {
  type: string;
  value?: string;
  children?: Node[];
}

const CALLOUT_MARKER = /^\[![\w-]+/;

function hasNewline(node: Node): boolean {
  if (node.type === "text") return (node.value ?? "").includes("\n");
  return (node.children ?? []).some(hasNewline);
}

/**
 * The children with each newline in their text replaced by a break, except
 * the first `skip` newlines. Returns the newlines still to skip.
 */
function breakLines(children: Node[], skip: number): [Node[], number] {
  const result: Node[] = [];
  for (const child of children) {
    if (child.children) {
      const [inner, left] = breakLines(child.children, skip);
      result.push({ ...child, children: inner });
      skip = left;
      continue;
    }
    if (child.type !== "text" || !(child.value ?? "").includes("\n")) {
      result.push(child);
      continue;
    }
    const lines = (child.value ?? "").split("\n");
    let text = lines[0] ?? "";
    for (const line of lines.slice(1)) {
      if (skip > 0) {
        text += `\n${line}`;
        skip -= 1;
        continue;
      }
      if (text) result.push({ type: "text", value: text });
      result.push({ type: "break" });
      text = line;
    }
    if (text) result.push({ type: "text", value: text });
  }
  return [result, skip];
}

export const mdastSoftBreaksPlugin = defineMdastPlugin({
  name: "mdast-soft-breaks",

  paragraph(node, ctx) {
    // Sätteri's node types and this file's loose Node describe the same
    // objects; the returned node replaces the visited one.
    const plain = node as unknown as Node;
    if (!hasNewline(plain)) return undefined;

    const parent = ctx.parent(node);
    const first = plain.children?.[0];
    const opensCallout =
      parent.type === "blockquote" &&
      ctx.indexOf(node) === 0 &&
      first?.type === "text" &&
      CALLOUT_MARKER.test(first.value ?? "");

    const [children] = breakLines(plain.children ?? [], opensCallout ? 1 : 0);
    return { ...plain, children } as unknown as Paragraph;
  },
});
