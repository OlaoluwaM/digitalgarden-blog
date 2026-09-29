/**
 * Excalidraw drawings in real Chrome: a drawing the publisher inlined
 * shrinks to fit the note column, but not below 70% of its drawn width;
 * past that it scrolls sideways with the diagrams' edge fade, and keyboard
 * users can reach and scroll it.
 *
 * Why this level and this fixture: sizing and scrolling depend on the
 * whole cascade at real viewport sizes, and the tab stop on the
 * scroll-region script running in the browser. No published note has a
 * drawing, so the tests build a throwaway copy of the site with one
 * (test/support/fixture-site.ts), in the publisher's markup.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import {
  buildFixture,
  createFixtureProject,
  type FixtureProject,
} from "../support/fixture-site.ts";
import { serveStatic, type StaticServer } from "../support/static-server.ts";

let fixture: FixtureProject;
let server: StaticServer;
let browser: Browser;
let origin: string;
let axeSource: string;

const NOTE = "/posts/drawings/";

// A 900px-wide drawing as the publisher inlines it: wider than the column
// at every width, and wider than a phone's column even at 70%.
const DRAWING =
  '<div class="excalidraw-svg"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 300" width="900" height="300" style="max-width: 100%; height: auto;">' +
  '<rect x="0" y="0" width="900" height="300" fill="#ffffff"></rect>' +
  '<text x="20" y="150" font-size="20">Vault to site</text></svg></div>';

before(async () => {
  fixture = await createFixtureProject("excalidraw-test");
  await fixture.writeNote("Home.md", {
    title: "Home",
    permalink: "/",
    home: true,
    body: "Welcome.",
  });
  await fixture.writeNote("Posts/Drawings.md", {
    title: "Drawings",
    permalink: NOTE,
    body: ["A drawing:", DRAWING].join("\n\n"),
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

/** The drawing's scale against its drawn width, and whether it scrolls. */
async function size(page: Page) {
  return page.$eval(".diagram svg", svg => {
    const figure = svg.parentElement!;
    return {
      scale:
        svg.getBoundingClientRect().width /
        (svg as SVGSVGElement).viewBox.baseVal.width,
      scrolls: figure.scrollWidth > figure.clientWidth,
    };
  });
}

describe("Excalidraw drawings", () => {
  // Why: the publisher's `max-width: 100%` shrank a wide drawing without
  // limit, so on a phone its text got too small to read. It now stops at
  // 70% of its drawn width and scrolls past that; on a wide screen it
  // still shrinks to fit the column.
  it("shrinks to fit, but no further than 70%, then scrolls", async () => {
    await withPage(1440, async page => {
      const { scale, scrolls } = await size(page);
      assert.equal(scrolls, false);
      assert.ok(scale >= 0.7 && scale < 1, `${scale}`);
    });
    await withPage(390, async page => {
      const { scale, scrolls } = await size(page);
      assert.equal(scrolls, true);
      assert.ok(Math.abs(scale - 0.7) < 0.01, `${scale}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth
      );
      assert.ok(overflow <= 0, `${overflow}px`);
    });
  });

  // Why: a drawing that scrolls needs a tab stop and a name, or keyboard
  // users can't scroll it (WCAG 2.1.1), and a cue that it continues.
  it("gives a scrolling drawing a tab stop, a name, and the edge fade", async () => {
    await withPage(390, async page => {
      const figure = await page.$eval(".diagram", element => ({
        tabindex: element.getAttribute("tabindex"),
        label: element.getAttribute("aria-label"),
        fadeEnd: getComputedStyle(element).getPropertyValue("--fade-end"),
      }));
      assert.deepEqual(figure, {
        tabindex: "0",
        label: "Excalidraw drawing, scrollable",
        fadeEnd: "40px",
      });
    });
  });

  // Why: the figure adds a control on phones; axe checks that it is named
  // and reachable. (axe passes an SVG with no role, so the drawing's own
  // name is checked in test/excalidraw.test.ts.)
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
});
