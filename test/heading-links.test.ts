/**
 * Render through the site's Astro processor: link fragments must match the
 * heading IDs Astro actually emits. These are processor tests, not full builds.
 * Synthetic headings use an existing note target so the real index and plugin
 * configuration are exercised without changing published content.
 */
import assert from "node:assert/strict";
import { it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateConfig } from "astro/config";
import { parse, type HTMLElement } from "node-html-parser";
import siteConfig from "../astro.config.ts";

const homeTarget = "Outbox/Digital Garden & Blog/Home";
const articleTarget =
  "Outbox/Digital Garden & Blog/Content/Blogposts/How to produce multiple executables from a stack project";
const articlePath =
  "/posts/how-to-produce-multiple-executables-from-a-stack-project/";
const { markdown } = await validateConfig(
  siteConfig,
  fileURLToPath(new URL("../", import.meta.url)),
  "build"
);
const renderer = await markdown.processor.createRenderer(markdown);

async function render(source: string) {
  const { code } = await renderer.render(source);
  return parse(code, { blockTextElements: { script: true, style: true } });
}

function assertHeadingLink(
  link: HTMLElement | null,
  pathname: string,
  headingId: string
) {
  assert.ok(link, "Expected a rendered link");
  const href = link.getAttribute("href");
  assert.ok(href);
  const url = new URL(href, "https://thunk.blog/");
  assert.equal(url.pathname, pathname);
  // Either literal Unicode or URL-encoded Unicode can identify the same anchor.
  assert.equal(decodeURIComponent(url.hash.slice(1)), headingId);
  assert.ok(link.classList.contains("internal-link"));
  assert.equal(link.classList.contains("is-unresolved"), false);
}

const headings = [
  ["Welcome", "Welcome", "welcome"],
  ["Version 1.2", "Version 1.2", "version-12"],
  ["FooBar", "FooBar", "foobar"],
  ["Café & Tea", "Café & Tea", "café--tea"],
  ["Using `code` and **bold**", "Using code and bold", "using-code-and-bold"],
] as const;

it("retains Astro's default IDs, including formatted heading text", async () => {
  const document = await render(
    headings.map(([text]) => `## ${text}`).join("\n\n")
  );
  assert.deepEqual(
    document.querySelectorAll("h2").map(node => node.getAttribute("id")),
    headings.map(([, , id]) => id)
  );
});

for (const [heading, reference, expectedId] of headings) {
  it(`resolves a cross-note fragment for ${reference}`, async () => {
    const destination = await render(`## ${heading}`);
    const id = destination.querySelector("h2")?.getAttribute("id");
    assert.equal(id, expectedId);
    const source = await render(`[[${articleTarget}#${reference}]]`);
    assertHeadingLink(source.querySelector("a"), articlePath, id!);
  });
}

for (const separator of ["|", "\\|"]) {
  it(`preserves an alias with a ${separator === "|" ? "normal" : "publisher-escaped"} pipe`, async () => {
    const document = await render(
      `[[${homeTarget}#Welcome${separator}start here]]`
    );
    const link = document.querySelector("a");
    assert.equal(link?.text, "start here");
    assertHeadingLink(link, "/", "welcome");
  });
}

it("resolves a same-page fragment without looking up an empty note name", async () => {
  const document = await render("[[#Welcome|jump]]\n\n## Welcome");
  const link = document.querySelector("a");
  assertHeadingLink(link, "/", "welcome");
  assert.equal(link?.getAttribute("href"), "#welcome");
});

it("keeps repeated links stable and allows an explicit duplicate-heading suffix", async () => {
  const document = await render(
    "[[#Repeat|first]] [[#Repeat|first again]] [[#Repeat-1|second]]\n\n## Repeat\n\n## Repeat"
  );
  const ids = document
    .querySelectorAll("h2")
    .map(node => node.getAttribute("id"));
  assert.deepEqual(ids, ["repeat", "repeat-1"]);
  const links = document.querySelectorAll("a");
  assert.equal(links.length, 3);
  for (const [index, id] of ["repeat", "repeat", "repeat-1"].entries()) {
    assertHeadingLink(links[index]!, "/", id);
  }
});

it("does not carry slug collision counts between documents", async () => {
  for (let index = 0; index < 2; index++) {
    const document = await render("[[#Welcome|jump]]\n\n## Welcome");
    assert.equal(document.querySelector("h2")?.getAttribute("id"), "welcome");
    assertHeadingLink(document.querySelector("a"), "/", "welcome");
  }
});

it("resolves heading links inside converted admonitions", async () => {
  const document = await render(
    `\`\`\`ad-note\n[[${homeTarget}#Welcome\\|start here]]\n\`\`\``
  );
  assertHeadingLink(document.querySelector(".callout a"), "/", "welcome");
});

it("keeps missing notes unresolved even when they have a fragment", async () => {
  const document = await render(
    "[[Missing heading test note#Welcome|missing]]"
  );
  const link = document.querySelector("a");
  assert.equal(link?.getAttribute("href"), "/404");
  assert.ok(link?.classList.contains("is-unresolved"));
  assert.equal(link?.text, "missing");
});

it("leaves ordinary Markdown fragment URLs unchanged", async () => {
  const document = await render(
    "[local](#Keep-This) [remote](https://example.com/#Keep-This)"
  );
  assert.deepEqual(
    document.querySelectorAll("a").map(link => link.getAttribute("href")),
    ["#Keep-This", "https://example.com/#Keep-This"]
  );
});

it("leaves fragment wikilinks in inline and fenced code unchanged", async () => {
  const document = await render("`[[#Welcome]]`\n\n```text\n[[#Welcome]]\n```");
  assert.equal(document.querySelectorAll("a").length, 0);
  assert.equal(document.querySelector("p code")?.text, "[[#Welcome]]");
  assert.equal(document.querySelector("pre code")?.text.trim(), "[[#Welcome]]");
});
