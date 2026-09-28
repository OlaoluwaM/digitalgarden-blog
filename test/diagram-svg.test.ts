/**
 * Unit tests for `prepareDiagramSvg`, which readies an SVG from Kroki for
 * inlining in a note: sanitized, with ids unique to the diagram, named for
 * assistive technology, and free to scale down (ADR 0006).
 *
 * Why this level: the fixtures are real Kroki output (test/fixtures/kroki),
 * so string-level checks pin exactly what the page receives, without a
 * build or the network.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { parse } from "node-html-parser";
import { diagramWidth, prepareDiagramSvg } from "../src/lib/diagram-svg.ts";

const fixture = (name: string) =>
  readFile(new URL(`./fixtures/kroki/${name}`, import.meta.url), "utf8");

const mermaid = await fixture("mermaid-flowchart.svg");
const titled = await fixture("mermaid-titled.svg");
const plantuml = await fixture("plantuml-sequence.svg");

const prepare = (svg: string, type: "mermaid" | "plantuml" = "mermaid") =>
  prepareDiagramSvg(svg, { type, idPrefix: "d1" });

describe("prepareDiagramSvg", () => {
  // Why: every Mermaid SVG has id="container", and its stylesheet and
  // markers refer to it (`#container .node`, `url(#container_…)`). Two
  // diagrams on one page would share ids and restyle each other, so each
  // diagram's ids, and every reference to them, get its own prefix.
  it("prefixes every id and every reference to one", () => {
    const svg = prepare(mermaid);
    const root = parse(svg);
    const ids = root.querySelectorAll("[id]").map(element => element.id);
    assert.ok(ids.length > 1);
    assert.ok(
      ids.every(id => id.startsWith("d1-")),
      ids.join(" ")
    );
    assert.doesNotMatch(svg, /#container(?![\w-])/);
    assert.match(svg, /#d1-container /);
    assert.doesNotMatch(svg, /url\(#container/);
  });

  // Why: the diagram is inlined into the page, so anything that could run
  // (scripts, event handlers, javascript: links) is removed, whatever
  // Kroki sends.
  it("removes scripts, event handlers, and javascript: links", () => {
    const svg = prepare(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)"><text onclick="alert(4)">Hi</text></a><a href="https://thunk.blog"><text>Ok</text></a></svg>`
    );
    assert.doesNotMatch(svg, /script|onload|onclick|javascript:/i);
    assert.match(svg, /href="https:\/\/thunk\.blog"/);
  });

  // Why: an SVG is one image to assistive technology. It is named by the
  // diagram's own title (Mermaid's `accTitle`), else by its kind.
  it("names the diagram by its title, else by its kind", () => {
    const named = parse(prepare(titled)).querySelector("svg");
    assert.equal(named?.getAttribute("role"), "img");
    assert.equal(
      named?.getAttribute("aria-labelledby"),
      "d1-chart-title-container"
    );
    assert.equal(named?.hasAttribute("aria-label"), false);

    for (const [svg, type, name] of [
      [mermaid, "mermaid", "Mermaid diagram"],
      [plantuml, "plantuml", "PlantUML diagram"],
    ] as const) {
      const element = parse(prepare(svg, type)).querySelector("svg");
      assert.equal(element?.getAttribute("role"), "img");
      assert.equal(element?.getAttribute("aria-label"), name);
    }
  });

  // Why: PlantUML fixes its size inline and stretches rather than scales
  // (`preserveAspectRatio="none"`), so on a phone it would distort. Without
  // them, the site's CSS scales it down in proportion; the width and height
  // attributes stay as its natural size.
  it("lets a PlantUML diagram scale in proportion", () => {
    const element = parse(prepare(plantuml, "plantuml")).querySelector("svg");
    assert.equal(element?.hasAttribute("style"), false);
    assert.equal(element?.hasAttribute("preserveAspectRatio"), false);
    assert.ok(element?.getAttribute("width"));
    assert.ok(element?.getAttribute("viewBox"));
  });

  // Why: the stylesheet shrinks a diagram only down to 70% of its drawn
  // size, so it needs that size: the viewBox width, which both formats set.
  it("reads the diagram's drawn width from its viewBox", () => {
    assert.equal(diagramWidth(mermaid), 942.1875);
    assert.equal(diagramWidth(plantuml), 380);
  });

  // Why: PlantUML adds processing instructions (`<?plantuml …?>`), which
  // mean nothing in HTML.
  it("drops processing instructions", () => {
    assert.doesNotMatch(prepare(plantuml, "plantuml"), /<\?/);
  });
});
