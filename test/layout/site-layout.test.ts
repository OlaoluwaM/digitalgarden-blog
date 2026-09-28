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
//   through `npm run sync-callouts`, so the fix belongs there.
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

/** Every page a reader stays on: not the 404 page, and not `/random/`,
 * which leaves for a note as soon as it loads. */
function routes() {
  return site.pages
    .filter(page => page !== "404.html" && page !== "random/index.html")
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

/**
 * A computed color as `rgba(r, g, b, a)`. Colors with an opacity modifier
 * (`bg-black/50`) compute to `oklab(...)`; mixing into sRGB gives every
 * color the same notation, so tests compare values, not how the browser
 * writes them.
 */
const rgba = (page: Page, color: string) =>
  page.evaluate(color => {
    const probe = document.createElement("span");
    probe.style.color = `color-mix(in srgb, ${color} 100%, transparent)`;
    document.body.append(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    const [r, g, b, a = 1] = computed
      .replace(/^color\(srgb |\)$/g, "")
      .split(/[\s/]+/)
      .map(Number);
    const channel = (value: number) => Math.round(value * 255);
    return `rgba(${channel(r!)}, ${channel(g!)}, ${channel(b!)}, ${Math.round(a * 100) / 100})`;
  }, color);

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
            return [...hint.querySelectorAll("kbd")].map(key => {
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

  // Why: the shortcut hint is a small aside to the button's label, so it
  // scales with it: its text is 0.75em of the label, with tight padding,
  // 15% smaller than the 12px hint it replaced (80 by 25px, now about 70
  // by 21px).
  it("sets the shortcut hint smaller than the button's label", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      const [label, hint, height] = await page.$eval(
        ".filetree-sidebar .search-button",
        button => [
          parseFloat(getComputedStyle(button).fontSize),
          parseFloat(
            getComputedStyle(button.querySelector(".search-keys")!).fontSize
          ),
          button.querySelector(".search-keys")!.getBoundingClientRect().height,
        ]
      );
      assert.ok(
        Math.abs(hint / label - 0.75) < 0.01,
        `${hint}px of ${label}px`
      );
      assert.ok(height <= 21, `${height}px tall`);
    });
  });
});

describe("search dialog", () => {
  // Why: utility classes that set `display` on a <dialog> beat the
  // browser's rule that hides a closed dialog, so a styling slip shows an
  // empty search box on every page. Open, it must sit where live put it:
  // 80px from the top, over a dimmed page, 95% wide on phones. On desktop
  // it is 1152px wide (the 6xl step; live: 1100px).
  for (const [width, expected] of [
    [1440, { x: 144, width: 1152 }],
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
          await rgba(
            page,
            await page.evaluate(
              () =>
                getComputedStyle(
                  document.querySelector("#globalsearch")!,
                  "::backdrop"
                ).backgroundColor
            )
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
      for (const mark of marks) {
        mark.background = await rgba(page, mark.background);
        mark.color = await rgba(page, mark.color);
      }
      const expected = {
        background: "rgba(153, 153, 153, 0.35)",
        color: "rgba(218, 218, 218, 1)",
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

  // Why: search shows a short message before a search, when nothing
  // matches, and before a result is picked for the preview. They are one
  // kind of message and share one style; the first was italic,
  // left-aligned, and brighter than the others.
  it("shows every search message in one style", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      const messages: Record<string, unknown> = {};
      for (const [state, selector] of [
        ["idle", ".search-idle p"],
        ["empty", ".no-results p"],
        ["results", ".preview-placeholder p"],
      ] as const) {
        await openSearch(page, state);
        messages[state] = await page.$eval(selector, message => {
          const style = getComputedStyle(message);
          const icon = message.parentElement!.querySelector("svg");
          return {
            size: style.fontSize,
            color: style.color,
            italic: style.fontStyle === "italic",
            align: style.textAlign,
            icon: icon ? getComputedStyle(icon).width : null,
          };
        });
        await page.evaluate(() =>
          document.querySelector<HTMLDialogElement>("#globalsearch")!.close()
        );
      }
      const expected = {
        size: "13.6px",
        color: "rgb(179, 179, 179)",
        italic: false,
        align: "center",
        icon: "48px",
      };
      assert.deepEqual(messages, {
        idle: expected,
        empty: expected,
        results: expected,
      });
    });
  });

  // Why: the footer names keys to press (Enter, arrows, Esc). Phones have
  // none, so the hints go below md, as the search button's Ctrl + K does.
  for (const [width, shown] of [
    [1440, true],
    [390, false],
  ] as const) {
    it(`${shown ? "shows" : "hides"} the keyboard hints at ${width}px`, async () => {
      await withPage(width, async page => {
        await page.goto(origin + "/", { waitUntil: "load" });
        await openSearch(page, "results");
        assert.equal(await page.isVisible(".search-box-footer"), shown);
      });
    });
  }

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
          title: getComputedStyle(
            document.querySelector(".preview-title")!
          ).fontFamily.split(",")[0],
        };
      });
      // The preview's title is set like the note's own: in the serif.
      assert.deepEqual(preview, {
        header: "none",
        footer: "none",
        text: "16px",
        code: '"Commit Mono"',
        callout: true,
        title: '"Instrument Serif"',
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

  // Why: the footer says Escape closes search. A search field's own
  // Escape clears the query first, which took a second press to close the
  // dialog; live closed on the first.
  it("closes on the first Escape with a query typed", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      await page.click(".filetree-sidebar .search-button");
      await page.keyboard.type("haskell");
      await page.waitForSelector(".searchresult");
      await page.keyboard.press("Escape");
      assert.equal(await isOpen(page), false);
    });
  });

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

describe("links", () => {
  // Why: a link inside a sentence is marked by a faint underline as well
  // as its color (WCAG 1.4.1), which hover makes solid. The post footer's
  // links had a solid underline and the 404 page's link none.
  it("underlines links in sentences the same way", async () => {
    await withPage(1440, async page => {
      const underline = (selector: string) =>
        page.$eval(selector, link => {
          const style = getComputedStyle(link);
          return {
            line: style.textDecorationLine,
            color: style.textDecorationColor,
            thickness: style.textDecorationThickness,
            // In em, whatever the link's size.
            offset:
              Math.round(
                (parseFloat(style.textUnderlineOffset) /
                  parseFloat(style.fontSize)) *
                  100
              ) / 100,
          };
        });
      const faint = async (selector: string) => {
        const { color, ...rest } = await underline(selector);
        return { ...rest, alpha: (await rgba(page, color)).split(", ")[3] };
      };
      await page.goto(`${origin}/posts/implementing-redis-info-in-haskell/`, {
        waitUntil: "load",
      });
      const note = await faint("main p a.internal-link");
      const footer = await faint(".post-cta a");
      await page.goto(`${origin}/404`, { waitUntil: "load" });
      const notFound = await faint("main a");
      const expected = {
        line: "underline",
        thickness: "1px",
        offset: 0.2,
        alpha: "0.4)",
      };
      assert.deepEqual(
        { note, footer, notFound },
        {
          note: expected,
          footer: expected,
          notFound: expected,
        }
      );
    });
  });
});

describe("site name and file tree", () => {
  // Why: the site name is the brand mark, kept at live's 2rem with live's
  // 1.1 line height and no tracking, between the heading steps (3xl is
  // 30.7px). As the 3xl step it read smaller and tighter than live.
  it("keeps live's site name size", async () => {
    const name = (page: Page, selector: string) =>
      page.$eval(selector, heading => {
        const style = getComputedStyle(heading);
        return {
          size: style.fontSize,
          lineHeight: style.lineHeight,
          tracking: style.letterSpacing,
        };
      });
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      assert.deepEqual(await name(page, ".filetree-sidebar h1"), {
        size: "32px",
        lineHeight: "35.2px",
        tracking: "normal",
      });
    });
    await withPage(900, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      assert.deepEqual(await name(page, ".navbar h1"), {
        size: "32px",
        lineHeight: "32px",
        tracking: "normal",
      });
    });
  });

  // Why: the file tree is a dense list, and live's looked right: 13.6px
  // text (the sm step) on a 21.76px line. On the scale that is `sm` with
  // `leading-relaxed` (22.1px), within half a pixel of live. The search
  // button above it uses the same size.
  it("keeps the file tree at live's size and spacing", async () => {
    await withPage(1440, async page => {
      await page.goto(`${origin}/posts/be-deliberate/`, { waitUntil: "load" });
      const [row, button] = await Promise.all([
        page.$eval(".filetree-sidebar .notelink", row => {
          const style = getComputedStyle(row);
          return {
            size: style.fontSize,
            line: parseFloat(style.lineHeight),
          };
        }),
        page.$eval(
          ".filetree-sidebar .search-button",
          button => getComputedStyle(button).fontSize
        ),
      ]);
      assert.equal(row.size, "13.6px");
      assert.equal(button, "13.6px");
      assert.ok(Math.abs(row.line - 21.76) <= 0.5, `${row.line}px`);
    });
  });
});

describe("tags", () => {
  // Why: tags are secondary to the title and text they sit under. They
  // stay in the muted gray that passes AA on every card (#999 fails on a
  // hovered search result), so they are quieted by weight instead, and
  // look the same in the note header, search results, and the preview.
  it("look the same everywhere, in the regular weight", async () => {
    await withPage(1440, async page => {
      const look = (selector: string) =>
        page.$eval(selector, tag => {
          const style = getComputedStyle(tag);
          return { weight: style.fontWeight, color: style.color };
        });
      await page.goto(`${origin}/posts/implementing-redis-info-in-haskell/`, {
        waitUntil: "load",
      });
      const header = await look("header a.tag");
      await openSearch(page, "results");
      await fillPreview(page, "/posts/on-maths-and-engineering/");
      const result = await look(".result-tags .tag");
      const preview = await look(".preview-tags .tag");
      const expected = { weight: "400", color: "rgb(179, 179, 179)" };
      assert.deepEqual(
        { header, result, preview },
        { header: expected, result: expected, preview: expected }
      );
    });
  });
});

describe("Recent Posts", () => {
  // Each entry's box, and its description's distance from the title's
  // line (the link is inline, so its own box sits inside that line).
  const items = (page: Page) =>
    page.$$eval(".recent-notes li", items =>
      items.map(item => {
        const box = item.getBoundingClientRect();
        const description = item.querySelector("p");
        const date = item.querySelector("time")!;
        const titleLine = parseFloat(getComputedStyle(item).lineHeight);
        return {
          top: box.top,
          bottom: box.bottom,
          descriptionGap: description
            ? description.getBoundingClientRect().top - (box.top + titleLine)
            : null,
          dateSize: parseFloat(getComputedStyle(date).fontSize),
          descriptionSize: description
            ? parseFloat(getComputedStyle(description).fontSize)
            : null,
        };
      })
    );

  // Why: the date is secondary to the description, so it is smaller; on
  // the scale both had become 14px.
  it("sets each date smaller than its description", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      for (const item of await items(page)) {
        if (item.descriptionSize === null) continue;
        assert.ok(item.dateSize < item.descriptionSize, JSON.stringify(item));
      }
    });
  });

  // Why: entries sat 20px apart with the description touching its title,
  // so the list read as one block. Entries are a paragraph apart (28px, the
  // notes' rhythm), and the description sits 4px under its title.
  it("gives each entry room", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/", { waitUntil: "load" });
      const list = await items(page);
      assert.ok(list.length >= 2);
      for (const [index, item] of list.entries()) {
        if (item.descriptionGap !== null) {
          assert.ok(
            Math.abs(item.descriptionGap - 4) < 1,
            JSON.stringify(item)
          );
        }
        const next = list[index + 1];
        if (next)
          assert.ok(
            Math.abs(next.top - item.bottom - 28) < 1,
            `${next.top - item.bottom}px`
          );
      }
    });
  });
});

describe("code blocks", () => {
  // Why: code blocks sit on the raised gray, like inline code, and their
  // copy button uses the site's one hover fill (white at 5%).
  it("sit on the raised gray, with the shared fill on the copy button", async () => {
    await withPage(1440, async page => {
      await page.goto(
        `${origin}/posts/how-to-produce-multiple-executables-from-a-stack-project/`,
        {
          waitUntil: "load",
        }
      );
      await page.hover("main pre.astro-code");
      const [block, button] = await page.$eval("main pre.astro-code", pre => [
        getComputedStyle(pre).backgroundColor,
        getComputedStyle(pre.querySelector(".copy-code-btn")!).backgroundColor,
      ]);
      assert.deepEqual(
        [await rgba(page, block), await rgba(page, button)],
        ["rgba(36, 36, 36, 1)", "rgba(255, 255, 255, 0.05)"]
      );
    });
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
        await rgba(
          page,
          await page.evaluate(
            () =>
              getComputedStyle(
                document.querySelector("#filetree")!,
                "::backdrop"
              ).backgroundColor
          )
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

describe("random page", () => {
  async function notes() {
    const html = await site.read("random/index.html");
    const json = /<script[^>]*id="random-notes"[^>]*>([\s\S]*?)<\/script>/.exec(
      html
    );
    assert.ok(json, "no #random-notes list");
    return JSON.parse(json[1]!) as string[];
  }

  // Why: the page's one job is to land on a note picked at random from its
  // list. Stubbing Math.random picks the first and last entries, so an
  // off-by-one in the index shows up.
  for (const [random, pick] of [
    [0, "first"],
    [0.999999, "last"],
  ] as const) {
    it(`sends the visitor to the ${pick} note when Math.random() is ${random}`, async () => {
      const urls = await notes();
      const expected = pick === "first" ? urls[0]! : urls.at(-1)!;
      await withPage(1440, async page => {
        await page.addInitScript(value => {
          Math.random = () => value;
        }, random);
        await page.goto(origin + "/random/");
        await page.waitForURL(url => url.pathname !== "/random/");
        assert.equal(new URL(page.url()).pathname, expected);
      });
    });
  }

  // Why: live's redirect added `/~random/` to the history, so Back from the
  // note returned to it and it redirected again, trapping the reader. The
  // page replaces itself instead, so Back returns to where they came from.
  it("leaves no history entry, so Back returns to the previous page", async () => {
    await withPage(1440, async page => {
      await page.goto(origin + "/");
      await page.goto(origin + "/random/");
      await page.waitForURL(url => url.pathname !== "/random/");
      await page.goBack();
      assert.equal(new URL(page.url()).pathname, "/");
    });
  });
});
