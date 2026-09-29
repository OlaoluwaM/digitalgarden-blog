/**
 * Render through the site's Astro processor: an Excalidraw drawing the
 * Digital Garden publisher inlined as SVG must become the same figure a
 * Kroki diagram gets, so the stylesheet and the scroll-region script treat
 * it as one. These are processor tests, not full builds; the sizing and
 * scrolling are checked in a browser in test/layout/excalidraw.test.ts.
 *
 * Why this level: the change is to the HTML a note gets, so rendering the
 * publisher's markup through the real pipeline is the cheapest check.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateConfig } from "astro/config";
import { parse } from "node-html-parser";
import siteConfig from "../astro.config.ts";

const { markdown } = await validateConfig(
  siteConfig,
  fileURLToPath(new URL("../", import.meta.url)),
  "build"
);
const renderer = await markdown.processor.createRenderer(markdown);

async function render(source: string) {
  const { code } = await renderer.render(source);
  return parse(code);
}

/**
 * A drawing as the publisher inlines it (ExcalidrawCompiler.compileToSvg):
 * one line, with the export's font styles and ids, and `max-width: 100%`
 * plus any embed size inline.
 */
function drawing(style = "max-width: 100%; height: auto;") {
  return (
    '<div class="excalidraw-svg"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 300" width="900" height="300" ' +
    `style="${style}">` +
    '<!-- svg-source:excalidraw --><defs><style class="style-fonts">@font-face { font-family: Excalifont; src: url(data:font/woff2;base64,AAAA); }</style>' +
    '<clipPath id="clip"><rect width="10" height="10"></rect></clipPath></defs>' +
    '<rect x="0" y="0" width="900" height="300" fill="#ffffff"></rect>' +
    '<g clip-path="url(#clip)"><text>Vault</text></g></svg></div>'
  );
}

describe("Excalidraw drawings", () => {
  // Why: the publisher's `max-width: 100%` shrinks a wide drawing without
  // limit, so its text gets too small to read on a phone. As a diagram
  // figure it shrinks only to 70% of its drawn width and scrolls past that.
  it("becomes a diagram figure at its drawn width", async () => {
    const html = await render(drawing());
    const figure = html.querySelector("figure.diagram");
    assert.ok(figure, html.toString());
    assert.equal(figure.getAttribute("data-diagram"), "excalidraw");
    assert.equal(figure.getAttribute("style"), "--diagram-width: 900px");
    assert.equal(html.querySelector(".excalidraw-svg"), null);
    assert.equal(figure.querySelector("svg")?.getAttribute("style"), undefined);
  });

  // Why: the export has no title, so without a name a screen reader meets
  // an unnamed graphic; the scroll-region script also names the figure
  // after it.
  it("names the drawing for assistive technology", async () => {
    const svg = (await render(drawing())).querySelector("svg");
    assert.equal(svg?.getAttribute("role"), "img");
    assert.equal(svg?.getAttribute("aria-label"), "Excalidraw drawing");
  });

  // Why: an embed size (`![[drawing|500]]`) is the width the writer chose;
  // it becomes the drawn width. A height would distort the drawing once it
  // shrinks, so only the width counts.
  it("takes the drawn width from an embed size", async () => {
    const sized = await render(
      drawing("max-width: 100%; height: 300px; width: 500px;")
    );
    assert.equal(
      sized.querySelector("figure")?.getAttribute("style"),
      "--diagram-width: 500px"
    );
    const percent = await render(drawing("max-width: 100%; width: 50%;"));
    assert.equal(
      percent.querySelector("figure")?.getAttribute("style"),
      "--diagram-width: 50%"
    );
  });

  // Why: two drawings can share ids (clip paths, embedded images); ids are
  // page-wide, so one drawing would pick up the other's definitions.
  it("gives two drawings on a page different ids", async () => {
    const html = await render(`${drawing()}\n\nBetween.\n\n${drawing()}`);
    const ids = html.querySelectorAll("svg [id]").map(element => element.id);
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
    for (const group of html.querySelectorAll("g[clip-path]")) {
      assert.match(group.getAttribute("clip-path") ?? "", /^url\(#excalidraw-/);
    }
  });

  // Why: only the publisher's drawing block changes; other raw HTML in a
  // note stays as written.
  it("leaves other HTML alone", async () => {
    const html = await render('<div class="note-box">Kept.</div>');
    assert.equal(html.toString().trim(), '<div class="note-box">Kept.</div>');
  });
});
