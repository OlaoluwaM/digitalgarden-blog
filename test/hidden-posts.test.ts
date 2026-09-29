/**
 * Build a fixture site with a post marked `dg-hide` (published by the
 * Digital Garden plugin as `hide: true`): the post is built and opens from
 * a direct link, but nothing lists it (the file tree, Recent Posts,
 * search, the feed, the sitemap, `/random/`), and its page asks search
 * engines not to index it.
 *
 * Why this level: the content schema strips keys it doesn't declare, so a
 * schema that names the vault's key (`dg-hide`) instead of the published
 * one (`hide`) silently loses the flag. Only a build that loads real
 * frontmatter through the schema shows the flag reaching the listings;
 * the sitemap reads it through the regenerated wikilink index. The
 * listings' own rules are in test/file-tree.test.ts and
 * test/posts.test.ts.
 */
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { parse } from "node-html-parser";
import {
  buildFixture,
  createFixtureProject,
  generateFixtureIndex,
  type FixtureProject,
} from "./support/fixture-site.ts";

let fixture: FixtureProject;

before(async () => {
  fixture = await createFixtureProject("hidden-posts-test");
  await fixture.writeNote("Home.md", {
    title: "Home",
    permalink: "/",
    home: true,
    body: "Welcome.",
  });
  await fixture.writeNote("Posts/Shown.md", {
    title: "Shown",
    permalink: "/posts/shown/",
    body: "Listed.",
  });
  await fixture.writeNote("Posts/Hidden.md", {
    title: "Hidden",
    permalink: "/posts/hidden/",
    body: "Published, not listed.",
    hide: true,
  });
  await generateFixtureIndex(fixture.project);
  const { status, output } = await buildFixture(fixture.project);
  assert.equal(status, 0, output);
});

after(async () => {
  await fixture?.cleanup();
});

const read = (path: string) =>
  readFile(join(fixture.project, "dist", path), "utf8");

describe("hidden posts", () => {
  // Why: every other way into the site lists posts; a hidden post must be
  // in none of them, while a listed one is (so an empty file can't pass).
  for (const [name, path] of [
    ["search index", "searchIndex.json"],
    ["feed", "feed.xml"],
    ["sitemap", "sitemap-0.xml"],
    ["random page", "random/index.html"],
  ] as const) {
    it(`leaves it out of the ${name}`, async () => {
      const content = await read(path);
      assert.ok(content.includes("/posts/shown/"), content);
      assert.equal(content.includes("/posts/hidden/"), false, content);
    });
  }

  // Why: a search engine can still find the page through a link from
  // elsewhere; `noindex` keeps it out of results. Listed posts stay
  // indexable.
  it("asks search engines not to index only the hidden page", async () => {
    const robots = async (path: string) =>
      parse(await read(path))
        .querySelector('meta[name="robots"]')
        ?.getAttribute("content");
    assert.equal(await robots("posts/hidden/index.html"), "noindex");
    assert.equal(await robots("posts/shown/index.html"), undefined);
  });

  // Why: `dg-hide` means "publish, but don't list it"; the file tree and
  // Recent Posts must not show the post, and the post must still be built.
  it("builds a hidden post but leaves it out of the listings", async () => {
    const dist = join(fixture.project, "dist");
    await access(join(dist, "posts/hidden/index.html"));
    const home = parse(await readFile(join(dist, "index.html"), "utf8"));
    for (const selector of [".notelink a", ".recent-notes a"]) {
      const titles = home
        .querySelectorAll(selector)
        .map(link => link.textContent.trim());
      assert.ok(titles.includes("Shown"), `${selector}: ${titles.join(", ")}`);
      assert.equal(
        titles.includes("Hidden"),
        false,
        `${selector}: ${titles.join(", ")}`
      );
    }
  });
});
