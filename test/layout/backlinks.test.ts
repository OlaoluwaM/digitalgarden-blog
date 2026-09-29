/**
 * Backlinks in real Chrome: the "Mentioned in" list sits between a note
 * and its sign-off, keeps the Markdown styles off, lists only the notes it
 * should, and opens "Show more" without JavaScript.
 *
 * Why this level and this fixture: whether the list lands in the right
 * place and escapes the Markdown stylesheet's scope depends on the built
 * page and the whole cascade. The published notes change with the vault,
 * so the tests build a throwaway copy of the site whose notes link to one
 * another in known ways (test/support/fixture-site.ts).
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

const TARGET = "/posts/target/";
const LONELY = "/posts/lonely/";
const LINK = `[the target note](${TARGET})`;

before(async () => {
  fixture = await createFixtureProject("backlinks-test");
  await fixture.writeNote("Home.md", {
    title: "Home",
    permalink: "/",
    home: true,
    body: `Welcome. Start with ${LINK}.`,
  });
  await fixture.writeNote("Posts/Target.md", {
    title: "Target",
    permalink: TARGET,
    body: "The note everyone mentions.",
  });
  await fixture.writeNote("Posts/Lonely.md", {
    title: "Lonely",
    permalink: LONELY,
    body: "Nobody links here.",
  });
  // Four notes that mention the target, a month apart: three show, one
  // waits behind "Show more".
  for (const month of [1, 2, 3, 4]) {
    await fixture.writeNote(`Posts/Mention ${month}.md`, {
      title: `Mention ${month}`,
      permalink: `/posts/mention-${month}/`,
      published: `2026-0${month}-01T00:00`,
      body: `This builds on ${LINK}.`,
    });
  }
  await fixture.writeNote("Posts/Hidden.md", {
    title: "Hidden",
    permalink: "/posts/hidden/",
    hide: true,
    body: `A hidden note that mentions ${LINK}.`,
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
  path: string,
  run: (page: Page) => Promise<T>,
  options: { javaScriptEnabled?: boolean } = {}
): Promise<T> {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    ...options,
  });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}${path}`, { waitUntil: "load" });
    return await run(page);
  } finally {
    await context.close();
  }
}

describe("backlinks", () => {
  // Why: the list belongs to the note, after its last line and before the
  // sign-off; and it lists the notes a reader can reach, newest first:
  // not Home, which links to everything it lists, nor a hidden post.
  it("lists the mentioning notes between the note and the sign-off", async () => {
    await withPage(1440, TARGET, async page => {
      const state = await page.$eval("section.backlinks", section => ({
        before: section.previousElementSibling?.textContent?.trim(),
        after: section.nextElementSibling?.matches("footer.post-cta"),
        titles: [...section.querySelectorAll("a")].map(link =>
          link.textContent?.trim()
        ),
      }));
      assert.deepEqual(state, {
        before: "The note everyone mentions.",
        after: true,
        titles: ["Mention 4", "Mention 3", "Mention 2", "Mention 1"],
      });
    });
  });

  // Why: the list sits in the note column, where the Markdown stylesheet
  // would indent each entry like a note's list item (3ch). It is outside
  // that stylesheet's scope, like Recent Posts, so entries line up with
  // the heading and the note's text.
  it("keeps the note's Markdown styles off the list", async () => {
    await withPage(1440, TARGET, async page => {
      const indent = await page.$eval(
        "section.backlinks li",
        item => getComputedStyle(item).marginInlineStart
      );
      assert.equal(indent, "0px");
    });
  });

  // Why: past three mentions the rest wait behind "Show more", which must
  // open without JavaScript, since it is a native disclosure.
  it("opens Show more without JavaScript", async () => {
    await withPage(
      1440,
      TARGET,
      async page => {
        const visible = () =>
          page.$$eval("section.backlinks a", links =>
            links
              .filter(link => link.checkVisibility())
              .map(link => link.textContent?.trim())
          );
        assert.deepEqual(await visible(), [
          "Mention 4",
          "Mention 3",
          "Mention 2",
        ]);
        await page.getByText("Show 1 more").click();
        assert.deepEqual(await visible(), [
          "Mention 4",
          "Mention 3",
          "Mention 2",
          "Mention 1",
        ]);
        assert.equal(await page.getByText("Show fewer").isVisible(), true);
      },
      { javaScriptEnabled: false }
    );
  });

  // Why: an empty "Mentioned in" heading would be noise on every note
  // nobody links to.
  it("shows nothing on a note nobody mentions", async () => {
    await withPage(1440, LONELY, async page => {
      assert.equal(await page.$("section.backlinks"), null);
    });
  });

  // Why: the list adds a heading, links, and a disclosure at every width;
  // axe checks their names, contrast, and structure.
  for (const width of [1440, 390]) {
    it(`passes axe at ${width}px`, async () => {
      await withPage(width, TARGET, async page => {
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
