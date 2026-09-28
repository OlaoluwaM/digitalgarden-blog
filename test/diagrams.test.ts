/**
 * Render through the site's Markdown processor with a local fake Kroki
 * (test/support/fake-kroki.ts): ```mermaid and ```plantuml fences become
 * inline SVG figures (ADR 0006), other fences stay code, and a diagram
 * Kroki rejects fails with the note and line.
 *
 * Why this level: the plugin's output and its error are what the build
 * receives; the site's own processor shows them in place among the other
 * plugins (Shiki, callouts) without a build.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateConfig } from "astro/config";
import { parse } from "node-html-parser";
import { startFakeKroki, type FakeKroki } from "./support/fake-kroki.ts";

let kroki: FakeKroki;
let cacheDir: string;
let render: (
  source: string,
  fileURL?: URL
) => Promise<ReturnType<typeof parse>>;

before(async () => {
  kroki = await startFakeKroki();
  cacheDir = await mkdtemp(join(tmpdir(), "diagrams-test-"));
  // The site's config reads these when it builds its plugins.
  process.env.KROKI_URL = kroki.url;
  process.env.KROKI_CACHE_DIR = cacheDir;
  const { default: siteConfig } = await import("../astro.config.ts");
  const { markdown } = await validateConfig(
    siteConfig,
    fileURLToPath(new URL("../", import.meta.url)),
    "build"
  );
  const renderer = await markdown.processor.createRenderer(markdown);
  render = async (source, fileURL) =>
    parse((await renderer.render(source, { fileURL })).code);
});

after(async () => {
  await kroki?.close();
  await rm(cacheDir, { recursive: true, force: true });
});

describe("diagrams", () => {
  // Why: each diagram becomes its SVG, in a figure the stylesheet sizes,
  // with no trace of the fence for Shiki to highlight.
  it("renders mermaid and plantuml fences as SVG figures", async () => {
    const root = await render(
      "```mermaid\ngraph LR\n  A --> B\n```\n\n```plantuml\n@startuml\nA -> B\n@enduml\n```"
    );
    const figures = root.querySelectorAll("figure.diagram");
    assert.deepEqual(
      figures.map(figure => figure.getAttribute("data-diagram")),
      ["mermaid", "plantuml"]
    );
    for (const figure of figures) {
      assert.ok(figure.querySelector(":scope > svg[role=img]"));
    }
    // The drawn width, for the stylesheet's shrink limit.
    assert.deepEqual(
      figures.map(figure => figure.getAttribute("style")),
      ["--diagram-width: 942.1875px", "--diagram-width: 380px"]
    );
    assert.equal(root.querySelector("pre"), null);
  });

  // Why: only the two diagram languages go to Kroki; any other fence
  // stays a highlighted code block, and Kroki is never asked.
  it("leaves other fences as code", async () => {
    const before = kroki.requests.length;
    const root = await render("```ts\nconst a = 1;\n```\n\n```\nplain\n```");
    assert.equal(root.querySelectorAll("pre").length, 2);
    assert.equal(root.querySelector("figure.diagram"), null);
    assert.equal(kroki.requests.length, before);
  });

  // Why: two diagrams on one page get different id prefixes, so their
  // styles and markers can't collide.
  it("gives each diagram on a page its own ids", async () => {
    const root = await render(
      "```mermaid\ngraph LR\n  A --> B\n```\n\n```mermaid\ngraph LR\n  C --> D\n```"
    );
    const ids = root.querySelectorAll("[id]").map(element => element.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  // Why: diagrams inside callouts render too; the callout plugin runs
  // before this one.
  it("renders a diagram inside a callout", async () => {
    const root = await render(
      "> [!note] Flow\n> ```mermaid\n> graph LR\n>   A --> B\n> ```"
    );
    assert.ok(root.querySelector(".callout-content figure.diagram svg"));
  });

  // Why: a diagram Kroki can't render fails the build (ADR 0006), and the
  // error must say which note and which fence, with Kroki's reason.
  it("fails with the note, the line, and Kroki's reason", async () => {
    const note = pathToFileURL("/vault/Posts/Broken.md");
    await assert.rejects(
      render("Intro.\n\n```mermaid\ngraph LR\n  BROKEN\n```", note),
      (error: Error) => {
        assert.match(error.message, /mermaid diagram/);
        assert.match(error.message, /\/vault\/Posts\/Broken\.md:3/);
        assert.match(error.message, /Kroki answered 400/);
        return true;
      }
    );
  });
});
