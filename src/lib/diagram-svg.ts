import { parse, type HTMLElement } from "node-html-parser";
import type { DiagramType } from "./kroki.ts";

const DEFAULT_NAMES: Record<DiagramType, string> = {
  mermaid: "Mermaid diagram",
  plantuml: "PlantUML diagram",
};

// Attributes whose value lists ids by name rather than as `#id`.
const ID_LIST_ATTRIBUTES = ["aria-labelledby", "aria-describedby"];

/**
 * Ready an SVG from Kroki for inlining in a note (ADR 0006): drop anything
 * that could run, give every id a per-diagram prefix (Mermaid's root is
 * always `id="container"`, and its styles refer to it), name the diagram
 * for assistive technology, and let it scale in proportion.
 */
export function prepareDiagramSvg(
  svg: string,
  { type, idPrefix }: { type: DiagramType; idPrefix: string }
): string {
  // Processing instructions (PlantUML's `<?plantuml …?>`) mean nothing in
  // HTML.
  const root = parse(svg.replace(/<\?[\s\S]*?\?>/g, ""), { comment: false });
  const element = root.querySelector("svg");
  if (!element) throw new Error("Kroki's answer has no <svg> element");

  for (const script of root.querySelectorAll("script")) script.remove();
  const all = root.querySelectorAll("*");
  for (const node of all) {
    for (const [name, value] of Object.entries(node.attributes)) {
      const runs =
        /^on/i.test(name) ||
        (/(^|:)href$/i.test(name) && /^\s*javascript:/i.test(value));
      if (runs) node.removeAttribute(name);
    }
  }

  prefixIds(all, idPrefix);

  element.setAttribute("role", "img");
  if (!element.hasAttribute("aria-labelledby")) {
    element.setAttribute("aria-label", DEFAULT_NAMES[type]);
  }
  // PlantUML fixes its size inline and stretches instead of scaling; the
  // width and height attributes still give its natural size.
  element.removeAttribute("style");
  if (element.getAttribute("preserveAspectRatio") === "none") {
    element.removeAttribute("preserveAspectRatio");
  }

  return root.toString();
}

/** The diagram's drawn width, in CSS pixels, from its viewBox. */
export function diagramWidth(svg: string): number {
  const viewBox = parse(svg).querySelector("svg")?.getAttribute("viewBox");
  const width = Number(viewBox?.trim().split(/[\s,]+/)[2]);
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error("Kroki's SVG has no usable viewBox");
  }
  return width;
}

function prefixIds(elements: HTMLElement[], prefix: string) {
  const ids = [
    ...new Set(elements.map(node => node.id).filter(id => id !== "")),
  ];
  if (ids.length === 0) return;
  const renamed = (id: string) => `${prefix}-${id}`;
  // Longest first, so `container_marker` isn't matched as `container`.
  const pattern = new RegExp(
    `#(${ids
      .toSorted((a, b) => b.length - a.length)
      .map(id => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})(?![\\w-])`,
    "g"
  );
  const idSet = new Set(ids);
  const references = (text: string) =>
    text.replace(pattern, (_, id: string) => `#${renamed(id)}`);

  for (const node of elements) {
    if (node.id !== "") node.setAttribute("id", renamed(node.id));
    for (const [name, value] of Object.entries(node.attributes)) {
      if (name === "id") continue;
      const next = ID_LIST_ATTRIBUTES.includes(name.toLowerCase())
        ? value
            .split(/\s+/)
            .map(token => (idSet.has(token) ? renamed(token) : token))
            .join(" ")
        : references(value);
      if (next !== value) node.setAttribute(name, next);
    }
    if (node.tagName === "STYLE") node.set_content(references(node.text));
  }
}
