/**
 * Build-level tests for site-wide invariants of the Astro pages.
 *
 * Why this level: these properties (every page's head, the bundled CSS order,
 * and which assets exist in the output) only exist after Astro builds the
 * site. Component or unit tests cannot see them. The build runs once for the
 * whole file.
 */
import assert from "node:assert/strict";
import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { parse, type HTMLElement } from "node-html-parser";
import postcss from "postcss";
import { buildSite, type SiteBuild } from "./support/site-build.ts";

let site: SiteBuild;
let documents: Map<string, HTMLElement>;

before(async () => {
  site = await buildSite();
  documents = new Map(
    await Promise.all(
      site.pages.map(
        async page =>
          [
            page,
            // Parse <pre> contents as HTML (the default keeps them as raw
            // text), so code-block classes are visible to the tests.
            parse(await site.read(page), {
              blockTextElements: { script: true, style: true },
            }),
          ] as const
      )
    )
  );
});

after(async () => {
  await site?.cleanup();
});

/** Standalone pages, not notes: no shared layout, note header, or analytics. */
const STANDALONE = ["404.html", "random/index.html"];
const isNote = (page: string) => !STANDALONE.includes(page);

function head(page: string) {
  const element = documents.get(page)?.querySelector("head");
  assert.ok(element, `${page} has no <head>`);
  return element;
}

describe("every page's head", () => {
  // Why: charset and viewport were missing before the shared layout. Chrome
  // then guessed windows-1252 and garbled punctuation, and phones rendered a
  // desktop-width page.
  it("declares UTF-8 first and a device-width viewport", () => {
    for (const page of site.pages) {
      const first = head(page).querySelector("meta");
      assert.equal(first?.getAttribute("charset"), "utf-8", page);
      assert.equal(
        head(page)
          .querySelector('meta[name="viewport"]')
          ?.getAttribute("content"),
        "width=device-width, initial-scale=1.0",
        page
      );
    }
  });

  // Why: the page language and a non-empty title are basic accessibility and
  // browser-tab requirements that the live site meets on every page.
  it("sets lang and a non-empty title", () => {
    for (const page of site.pages) {
      const html = documents.get(page)?.querySelector("html");
      assert.equal(html?.getAttribute("lang"), "en", page);
      assert.ok(head(page).querySelector("title")?.text.trim(), page);
    }
  });

  // Why: these links are what the live site ships. Losing one silently breaks
  // favicons, home-screen icons, or feed discovery.
  // The feed link's type must match the feed (RSS since ADR 0004), or feed
  // readers and browser extensions may skip or mislabel it.
  it("links the favicons, manifest, and RSS feed", () => {
    for (const page of site.pages) {
      const links = head(page)
        .querySelectorAll("link")
        .map(link =>
          [
            link.getAttribute("rel"),
            link.getAttribute("type"),
            link.getAttribute("href"),
          ]
            .filter(Boolean)
            .join(" ")
        );
      for (const expected of [
        "icon /favicon.ico",
        "icon image/svg+xml /favicon.svg",
        "apple-touch-icon /apple-touch-icon.png",
        "manifest /manifest.webmanifest",
        "alternate application/rss+xml https://thunk.blog/feed.xml",
      ]) {
        assert.ok(links.includes(expected), `${page} is missing ${expected}`);
      }
    }
  });

  // Why: the live site loads Alpine, force-graph, Luxon, Lucide, and a fetch
  // polyfill from CDNs. The Astro site bundles or renders what it needs at
  // build time; an external script creeping back in is a regression in both
  // reliability and privacy.
  // Why: the live site reports page views and Core Web Vitals to Vercel;
  // dropping either component would silently stop the data. The standalone
  // pages carry neither: the 404 page as on Eleventy, and `/random/`
  // leaves for a note before it could report.
  it("includes Vercel Web Analytics and Speed Insights on note pages", () => {
    for (const page of site.pages.filter(isNote)) {
      const document = documents.get(page)!;
      assert.ok(document.querySelector("vercel-analytics"), page);
      assert.ok(document.querySelector("vercel-speed-insights"), page);
    }
  });

  it("loads no third-party scripts", () => {
    for (const page of site.pages) {
      for (const script of documents.get(page)!.querySelectorAll("script")) {
        const source = script.getAttribute("src");
        if (source) assert.match(source, /^\/_astro\//, `${page}: ${source}`);
      }
    }
  });
});

describe("the stylesheet bundle (ADR 0003)", () => {
  async function stylesheets(page: string) {
    const hrefs = head(page)
      .querySelectorAll('link[rel="stylesheet"]')
      .map(link => link.getAttribute("href")!);
    return Promise.all(hrefs.map(href => site.read(href.replace(/^\//, ""))));
  }

  // Why: unlayered CSS beats every layered rule regardless of specificity,
  // and a layer's position is fixed where its name first appears. Utilities
  // must beat component and base rules, and no style rule may sit outside a
  // layer. The minifier rewrites the declared order statement, so this
  // checks the effective order, not the source.
  it("orders the layers theme < base < components < utilities", async () => {
    const css = (await stylesheets("index.html")).join("\n");
    const topLevel = postcss
      .parse(css)
      .nodes.filter(
        node =>
          node.type !== "comment" &&
          !(node.type === "atrule" && node.name === "charset")
      );
    const order: string[] = [];
    for (const node of topLevel) {
      if (node.type !== "atrule" || node.name !== "layer") continue;
      for (const name of node.params.split(",").map(name => name.trim())) {
        if (!order.includes(name)) order.push(name);
      }
    }
    // Tailwind's `properties` layer only holds custom-property fallbacks
    // for older browsers; it may come first (lowest) or be absent.
    assert.deepEqual(
      order.filter(name => name !== "properties"),
      ["theme", "base", "components", "utilities"]
    );
    // `@property` (custom properties for utilities) and `@font-face` are
    // not style rules; layers do not order them.
    const unlayered = topLevel
      .filter(
        node =>
          !(
            node.type === "atrule" &&
            ["layer", "property", "font-face"].includes(node.name)
          )
      )
      .map(node => node.toString().slice(0, 80));
    assert.deepEqual(unlayered, []);
  });

  // Why: Tailwind generates a utility for every class-like word it finds in
  // its sources. A utility named like a class the Markdown pipeline emits
  // (`table`, `hidden`, `collapse`, ...) would restyle note content from the
  // top layer. global.css limits sources to the templates; this catches a
  // template word that still collides.
  it("generates no utility named like a class in rendered notes", async () => {
    const utilities = new Set<string>();
    postcss
      .parse((await stylesheets("index.html")).join("\n"))
      .walkAtRules("layer", layer => {
        if (layer.params !== "utilities") return;
        layer.walkRules(rule => {
          for (const match of rule.selector.matchAll(/\.((?:\\.|[\w-])+)/g))
            utilities.add(match[1]!.replace(/\\/g, ""));
        });
      });
    const collisions = new Set<string>();
    // The standalone pages are hand-written chrome, not rendered Markdown:
    // they carry utility classes the way header/footer/Recent Posts do.
    for (const page of site.pages.filter(isNote)) {
      const main = documents.get(page)!.querySelector("main");
      for (const element of main?.querySelectorAll("*") ?? []) {
        if (element.closest("header, footer, section.recent-notes")) continue;
        for (const name of element.classList.values())
          if (utilities.has(name)) collisions.add(`${page}: .${name}`);
      }
    }
    assert.deepEqual([...collisions], []);
  });

  // Why: ADR 0003 ends with the legacy Eleventy/Obsidian cascade (about
  // 1 MB, with base64 fonts) deleted. If an import of it came back, the
  // page would silently carry both designs; the size budget also catches
  // any other large stylesheet creeping in.
  it("ships no legacy CSS and stays within its size budget", async () => {
    const css = (await stylesheets("index.html")).join("\n");
    assert.doesNotMatch(css, /@layer legacy|\.messageBar\{|--dg-content/);
    assert.ok(css.length < 64_000, `${css.length} bytes`);
  });

  // Why: with the legacy CSS gone, Tailwind's Preflight reset is the element
  // baseline the base, content, and component styles are written against
  // (margins, lists, headings, media). It must load, in the base layer.
  it("ships the Preflight reset in the base layer", async () => {
    let found = false;
    postcss
      .parse((await stylesheets("index.html")).join("\n"))
      .walkAtRules("layer", layer => {
        if (layer.params !== "base") return;
        layer.walkRules(rule => {
          if (rule.selector.includes("::file-selector-button")) found = true;
        });
      });
    assert.ok(found, "no Preflight rules in @layer base");
  });

  // Why: the stylesheets reference fonts and icons by absolute URL. They
  // resolve only if `public/` supplies them, and a missing font falls back
  // silently to a system font.
  it("ships every absolute font and image URL the CSS references", async () => {
    const css = (await stylesheets("index.html")).join("\n");
    const urls = [
      ...css.matchAll(/url\(["']?(\/(?:fonts|img)\/[^)"']+)["']?\)/g),
    ].map(match => match[1]!);
    assert.ok(urls.length > 0, "expected font and image URLs");
    for (const url of new Set(urls)) {
      await access(join(site.outDir, url)).catch(() =>
        assert.fail(`${url} is referenced by CSS but missing from the build`)
      );
    }
  });
});

describe("page structure", () => {
  // Why: the style guide is a development tool (astro.config.ts injects it
  // only for `astro dev`). Shipping it would publish a page of fake posts.
  it("does not ship the dev-only style guide", () => {
    assert.ok(
      !site.pages.some(page => page.startsWith("style-guide")),
      site.pages.join(", ")
    );
  });

  // Why: note content must stay inside `main.content`: layout.css places the
  // note column through that selector, and the code styles are scoped to it.
  it("renders note content inside the content container", () => {
    for (const page of site.pages.filter(isNote)) {
      const main = documents.get(page)!.querySelector("body > main");
      assert.ok(main, page);
      assert.deepEqual([...main.classList.values()], ["content"], page);
      assert.ok(main.querySelector("p"), `${page} has no rendered content`);
    }
  });

  // Why: the live home page nests an empty `<h1></h1>` in its header,
  // producing an empty band above the content and a second h1. Home
  // deliberately renders no note header (an agreed change from live), and
  // that is decided by the page not rendering `NoteHeader`, so only the
  // built pages can show it. Posts are checked too so the assertion cannot
  // pass by the header vanishing everywhere.
  it("renders the note header on posts but not on Home", () => {
    const noteHeader = (page: string) =>
      documents.get(page)!.querySelector("main > header");
    assert.equal(noteHeader("index.html"), null);
    for (const page of site.pages.filter(
      page => isNote(page) && page !== "index.html"
    )) {
      assert.ok(noteHeader(page)?.querySelector("h1"), page);
    }
  });

  // Why: the rendered Markdown stylesheet is scoped to
  // `.markdown-rendered main.content`; without the body class every note
  // renders with browser defaults.
  it("marks every note page's body as rendered Markdown", () => {
    for (const page of site.pages.filter(isNote)) {
      const classes = documents.get(page)!.querySelector("body")?.classList;
      assert.ok(classes?.contains("markdown-rendered"), page);
    }
  });
});

describe("page scripts", () => {
  // A string only FlexSearch's code (and the engine configuring it) holds.
  const FLEXSEARCH = "latin:extra";
  const staticImports = (code: string) =>
    [
      ...code.matchAll(/import(?:[\w\s{},*$]*from)?\s*["']\.\/([^"']+)["']/g),
    ].map(match => match[1]!);

  // Why: FlexSearch is most of the search code, and most visits never
  // search. It must arrive with the index, in a chunk the page imports only
  // when search is used, not in the scripts every page loads up front
  // (live loaded it from a CDN on every page).
  it("loads FlexSearch only when search is used", async () => {
    const read = (file: string) => site.read(join("_astro", file));
    const upfront = new Set<string>();
    const queue = site.pages.flatMap(page =>
      documents
        .get(page)!
        .querySelectorAll("script[src]")
        .map(script => script.getAttribute("src")!)
        .filter(src => src.startsWith("/_astro/"))
        .map(src => src.slice("/_astro/".length))
    );
    for (let file; (file = queue.pop());) {
      if (upfront.has(file)) continue;
      upfront.add(file);
      queue.push(...staticImports(await read(file)));
    }
    for (const file of upfront) {
      assert.ok(!(await read(file)).includes(FLEXSEARCH), file);
    }

    const chunks = (await readdir(join(site.outDir, "_astro"))).filter(file =>
      file.endsWith(".js")
    );
    const withFlexSearch = [];
    for (const file of chunks) {
      if ((await read(file)).includes(FLEXSEARCH)) withFlexSearch.push(file);
    }
    assert.equal(withFlexSearch.length, 1, String(withFlexSearch));
  });
});
