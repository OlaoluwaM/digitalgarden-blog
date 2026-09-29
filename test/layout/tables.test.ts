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

/** A wrapper's edge fade widths: [start, end]. */
async function fades(page: Page, selector: string) {
  return page.$eval(selector, wrapper => {
    const style = getComputedStyle(wrapper);
    return [
      style.getPropertyValue("--fade-start"),
      style.getPropertyValue("--fade-end"),
    ];
  });
}

const WIDE_WRAPPER = "main.content > .table-wrapper:nth-of-type(1)";
const NARROW_WRAPPER = "main.content > .table-wrapper:nth-of-type(2)";
const CALLOUT_WRAPPER = ".callout .table-wrapper";

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
  // scrollbars are hidden on phones and macOS. The edge with more table
  // beyond it fades out, and the fade clears at each end; a table that fits
  // doesn't fade. (A scroll-driven animation moves the fades; Firefox,
  // without one, shows none.)
  it("fades the edge of a scrolling table that has more beyond it", async () => {
    await withPage(390, async page => {
      assert.deepEqual(await fades(page, WIDE_WRAPPER), ["0px", "40px"]);
      await page.$eval(WIDE_WRAPPER, wrapper => {
        wrapper.scrollLeft = wrapper.scrollWidth;
      });
      await page.waitForFunction(
        selector =>
          getComputedStyle(document.querySelector(selector)!).getPropertyValue(
            "--fade-end"
          ) === "0px",
        WIDE_WRAPPER
      );
      assert.deepEqual(await fades(page, WIDE_WRAPPER), ["40px", "0px"]);
      assert.deepEqual(await fades(page, NARROW_WRAPPER), ["0px", "0px"]);
    });
  });

  // Why: the shadows this fade replaced were drawn with page-colored covers,
  // so a table on a callout's tinted background had no cue. The fade is a
  // mask and doesn't depend on the background.
  it("fades a scrolling table in a callout too", async () => {
    await withPage(390, async page => {
      assert.deepEqual(await fades(page, CALLOUT_WRAPPER), ["0px", "40px"]);
    });
  });

  // Why: the fade is a mask, and a mask also clips the focus ring drawn
  // around the wrapper. While a keyboard user has the table focused, the
  // fade steps aside so the ring shows in full.
  it("drops the fade while the table has keyboard focus", async () => {
    await withPage(390, async page => {
      const mask = () =>
        page.$eval(
          WIDE_WRAPPER,
          wrapper => getComputedStyle(wrapper).maskImage
        );
      assert.notEqual(await mask(), "none");
      await page.focus(WIDE_WRAPPER);
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page.$eval(WIDE_WRAPPER, wrapper =>
          wrapper.matches(":focus-visible")
        ),
        true
      );
      assert.equal(await mask(), "none");
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
