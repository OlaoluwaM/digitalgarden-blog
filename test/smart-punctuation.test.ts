/**
 * Render through the site's Astro processor: Eleventy's markdown-it has
 * typographer off, so published prose must keep ASCII punctuation.
 * These are processor tests, not full builds.
 */
import assert from "node:assert/strict";
import { it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateConfig } from "astro/config";
import { parse } from "node-html-parser";
import siteConfig from "../astro.config.ts";

const { markdown } = await validateConfig(
  siteConfig,
  fileURLToPath(new URL("../", import.meta.url)),
  "build"
);
const renderer = await markdown.processor.createRenderer(markdown);

async function renderText(source: string) {
  const { code } = await renderer.render(source);
  return parse(code).text.trim();
}

it("keeps straight quotes, apostrophes, ellipses, and dashes", async () => {
  const source = `"double" 'single' it's ... -- ---`;
  assert.equal(await renderText(source), source);
});

it("keeps ASCII punctuation inside callouts", async () => {
  const text = await renderText(`> [!note]\n> "quoted" it's...`);
  assert.match(text, /"quoted" it's\.\.\./);
  assert.doesNotMatch(text, /[‘’“”…–—]/);
});
