/**
 * Build-level tests for the sitemap (`@astrojs/sitemap`) and `robots.txt`,
 * which points crawlers at it.
 *
 * Why this level: the integration writes the sitemap from the pages Astro
 * actually built, after the build. Only the build output shows which pages
 * it lists.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";
import { buildSite, type SiteBuild } from "./support/site-build.ts";

const SITE = "https://thunk.blog";
let site: SiteBuild;

before(async () => {
  site = await buildSite();
});

after(async () => {
  await site?.cleanup();
});

async function locations(file: string, list: string, entry: string) {
  const xml = await site.read(file);
  assert.equal(SyntaxValidator.validate(xml), true);
  const document = new XMLParser({ isArray: name => name === entry }).parse(
    xml
  ) as Record<string, Record<string, unknown>>;
  return (document[list][entry] as { loc: string }[]).map(item => item.loc);
}

describe("the sitemap", () => {
  // Why: crawlers start from the index, which must name the page list.
  it("has an index that lists the page sitemap", async () => {
    assert.deepEqual(
      await locations("sitemap-index.xml", "sitemapindex", "sitemap"),
      [`${SITE}/sitemap-0.xml`]
    );
  });

  // Why: the sitemap should hold every page worth indexing: Home and every
  // note. `/random/` only redirects, and the 404 page is not content (live
  // listed it). The expected list is every built page but those two, so a
  // new note needs no change.
  it("lists Home and every note, not /random/ or the 404 page", async () => {
    const expected = site.pages
      .filter(page => !["404.html", "random/index.html"].includes(page))
      .map(page => `${SITE}/${page.replace(/index\.html$/, "")}`);
    assert.ok(expected.includes(`${SITE}/`));
    assert.deepEqual(
      (await locations("sitemap-0.xml", "urlset", "url")).sort(),
      expected.sort()
    );
  });
});

describe("robots.txt", () => {
  // Why: the sitemap is at /sitemap-index.xml, not the /sitemap.xml
  // crawlers guess, so robots.txt must name it. It must not block anything.
  it("allows every crawler and names the sitemap index", async () => {
    const robots = await site.read("robots.txt");
    assert.match(robots, /^User-agent: \*$/m);
    assert.match(robots, /^Allow: \/$/m);
    assert.doesNotMatch(robots, /^Disallow:/m);
    assert.match(
      robots,
      new RegExp(`^Sitemap: ${SITE}/sitemap-index\\.xml$`, "m")
    );
  });
});
