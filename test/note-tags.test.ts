/**
 * Build a fixture site whose notes have no tags, written as the Digital
 * Garden plugin publishes them: Home with only the `gardenEntry` tag it
 * adds for `dg-home`, one note whose tags property was deleted, and one
 * whose tags property was left empty (null in YAML).
 *
 * Why this level: the content schema decides which frontmatter loads; the
 * vault template deletes empty properties, so a note without tags must
 * build, and only a build runs real frontmatter through the schema.
 */
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
  buildFixture,
  createFixtureProject,
  type FixtureProject,
} from "./support/fixture-site.ts";

let fixture: FixtureProject;
let build: { status: number | null; output: string };

before(async () => {
  fixture = await createFixtureProject("note-tags-test");
  await fixture.writeNote("Home.md", {
    title: "Home",
    permalink: "/home/",
    home: true,
    body: "Welcome.",
    untagged: "omitted",
  });
  await fixture.writeNote("Posts/Omitted.md", {
    title: "Omitted",
    permalink: "/posts/omitted/",
    body: "No tags property.",
    untagged: "omitted",
  });
  await fixture.writeNote("Posts/Empty.md", {
    title: "Empty",
    permalink: "/posts/empty/",
    body: "An empty tags property.",
    untagged: "empty",
  });
  build = await buildFixture(fixture.project);
});

after(async () => {
  await fixture?.cleanup();
});

describe("notes without tags", () => {
  // Why: Home has no tags of its own, and the template deletes an empty
  // tags property; either way the note has no tags and must build.
  it("builds Home and notes with a missing or empty tags property", async () => {
    assert.equal(build.status, 0, build.output);
    const dist = join(fixture.project, "dist");
    for (const page of [
      "index.html",
      "posts/omitted/index.html",
      "posts/empty/index.html",
    ]) {
      await access(join(dist, page));
    }
  });
});
