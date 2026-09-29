import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { defineMdastPlugin } from "satteri";
import { diagramWidth, prepareDiagramSvg } from "../../lib/diagram-svg.ts";
import { renderWithKroki, type DiagramType } from "../../lib/kroki.ts";

// Render ```mermaid and ```plantuml fences to inline SVG at build time
// through Kroki (ADR 0006). The fence is replaced before syntax
// highlighting, so Shiki never sees it. A diagram Kroki can't render fails
// the build, naming the note and the fence's line.

const TYPES = new Set<string>(["mermaid", "plantuml"]);

export interface DiagramsOptions {
  /** Kroki's base URL; `KROKI_URL`, else https://kroki.io. */
  krokiUrl?: string;
  /** Where rendered SVGs are cached; `KROKI_CACHE_DIR`, else node_modules/.cache/kroki. */
  cacheDir?: string;
}

export function mkmdastDiagramsPlugin({
  krokiUrl = process.env.KROKI_URL || "https://kroki.io",
  cacheDir = process.env.KROKI_CACHE_DIR || "node_modules/.cache/kroki",
}: DiagramsOptions = {}) {
  return defineMdastPlugin({
    name: "mdast-diagrams",
    async code(node, ctx) {
      const type = node.lang;
      if (!type || !TYPES.has(type)) return;
      const diagramType = type as DiagramType;
      const line = node.position?.start.line;

      let svg: string;
      try {
        svg = await renderWithKroki(diagramType, node.value, {
          url: krokiUrl,
          cacheDir,
        });
      } catch (error) {
        const note = ctx.fileURL ? fileURLToPath(ctx.fileURL) : "a note";
        throw new Error(
          `Cannot render the ${type} diagram at ${note}:${line ?? "?"}. ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error }
        );
      }

      // Unique on the page (two fences never share a line) and stable
      // across builds.
      const idPrefix = `diagram-${line ?? 0}-${createHash("sha256")
        .update(node.value)
        .digest("hex")
        .slice(0, 6)}`;
      // The drawn width: the stylesheet shrinks a diagram only so far.
      const style = `--diagram-width: ${diagramWidth(svg)}px`;
      return {
        type: "html",
        value: `<figure class="diagram" data-diagram="${type}" style="${style}">${prepareDiagramSvg(
          svg,
          { type: diagramType, idPrefix }
        )}</figure>`,
      };
    },
  });
}
