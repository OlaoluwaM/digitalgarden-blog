/**
 * A snapshot of `/feed.xml` for a small fixture site: the channel, and
 * each item's title, link, date, description, categories, and full content
 * with absolute URLs.
 *
 * Why a snapshot, and why this level: a feed reader shows whatever the
 * feed holds, and a change there (a date format, a relative link, a
 * dropped field) goes unnoticed on the site itself. test/feed.test.ts
 * pins the rules; this shows the whole output in review whenever it
 * changes. The fixture notes are written here, so publishing never
 * changes the snapshot: two posts with different dates, tags, a relative
 * link, a heading link, an image through Astro's pipeline, and a hidden
 * post the feed leaves out.
 *
 * Update deliberately, after reading the diff:
 * node --test --test-update-snapshots test/feed-snapshot.test.ts
 */
import assert from "node:assert/strict";
import { copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildFixture,
  createFixtureProject,
  type FixtureProject,
} from "./support/fixture-site.ts";

let fixture: FixtureProject;
let feed: string;

before(async () => {
  fixture = await createFixtureProject("feed-snapshot-test");
  await copyFile(
    fileURLToPath(new URL("../public/icon-192.png", import.meta.url)),
    join(fixture.project, "src/site/img/user/icon.png")
  );
  await fixture.writeNote("Home.md", {
    title: "Home",
    permalink: "/",
    home: true,
    body: "Welcome.",
  });
  await fixture.writeNote("Posts/Older.md", {
    title: "Older post",
    permalink: "/posts/older/",
    published: "2026-02-01T09:30",
    tags: ["haskell"],
    body: [
      "## Setup",
      "",
      "Text with a [relative link](/posts/newer/) and a [heading link](#setup).",
    ].join("\n"),
  });
  await fixture.writeNote("Posts/Newer.md", {
    title: "Newer post",
    permalink: "/posts/newer/",
    published: "2026-03-15T18:05",
    tags: ["linux", "software-engineering"],
    body: "An image:\n\n![The icon](/img/user/icon.png)",
  });
  await fixture.writeNote("Posts/Hidden.md", {
    title: "Hidden post",
    permalink: "/posts/hidden/",
    hide: true,
    body: "Only by direct link.",
  });
  const { status, output } = await buildFixture(fixture.project);
  assert.equal(status, 0, output);
  feed = await readFile(join(fixture.project, "dist/feed.xml"), "utf8");
});

after(async () => {
  await fixture?.cleanup();
});

describe("feed snapshot", () => {
  it("matches the reviewed feed", t => {
    // One element per line, so the snapshot diffs by field.
    t.assert.snapshot(feed.replaceAll("><", ">\n<"), {
      serializers: [value => String(value)],
    });
  });
});
