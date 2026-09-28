import { defineMdastPlugin } from "satteri";
import juice from "juice";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import type { LiteElement } from "mathjax-full/js/adaptors/lite/Element.js";
import type { LiteText } from "mathjax-full/js/adaptors/lite/Text.js";
import type { LiteDocument } from "mathjax-full/js/adaptors/lite/Document.js";
import type { MathDocument } from "mathjax-full/js/core/MathDocument.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { AssistiveMmlHandler } from "mathjax-full/js/a11y/assistive-mml.js";

export const mdastMathRenderPlugin = defineMdastPlugin({
  name: "mdast-math-render-plugin",

  inlineMath(node) {
    return {
      type: "html",
      value: renderMath(node.value, "inline"),
    };
  },

  math(node) {
    return {
      type: "html",
      value: renderMath(node.value, "full"),
    };
  },
});

// Mirrors markdown-it-mathjax3, which Eleventy uses: TeX with every package,
// self-contained SVG glyphs, and assistive MathML for screen readers.
const documentOptions = {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG<LiteElement, LiteText, LiteDocument>({
    fontCache: "none",
  }),
};

// Register once; markdown-it-mathjax3 registers a new handler on every call.
const adaptor = liteAdaptor();
AssistiveMmlHandler(RegisterHTMLHandler(adaptor));

export type MathDisplayMode = "inline" | "full";

export function renderMath(tex: string, mode: MathDisplayMode): string {
  // MathJax types its documents and converted nodes as `any`; these are
  // the node types liteAdaptor works with.
  const mathDocument = mathjax.document(tex, documentOptions) as MathDocument<
    LiteElement,
    LiteText,
    LiteDocument
  >;
  const html = adaptor.outerHTML(
    mathDocument.convert(tex, { display: mode === "full" }) as LiteElement
  );
  const stylesheet = adaptor.outerHTML(
    documentOptions.OutputJax.styleSheet(mathDocument)
  );
  // Inline MathJax's styles so each expression works without a stylesheet.
  return juice(html + stylesheet);
}
