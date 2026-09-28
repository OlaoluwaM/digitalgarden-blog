/**
 * The npm scripts and the Vercel config that build and deploy the site.
 *
 * Why this level: the risk is in the configuration itself, not in
 * rendering. A deploy that runs a script that does not exist, or serves a
 * folder Astro does not write, fails or ships nothing, and only a deploy
 * shows it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const { scripts } = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as Record<
  string,
  unknown
>;
const PREPARE = "npm run patch-dependencies && npm run generate:wikilink-index";

describe("npm scripts", () => {
  // Why: `dev`, `build`, and `preview` are the names Astro, Vercel, and
  // anyone new to the repository reach for first.
  it("uses Astro's standard script names", () => {
    assert.equal(scripts.dev, "astro dev");
    assert.equal(scripts.preview, "astro preview");
  });

  // Why: Astro keeps rendered Markdown in its cache folder
  // (`node_modules/.astro`), which Vercel restores between deploys, and
  // clears it only when its config digest changes. The digest skips
  // functions, so an edited remark, rehype, or Shiki plugin never clears
  // it, and notes that did not change keep their old HTML. `--force`
  // re-renders every note on every build.
  it("builds with --force", () => {
    assert.equal(scripts.build, "astro build --force");
  });

  // Why: both commands need the dependency patches applied and the
  // wikilink index generated first; npm runs `pre<name>` automatically.
  it("prepares the patches and the wikilink index before dev and build", () => {
    assert.equal(scripts.predev, PREPARE);
    assert.equal(scripts.prebuild, PREPARE);
  });
});

describe("vercel.json", () => {
  // Why: the project's dashboard still says Eleventy. The file overrides
  // it for every deploy, so it must name Astro, the build script, and the
  // folder Astro writes (its default, `dist`).
  it("deploys the Astro build", () => {
    assert.equal(vercel.framework, "astro");
    assert.equal(vercel.buildCommand, "npm run build");
    assert.equal(vercel.devCommand, "npm run dev");
    assert.equal(vercel.outputDirectory, "dist");
    assert.doesNotMatch(
      readFileSync("astro.config.ts", "utf8"),
      /outDir/,
      "astro.config.ts must keep Astro's default output folder"
    );
  });

  // Why: the Eleventy-era catch-all sent every missing URL to `/404`, the
  // folder Eleventy built. Astro builds `404.html`, which Vercel serves for
  // missing URLs by itself.
  it("has no custom routes", () => {
    assert.equal(vercel.routes, undefined);
  });
});
