/**
 * Render Markdown with the site's configured processor and Shiki options.
 * These tests cover generated markup, not a full build or browser styling.
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

async function render(source: string) {
  const { code } = await renderer.render(source);
  // Parse Shiki's nested spans; this parser treats <pre> as raw text by default.
  return {
    html: code,
    document: parse(code, { blockTextElements: { script: true, style: true } }),
  };
}

// Why: the blocks keep dark-plus's syntax colors, but sit on the site's
// raised gray, like inline code and quotes, instead of the theme's
// #1e1e1e, which is the page's own color (docs/design-changes.md).
it("uses dark-plus colors on the site's raised gray", async () => {
  const { document } = await render('```js\nconst greeting = "hello";\n```');
  const block = document.querySelector("pre");
  assert.ok(block);
  assert.match(
    block.getAttribute("style") ?? "",
    /background-color:\s*var\(--color-gray-900\)/
  );
  assert.match(
    block.getAttribute("style") ?? "",
    /(?:^|;)\s*color:\s*#d4d4d4/i
  );
  const tokens = block.querySelectorAll(".line span");
  const keyword = tokens.find(token => token.text === "const");
  const string = tokens.find(token => token.text === '"hello"');
  assert.ok(keyword);
  assert.ok(string);
  assert.match(keyword.getAttribute("style") ?? "", /color:\s*#569cd6/i);
  assert.match(string.getAttribute("style") ?? "", /color:\s*#ce9178/i);
});

it("emits exactly one language label on each code block", async () => {
  const { html, document } = await render("```js\nlet count = 1;\n```");
  assert.equal(
    document.querySelector("pre")?.getAttribute("data-language"),
    "js"
  );
  // HTML parsers can hide duplicate attributes, so inspect the opening tag too.
  const openingTag = html.match(/<pre\b[^>]*>/)?.[0];
  assert.ok(openingTag);
  assert.equal(
    (openingTag.match(/\sdata-language\s*=/g) ?? []).length,
    1,
    openingTag
  );
});

it("numbers blank lines as well as lines containing code", async () => {
  const source = 'const greeting = "hello";\n\nconsole.log(greeting);';
  const { document } = await render(`\`\`\`js\n${source}\n\`\`\``);
  const lines = document.querySelectorAll("pre code .line");
  assert.deepEqual(
    lines.map(line => line.getAttribute("data-line")),
    ["1", "2", "3"]
  );
  assert.deepEqual(
    lines.map(line => line.text),
    source.split("\n")
  );
});

it("restarts line numbering for each code block", async () => {
  const { document } = await render(
    "```js\nlet a = 1;\nlet b = 2;\n```\n\n```python\nprint(1)\n```"
  );
  const blocks = document.querySelectorAll("pre");
  assert.equal(blocks.length, 2);
  assert.deepEqual(
    blocks.map(block =>
      block
        .querySelectorAll(".line")
        .map(line => line.getAttribute("data-line"))
    ),
    [["1", "2"], ["1"]]
  );
});

it("highlights the hs alias while retaining its language label", async () => {
  const source = 'main = putStrLn "hello"';
  const { document } = await render(`\`\`\`hs\n${source}\n\`\`\``);
  const block = document.querySelector("pre");
  assert.ok(block);
  assert.equal(block.getAttribute("data-language"), "hs");
  assert.equal(block.querySelector("code")?.text, source);
  const string = block
    .querySelectorAll(".line span")
    .find(token => token.text === '"hello"');
  assert.ok(string);
  assert.match(string.getAttribute("style") ?? "", /color:\s*#ce9178/i);
});

it("preserves unlabelled code and escapes HTML characters", async () => {
  const source = '<tag> & "quoted"';
  const { document } = await render(`\`\`\`\n${source}\n\`\`\``);
  const code = document.querySelector("pre code");
  assert.ok(code);
  assert.equal(code.text, source);
  assert.equal(code.querySelector("tag"), null);
  assert.equal(code.querySelector(".line")?.getAttribute("data-line"), "1");
});

it("leaves inline code without block labels or line numbers", async () => {
  const { document } = await render("Use `const value = 1` here.");
  assert.equal(document.querySelector("pre"), null);
  const code = document.querySelector("p code");
  assert.ok(code);
  assert.equal(code.text, "const value = 1");
  assert.equal(document.querySelector("[data-line]"), null);
  assert.equal(document.querySelector("[data-language]"), null);
});

// Why: ADR 0003 phase 1 keeps Eleventy's class names. The legacy
// `user/code-blocks.scss` draws line numbers, the language label, and the
// copy button through `pre.shiki`, the class Eleventy's Shiki plugin emitted.
// Without it, code blocks silently lose their numbers and labels. The
// `astro-code` class stays because the copy-button script selects it.
it("keeps Eleventy's shiki class alongside Astro's own classes", async () => {
  const { document } = await render("```js\nconst value = 1;\n```");
  const block = document.querySelector("pre");
  assert.ok(block);
  assert.ok(block.classList.contains("shiki"));
  assert.ok(block.classList.contains("astro-code"));
});

// Why: user/custom.scss sets `code[class*="language-"] { font-weight: 600 }`.
// Eleventy's `<code>` carried `language-<name>`, so code rendered at 600;
// without the class it silently drops to 400.
it("marks the code element with Eleventy's language class", async () => {
  const { document } = await render("```yaml\nkey: value\n```");
  assert.ok(
    document.querySelector("pre code")?.classList.contains("language-yaml")
  );
});

// Why: Eleventy labelled unlabelled fences "text" (shown as "Text" by the
// label CSS). Astro would say "plaintext", visibly changing the label on
// pages such as the Maths note. There must still be exactly one label.
it("labels unlabelled code blocks as text, like Eleventy", async () => {
  const { html, document } = await render("```\nplain words\n```");
  const block = document.querySelector("pre");
  assert.equal(block?.getAttribute("data-language"), "text");
  assert.ok(block?.querySelector("code")?.classList.contains("language-text"));
  const openingTag = html.match(/<pre\b[^>]*>/)?.[0] ?? "";
  assert.equal((openingTag.match(/\sdata-language\s*=/g) ?? []).length, 1);
});
