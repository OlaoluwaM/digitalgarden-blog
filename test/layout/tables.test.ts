/**
 * Tables in real Chrome: a table wider than the note column scrolls inside
 * its wrapper, with whole words in its cells, and keyboard users can scroll
 * it; a table that fits spans the column and adds no tab stop.
 *
 * Why this level and this fixture: whether a table overflows depends on the
 * whole cascade at real viewport sizes, and keyboard scrolling on the
 * browser. No published note has a table yet, so the tests build a
 * throwaway copy of the site with one (test/support/fixture-site.ts).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
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

const NOTE = "/posts/tables/";

// Five columns with code and a long note: wider than a phone's column.
const WIDE = `| Task | Stack | Cabal | Targets | Notes |
| --- | --- | --- | --- | --- |
| Build everything | \`stack build\` | \`cabal build all\` | all components | With hpack, Stack regenerates the .cabal file from package.yaml before building. |
| Coverage | \`stack test --coverage\` | \`cabal test --enable-coverage\` | test suites | HPC reports land under .stack-work or dist-newstyle. |`;

const NARROW = `| Tool | Language |
| --- | --- |
| Stack | Haskell |`;

before(async () => {
  fixture = await createFixtureProject("tables-test");
  await fixture.writeNote("Home.md", {
    title: "Home",
    permalink: "/",
    home: true,
    body: "Welcome.",
  });
  await fixture.writeNote("Posts/Tables.md", {
    title: "Tables",
    permalink: NOTE,
    body: [
      "A wide table:",
      WIDE,
      "A narrow table:",
      NARROW,
      `> [!note] In a callout\n> ${WIDE.replace(/\n/g, "\n> ")}`,
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
    await page.evaluate(() => document.fonts.ready);
    return await run(page);
  } finally {
    await context.close();
  }
}

/** Where an element sits in the viewport, in CSS pixels. */
async function rect(page: Page, selector: string) {
  return page.$eval(selector, element => {
    const { top, right, bottom, left } = element.getBoundingClientRect();
    return { top, right, bottom, left };
  });
}

/** The mean of a one-pixel PNG's color channels, 0 to 255. */
async function brightness(png: Buffer) {
  const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  return (data[0]! + data[1]! + data[2]!) / 3;
}

const WIDE_WRAPPER = "main.content > .table-wrapper:nth-of-type(1)";
const NARROW_WRAPPER = "main.content > .table-wrapper:nth-of-type(2)";

describe("tables", () => {
  // Why: on phones a wide table used to run past the screen's edge, where
  // the page's `overflow-x: hidden` clipped it with no way to reach its last
  // columns. It now scrolls inside its wrapper, and the page itself still
  // doesn't scroll sideways.
  it("scrolls a wide table inside its wrapper on phones", async () => {
    await withPage(390, async page => {
      const sizes = await page.$eval(WIDE_WRAPPER, wrapper => ({
        scroll: wrapper.scrollWidth,
        client: wrapper.clientWidth,
      }));
      assert.ok(sizes.scroll > sizes.client, JSON.stringify(sizes));
      const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth
      );
      assert.ok(pageOverflow <= 0, `${pageOverflow}px`);

      await page.$eval(WIDE_WRAPPER, wrapper => {
        wrapper.scrollLeft = wrapper.scrollWidth;
      });
      const lastCell = await page.$eval(
        `${WIDE_WRAPPER} tr:last-child td:last-child`,
        cell => cell.getBoundingClientRect().right
      );
      assert.ok(lastCell <= 390, `last column ends at ${lastCell}px`);
    });
  });

  // Why: live's `word-break: break-word` broke words mid-letter in squeezed
  // columns ("Com/mand"). With room to scroll, cells break between words;
  // a word breaks only when it alone is wider than the cell's 30ch cap.
  it("keeps words whole in a wide table's cells", async () => {
    await withPage(390, async page => {
      const broken = await page.$$eval(`${WIDE_WRAPPER} :is(th, td)`, cells =>
        cells.flatMap(cell => {
          const words: string[] = [];
          const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
          for (let text = walker.nextNode(); text; text = walker.nextNode()) {
            const value = text.textContent ?? "";
            for (const match of value.matchAll(/\S+/g)) {
              const range = document.createRange();
              range.setStart(text, match.index);
              range.setEnd(text, match.index + match[0].length);
              if (range.getClientRects().length > 1) words.push(match[0]);
            }
          }
          return words;
        })
      );
      assert.deepEqual(broken, []);
    });
  });

  // Why: in a table wider than the column, cells stop at 30ch, so a long
  // note wraps into a readable column instead of one line as wide as the
  // whole text. (A table narrower than the column stretches to fill it.)
  it("stops a wide table's cells at 30ch", async () => {
    await withPage(390, async page => {
      const cells = await page.$$eval(`${WIDE_WRAPPER} td`, cells =>
        cells.map(cell => {
          const style = getComputedStyle(cell);
          return {
            text: cell.textContent,
            width: cell.getBoundingClientRect().width,
            // 30ch, in pixels, of the cell's own font.
            cap: parseFloat(style.maxWidth),
          };
        })
      );
      for (const cell of cells) {
        assert.ok(cell.width <= cell.cap + 1, JSON.stringify(cell));
      }
      // The long note is the cell that reaches the cap and wraps.
      const note = cells.find(cell => cell.text?.startsWith("With hpack"));
      assert.ok(note && note.width >= note.cap - 1, JSON.stringify(note));
    });
  });

  // Why: a table that fits reads as before: it spans the note column, and
  // scrolls nothing, so it adds no tab stop.
  it("spans the column with a table that fits, without a tab stop", async () => {
    await withPage(1440, async page => {
      const column = await page.$eval("main.content > p", paragraph =>
        Math.round(paragraph.getBoundingClientRect().width)
      );
      const table = await page.$eval(`${NARROW_WRAPPER} table`, element =>
        Math.round(element.getBoundingClientRect().width)
      );
      assert.equal(table, column);
      assert.equal(
        await page.$eval(NARROW_WRAPPER, wrapper =>
          wrapper.hasAttribute("tabindex")
        ),
        false
      );
    });
  });

  // Why: a scrolling box with nothing focusable inside can't be scrolled
  // from the keyboard (WCAG 2.1.1). The wrapper takes a tab stop and a name
  // while it overflows, and the arrow keys scroll it.
  it("lets keyboard users reach and scroll a wide table", async () => {
    await withPage(390, async page => {
      const wrapper = page.locator(WIDE_WRAPPER);
      assert.equal(await wrapper.getAttribute("tabindex"), "0");
      assert.equal(
        await wrapper.getAttribute("aria-label"),
        "Table, scrollable"
      );
      await wrapper.focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(
        selector => (document.querySelector(selector)?.scrollLeft ?? 0) > 0,
        WIDE_WRAPPER
      );
    });
  });

  // Why: a table in a callout scrolls in its own wrapper, so the callout's
  // body no longer needs to scroll, and only one box gets the tab stop.
  it("scrolls a table in a callout in its own wrapper", async () => {
    await withPage(390, async page => {
      const state = await page.$eval(".callout-content", content => ({
        contentScrolls: content.scrollWidth > content.clientWidth,
        wrapperStop: content
          .querySelector(".table-wrapper")
          ?.getAttribute("tabindex"),
      }));
      assert.deepEqual(state, { contentScrolls: false, wrapperStop: "0" });
    });
  });

  // Why: a wrapper that scrolls needs a cue that the table continues, since
  // scrollbars are hidden on phones and macOS. Edge shadows fade in where
  // there is more to scroll to and out at the table's own edges.
  it("shows a shadow only at an edge with more table beyond it", async () => {
    await withPage(390, async page => {
      // Hide the table's text and borders, keeping its size, so only the
      // wrapper's background is sampled.
      await page.addStyleTag({
        content: `${WIDE_WRAPPER} table { visibility: hidden; }`,
      });
      const edge = async (side: "left" | "right") => {
        const box = await rect(page, WIDE_WRAPPER);
        const x = side === "left" ? box.left + 2 : box.right - 3;
        // The shadows are strongest at the wrapper's vertical middle.
        const y = Math.round((box.top + box.bottom) / 2);
        const image = await page.screenshot({
          clip: { x, y, width: 1, height: 1 },
        });
        return brightness(image);
      };
      const atStart = { left: await edge("left"), right: await edge("right") };
      await page.$eval(WIDE_WRAPPER, wrapper => {
        wrapper.scrollLeft = wrapper.scrollWidth;
      });
      const atEnd = { left: await edge("left"), right: await edge("right") };
      // Darker than the page (#1e1e1e, 30) means a shadow.
      assert.ok(
        atStart.right < 25 && atStart.left >= 29,
        JSON.stringify(atStart)
      );
      assert.ok(atEnd.left < 25 && atEnd.right >= 29, JSON.stringify(atEnd));
    });
  });

  // Why: the wrappers add controls at every width; axe checks that they
  // are named and reachable (scrollable-region-focusable).
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
