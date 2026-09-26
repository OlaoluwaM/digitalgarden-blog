/**
 * Build-level tests for site-wide invariants of the Astro pages.
 *
 * Why this level: these properties (every page's head, the bundled CSS order,
 * and which assets exist in the output) only exist after Astro builds the
 * site. Component or unit tests cannot see them. The build runs once for the
 * whole file.
 */
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
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
        async page => [page, parse(await site.read(page))] as const
      )
    )
  );
});

after(async () => {
  await site?.cleanup();
});

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
  it("links the favicons, manifest, and Atom feed like the live site", () => {
    for (const page of site.pages) {
      const links = head(page)
        .querySelectorAll("link")
        .map(
          link => `${link.getAttribute("rel")} ${link.getAttribute("href")}`
        );
      for (const expected of [
        "icon /favicon.ico",
        "icon /favicon.svg",
        "apple-touch-icon /apple-touch-icon.png",
        "manifest /manifest.webmanifest",
        "alternate https://thunk.blog/feed.xml",
      ]) {
        assert.ok(links.includes(expected), `${page} is missing ${expected}`);
      }
    }
  });

  // Why: the live site loads Alpine, force-graph, Luxon, Lucide, and a fetch
  // polyfill from CDNs. The Astro site bundles or renders what it needs at
  // build time; an external script creeping back in is a regression in both
  // reliability and privacy.
  it("loads no third-party scripts", () => {
    for (const page of site.pages) {
      for (const script of documents.get(page)!.querySelectorAll("script")) {
        const source = script.getAttribute("src");
        if (source) assert.match(source, /^\/_astro\//, `${page}: ${source}`);
      }
    }
  });
});

describe("the legacy stylesheet bundle (ADR 0003 phase 1)", () => {
  async function stylesheets(page: string) {
    const hrefs = head(page)
      .querySelectorAll('link[rel="stylesheet"]')
      .map(link => link.getAttribute("href")!);
    return Promise.all(hrefs.map(href => site.read(href.replace(/^\//, ""))));
  }

  // Why: phase 2 depends on the whole legacy cascade sitting in one
  // low-priority layer, so Tailwind layers can be ordered above it. An
  // unlayered legacy rule would beat every utility regardless of specificity.
  // Phase 2 changes this test when it adds its own layers.
  it("puts all legacy CSS inside @layer legacy", async () => {
    for (const css of await stylesheets("index.html")) {
      const topLevel = postcss
        .parse(css)
        .nodes.filter(
          node => !(node.type === "atrule" && node.name === "charset")
        )
        .map(node =>
          node.type === "atrule" ? `@${node.name} ${node.params}` : node.type
        );
      assert.deepEqual(topLevel, ["@layer legacy"]);
    }
  });

  // Why: parity depends on the live cascade order. Later files override
  // earlier ones, so swapping any two changes the design without any error.
  it("keeps the live cascade order", async () => {
    const css = (await stylesheets("index.html")).join("\n");
    const markers = [
      [".messageBar{", "obsidian-base.scss"],
      ["--font-interface-theme:Inter", "the vendored theme"],
      ["--dg-external-link-icon-size:13px", "digital-garden-base.scss"],
      ["--dg-content-font-size:1.03rem", "user/custom.scss"],
    ] as const;
    const positions = markers.map(([marker, file]) => {
      const position = css.indexOf(marker);
      assert.notEqual(position, -1, `missing marker from ${file}`);
      return position;
    });
    assert.deepEqual(
      positions,
      positions.toSorted((a, b) => a - b),
      "legacy files are out of order"
    );
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
  // Why: note content must stay inside `main.content.cm-s-obsidian`. The
  // legacy CSS positions and styles the note column through that selector,
  // and later components are placed relative to it.
  it("renders note content inside the legacy content container", () => {
    for (const page of site.pages.filter(page => page !== "404.html")) {
      const main = documents.get(page)!.querySelector("body > main");
      assert.ok(main, page);
      assert.deepEqual(
        [...main.classList.values()],
        ["content", "cm-s-obsidian", "print"],
        page
      );
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
      page => page !== "404.html" && page !== "index.html"
    )) {
      assert.ok(noteHeader(page)?.querySelector("h1"), page);
    }
  });

  // Why: the legacy theme applies its dark palette and preview typography
  // through these body classes; without them the page renders unstyled.
  it("sets the legacy body classes on every note page", () => {
    for (const page of site.pages.filter(page => page !== "404.html")) {
      const classes = documents.get(page)!.querySelector("body")?.classList;
      for (const name of [
        "theme-dark",
        "markdown-preview-view",
        "markdown-rendered",
        "markdown-preview-section",
      ]) {
        assert.ok(classes?.contains(name), `${page} lacks ${name}`);
      }
    }
  });
});
