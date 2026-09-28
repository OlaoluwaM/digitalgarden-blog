/**
 * Task lists in real Chrome: each checkbox is named by its item's text,
 * axe finds nothing to flag, and the boxes stay read-only.
 *
 * Why this level and this fixture: accessible names are computed by the
 * browser from the rendered page, and axe runs against it. No published
 * note has a task list yet, so the tests build a throwaway copy of the site
 * with one (test/support/fixture-site.ts).
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

const NOTE = "/posts/tasks/";

before(async () => {
  fixture = await createFixtureProject("task-lists-test");
  await fixture.writeNote("Home.md", {
    title: "Home",
    permalink: "/",
    home: true,
    body: "Welcome.",
  });
  await fixture.writeNote("Posts/Tasks.md", {
    title: "Tasks",
    permalink: NOTE,
    body: [
      "- [x] Move the dotfiles to **NixOS**",
      "- [ ] Write about [flakes](https://nixos.wiki/wiki/Flakes)",
      "  - [ ] Try Home Manager",
    ].join("\n"),
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

async function withPage<T>(run: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 800 },
  });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}${NOTE}`, { waitUntil: "load" });
    return await run(page);
  } finally {
    await context.close();
  }
}

describe("task lists", () => {
  // Why: a screen reader announces a checkbox by its name; without one it
  // says only "checkbox, not checked". Each is named by its own item's
  // text, and a nested item's text stays out of its parent's name.
  it("names each checkbox by its item's text", async () => {
    await withPage(async page => {
      const names = await page
        .getByRole("checkbox")
        .evaluateAll(boxes =>
          boxes.map(box =>
            (box as HTMLInputElement).labels?.[0]?.textContent
              ?.replace(/\s+/g, " ")
              .trim()
          )
        );
      assert.deepEqual(names, [
        "Move the dotfiles to NixOS",
        "Write about flakes",
        "Try Home Manager",
      ]);
      assert.equal(
        await page
          .getByRole("checkbox", { name: "Move the dotfiles to NixOS" })
          .isChecked(),
        true
      );
    });
  });

  // Why: a published note is not a to-do app; a click on the label must
  // not tick a box the author left open.
  it("keeps the checkboxes read-only", async () => {
    await withPage(async page => {
      const open = page.getByRole("checkbox", { name: "Try Home Manager" });
      await page.getByText("Try Home Manager").click({ force: true });
      assert.equal(await open.isChecked(), false);
      assert.equal(await open.isDisabled(), true);
    });
  });

  // Why: axe flagged these checkboxes as unlabeled (rule `label`) in the
  // style guide's Markdown sample; a page with a task list must pass.
  it("passes axe", async () => {
    await withPage(async page => {
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
