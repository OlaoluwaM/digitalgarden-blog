/**
 * Build-level tests for `/random/`, which sends a visitor to a random note.
 * Like the 404 page, it is a standalone HTML document with its own head.
 *
 * Why this level: which notes the page can pick is decided when the site is
 * built, and only the built page shows the list it embeds. The redirect
 * itself is a browser behavior, tested in test/layout/site-layout.test.ts.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { parse, type HTMLElement } from "node-html-parser";
import { buildSite, type SiteBuild } from "./support/site-build.ts";

const PAGE = "random/index.html";
let site: SiteBuild;
let document: HTMLElement;

before(async () => {
  site = await buildSite();
  document = parse(await site.read(PAGE), {
    blockTextElements: { script: true, noscript: true },
  });
});

after(async () => {
  await site?.cleanup();
});

describe("random page", () => {
  // Why: the page lives at `/random/`, without live's tilde (`/~random/`,
  // from the Digital Garden template); links to the old URL were not kept.
  it("is generated at /random/", () => {
    assert.ok(site.pages.includes(PAGE), site.pages.join(", "));
  });

  // Why: the browser tab shows the title while the redirect runs; live
  // calls the page "Random Page".
  it("has the title 'Random Page'", () => {
    assert.equal(document.querySelector("head > title")?.text, "Random Page");
  });

  // Why: the page picks from every published note, and Home is not a note to
  // land on at random (a change from live, which included it). The expected
  // list is every built note page, so a new note needs no test change.
  it("can pick every published note except Home", () => {
    const data = document.querySelector("script#random-notes");
    assert.equal(data?.getAttribute("type"), "application/json");
    const urls = JSON.parse(data!.text) as string[];
    const notes = site.pages
      .filter(page => !["index.html", "404.html", PAGE].includes(page))
      .map(page => "/" + page.replace(/index\.html$/, ""));
    assert.ok(notes.length > 0);
    assert.deepEqual([...urls].sort(), notes.sort());
  });

  // Why: the redirect is a script, so without JavaScript the page must still
  // offer a way on, as live does.
  it("links home when JavaScript is off", () => {
    const fallback = document.querySelector("noscript");
    assert.ok(fallback, "no <noscript>");
    assert.ok(
      parse(fallback.text).querySelector('a[href="/"]'),
      fallback.toString()
    );
  });
});
