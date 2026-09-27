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

// Known axe-core issues that the live site has too, matched by rule and
// target. They are listed, not ignored: each must still occur somewhere (so
// the list shrinks when one is fixed), and any other violation fails.
// - color-contrast: the vault's `aside` callout title color (#7f849c,
//   3.98:1 on its tinted background). It comes from the Obsidian vault
//   through /sync-callouts, so the fix belongs there.
const KNOWN = [
  {
    rule: "color-contrast",
    target:
      /^div\[data-callout="aside"\] > \.callout-title > \.callout-title-inner$|^\.callout-title-inner$/,
  },
];

function isKnown(violation: { rule: string; target: string }) {
  return KNOWN.find(
    entry =>
      entry.rule === violation.rule && entry.target.test(violation.target)
  );
}

function routes() {
  return site.pages
    .filter(page => page !== "404.html")
    .map(page => "/" + page.replace(/index\.html$/, ""));
}

/** Run axe-core on the page as it is now; one entry per failing node. */
async function axeViolations(page: Page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
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

describe("network requests", () => {
  // Why: analytics must come from the site's own origin (Vercel serves
  // `/_vercel/...` scripts when the features are enabled), not from a
  // third-party CDN as the live site's older script did, and nothing else
  // may reach another origin either. Only a browser running the page's
  // scripts shows what it actually requests.
  it("requests nothing from other origins and loads analytics same-origin", async () => {
    await withPage(1440, async page => {
      const requested: string[] = [];
      page.on("request", request => requested.push(request.url()));
      await page.goto(`${origin}/posts/on-maths-and-engineering/`, {
        waitUntil: "networkidle",
      });
      const foreign = requested.filter(url => !url.startsWith(origin));
      assert.deepEqual(foreign, []);
      for (const script of [
        "/_vercel/insights/script.js",
        "/_vercel/speed-insights/script.js",
      ]) {
        assert.ok(
          requested.includes(origin + script),
          `${script} not requested; got ${requested.filter(url => url.includes("_vercel")).join(", ")}`
        );
      }
    });
  });
});

describe("reduced motion", () => {
  // Why: readers who ask the system for reduced motion should get no
  // animated transitions. Transitions are declared in many places (tags,
  // links, the hamburger, callout chevrons, the copy button), so this checks
  // every element of pages that have them, at phone and desktop width,
  // on the built page with the media feature emulated.
  for (const width of [390, 1440]) {
    it(`drops every transition at ${width}px when motion is reduced`, async () => {
      await withPage(width, async page => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const animated: string[] = [];
        for (const route of ["/", "/posts/on-maths-and-engineering/"]) {
          await page.goto(origin + route, { waitUntil: "load" });
          animated.push(
            ...(await page.evaluate(() =>
              [...document.querySelectorAll("body *")].flatMap(element => {
                const style = getComputedStyle(element);
                // No transition means no animated property or no duration
                // (Tailwind's `transition-none` clears only the property).
                const still =
                  style.transitionProperty === "none" ||
                  style.transitionDuration
                    .split(",")
                    .every(duration => parseFloat(duration) === 0);
                return still
                  ? []
                  : [
                      `${element.tagName.toLowerCase()}.${[...element.classList].slice(0, 2).join(".")}: ${style.transitionProperty} ${style.transitionDuration}`,
                    ];
              })
            ))
          );
        }
        assert.deepEqual([...new Set(animated)], []);
      });
    });
  }
});

describe("print", () => {
  // Why: the navbar and file tree are fixed-position chrome; printed, they
  // would repeat over every page of the note. The legacy CSS hid everything
  // but the note (`body > :not(.print)`); the token styles must too, and
  // only the print media emulation shows it.
  it("prints the note without the navigation", async () => {
    for (const width of [720, 1440]) {
      await withPage(width, async page => {
        await page.emulateMedia({ media: "print" });
        await page.goto(`${origin}/posts/on-maths-and-engineering/`, {
          waitUntil: "load",
        });
        const shown = await page.evaluate(() =>
          [...document.body.children]
            .filter(element => {
              // Empty elements (the analytics custom elements) print nothing.
              const box = element.getBoundingClientRect();
              return (
                getComputedStyle(element).display !== "none" &&
                box.width * box.height > 0
              );
            })
            .map(element => element.tagName.toLowerCase())
            .filter(tag => tag !== "script")
        );
        assert.deepEqual(shown, ["main"], `${width}px`);
      });
    }
  });
});

// What the search script puts in the dialog, as SearchDialog.astro's
// contract describes it. The tests fill the dialog themselves, so they
// check the stylesheet whatever the script does.
const RESULTS_FIXTURE = [
  ["/posts/io-in-haskell-an-epiphany/", "IO in ", "Haskell", ", an epiphany"],
  [
    "/posts/implementing-redis-info-in-haskell/",
    "Implementing Redis INFO in ",
    "Haskell",
    "",
  ],
]
  .map(
    ([href, before, match, after], index) =>
      `<a class="searchresult" id="search-result-${index}" role="option" aria-selected="${index === 0}" tabindex="-1" href="${href}"><span class="result-title">${before}<mark class="search-highlight">${match}</mark>${after}</span><span class="result-tags"><span class="tag">#haskell</span><span class="tag">#software-engineering</span></span><span class="result-excerpt">It seems to me like IO is <mark class="search-highlight">${match}</mark>'s way of modelling the general concept of a statement, an action with side effects that may or may not return a value.</span></a>`
  )
  .join("");

type SearchState = "idle" | "results" | "empty";

/** Open the dialog as the search script would, with results in the list. */
async function openSearch(page: Page, state: SearchState) {
  await page.evaluate(
    ({ state, results }) => {
      document.querySelector<HTMLDialogElement>("#globalsearch")!.showModal();
      document.querySelector("#search-results")!.innerHTML = results;
      document.querySelector<HTMLElement>("#search-layout")!.dataset.state =
        state;
    },
    { state, results: RESULTS_FIXTURE }
  );
}

/**
 * Load a note's `main.content` into the preview, as the script does. The
 * script must then call `initializeScrollRegions()` (src/scripts), which
 * gives callouts that overflow the narrow panel a tab stop; the built page
 * does not expose it, so this does the same.
 */
async function fillPreview(page: Page, route: string) {
  await page.evaluate(async route => {
    const html = await (await fetch(route)).text();
    const main = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("main.content")!;
    document.querySelector("#preview-content")!.innerHTML =
      `<div class="preview-title">On Maths and Engineering</div><div class="preview-tags"><button type="button" class="tag">#maths</button></div><div class="preview-body">${main.innerHTML}</div>`;
    for (const region of document.querySelectorAll<HTMLElement>(
      ".preview-body .callout-content"
    )) {
      if (region.scrollWidth <= region.clientWidth) continue;
      region.tabIndex = 0;
      region.setAttribute("role", "group");
      region.setAttribute("aria-label", "Scrollable content");
    }
  }, route);
}

const box = (page: Page, selector: string) =>
  page.evaluate(selector => {
    const rect = document.querySelector(selector)!.getBoundingClientRect();
    return [rect.x, rect.y, rect.width, rect.height].map(Math.round);
  }, selector);

describe("search button", () => {
  // Why: the Ctrl + K hint is a small box holding two key boxes; live left
  // about 2px of the hint showing above and below the keys. A shorter hint
  // cut the keys off at its bottom edge.
  for (const width of [1440, 900]) {
    it(`fits the shortcut keys inside their hint at ${width}px`, async () => {
      await withPage(width, async page => {
        await page.goto(origin + "/", { waitUntil: "load" });
        const gaps = await page
          .locator(".search-keys:visible")
          .first()
          .evaluate(hint => {
            const outer = hint.getBoundingClientRect();
            return [...hint.querySelectorAll("code")].map(key => {
              const inner = key.getBoundingClientRect();
              return {
                top: inner.top - outer.top,
                bottom: outer.bottom - inner.bottom,
              };
            });
          });
        assert.equal(gaps.length, 2);
        for (const gap of gaps) {
          assert.ok(gap.top >= 1.5 && gap.bottom >= 1.5, JSON.stringify(gaps));
        }
      });
    });
  }
});

describe("search dialog", () => {
  // Why: utility classes that set `display` on a <dialog> beat the
  // browser's rule that hides a closed dialog, so a styling slip shows an
  // empty search box on every page. Open, it must sit where live put it:
  // 80px from the top, 1100px wide on desktop and 95% on phones, over a
  // dimmed page.
  for (const [width, expected] of [
    [1440, { x: 170, width: 1100 }],
    [390, { x: 10, width: 371 }],
  ] as const) {
    it(`stays hidden until opened, then sits over the page at ${width}px`, async () => {
      await withPage(width, async page => {
        await page.goto(origin + "/", { waitUntil: "load" });
        assert.equal(await page.isVisible("#globalsearch"), false);
        assert.equal(await page.isVisible(".search-box"), false);

        await openSearch(page, "idle");
        const [x, y, boxWidth] = await box(page, ".search-box");
        assert.deepEqual({ x, y, width: boxWidth }, { ...expected, y: 80 });
        assert.equal(
          await page.evaluate(
            () =>
              getComputedStyle(
                document.querySelector("#globalsearch")!,
                "::backdrop"
              ).backgroundColor
          ),
          "rgba(0, 0, 0, 0.5)"
        );
        assert.equal(
          await page.evaluate(() => document.activeElement?.id),
          "term",
          "opening the dialog focuses the search field"
        );
      });
    });
  }

  // Why: the script sets one state after each search and leaves the rest to
  // CSS: the hint before a search, the results and their preview after
  // one, the message when nothing matches. The preview needs width, so
  // phones show only the list (live: below 768px; here below md, 800px).
  // The list is filled in every state, so the state alone must decide.
  for (const width of [1440, 390]) {
    it(`shows the parts that belong to each search state at ${width}px`, async () => {
      await withPage(width, async page => {
        await page.goto(origin + "/", { waitUntil: "load" });
        const parts = async (state: SearchState) => {
          await openSearch(page, state);
          return {
            hint: await page.isVisible(".search-idle"),
            results: await page.isVisible("#search-results"),
            noResults: await page.isVisible(".no-results"),
            preview: await page.isVisible(".search-preview-panel"),
          };
        };
        const none = {
          hint: false,
          results: false,
          noResults: false,
          preview: false,
        };
        assert.deepEqual(await parts("idle"), { ...none, hint: true });
        assert.deepEqual(await parts("results"), {
          ...none,
          results: true,
          preview: width >= 800,
        });
        assert.deepEqual(await parts("empty"), { ...none, noResults: true });
      });
    });
  }

  // Why: live split the box 45/55 between the list and the preview, and a
  // divider separates them; on phones the list takes the full width.
  it("splits the box between results and preview on desktop only", async () => {
    for (const [width, share] of [
      [1440, 0.45],
      [390, 1],
    ] as const) {
      await withPage(width, async page => {
        await page.goto(origin + "/", { waitUntil: "load" });
        await openSearch(page, "results");
        const [, , panel] = await box(page, ".search-results-panel");
        const [, , layout] = await box(page, ".search-layout");
        assert.ok(
          Math.abs(panel! / layout! - share) < 0.01,
          `${width}px: results panel is ${panel}px of ${layout}px`
        );
      });
    }
  });

  // Why: the arrow keys move the selection while focus stays in the search
  // field, so the selected result's outline is the only sign of where
  // Enter will go. The script marks it with `aria-selected`, which screen
  // readers announce too.
  it("outlines the selected result only", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      await openSearch(page, "results");
      const borders = await page.evaluate(() =>
        [...document.querySelectorAll(".searchresult")].map(
          result => getComputedStyle(result).borderColor
        )
      );
      assert.deepEqual(borders, ["rgb(153, 153, 153)", "rgba(0, 0, 0, 0)"]);
    });
  });

  // Why: a match is marked with a translucent gray behind the text, in the
  // weight of the text around it. The text turns the body color: live kept
  // the title's link gray and the excerpt's muted gray, which fall below
  // 4.5:1 on the highlight.
  it("highlights matches without changing their text", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      await openSearch(page, "results");
      const marks = await page.evaluate(() =>
        [...document.querySelectorAll(".searchresult .search-highlight")]
          .slice(0, 2)
          .map(mark => {
            const own = getComputedStyle(mark);
            const parent = getComputedStyle(mark.parentElement!);
            return {
              background: own.backgroundColor,
              color: own.color,
              sameWeight: own.fontWeight === parent.fontWeight,
            };
          })
      );
      const expected = {
        background: "rgba(153, 153, 153, 0.35)",
        color: "rgb(218, 218, 218)",
        sameWeight: true,
      };
      assert.deepEqual(marks, [expected, expected]);
    });
  });

  // Why: the placeholder is shown while the preview is empty and hidden
  // once the script puts anything in it (a loading indicator or a note),
  // so the script never toggles it itself.
  it("shows the preview placeholder until the preview has content", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      await openSearch(page, "results");
      assert.equal(await page.isVisible(".preview-placeholder"), true);
      assert.equal(await page.isVisible("#preview-content"), false);
      await fillPreview(page, "/posts/on-maths-and-engineering/");
      assert.equal(await page.isVisible(".preview-placeholder"), false);
      assert.equal(await page.isVisible("#preview-content"), true);
    });
  });

  // Why: the preview shows another note's `main.content`, which must look
  // like that note (callouts, code blocks, compact text) without repeating
  // the title and tags that the preview's own header already shows, or the
  // post footer. Live showed the title twice.
  it("styles the preview like a note, without the note's header and footer", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      await openSearch(page, "results");
      await fillPreview(page, "/posts/on-maths-and-engineering/");
      const preview = await page.evaluate(() => {
        const body = document.querySelector(".preview-body")!;
        const style = (selector: string) =>
          getComputedStyle(body.querySelector(selector)!);
        return {
          header: style(":scope > header").display,
          footer: style(":scope > footer").display,
          text: style(":scope > p").fontSize,
          code: style("pre.astro-code").fontFamily.split(",")[0],
          callout: style(".callout").backgroundColor !== "rgba(0, 0, 0, 0)",
        };
      });
      assert.deepEqual(preview, {
        header: "none",
        footer: "none",
        text: "15.2px",
        code: '"Commit Mono"',
        callout: true,
      });
    });
  });
});

describe("search", () => {
  const openDialog = (page: Page) =>
    page.evaluate(() =>
      document.querySelector<HTMLDialogElement>("#globalsearch")!.showModal()
    );
  const resultTitles = (page: Page) =>
    page.$$eval(".searchresult .result-title", titles =>
      titles.map(title => title.textContent)
    );

  // Why: the script, the bundled FlexSearch, and the built
  // `/searchIndex.json` must work together on a real page: words find
  // notes (titles first), `#tag` finds tagged notes, and an unknown word
  // shows the no-results message.
  it("searches the built index as the reader types", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      await openDialog(page);

      await page.fill("#term", "haskell");
      await page.waitForSelector(".searchresult");
      const titles = await resultTitles(page);
      assert.deepEqual(
        new Set(titles.slice(0, 2)),
        new Set([
          "IO in Haskell, an epiphany",
          "Implementing Redis INFO in Haskell",
        ])
      );
      assert.equal(
        await page.textContent(".searchresult .search-highlight"),
        "Haskell"
      );

      await page.fill("#term", "#linux");
      await page.waitForFunction(
        () =>
          document.querySelector(".searchresult .result-title")?.textContent !==
          "IO in Haskell, an epiphany"
      );
      const tags = await page.$$eval(".searchresult", results =>
        results.map(result =>
          [...result.querySelectorAll(".tag")].map(tag => tag.textContent)
        )
      );
      assert.equal(tags.length, 4);
      assert.ok(
        tags.every(list => list.includes("#linux")),
        String(tags)
      );

      await page.fill("#term", "zzqqxx");
      await page.waitForSelector(".no-results", { state: "visible" });
      assert.equal(await page.textContent(".no-results-query"), "zzqqxx");
    });
  });

  // Why: every page carries the search dialog, but most visits never
  // search, so the index downloads when the dialog opens (it focuses the
  // field), once, instead of on every page load as live did.
  it("downloads the index only when search is used, once", async () => {
    await withPage(1440, async page => {
      const requested: string[] = [];
      page.on("request", request => requested.push(request.url()));
      await page.goto(origin + "/", { waitUntil: "networkidle" });
      const index = () =>
        requested.filter(url => new URL(url).pathname === "/searchIndex.json");
      assert.deepEqual(index(), []);

      await openDialog(page);
      await page.fill("#term", "nix");
      await page.waitForSelector(".searchresult");
      await page.fill("#term", "redis");
      await page.waitForFunction(
        () =>
          document.querySelector(".searchresult .result-title")?.textContent ===
          "Implementing Redis INFO in Haskell"
      );
      assert.equal(index().length, 1);
    });
  });
});

describe("search dialog wiring", () => {
  const isOpen = (page: Page) =>
    page.evaluate(
      () => document.querySelector<HTMLDialogElement>("#globalsearch")!.open
    );

  // Why: the search button is how most readers find search: the sidebar's
  // on desktop, the navbar's on phones. Escape closes the dialog and puts
  // focus back on the button.
  for (const [width, button] of [
    [1440, ".filetree-sidebar .search-button"],
    [390, ".navbar .search-button"],
  ] as const) {
    it(`opens from the search button and closes on Escape at ${width}px`, async () => {
      await withPage(width, async page => {
        await page.goto(origin + "/", { waitUntil: "load" });
        await page.click(button);
        assert.equal(await isOpen(page), true);
        assert.equal(
          await page.evaluate(() => document.activeElement?.id),
          "term"
        );
        await page.keyboard.press("Escape");
        assert.equal(await isOpen(page), false);
        assert.ok(
          await page.evaluate(
            selector =>
              document.activeElement === document.querySelector(selector),
            button
          )
        );
      });
    });
  }

  // Why: `/?q=` links open search with results; the note header's tag
  // links point there.
  it("opens with the results for ?q=", async () => {
    await withPage(1440, async page => {
      await page.goto(`${origin}/?q=%23linux`, { waitUntil: "load" });
      assert.equal(await isOpen(page), true);
      await page.waitForSelector(".searchresult");
      assert.equal(await page.locator(".searchresult").count(), 4);
    });
  });

  // Why: a note's tags search in place, without leaving the note.
  it("searches a note's tag in place", async () => {
    await withPage(1440, async page => {
      const url = `${origin}/posts/io-in-haskell-an-epiphany/`;
      await page.goto(url, { waitUntil: "load" });
      await page.click("header a.tag >> nth=1");
      assert.equal(await isOpen(page), true);
      assert.equal(await page.inputValue("#term"), "#haskell");
      await page.waitForSelector(".searchresult");
      assert.equal(page.url(), url);
    });
  });

  // Why: the keyboard path end to end: type, arrow to a result, Enter
  // opens its note.
  it("opens the selected result with Enter", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      await page.keyboard.press("Control+k");
      await page.keyboard.type("haskell");
      await page.waitForSelector(".searchresult");
      const second = await page.getAttribute(".searchresult >> nth=1", "href");
      await page.keyboard.press("ArrowDown");
      await Promise.all([
        page.waitForURL(origin + second),
        page.keyboard.press("Enter"),
      ]);
    });
  });

  // Why: on desktop the preview shows the selected note, styled as a note;
  // phones hide the panel and fetch no notes for it.
  it("previews the selected note on desktop only", async () => {
    for (const width of [1440, 390]) {
      await withPage(width, async page => {
        const notes: string[] = [];
        page.on("request", request => {
          if (new URL(request.url()).pathname.startsWith("/posts/"))
            notes.push(request.url());
        });
        await page.goto(origin + "/", { waitUntil: "load" });
        await page.keyboard.press("Control+k");
        await page.keyboard.type("redis");
        await page.waitForSelector(".searchresult");
        if (width === 390) {
          await page.waitForTimeout(300);
          assert.deepEqual(notes, []);
          return;
        }
        await page.waitForSelector(".preview-body p");
        assert.equal(
          await page.textContent(".preview-title"),
          "Implementing Redis INFO in Haskell"
        );
        assert.equal(await page.isVisible(".preview-body > header"), false);
        assert.equal(await page.locator(".preview-body [id]").count(), 0);
      });
    }
  });
});

describe("mobile file tree", () => {
  const isOpen = (page: Page) =>
    page.evaluate(() =>
      document.querySelector("#filetree")!.matches(":popover-open")
    );

  // Why: on phones and tablets the file tree is a popover over the page,
  // with the page dimmed behind it (the popover's backdrop). Live dimmed
  // with an `absolute` overlay that covered only the first screen, so
  // opened after scrolling, the dimming and its tap-to-close were off
  // screen. The backdrop always covers the viewport.
  it("opens over the page wherever it is scrolled", async () => {
    await withPage(390, async page => {
      await page.goto(origin + "/posts/on-maths-and-engineering/", {
        waitUntil: "load",
      });
      assert.equal(await page.isVisible(".filetree-wrapper"), false);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.click(".hamburger-btn");
      assert.equal(await isOpen(page), true);
      assert.deepEqual(await box(page, ".filetree-wrapper"), [0, 0, 280, 900]);
      assert.equal(
        await page.evaluate(
          () =>
            getComputedStyle(document.querySelector("#filetree")!, "::backdrop")
              .backgroundColor
        ),
        "rgba(0, 0, 0, 0.5)"
      );
    });
  });

  // Why: the navigation must work without JavaScript, which live's Alpine
  // version did not: the hamburger opens the tree, and a tap on the dimmed
  // page or Escape closes it. The tree's links and folders then work as
  // they do on desktop.
  for (const javaScriptEnabled of [true, false]) {
    it(`opens from the hamburger and closes from a tap outside or Escape (JavaScript ${javaScriptEnabled ? "on" : "off"})`, async () => {
      await withPage(
        390,
        async page => {
          await page.goto(origin + "/", { waitUntil: "load" });
          await page.click(".hamburger-btn");
          assert.equal(await page.isVisible(".filetree-wrapper"), true);
          await page.mouse.click(350, 450);
          assert.equal(await page.isVisible(".filetree-wrapper"), false);

          await page.click(".hamburger-btn");
          assert.equal(await page.isVisible(".filetree-wrapper"), true);
          await page.keyboard.press("Escape");
          assert.equal(await page.isVisible(".filetree-wrapper"), false);

          await page.click(".hamburger-btn");
          await page.click(".filetree-sidebar details.inner-folder >> summary");
          await page.click('.filetree-sidebar a[href="/posts/be-deliberate/"]');
          await page.waitForURL(`${origin}/posts/be-deliberate/`);
        },
        { javaScriptEnabled }
      );
    });
  }

  // Why: the open tree is as wide as the desktop sidebar can be (280px;
  // live: 250px), so note titles wrap less, but it always leaves part of
  // the dimmed page showing to tap, even on the narrowest phones.
  it("opens wide, but never over the whole width", async () => {
    for (const [width, expected] of [
      [390, 280],
      [320, 272],
    ] as const) {
      await withPage(width, async page => {
        await page.goto(origin + "/", { waitUntil: "load" });
        await page.click(".hamburger-btn");
        const [, , treeWidth] = await box(page, ".filetree-wrapper");
        assert.equal(treeWidth, expected, `${width}px`);
      });
    }
  });

  // Why: the note list scrolls under the search button. Cut off hard right
  // below it (2px on phones), half-hidden titles crowded the button. The
  // list keeps clear of the button at every width, and its top edge fades
  // so scrolled rows fade out instead of being sliced.
  for (const width of [390, 1440]) {
    it(`leaves room between the search button and the note list at ${width}px`, async () => {
      await withPage(width, async page => {
        await page.goto(origin + "/", { waitUntil: "load" });
        if (width < 1000) await page.click(".hamburger-btn");
        const edge = await page.evaluate(() => {
          const button = document
            .querySelector(".filetree-sidebar .search-button")!
            .getBoundingClientRect();
          const list = document.querySelector(".filetree-sidebar > .folder")!;
          return {
            gap: list.getBoundingClientRect().top - button.bottom,
            fades: getComputedStyle(list).maskImage.includes("gradient"),
          };
        });
        assert.ok(edge.gap >= 10, `gap ${edge.gap}px`);
        assert.equal(edge.fades, true);
      });
    });
  }

  // Why: a folder the reader opened stays open on the next page, as on
  // live.
  it("keeps an opened folder open on the next page", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      const folder = ".filetree-sidebar details.inner-folder >> nth=0";
      await page.click(`${folder} >> summary`);
      assert.equal(await page.getAttribute(folder, "open"), "");
      await page.goto(`${origin}/posts/be-deliberate/`, { waitUntil: "load" });
      assert.equal(await page.getAttribute(folder, "open"), "");
    });
  });

  // Why: desktop shows the file tree in place: it is the same element as
  // the phone popover, so it must show without being opened and without
  // dimming the page.
  it("shows the tree in place on desktop", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      assert.equal(await page.isVisible(".filetree-wrapper"), true);
      assert.equal(await isOpen(page), false);
      assert.deepEqual(await box(page, ".filetree-wrapper"), [0, 0, 290, 900]);
    });
  });
});

describe("without JavaScript", () => {
  // Why: search needs JavaScript, so without it the search buttons would
  // do nothing. They are hidden instead; with JavaScript they show.
  for (const width of [390, 1440]) {
    it(`hides the search buttons at ${width}px`, async () => {
      for (const javaScriptEnabled of [true, false]) {
        await withPage(
          width,
          async page => {
            await page.goto(origin + "/", { waitUntil: "load" });
            assert.equal(
              await page.locator(".search-button:visible").count(),
              javaScriptEnabled ? 1 : 0,
              `JavaScript ${javaScriptEnabled ? "on" : "off"}`
            );
          },
          { javaScriptEnabled }
        );
      }
    });
  }

  // Why: a callout written collapsed (`[!note]-`) opens only through the
  // callout script, so without JavaScript its text would stay hidden for
  // good. It shows expanded instead, without the fold chevron that could
  // not work. No published note is collapsed yet, so the test builds one
  // with the site's stylesheet.
  it("shows collapsed callouts expanded", async () => {
    const html = await site.read("index.html");
    const stylesheet = html.match(/<link rel="stylesheet" href="([^"]+)"/)![1];
    await withPage(
      1440,
      async page => {
        await page.goto(origin + "/", { waitUntil: "load" });
        await page.setContent(
          `<!doctype html><html><head><link rel="stylesheet" href="${origin}${stylesheet}"></head><body class="markdown-rendered"><main class="content"><div class="callout is-collapsible is-collapsed" data-callout="note"><div class="callout-title"><div class="callout-title-inner">Note</div><div class="callout-fold"><svg width="16" height="16"></svg></div></div><div class="callout-content"><p>Hidden text</p></div></div></main></body></html>`,
          { waitUntil: "load" }
        );
        assert.equal(await page.isVisible(".callout-content p"), true);
        assert.equal(await page.isVisible(".callout-fold"), false);
      },
      { javaScriptEnabled: false }
    );
  });
});

describe("accessibility checks (axe-core)", () => {
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
          for (const violation of await axeViolations(page)) {
            const known = isKnown(violation);
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

  // Why: the search dialog and the open mobile file tree are hidden when
  // the page loads, so the check above never sees them. They add text
  // (hints, tags, excerpts, highlights) whose contrast and names need the
  // same checks, with the dialog in the state it is in most of the time.
  it("finds no new violations with search or the mobile file tree open", async () => {
    const unexpected: string[] = [];
    const check = async (page: Page, label: string) => {
      for (const violation of await axeViolations(page))
        if (!isKnown(violation))
          unexpected.push(`${label}: ${violation.rule} at ${violation.target}`);
    };
    for (const width of [390, 1440]) {
      await withPage(width, async page => {
        await page.goto(origin + "/", { waitUntil: "load" });
        await openSearch(page, "results");
        await fillPreview(page, "/posts/on-maths-and-engineering/");
        await check(page, `${width}px search results`);
        await openSearch(page, "empty");
        await check(page, `${width}px search empty`);
      });
    }
    await withPage(390, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      await page.click(".hamburger-btn");
      await check(page, "390px file tree open");
    });
    assert.deepEqual(unexpected, []);
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
