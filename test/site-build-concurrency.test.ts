/**
 * Builds of the site that overlap, as `npm run test:unit` starts them:
 * several test files each build the site in their own process, a moment
 * apart.
 *
 * Why this level: the failure only happens between real `astro build`
 * processes. Builds that shared Astro's cache folder
 * (`node_modules/.astro`) raced on its data store: a build starting with
 * `--force` cleared the store while an earlier one was still using it, and
 * that build failed: with ENOENT on `data-store.json.tmp`, or finding no
 * posts at all. Its file's tests were then cancelled, at random. Starts a moment apart are what hit it;
 * builds started together did not.
 */
import assert from "node:assert/strict";
import { it } from "node:test";
import { buildSite } from "./support/site-build.ts";

const STAGGER_MS = 700;

it("builds the site four times over each other", async () => {
  const builds = await Promise.allSettled(
    [0, 1, 2, 3].map(async step => {
      await new Promise(resolve => setTimeout(resolve, step * STAGGER_MS));
      return buildSite();
    })
  );
  try {
    for (const build of builds) {
      assert.equal(
        build.status,
        "fulfilled",
        build.status === "rejected" ? String(build.reason) : ""
      );
    }
  } finally {
    for (const build of builds) {
      if (build.status === "fulfilled") await build.value.cleanup();
    }
  }
});
