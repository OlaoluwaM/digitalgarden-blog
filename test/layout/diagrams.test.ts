/**
 * Diagrams in real Chrome and in a real build, against a local fake Kroki
 * (test/support/fake-kroki.ts) that answers with real Kroki SVGs: they
 * scale to the note column, keep their own styles, stay distinct on one
 * page, and pass axe; and a diagram Kroki rejects fails the build (ADR 0006).
 *
 * Why this level and this fixture: sizing and style isolation depend on
 * the full cascade at real widths, and "fail the build" is only true of a
 * build. No published note has a diagram yet, so the tests build throwaway
 * copies of the site (test/support/fixture-site.ts).
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import { startFakeKroki, type FakeKroki } from "../support/fake-kroki.ts";
import {
  buildFixture,
  createFixtureProject,
  type FixtureProject,
} from "../support/fixture-site.ts";
import { serveStatic, type StaticServer } from "../support/static-server.ts";

let kroki: FakeKroki;
let cacheDir: string;
let fixture: FixtureProject;
let server: StaticServer;
let browser: Browser;
let origin: string;
let axeSource: string;

const NOTE = "/posts/diagrams/";
const MERMAID = "```mermaid\ngraph LR\n  A[Vault] --> B[Site]\n```";

async function writeHome(site: FixtureProject) {
  await site.writeNote("Home.md", {
    title: "Home",
    permalink: "/",
    home: true,
    body: "Welcome.",
  });
}

before(async () => {
  kroki = await startFakeKroki();
  cacheDir = await mkdtemp(join(tmpdir(), "diagrams-layout-"));
  // The fixture build inherits these: the fake Kroki, and a throwaway cache.
  process.env.KROKI_URL = kroki.url;
  process.env.KROKI_CACHE_DIR = cacheDir;

  fixture = await createFixtureProject("diagrams-test");
  await writeHome(fixture);
  await fixture.writeNote("Posts/Diagrams.md", {
    title: "Diagrams",
    permalink: NOTE,
    body: [
      "A flowchart:",
      MERMAID,
      "Another, on the same page:",
      "```mermaid\ngraph LR\n  C --> D\n```",
      "A sequence diagram:",
      "```plantuml\n@startuml\nReader -> Site: Open a note\n@enduml\n```",
    ].join("\n\n"),
  });
  const { status, output } = await buildFixture(fixture.project);
  assert.equal(status, 0, output);

  server = await serveStatic(join(fixture.project, "dist"));
  origin = server.origin;
  browser = await chromium.launch({
    executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH || undefined,
  });
  axeSource = await readFile("node_modules/axe-core/axe.min.js", "utf8");
});

after(async () => {
  await browser?.close();
  await server?.close();
  await fixture?.cleanup();
  await kroki?.close();
  await rm(cacheDir, { recursive: true, force: true });
});

async function withPage<T>(
  width: number,
  run: (page: Page) => Promise<T>
): Promise<T> {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
  });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}${NOTE}`, { waitUntil: "load" });
    return await run(page);
  } finally {
    await context.close();
  }
}

describe("diagrams", () => {
  // Why: a diagram is often wider than a phone. It shrinks to fit the
  // column in proportion (PlantUML's own markup would stretch it), but not
  // below 70% of its drawn size, where its labels would be unreadable;
  // past that its figure scrolls sideways, and the page itself never does.
  for (const width of [1440, 390]) {
    it(`fits or scrolls every diagram at ${width}px`, async () => {
      await withPage(width, async page => {
        const sizes = await page.$$eval(".diagram svg", svgs =>
          svgs.map(svg => {
            const figure = svg.parentElement!;
            const box = svg.getBoundingClientRect();
            const viewBox = (svg as SVGSVGElement).viewBox.baseVal;
            return {
              width: box.width,
              column: figure.clientWidth,
              scrolls: figure.scrollWidth > figure.clientWidth,
              scale: box.width / viewBox.width,
              ratio: box.width / box.height,
              natural: viewBox.width / viewBox.height,
            };
          })
        );
        assert.equal(sizes.length, 3);
        for (const size of sizes) {
          const detail = JSON.stringify(size);
          assert.ok(Math.abs(size.ratio - size.natural) < 0.02, detail);
          assert.ok(size.scale >= 0.7 - 0.001 && size.scale <= 1.001, detail);
          if (size.scrolls) {
            assert.ok(Math.abs(size.scale - 0.7) < 0.01, detail);
          } else {
            assert.ok(size.width <= size.column + 0.5, detail);
          }
        }
        // The 942px flowchart fits at 1440px but scrolls on a phone.
        assert.equal(sizes[0]?.scrolls, width === 390);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth
        );
        assert.ok(overflow <= 0, `${overflow}px`);
      });
    });
  }

  // Why: a diagram that scrolls needs a tab stop and a name, or keyboard
  // users can't scroll it (WCAG 2.1.1); one that fits adds no tab stop.
  it("gives a scrolling diagram a tab stop and a name", async () => {
    await withPage(390, async page => {
      const figures = await page.$$eval(".diagram", figures =>
        figures.map(figure => ({
          tabindex: figure.getAttribute("tabindex"),
          label: figure.getAttribute("aria-label"),
        }))
      );
      assert.deepEqual(figures[0], {
        tabindex: "0",
        label: "Mermaid diagram, scrollable",
      });
      assert.equal(figures[2]?.tabindex, null);
    });
  });

  // Why: a diagram that scrolls needs a cue that it continues, and an edge
  // shadow drawn behind it would hide under its filled shapes. Instead the
  // edge with more to scroll to fades out, over the shapes, and clears at
  // each end; a diagram that fits doesn't fade. (A scroll-driven animation
  // moves the fades; Firefox, without one, shows none.)
  it("fades the edge of a scrolling diagram that has more beyond it", async () => {
    await withPage(390, async page => {
      const fades = (index: number) =>
        page.$$eval(
          ".diagram",
          (figures, i) => {
            const style = getComputedStyle(figures[i]!);
            return [
              style.getPropertyValue("--fade-start"),
              style.getPropertyValue("--fade-end"),
            ];
          },
          index
        );
      assert.deepEqual(await fades(0), ["0px", "40px"]);
      await page.$eval(".diagram", figure => {
        figure.scrollLeft = figure.scrollWidth;
      });
      await page.waitForFunction(
        () =>
          getComputedStyle(
            document.querySelector(".diagram")!
          ).getPropertyValue("--fade-end") === "0px"
      );
      assert.deepEqual(await fades(0), ["40px", "0px"]);
      // The PlantUML diagram fits the column: nothing fades.
      assert.deepEqual(await fades(2), ["0px", "0px"]);
    });
  });

  // Why: the fade is a mask, and a mask also clips the focus ring drawn
  // around the figure. While a keyboard user has the diagram focused, the
  // fade steps aside so the ring shows in full.
  it("drops the fade while the diagram has keyboard focus", async () => {
    await withPage(390, async page => {
      const mask = () =>
        page.$eval(".diagram", figure => getComputedStyle(figure).maskImage);
      assert.notEqual(await mask(), "none");
      await page.focus(".diagram");
      await page.keyboard.press("ArrowRight");
      const focused = await page.$eval(".diagram", figure => ({
        visible: figure.matches(":focus-visible"),
        outline: getComputedStyle(figure).outlineStyle,
      }));
      assert.deepEqual(focused, { visible: true, outline: "solid" });
      assert.equal(await mask(), "none");
    });
  });

  // Why: Mermaid writes its labels as HTML paragraphs inside the SVG; the
  // note's paragraph rules (28px margins, 18px text) would break its
  // layout, so the content styles stop at the diagram.
  it("leaves the diagram's own label styles alone", async () => {
    await withPage(1440, async page => {
      const label = await page.$eval(".diagram foreignObject p", element => {
        const style = getComputedStyle(element);
        return { margin: style.marginTop, size: style.fontSize };
      });
      assert.deepEqual(label, { margin: "0px", size: "16px" });
    });
  });

  // Why: every Mermaid SVG arrives with the same ids; on one page they
  // must differ, or one diagram's styles would restyle another.
  it("gives two diagrams on a page different ids", async () => {
    await withPage(1440, async page => {
      const ids = await page.$$eval("[id]", elements =>
        elements.map(element => element.id)
      );
      assert.equal(new Set(ids).size, ids.length);
    });
  });

  // Why: each diagram is one image to assistive technology, with a name.
  for (const width of [1440, 390]) {
    it(`passes axe at ${width}px`, async () => {
      await withPage(width, async page => {
        await page.addScriptTag({ content: axeSource });
        const violations = await page.evaluate(async () => {
          const axe = (
            window as unknown as {
              axe: {
                run: (context: Document) => Promise<{
                  violations: { id: string; nodes: { target: string[] }[] }[];
                }>;
              };
            }
          ).axe;
          const result = await axe.run(document);
          return result.violations.flatMap(violation =>
            violation.nodes.map(
              node => `${violation.id}: ${node.target.join(" ")}`
            )
          );
        });
        assert.deepEqual(violations, []);
      });
    });
  }

  // Why: the chosen policy (ADR 0006) is to fail the build, naming the note
  // and the fence, rather than publish a broken diagram or its source.
  it("fails the build on a diagram Kroki rejects", async () => {
    const broken = await createFixtureProject("diagrams-broken-test");
    try {
      await writeHome(broken);
      await broken.writeNote("Posts/Broken.md", {
        title: "Broken",
        permalink: "/posts/broken/",
        body: "Intro.\n\n```mermaid\ngraph LR\n  BROKEN\n```",
      });
      const { status, output } = await buildFixture(broken.project);
      assert.notEqual(status, 0, output);
      assert.match(output, /Cannot render the mermaid diagram/);
      assert.match(output, /Posts\/Broken\.md:3/);
      assert.match(output, /Kroki answered 400/);
    } finally {
      await broken.cleanup();
    }
  });
});
