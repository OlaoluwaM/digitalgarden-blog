/**
 * Build-level tests for `/feed.xml`, the RSS 2.0 feed (`@astrojs/rss`).
 *
 * Why this level: the feed is only complete in the built site. Each item's
 * content is the note rendered by Astro (with its optimized images), and
 * which notes it lists comes from the same collection the pages use, so a
 * unit test of the endpoint's parts could not show a broken image, a
 * relative link, or a missing note.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";
import { parse } from "node-html-parser";
import { buildSite, type SiteBuild } from "./support/site-build.ts";

interface Item {
  title: string;
  link: string;
  guid: { "#text": string };
  pubDate: string;
  description?: string;
  category?: string | string[];
  "content:encoded": string;
}

const SITE = "https://thunk.blog";
let site: SiteBuild;
let xml: string;
let channel: Record<string, unknown>;
let items: Item[];

before(async () => {
  site = await buildSite();
  xml = await site.read("feed.xml");
  const document = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    isArray: name => name === "item",
  }).parse(xml) as { rss: { channel: Record<string, unknown> } };
  channel = document.rss.channel;
  items = (channel.item as Item[] | undefined) ?? [];
});

after(async () => {
  await site?.cleanup();
});

const item = (path: string) => {
  const found = items.find(item => item.link === SITE + path);
  assert.ok(found, `no item for ${path}`);
  return found;
};

describe("the feed", () => {
  // Why: a feed reader rejects the whole feed over one XML error, and
  // escaping note HTML inside XML is where that goes wrong.
  it("is well-formed RSS 2.0", () => {
    assert.equal(SyntaxValidator.validate(xml), true);
    assert.match(xml, /<rss [^>]*version="2\.0"/);
  });

  // Why: readers show the channel's title and link, and validators expect
  // the feed to name its own URL (the Atom self link).
  it("describes the site", () => {
    assert.equal(channel.title, "Thunks & Thoughts");
    assert.equal(channel.link, `${SITE}/`);
    assert.equal(channel.language, "en");
    const self = channel["atom:link"] as Record<string, string>;
    assert.equal(self["@href"], `${SITE}/feed.xml`);
    assert.equal(self["@rel"], "self");
  });

  // Why: subscribers should get every published note and nothing else. Home
  // is the site's front page, not a post (live's feed left it out too). The
  // expected list is every built note page, so a new note needs no change.
  it("has one item per published note, without Home", () => {
    const notes = site.pages
      .filter(
        page => !["index.html", "404.html", "random/index.html"].includes(page)
      )
      .map(page => `${SITE}/${page.replace(/index\.html$/, "")}`);
    assert.ok(notes.length > 0);
    assert.deepEqual(items.map(item => item.link).sort(), notes.sort());
    for (const { link, guid } of items) assert.equal(guid["#text"], link);
  });

  // Why: readers list items in feed order; live's was arbitrary.
  it("lists the newest post first", () => {
    const dates = items.map(item => Date.parse(item.pubDate));
    assert.deepEqual(
      dates,
      dates.toSorted((a, b) => b - a)
    );
  });
});

describe("an item", () => {
  // Why: the title, description, and tags come from the note's properties;
  // the publication time is the note's `published` value in Central time
  // (15:42 CDT is 20:42 UTC), not live's UTC reading of it.
  it("carries the note's title, description, tags, and publication time", () => {
    const post = item("/posts/be-deliberate/");
    assert.equal(post.title, "Be deliberate");
    assert.equal(post.description, "Be deliberate");
    assert.deepEqual(post.category, ["non-technical", "self-development"]);
    assert.equal(post.pubDate, "Fri, 20 Mar 2026 20:42:00 GMT");
  });

  // Why: full-text feeds let people read in their reader. The content must
  // be the note as the site renders it.
  it("holds the note's full rendered content", async () => {
    const content = parse(item("/posts/be-deliberate/")["content:encoded"]);
    const page = parse(await site.read("posts/be-deliberate/index.html"));
    const paragraphs = page.querySelectorAll("main.content > p");
    assert.ok(paragraphs.length > 1);
    for (const paragraph of [paragraphs[0]!, paragraphs.at(-1)!]) {
      assert.ok(content.text.includes(paragraph.text.trim()), paragraph.text);
    }
  });

  // Why: a feed reader is not on thunk.blog, so a link or image with a
  // site-relative URL (`/posts/...`, `/_astro/...`) is broken there, and an
  // image left as Astro's build placeholder never loads at all.
  it("uses absolute URLs for every link and image", () => {
    for (const { link, "content:encoded": html } of items) {
      assert.doesNotMatch(html, /__ASTRO_IMAGE_/, link);
      const content = parse(html);
      for (const element of content.querySelectorAll("[href], [src]")) {
        const url =
          element.getAttribute("href") ?? element.getAttribute("src")!;
        if (url.startsWith("#")) continue;
        assert.match(url, /^(https?:|mailto:)/, `${link}: ${url}`);
      }
      for (const element of content.querySelectorAll("[srcset]")) {
        for (const candidate of element.getAttribute("srcset")!.split(",")) {
          assert.match(candidate.trim(), /^https?:/, `${link}: ${candidate}`);
        }
      }
    }
  });

  // Why: the one note with an image today; its optimized file must be the
  // one the site serves.
  it("points images at the site's optimized files", () => {
    const content = parse(
      item("/posts/implementing-redis-info-in-haskell/")["content:encoded"]
    );
    const image = content.querySelector("img");
    assert.match(
      image?.getAttribute("src") ?? "",
      /^https:\/\/thunk\.blog\/_astro\//
    );
  });
});
