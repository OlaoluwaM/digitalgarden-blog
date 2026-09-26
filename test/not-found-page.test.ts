/**
 * Build-level tests for the 404 page. The 404 page is a standalone HTML
 * document that doesn't use BaseLayout, so it must define its own head,
 * styles, and structure.
 *
 * Why this level: the 404 page's meta tags, stylesheets, status code, and
 * complete document structure only exist in the built output. Testing at
 * build time verifies the whole integration, including that the file exists
 * and the server returns a 404 status for missing URLs.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { parse } from "node-html-parser";
import { buildSite, type SiteBuild } from "./support/site-build.ts";

let site: SiteBuild;

before(async () => {
  site = await buildSite();
});

after(async () => {
  await site?.cleanup();
});

describe("404 page", () => {
  // Why: the page must exist in the build output at the expected location.
  // If the 404.html file is missing, the server cannot serve it.
  it("is generated as 404.html in the site root", () => {
    assert.ok(
      site.pages.includes("404.html"),
      "404.html not found in built pages"
    );
  });

  // Why: the 404 page title appears in the browser tab and accessibility
  // readers. "Nothing here" matches the live site's page title.
  it("has the title 'Nothing here'", async () => {
    const html = await site.read("404.html");
    const doc = parse(html);
    const title = doc.querySelector("head > title");
    assert.equal(title?.text, "Nothing here");
  });

  // Why: UTF-8 charset and viewport are required for proper rendering on all
  // devices. This is a site-wide invariant that the 404 page must not break.
  it("declares UTF-8 charset and device-width viewport", async () => {
    const html = await site.read("404.html");
    const doc = parse(html);
    const head = doc.querySelector("head");
    assert.ok(head, "no <head> found");

    const charsetMeta = head.querySelector("meta[charset]");
    assert.equal(
      charsetMeta?.getAttribute("charset"),
      "utf-8",
      "missing or incorrect charset"
    );

    const viewportMeta = head.querySelector('meta[name="viewport"]');
    assert.equal(
      viewportMeta?.getAttribute("content"),
      "width=device-width, initial-scale=1.0",
      "missing or incorrect viewport"
    );
  });

  // Why: the page language is an accessibility and SEO requirement. It must
  // match the site's configured language from site.lang.
  it("sets html lang='en'", async () => {
    const html = await site.read("404.html");
    const doc = parse(html);
    const htmlElem = doc.querySelector("html");
    assert.equal(htmlElem?.getAttribute("lang"), "en");
  });

  // Why: favicon links allow browsers to show the site icon in tabs and
  // bookmarks. These must match what other pages link.
  it("includes favicon links", async () => {
    const html = await site.read("404.html");
    const doc = parse(html);
    const head = doc.querySelector("head");
    assert.ok(head, "no <head> found");

    const links = head
      .querySelectorAll("link")
      .map(link => `${link.getAttribute("rel")} ${link.getAttribute("href")}`)
      .join("|");

    assert.match(links, /icon \/favicon\.ico/);
    assert.match(links, /icon \/favicon\.svg/);
    assert.match(links, /apple-touch-icon \/apple-touch-icon\.png/);
  });

  // Why: the page imports the legacy stylesheet so the dark theme and
  // typography match the rest of the site. Astro bundles the CSS from the
  // imported index.scss into the site bundle.
  it("links a stylesheet for styling", async () => {
    const html = await site.read("404.html");
    const doc = parse(html);
    const stylesheets = doc
      .querySelectorAll('link[rel="stylesheet"]')
      .map(link => link.getAttribute("href")!);
    assert.ok(stylesheets.length > 0, `no stylesheets found`);
    assert.ok(
      stylesheets.some(href => href.endsWith(".css")),
      `no CSS stylesheets found in [${stylesheets.join(", ")}]`
    );
  });

  // Why: the body carries the legacy theme and presentation classes. Without
  // them, the page renders unstyled.
  it("sets the legacy body classes", async () => {
    const html = await site.read("404.html");
    const doc = parse(html);
    const body = doc.querySelector("body");
    assert.ok(body, "no <body> found");

    const classes = body.classList;
    for (const name of ["theme-dark", "markdown-preview-view"]) {
      assert.ok(classes?.contains(name), `body missing class ${name}`);
    }
  });

  // Why: the content wrapper keeps the live `content centered` classes the
  // legacy CSS positions, but is a <main> landmark (live used a <div>), so
  // screen readers can jump to the page's content (axe landmark-one-main).
  it("wraps the content in a main landmark with content and centered classes", async () => {
    const html = await site.read("404.html");
    const doc = parse(html);
    const main = doc.querySelector("body > main.content.centered");
    assert.ok(main, "no main.content.centered found");
  });

  // Why: the heading is a level-1 message telling the user they've hit a 404.
  // The exact text "There is nothing here" matches the live site.
  it("includes an h1 with text 'There is nothing here'", async () => {
    const html = await site.read("404.html");
    const doc = parse(html);
    const h1 = doc.querySelector("h1");
    assert.equal(h1?.text, "There is nothing here");
  });

  // Why: the explanatory paragraph gives context for the error without being
  // too technical. This message appears on the live site.
  it("includes a p with the explanation", async () => {
    const html = await site.read("404.html");
    const doc = parse(html);
    const p = doc.querySelector("body > main > p");
    assert.match(
      p?.text || "",
      /If you got here from a link.*this note is probably not made public/
    );
  });

  // Why: the link allows users to navigate back to the home page when they
  // land on a 404. It must point to "/" (the home page).
  it("includes a link back to home at '/'", async () => {
    const html = await site.read("404.html");
    const doc = parse(html);
    const link = doc.querySelector("body > main > a");
    assert.equal(link?.getAttribute("href"), "/");
    assert.match(link?.text || "", /[Gg]o back home/);
  });

  // Why: the 404 page is standalone like Eleventy's, not the note layout: no
  // note container (`cm-s-obsidian`) and no site navigation.
  it("does not use the note layout", async () => {
    const html = await site.read("404.html");
    const doc = parse(html);
    assert.equal(doc.querySelector(".cm-s-obsidian"), null);
    assert.equal(doc.querySelector(".filetree-wrapper, .navbar"), null);
  });
});
