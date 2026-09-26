/**
 * Build-level tests for the metadata in each page's <head>: canonical URLs,
 * descriptions, and Open Graph and Twitter tags.
 *
 * Why this level: the tags depend on each route's final URL and on how the
 * layout and pages combine, which only a real build shows. The build runs
 * once for the whole file.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { parse, type HTMLElement } from "node-html-parser";
import { buildSite, type SiteBuild } from "./support/site-build.ts";

let site: SiteBuild;
const heads = new Map<string, HTMLElement>();

before(async () => {
  site = await buildSite();
  for (const page of site.pages) {
    const head = parse(await site.read(page)).querySelector("head");
    assert.ok(head, `${page} has no <head>`);
    heads.set(page, head);
  }
});

after(async () => {
  await site?.cleanup();
});

const notePages = () => site.pages.filter(page => page !== "404.html");

function meta(page: string, key: string) {
  const head = heads.get(page)!;
  const element =
    head.querySelector(`meta[name="${key}"]`) ??
    head.querySelector(`meta[property="${key}"]`);
  return element?.getAttribute("content");
}

function routeOf(page: string) {
  return "/" + page.replace(/index\.html$/, "");
}

describe("canonical URLs", () => {
  // Why: the live site has no canonical links. Adding them tells search
  // engines which URL is authoritative (with the trailing slash the routes
  // use), and the value must match the page's actual route.
  it("gives every note page one canonical link to its own route", () => {
    for (const page of notePages()) {
      const links = heads.get(page)!.querySelectorAll('link[rel="canonical"]');
      assert.equal(links.length, 1, page);
      assert.equal(
        links[0]!.getAttribute("href"),
        `https://thunk.blog${routeOf(page)}`,
        page
      );
    }
  });
});

describe("descriptions", () => {
  // Why: posts used to repeat their title as the description. These pages
  // pin the switch to the note's own description property.
  it("uses each post's description property", () => {
    assert.equal(
      meta("posts/endianness-woot/index.html", "description"),
      "Endian deez nuts"
    );
    assert.equal(
      meta(
        "posts/implementing-redis-info-in-haskell/index.html",
        "description"
      ),
      "You're INFO a treat"
    );
  });

  // Why: Home's description is still the vault placeholder, so Home must not
  // publish one (and neither should its Open Graph tags).
  it("omits Home's placeholder description", () => {
    assert.equal(meta("index.html", "description"), undefined);
    assert.equal(meta("index.html", "og:description"), undefined);
  });
});

describe("Open Graph and Twitter tags", () => {
  // Why: link previews on social sites and chat apps read these tags. The
  // live site has none, so shared links show no title or summary.
  it("describes every note page for link previews", () => {
    for (const page of notePages()) {
      const title = heads.get(page)!.querySelector("title")!.text;
      assert.equal(meta(page, "og:title"), title, page);
      assert.equal(
        meta(page, "og:url"),
        `https://thunk.blog${routeOf(page)}`,
        page
      );
      assert.equal(meta(page, "og:site_name"), "Thunks & Thoughts", page);
      assert.equal(meta(page, "og:locale"), "en", page);
      assert.equal(meta(page, "twitter:card"), "summary", page);
      assert.equal(
        meta(page, "og:description"),
        meta(page, "description"),
        page
      );
    }
  });

  // Why: previews label articles differently from sites; only posts are
  // articles, Home is the site itself.
  it("marks posts as articles and Home as a website", () => {
    assert.equal(meta("index.html", "og:type"), "website");
    for (const page of notePages().filter(page => page !== "index.html")) {
      assert.equal(meta(page, "og:type"), "article", page);
    }
  });
});

describe("head snapshots", () => {
  // Why: the head is small and stable, so a snapshot is readable in review
  // and catches any metadata change (added, removed, or reordered tags) that
  // the targeted tests above do not name. Asset file names are normalized:
  // Vite picks both the hash and the chunk name (the name changes when pages
  // are added), so unrelated edits must not churn the snapshot.
  // Update deliberately with: node --test --test-update-snapshots test/head-metadata.test.ts
  for (const page of [
    "index.html",
    "posts/be-deliberate/index.html",
    "posts/on-maths-and-engineering/index.html",
  ]) {
    it(`matches the reviewed head for ${page}`, t => {
      const normalized = heads
        .get(page)!
        .toString()
        .replace(/\/_astro\/[\w.-]+\.(css|js)/g, "/_astro/<asset>.$1")
        .replace(/></g, ">\n<");
      // Store the markup as plain text so snapshot diffs read like HTML.
      t.assert.snapshot(normalized, { serializers: [value => String(value)] });
    });
  }
});
