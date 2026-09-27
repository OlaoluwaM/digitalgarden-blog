/**
 * The npm scripts that build the site for deploys.
 *
 * Why this level: the risk is in the script itself, not in rendering.
 * Astro keeps rendered Markdown in its cache folder (`node_modules/.astro`),
 * which Vercel restores between deploys, and clears it only when its config
 * digest changes. The digest skips functions, so an edited remark, rehype,
 * or Shiki plugin never clears it, and notes that did not change keep their
 * old HTML. `--force` clears the content cache on every production build.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const { scripts } = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

// Why: the production build must re-render every note with the current
// plugin code, and still run build:astro's prebuild step (dependency
// patches, the wikilink index), which npm runs only for `build:astro`.
it("builds for production through build:astro with --force", () => {
  assert.equal(scripts["build:astro:prod"], "npm run build:astro -- --force");
});
