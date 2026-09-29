/**
 * Transclusions in real Chrome: the source card's header spans the top of
 * the card with the link at its end, a link to a block lands below the
 * navbar, the table of contents leaves out embedded headings, the page
 * keeps one h1, and axe finds
 * nothing to flag (the header's quieter "From" included).
 *
 * Why this level and this fixture: the header is pulled over the card's
 * padding by negative margins, which only a layout shows, and contrast is
 * computed from the rendered colors. No published note embeds another yet,
 * so the tests build a throwaway copy of the site with the publisher's
 * markup (test/support/publisher-embed.ts).
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
import { publisherEmbed } from "../support/publisher-embed.ts";
import { serveStatic, type StaticServer } from "../support/static-server.ts";

let fixture: FixtureProject;
let server: StaticServer;
let browser: Browser;
let origin: string;
let axeSource: string;

const NOTE = "/posts/embeds/";
// A published note in the real wikilink index, which gives its title.
const SOURCE_URL = "/posts/dotfiles-reorg-a-journey/";

before(async () => {
  fixture = await createFixtureProject("transclusions-test");
  await fixture.writeNote("Home.md", {
    title: "Home",
    permalink: "/",
    home: true,
    body: "Welcome.",
  });
  await fixture.writeNote("Posts/Embeds.md", {
    title: "Embeds",
    permalink: NOTE,
    body: [
      // Three sections of the note's own, so it has a table of contents.
      "## First",
      "## Second",
      "## Third",
      "Before the embeds.",
      publisherEmbed({
        href: SOURCE_URL,
        body: "It seems to me like IO is Haskell's way of modelling a statement.",
      }),
      publisherEmbed({
        href: `${SOURCE_URL}#The-epiphany`,
        title: "# IO, an epiphany",
        body: "## The epiphany\n\nAn action that yields a value when it runs.",
      }),
      publisherEmbed({ body: "Text from an unpublished note." }),
      "After the embeds.",
      // A block a block embed's link would point at, as the publisher
      // writes `^block-target`, with text after it to scroll to.
      "A block to link to. \n{ #block-target}",
      ...Array.from({ length: 12 }, (_, index) => `Filler paragraph ${index}.`),
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
    return await run(page);
  } finally {
    await context.close();
  }
}

describe("transclusions", () => {
  for (const width of [390, 1440]) {
    // Why: the header is the card's top band. Its negative margins must
    // cancel the card's padding exactly, or a strip of the card shows
    // above or beside it (the first build left a gap above it), and the
    // link must sit in the band, not over the embedded text.
    it(`draws the header across the card's top at ${width}px`, async () => {
      await withPage(width, async page => {
        const cards = await page.$$eval(".transclusion", cards =>
          cards.flatMap(card => {
            const header = card.querySelector(".markdown-embed-title");
            if (!header) return [];
            const box = card.getBoundingClientRect();
            const band = header.getBoundingClientRect();
            const link = card
              .querySelector(".markdown-embed-link")
              ?.getBoundingClientRect();
            return [
              {
                top: band.top - box.top,
                left: band.left - box.left,
                right: box.right - band.right,
                linkInBand:
                  link !== undefined &&
                  link.top >= band.top &&
                  link.bottom <= band.bottom &&
                  box.right - link.right < 16,
              },
            ];
          })
        );
        // The card's 1px border surrounds the band.
        assert.deepEqual(cards, [
          { top: 1, left: 1, right: 1, linkInBand: true },
          { top: 1, left: 1, right: 1, linkInBand: true },
        ]);
      });
    });
  }

  // Why: a block embed's link lands on the block (plugins/mdast/blockIds.ts),
  // which must stop below the fixed navbar like a heading does.
  it("lands a link to a block below the navbar on phones", async () => {
    await withPage(390, async page => {
      await page.goto(`${origin}${NOTE}#block-target`, { waitUntil: "load" });
      const [navbar, block] = await Promise.all(
        ["nav.navbar", "#block-target"].map(selector =>
          page.$eval(
            selector,
            element => element.getBoundingClientRect().toJSON() as DOMRect
          )
        )
      );
      assert.ok(
        navbar &&
          block &&
          block.top >= navbar.bottom &&
          block.top < navbar.bottom + 60,
        JSON.stringify({ navbar, block })
      );
    });
  });

  // Why: the table of contents lists the note's own sections; the
  // embedded note's heading ("The epiphany") is that note's.
  it("leaves embedded headings out of the table of contents", async () => {
    await withPage(1440, async page => {
      assert.deepEqual(
        await page.locator("details.toc-inline a").allTextContents(),
        ["First", "Second", "Third"]
      );
    });
  });

  // Why: the embed title arrives as a `#` heading; the page's only h1 is
  // the note's own title.
  it("keeps one h1 on the page", async () => {
    await withPage(1440, async page => {
      assert.deepEqual(await page.locator("h1").allTextContents(), ["Embeds"]);
    });
  });

  // Why: the header's "From" is deliberately quieter than the note's name;
  // it must still meet contrast on the header's gray, and the icon link
  // needs a name.
  it("passes axe", async () => {
    await withPage(1440, async page => {
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
});
