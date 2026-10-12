/**
 * The "Comments & Discussion" section on built pages, in real Chrome
 * (ADR 0008): where it sits, which pages get it, what readers see with and
 * without JavaScript, and that previews load nothing.
 *
 * Why this level: placement, the scripting media query, and the
 * production-only switch (read from `VERCEL_ENV` at build time) only show
 * in a build. Two throwaway fixture builds run once each: one as Vercel's
 * production build, one as any other. giscus.app is blocked, so the tests
 * check the page's side only; the widget's iframe is out of their reach.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import postcss from "postcss";
import { chromium, type Browser, type Page } from "playwright";
import {
  buildFixture,
  createFixtureProject,
  type FixtureProject,
} from "../support/fixture-site.ts";
import { serveStatic, type StaticServer } from "../support/static-server.ts";

const NOTE = "/posts/commented/";
const HIDDEN = "/posts/hidden/";
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

interface Site {
  fixture: FixtureProject;
  server: StaticServer;
}

let production: Site;
let preview: Site;
let browser: Browser;
let axeSource: string;

async function buildSite(name: string, vercelEnv?: string): Promise<Site> {
  const fixture = await createFixtureProject(name);
  await fixture.writeNote("Home.md", {
    title: "Home",
    permalink: "/",
    home: true,
    body: `Welcome. See [[Commented]].`,
  });
  await fixture.writeNote("Posts/Commented.md", {
    title: "Commented",
    permalink: NOTE,
    body: "A note readers can comment on.",
  });
  await fixture.writeNote("Posts/Hidden.md", {
    title: "Hidden",
    permalink: HIDDEN,
    hide: true,
    body: "A hidden note, opened only from a direct link.",
  });
  // The fixture build inherits the test process's environment.
  const previous = process.env.VERCEL_ENV;
  if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = vercelEnv;
  try {
    const { status, output } = await buildFixture(fixture.project);
    assert.equal(status, 0, output);
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
  return {
    fixture,
    server: await serveStatic(join(fixture.project, "dist")),
  };
}

before(async () => {
  production = await buildSite("comments-production", "production");
  preview = await buildSite("comments-preview");
  browser = await chromium.launch({
    executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH || undefined,
  });
  axeSource = await readFile("node_modules/axe-core/axe.min.js", "utf8");
});

after(async () => {
  await browser?.close();
  for (const site of [production, preview]) {
    await site?.server.close();
    await site?.fixture.cleanup();
  }
});

async function withPage<T>(
  site: Site,
  path: string,
  run: (page: Page) => Promise<T>,
  {
    javaScriptEnabled = true,
    viewport = VIEWPORTS[1]!,
  }: { javaScriptEnabled?: boolean; viewport?: (typeof VIEWPORTS)[number] } = {}
): Promise<T> {
  const context = await browser.newContext({ viewport, javaScriptEnabled });
  try {
    // Never reach the real giscus.app from a test.
    await context.route("https://giscus.app/**", route => route.abort());
    const page = await context.newPage();
    await page.goto(`${site.server.origin}${path}`, { waitUntil: "load" });
    return await run(page);
  } finally {
    await context.close();
  }
}

const SECTION = "section[aria-labelledby='comments-heading']";

describe("comments section", () => {
  // Why: the section comes last, after the sign-off, so a long thread never
  // pushes the note's own ending down (ADR 0008).
  for (const viewport of VIEWPORTS) {
    it(`ends the note, after the sign-off, at ${viewport.width}px`, async () => {
      await withPage(
        production,
        NOTE,
        async page => {
          const order = await page.evaluate(() =>
            [...document.querySelector("main.content")!.children].map(
              element =>
                element.matches("footer.post-cta")
                  ? "sign-off"
                  : element.matches(
                        "section[aria-labelledby='comments-heading']"
                      )
                    ? "comments"
                    : "other"
            )
          );
          assert.deepEqual(order.slice(-2), ["sign-off", "comments"]);
          assert.ok(
            await page.locator(SECTION).getByRole("heading").isVisible()
          );
        },
        { viewport }
      );
    });
  }

  // Why: comments belong to articles. Home lists them, and a hidden note is
  // only opened from a direct link, so neither gets a thread.
  it("leaves Home and hidden notes without comments", async () => {
    // The control: an article in the same build has the section.
    await withPage(production, NOTE, async page => {
      assert.equal(await page.locator(SECTION).count(), 1);
    });
    for (const path of ["/", HIDDEN]) {
      await withPage(production, path, async page => {
        assert.equal(await page.locator(SECTION).count(), 0, path);
        assert.equal(
          await page
            .locator("script[src='https://giscus.app/client.js']")
            .count(),
          0,
          path
        );
      });
    }
  });

  // Why: in production the widget's script is on the page, and the
  // no-JavaScript message stays hidden while scripts run.
  it("loads the widget in production and hides the no-JavaScript message", async () => {
    await withPage(production, NOTE, async page => {
      assert.equal(
        await page
          .locator(`${SECTION} script[src='https://giscus.app/client.js']`)
          .count(),
        1
      );
      assert.equal(
        await page.locator("[data-comments-noscript]").isVisible(),
        false
      );
    });
  });

  // Why: without JavaScript the section stays, and says how to take part.
  for (const viewport of VIEWPORTS) {
    it(`asks readers without JavaScript to enable it at ${viewport.width}px`, async () => {
      await withPage(
        production,
        NOTE,
        async page => {
          const message = page.locator("[data-comments-noscript]");
          assert.ok(await message.isVisible());
          assert.match(
            await message.innerText(),
            /Enable JavaScript to comment and react\./
          );
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth
          );
          assert.equal(overflow, false, "no sideways scroll");
        },
        { javaScriptEnabled: false, viewport }
      );
    });
  }

  // Why: giscus's client adds its own stylesheet to the page, which sets
  // `.giscus-frame { color-scheme: light dark }`, so the iframe follows the
  // reader's system setting. The theme keeps giscus's document dark, and an
  // iframe whose scheme differs from its document's is painted opaque: a
  // dark box on the page in light mode. The page keeps the frame dark too.
  // giscus.app is blocked, so its rule and frame are stood in for here.
  it("keeps giscus's frame dark against giscus's own stylesheet", async () => {
    await withPage(production, NOTE, async page => {
      const scheme = await page.evaluate(() => {
        const style = document.createElement("style");
        style.textContent =
          ".giscus, .giscus-frame { color-scheme: light dark; }";
        document.head.append(style);
        const frame = document.createElement("iframe");
        frame.className = "giscus-frame";
        document.querySelector(".giscus")!.append(frame);
        return getComputedStyle(frame).colorScheme;
      });
      assert.equal(scheme, "dark");
    });
  });

  // Why: the heading must read like "Mentioned in" and the sign-off, in
  // the site's text face. Rendered Markdown's heading rules (Instrument
  // Serif) must not reach it.
  it("sets its heading in the text face, not the heading face", async () => {
    await withPage(production, NOTE, async page => {
      const font = await page
        .locator("#comments-heading")
        .evaluate(heading => getComputedStyle(heading).fontFamily);
      assert.match(font, /^"Instrument Sans"/);
    });
  });

  // Why: each URL form of a note (`/x`, `/x/`, `/x/index.html`) must find
  // the same thread, so the widget is given the note's permalink.
  it("keys the thread on the note's permalink", async () => {
    await withPage(production, NOTE, async page => {
      assert.equal(
        await page
          .locator("script[src='https://giscus.app/client.js']")
          .getAttribute("data-term"),
        NOTE.replace(/\/$/, "")
      );
    });
  });

  // Why: on previews and localhost a comment would land in the real thread,
  // so nothing loads, and the section says where comments are.
  it("loads nothing outside production", async () => {
    await withPage(preview, NOTE, async page => {
      assert.equal(
        await page
          .locator("script[src='https://giscus.app/client.js']")
          .count(),
        0
      );
      assert.equal(
        (await page.locator("[data-comments-off]").innerText()).trim(),
        "Comments only load on thunk.blog."
      );
    });
  });

  // Why: the section is a control for the screen; a printout is the note.
  it("is not printed", async () => {
    await withPage(production, NOTE, async page => {
      assert.ok(await page.locator(SECTION).isVisible(), "shown on screen");
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.locator(SECTION).isVisible(), false);
    });
  });

  // Why: the heading, the message, and its link must pass axe in each state
  // readers can meet. axe needs timers, which don't run with scripting off,
  // so the no-JavaScript state is shown by force (its real markup and
  // styles, the panel made visible) on a page where scripts run.
  for (const [name, site, showNoScript] of [
    ["production", () => production, false],
    ["production without JavaScript", () => production, true],
    ["a preview", () => preview, false],
  ] as const) {
    it(`passes axe on ${name}`, async () => {
      await withPage(site(), NOTE, async page => {
        if (showNoScript) {
          await page.addStyleTag({
            content:
              "[data-comments-noscript] { display: flex !important; } .giscus { display: none !important; }",
          });
          assert.ok(await page.locator("[data-comments-noscript]").isVisible());
        }
        await page.addScriptTag({ content: axeSource });
        const violations = await page.evaluate(async () => {
          const result = await (
            window as unknown as {
              axe: {
                run: (c: string) => Promise<{ violations: { id: string }[] }>;
              };
            }
          ).axe.run("section[aria-labelledby='comments-heading']");
          return result.violations.map(violation => violation.id);
        });
        assert.deepEqual(violations, []);
      });
    });
  }

  // Why: the theme is built from tokens.css at build time; giscus.app reads
  // it from thunk.blog, so it must be in the build's output.
  it("builds the theme stylesheet", async () => {
    const css = await readFile(
      join(production.fixture.project, "dist/giscus-theme.css"),
      "utf8"
    );
    let scheme: string | undefined;
    postcss.parse(css).walkDecls("color-scheme", decl => {
      scheme = decl.value;
    });
    assert.equal(scheme, "dark");
  });
});
