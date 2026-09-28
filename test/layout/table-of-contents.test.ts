/**
 * The table of contents in real Chrome, at each width's design: the rail
 * from 1400px (A), the inline box from 800px to 1399px (B), and the
 * button and sheet below 800px (D).
 *
 * Why this level and this fixture: which variant shows, where it sits, and
 * whether it scrolls with the note depend on the whole cascade at real
 * viewport sizes, and the behavior on the browser's own <details> and
 * popover. No published note has three sections yet, so the tests build a
 * throwaway copy of the site with notes that do (test/support/fixture-site.ts).
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

const NOTE = "/posts/sections/";
const SHORT_NOTE = "/posts/short/";

const paragraphs = (topic: string) =>
  Array.from(
    { length: 4 },
    (_, index) =>
      `Paragraph ${index + 1} about ${topic}. It runs long enough to wrap onto several lines at every width, so the note is tall enough to scroll past each heading and check which one is being read.`
  ).join("\n\n");

before(async () => {
  fixture = await createFixtureProject("table-of-contents-test");
  await fixture.writeNote("Home.md", {
    title: "Home",
    permalink: "/",
    home: true,
    body: "Welcome.",
  });
  await fixture.writeNote("Posts/Sections.md", {
    title: "A note with sections",
    permalink: NOTE,
    body: [
      paragraphs("the introduction"),
      "## The INFO command",
      paragraphs("the command"),
      "### Sections and fields",
      paragraphs("sections"),
      "### Formatting the reply",
      paragraphs("the reply"),
      "## Wiring it into the server",
      paragraphs("the server"),
      "## What's next",
      paragraphs("what comes next"),
    ].join("\n\n"),
  });
  await fixture.writeNote("Posts/Short.md", {
    title: "A short note",
    permalink: SHORT_NOTE,
    body: ["## One", "Text.", "## Two", "Text."].join("\n\n"),
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
  run: (page: Page) => Promise<T>,
  options: { javaScriptEnabled?: boolean; path?: string } = {}
): Promise<T> {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    javaScriptEnabled: options.javaScriptEnabled ?? true,
  });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}${options.path ?? NOTE}`, { waitUntil: "load" });
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

const RAIL = ".toc-rail nav";
const INLINE = "details.toc-inline";
const BUTTON = "button.toc-button";
const SHEET = "#toc-sheet";

/** Which variants the reader can see. */
async function visible(page: Page) {
  return {
    rail: await page.isVisible(RAIL),
    inline: await page.isVisible(INLINE),
    button: await page.isVisible(BUTTON),
  };
}

describe("table of contents", () => {
  // Why: each width gets its one design, and the others must be gone, not
  // just out of sight: a hidden duplicate would still be a second landmark
  // or a second tab stop.
  for (const [width, expected] of [
    [1440, { rail: true, inline: false, button: false }],
    [1400, { rail: true, inline: false, button: false }],
    [1399, { rail: false, inline: true, button: false }],
    [1100, { rail: false, inline: true, button: false }],
    [800, { rail: false, inline: true, button: false }],
    [799, { rail: false, inline: false, button: true }],
    [390, { rail: false, inline: false, button: true }],
  ] as const) {
    it(`shows only its ${width}px design`, async () => {
      await withPage(width, async page => {
        assert.deepEqual(await visible(page), expected);
      });
    });
  }

  // Why: the rail lives in the space beside the note column; it must not
  // cover the text or run off the screen at the narrowest width it shows.
  for (const width of [1400, 1440, 1920]) {
    it(`puts the rail beside the note column at ${width}px`, async () => {
      await withPage(width, async page => {
        const column = await rect(page, "main.content");
        const rail = await rect(page, RAIL);
        assert.ok(
          rail.left >= column.right + 40,
          JSON.stringify({ column, rail })
        );
        assert.ok(rail.right <= width, JSON.stringify({ rail, width }));
      });
    });
  }

  // Why: the rail is for finding your place in a long note, so it stays in
  // view as the note scrolls, and it marks the section being read.
  it("keeps the rail in view and marks the section being read", async () => {
    await withPage(1440, async page => {
      await page.evaluate(() =>
        document.getElementById("formatting-the-reply")?.scrollIntoView()
      );
      const rail = await rect(page, RAIL);
      assert.ok(rail.top >= 0 && rail.bottom <= 800, JSON.stringify(rail));
      await page.waitForFunction(
        () =>
          document
            .querySelector(".toc-rail a[aria-current]")
            ?.getAttribute("href") === "#formatting-the-reply"
      );
      assert.equal(await page.locator(".toc-rail a[aria-current]").count(), 1);
    });
  });

  // Why: between phones and desktops the list sits under the header,
  // closed so it doesn't push the note down, and opens in place.
  for (const width of [800, 1100]) {
    it(`opens the closed contents box under the header at ${width}px`, async () => {
      await withPage(width, async page => {
        const box = await rect(page, INLINE);
        const meta = await rect(page, "header .timestamps");
        const text = await rect(page, "main.content > p");
        assert.ok(meta.bottom <= box.top && box.bottom <= text.top);
        assert.equal(await page.isVisible(`${INLINE} nav`), false);
        await page.click(`${INLINE} summary`);
        assert.equal(await page.isVisible(`${INLINE} nav`), true);
        assert.equal(await page.locator(`${INLINE} nav a`).count(), 5);
      });
    });
  }

  // Why: on phones a button opens the list as a sheet from the bottom of
  // the screen. Choosing a section closes the sheet and lands the heading
  // below the fixed navbar, not under it.
  it("opens the sheet from the phone button and closes it on a choice", async () => {
    await withPage(390, async page => {
      await page.click(BUTTON);
      assert.equal(await page.isVisible(SHEET), true);
      const sheet = await rect(page, SHEET);
      assert.equal(Math.round(sheet.bottom), 800);
      await page.click(`${SHEET} a[href="#formatting-the-reply"]`);
      await page.waitForFunction(
        () => !document.querySelector("#toc-sheet:popover-open")
      );
      assert.equal(new URL(page.url()).hash, "#formatting-the-reply");
      const navbar = await rect(page, "nav.navbar");
      const heading = await rect(page, "#formatting-the-reply");
      assert.ok(
        heading.top >= navbar.bottom && heading.top < navbar.bottom + 60,
        JSON.stringify({ navbar, heading })
      );
    });
  });

  // Why: the box and the sheet are built on <details> and a popover, so
  // they open without JavaScript; only the section marking needs it.
  it("opens the box and the sheet without JavaScript", async () => {
    await withPage(
      1100,
      async page => {
        await page.click(`${INLINE} summary`);
        assert.equal(await page.isVisible(`${INLINE} nav`), true);
      },
      { javaScriptEnabled: false }
    );
    await withPage(
      390,
      async page => {
        await page.click(BUTTON);
        assert.equal(await page.isVisible(SHEET), true);
        await page.click(`${SHEET} button[aria-label="Close contents"]`);
        assert.equal(await page.isVisible(SHEET), false);
      },
      { javaScriptEnabled: false }
    );
  });

  // Why: a note with one or two sections gets no table of contents.
  it("leaves it out of a note with fewer than three sections", async () => {
    for (const width of [1440, 1100, 390]) {
      await withPage(
        width,
        async page => {
          assert.equal(await page.locator(".toc-list").count(), 0);
          assert.equal(await page.locator(BUTTON).count(), 0);
        },
        { path: SHORT_NOTE }
      );
    }
  });

  // Why: the button sits over the note on phones; it must not widen the
  // page into a sideways scroll.
  it("adds no horizontal scroll on phones", async () => {
    await withPage(390, async page => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth
      );
      assert.ok(overflow <= 0, `${overflow}px`);
    });
  });

  // Why: printed notes have no use for navigation, as with the site's
  // other chrome.
  it("prints without the table of contents", async () => {
    for (const width of [1440, 1100, 390]) {
      await withPage(width, async page => {
        await page.emulateMedia({ media: "print" });
        assert.deepEqual(await visible(page), {
          rail: false,
          inline: false,
          button: false,
        });
      });
    }
  });

  // Why: each design adds controls and landmarks; axe checks their names,
  // roles, and contrast at every width, with the sheet open on phones.
  for (const width of [1440, 1100, 390]) {
    it(`passes axe at ${width}px`, async () => {
      await withPage(width, async page => {
        if (width === 390) await page.click(BUTTON);
        if (width === 1100) await page.click(`${INLINE} summary`);
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

describe("table of contents at the end of a note", () => {
  // Why: the phone button floats over the note's lower right corner; at
  // the end of the page it must not cover the note's last line.
  it("leaves the last line clear of the phone button", async () => {
    await withPage(390, async page => {
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
      const button = await rect(page, BUTTON);
      const last = await rect(
        page,
        "main.content > footer, main.content > :last-child"
      );
      assert.ok(last.bottom <= button.top, JSON.stringify({ last, button }));
    });
  });
});
