import * as lucide from "lucide";
import type { IconNode } from "lucide";
import type { Element } from "hast";

// Build the exact `<svg>` HAST shape Lucide's browser bundle produces when
// `lucide.createIcons()` resolves a `[data-lucide="<name>"]` placeholder
// (see node_modules/lucide/dist/esm/replaceElement.mjs), but at build time,
// from the pinned `lucide` package's icon data instead of the DOM. This is
// deliberately its own tiny helper rather than a reuse of
// `src/components/Icon.astro`: that component always adds a `svg-icon`
// class (to match Eleventy's `lucide.createIcons({ attrs: { class:
// ["svg-icon"] } })` call) and throws on an unknown name, but the live
// callout markup carries no `svg-icon` class, and an unresolved Obsidian
// icon name (such as Obsidian's `quote-glyph`, which Lucide lacks, copied
// into the icon map by a future `/sync-callouts`) must degrade gracefully
// rather than fail the build --
// `replaceElement` itself only `console.warn`s and leaves the placeholder
// element in the DOM, and that placeholder's tag/attribute in the live
// pre-JS HTML is `<i data-lucide="...">`, which is what we reproduce here.
export function calloutIconToHast(name: string): Element {
  const iconNode = resolveLucideIconNode(name);

  if (!iconNode) {
    return {
      type: "element",
      tagName: "i",
      properties: { dataLucide: name },
      children: [],
    };
  }

  return {
    type: "element",
    tagName: "svg",
    properties: {
      xmlns: "http://www.w3.org/2000/svg",
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      // hast's Properties type declares these as strings (matching the
      // serialized attribute), unlike lucide's own looser SVGProps type.
      strokeWidth: "2",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      dataLucide: name,
      ariaHidden: "true",
      className: ["lucide", `lucide-${name}`],
    },
    children: iconNode.map(iconNodeEntryToElement),
  };
}

function iconNodeEntryToElement([tag, attrs]: IconNode[number]): Element {
  return {
    type: "element",
    tagName: tag,
    properties: attrs,
    children: [],
  };
}

// Kebab-case icon name -> the PascalCase export name `lucide`'s package
// entry point uses (matches Icon.astro's own conversion; kept separate so
// this plugin package doesn't depend on an Astro component).
function resolveLucideIconNode(name: string): IconNode | undefined {
  const exportName = name
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const node = (lucide as unknown as Record<string, IconNode | undefined>)[
    exportName
  ];
  return Array.isArray(node) ? node : undefined;
}
