/**
 * Layout and accessibility tests for the built site, in real Chrome.
 *
 * Why this level: overflow, breakpoints, focus rings, and accessibility
 * violations depend on the full cascade applied to real pages at real
 * viewport sizes. Component tests see no CSS, and the Vitest browser tests
 * use fixture markup, so only a built site served to a browser can show
 * these. The build and browser start once for the whole file.
 *
 * Run with `npm run test:layout` (reads the Chrome path from
 * `.env.browser.local`, like the other browser tests).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import { buildSite, type SiteBuild } from "../support/site-build.ts";

let site: SiteBuild;
let server: Server;
let browser: Browser;
let origin: string;
let axeSource: string;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

before(async () => {
  site = await buildSite();
  server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url!, "http://x").pathname
    );
    const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    const candidates = relative.endsWith("/")
      ? [join(relative, "index.html")]
      : [relative, join(relative, "index.html")];
    for (const candidate of candidates) {
      try {
        const body = await readFile(join(site.outDir, candidate));
        response.writeHead(200, {
          "content-type":
            CONTENT_TYPES[extname(candidate)] ?? "application/octet-stream",
        });
        response.end(body);
        return;
      } catch {}
    }
    response.writeHead(404, { "content-type": CONTENT_TYPES[".html"] });
    response.end(await readFile(join(site.outDir, "404.html")));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH || undefined,
  });
  axeSource = await readFile("node_modules/axe-core/axe.min.js", "utf8");
});

after(async () => {
  await browser?.close();
  await new Promise(resolve => server?.close(resolve));
  await site?.cleanup();
});

function routes() {
  return site.pages
    .filter(page => page !== "404.html")
    .map(page => "/" + page.replace(/index\.html$/, ""));
}

async function withPage<T>(
  width: number,
  run: (page: Page) => Promise<T>,
  options: { javaScriptEnabled?: boolean } = {}
): Promise<T> {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    javaScriptEnabled: options.javaScriptEnabled ?? true,
  });
  try {
    return await run(await context.newPage());
  } finally {
    await context.close();
  }
}

describe("responsive layout", () => {
  // Why: the known phone-width bug before the shared layout was a 515px image
  // overflowing a 390px viewport. Sideways scrolling on any page at phone,
  // tablet, or desktop width means something escaped the content column.
  for (const width of [390, 768, 1440]) {
    it(`has no horizontal page scroll at ${width}px`, async () => {
      await withPage(width, async page => {
        for (const route of routes()) {
          await page.goto(origin + route, { waitUntil: "load" });
          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth
          );
          assert.ok(overflow <= 0, `${route} overflows by ${overflow}px`);
        }
      });
    });
  }

  // Why: Astro's Markdown images carry width and height attributes, and no
  // responsive image CSS reaches them, so a narrowed image kept its full
  // height and stretched (311x500 instead of 311x302 on the Redis post).
  it("keeps images at their natural aspect ratio on phones", async () => {
    await withPage(390, async page => {
      await page.goto(`${origin}/posts/implementing-redis-info-in-haskell/`, {
        waitUntil: "load",
      });
      const images = await page.$$eval("main img", elements =>
        elements.map(image => {
          const img = image as HTMLImageElement;
          const rect = img.getBoundingClientRect();
          return {
            rendered: rect.width / rect.height,
            natural:
              Number(img.getAttribute("width")) /
              Number(img.getAttribute("height")),
          };
        })
      );
      assert.ok(images.length > 0, "expected an image on the Redis post");
      for (const { rendered, natural } of images) {
        assert.ok(
          Math.abs(rendered - natural) < 0.02,
          `${rendered} vs ${natural}`
        );
      }
    });
  });

  // Why: the live site switches from the mobile navbar to the desktop
  // sidebar at `window.innerWidth >= 1000`. The Astro site does it with CSS,
  // and an off-by-one media query would show both or neither at 1000px.
  it("switches between navbar and sidebar exactly at 1000px", async () => {
    const visibility = async (width: number) =>
      withPage(width, async page => {
        await page.goto(`${origin}/posts/be-deliberate/`, {
          waitUntil: "load",
        });
        return {
          navbar: await page.isVisible(".navbar"),
          sidebar: await page.isVisible(".filetree-wrapper"),
        };
      });
    assert.deepEqual(await visibility(999), { navbar: true, sidebar: false });
    assert.deepEqual(await visibility(1000), { navbar: false, sidebar: true });
  });
});

describe("navigation without JavaScript", () => {
  // Why: the live folder toggle needed Alpine. The Astro file tree uses
  // native <details>, so readers without JavaScript can still reach posts.
  // The chevron that shows the folder's state is swapped by CSS alone, so
  // only a styled page in a browser can show that it follows the toggle.
  it("opens and closes the Posts folder with JavaScript disabled", async () => {
    await withPage(
      1440,
      async page => {
        await page.goto(`${origin}/posts/be-deliberate/`, {
          waitUntil: "load",
        });
        const folder = page
          .locator(".filetree-sidebar details.inner-folder")
          .first();
        const chevrons = async () => ({
          open: await folder
            .locator(":scope > summary .folder-chevron-open")
            .isVisible(),
          closed: await folder
            .locator(":scope > summary .folder-chevron-closed")
            .isVisible(),
        });
        assert.equal(await folder.getAttribute("open"), null);
        assert.deepEqual(await chevrons(), { open: false, closed: true });
        await folder.locator("summary").click();
        assert.equal(await folder.getAttribute("open"), "");
        assert.deepEqual(await chevrons(), { open: true, closed: false });
        assert.ok(
          await page.isVisible(
            '.filetree-sidebar a[href="/posts/be-deliberate/"]'
          )
        );
        await folder.locator("summary").click();
        assert.equal(await folder.getAttribute("open"), null);
      },
      { javaScriptEnabled: false }
    );
  });
});

describe("keyboard access", () => {
  // Why: obsidian-base.scss removes focus outlines globally and
  // user/custom.scss restores them with `:focus-visible`. New elements
  // (real <button>s, tag links, <summary>) must still show a ring when
  // reached by keyboard, or keyboard users lose their place. Matching is by
  // tag name + a required class, not the full class list: phase 2 (ADR 0003)
  // styles tag links with Tailwind utilities, and pinning the exact class
  // string here would fail on every styling change instead of only when a
  // control stops being reachable or loses its ring.
  it("shows a focus ring on every control reached with Tab", async () => {
    await withPage(1440, async page => {
      await page.goto(`${origin}/posts/be-deliberate/`, { waitUntil: "load" });
      const reached: { label: string; tag: string; classes: string[] }[] = [];
      for (let step = 0; step < 12; step++) {
        await page.keyboard.press("Tab");
        const focused = await page.evaluate(() => {
          const element = document.activeElement as HTMLElement | null;
          if (!element || element === document.body) return null;
          const style = getComputedStyle(element);
          return {
            tag: element.tagName.toLowerCase(),
            classes: [...element.classList],
            label: `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`,
            outline:
              style.outlineStyle !== "none" &&
              parseFloat(style.outlineWidth) > 0,
          };
        });
        if (!focused) continue;
        reached.push(focused);
        assert.ok(
          focused.outline,
          `${focused.label} has no visible focus ring`
        );
      }
      for (const expected of [
        { tag: "button", requiredClass: "search-button" },
        { tag: "summary", requiredClass: "foldername-wrapper" },
        { tag: "a", requiredClass: "tag" },
      ]) {
        assert.ok(
          reached.some(
            r =>
              r.tag === expected.tag &&
              r.classes.includes(expected.requiredClass)
          ),
          `Tab never reached ${expected.tag}.${expected.requiredClass}; reached ${reached.map(r => r.label).join(", ")}`
        );
      }
    });
  });
});

describe("accessibility checks (axe-core)", () => {
  // Known issues that the live site has too, matched by rule and target.
  // They are listed, not ignored: each must still occur somewhere (so the
  // list shrinks when one is fixed), and any other violation fails.
  // - color-contrast: muted #666 text on #1e1e1e (2.9:1) in Recent Posts
  //   and the post footer, and some callout titles. Fixing it changes the
  //   design, so it waits for a decision.
  // - scrollable-region-focusable: a callout whose math overflows at phone
  //   width scrolls sideways with nothing keyboard-focusable inside.
  // - link-in-text-block: internal links distinguished from body text by
  //   color alone.
  const KNOWN = [
    {
      rule: "color-contrast",
      target:
        /^(li:nth-child\(\d+\) > p|time\[datetime=".+"\]|footer > p|\.callout-title-inner)$/,
    },
    {
      rule: "scrollable-region-focusable",
      target: /^div\[data-callout="\w+"\] > \.callout-content$/,
    },
    {
      rule: "link-in-text-block",
      target: /^(p:nth-child\(\d+\) > )?\.internal-link$/,
    },
  ];

  // Why: automated checks catch missing names, roles, landmarks, and
  // contrast regressions. Every page is checked at phone and desktop width,
  // because new markup (callout icons, the file tree) appears on all of them.
  it("finds no new violations on any page at 390px or 1440px", async () => {
    const seen = new Set<string>();
    const unexpected: string[] = [];
    for (const width of [390, 1440]) {
      await withPage(width, async page => {
        for (const route of [...routes(), "/definitely-not-a-page"]) {
          await page.goto(origin + route, { waitUntil: "load" });
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
              violation.nodes.map(node => ({
                rule: violation.id,
                target: node.target.join(" "),
              }))
            );
          });
          for (const violation of violations) {
            const known = KNOWN.find(
              entry =>
                entry.rule === violation.rule &&
                entry.target.test(violation.target)
            );
            if (known) seen.add(known.rule);
            else
              unexpected.push(
                `${width}px ${route}: ${violation.rule} at ${violation.target}`
              );
          }
        }
      });
    }
    assert.deepEqual(unexpected, []);
    for (const entry of KNOWN) {
      assert.ok(
        seen.has(entry.rule),
        `${entry.rule} no longer occurs; remove it from KNOWN`
      );
    }
  });
});

describe("not-found handling", () => {
  // Why: unknown URLs and unresolved wikilinks (`href="/404"`) must reach the
  // 404 page. The static server mirrors how hosts serve `404.html`.
  it("serves the 404 page for unknown URLs", async () => {
    await withPage(1440, async page => {
      const response = await page.goto(`${origin}/definitely-not-a-page`);
      assert.equal(response?.status(), 404);
      assert.equal(await page.title(), "Nothing here");
    });
  });
});
