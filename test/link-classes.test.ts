/**
 * Render through the site's Astro processor: link classes must match
 * Eleventy's `link_open` rule in `.eleventy.js`. Hrefs with a scheme are
 * external; everything else is internal. These are processor tests, not
 * full builds or browser styling checks.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateConfig } from "astro/config";
import { parse, type HTMLElement } from "node-html-parser";
import siteConfig from "../astro.config.ts";

const homeTarget = "Outbox/Digital Garden & Blog/Home";
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

async function renderLinks(source: string) {
  return (await render(source)).querySelectorAll("a");
}

async function renderOnlyLink(source: string) {
  const links = await renderLinks(source);
  assert.equal(links.length, 1, `Expected one link in: ${source}`);
  return links[0];
}

function classNames(link: HTMLElement) {
  return (link.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

function assertExternal(link: HTMLElement) {
  const classes = classNames(link);
  assert.equal(
    classes.filter(name => name === "external-link").length,
    1,
    `Expected exactly one external-link class on ${link.outerHTML}`
  );
  assert.equal(classes.includes("internal-link"), false);
  assert.equal(link.getAttribute("target"), "_blank");
}

function assertInternal(link: HTMLElement) {
  const classes = classNames(link);
  assert.equal(
    classes.filter(name => name === "internal-link").length,
    1,
    `Expected exactly one internal-link class on ${link.outerHTML}`
  );
  assert.equal(classes.includes("external-link"), false);
  assert.equal(link.hasAttribute("target"), false);
}

describe("external links", () => {
  const cases = [
    ["an inline https link", "[site](https://example.com/path?q=1#top)"],
    ["an inline http link", "[site](http://example.com)"],
    ["a bare URL autolink", "Visit https://example.com today"],
    ["an angle-bracket autolink", "<https://example.com>"],
    ["a mailto link", "[email me](mailto:someone@example.com)"],
    ["a bare email autolink", "Write to someone@example.com"],
    ["an uppercase scheme", "[site](HTTPS://EXAMPLE.COM)"],
    ["a non-web scheme", "[call](tel:+15555550100)"],
  ] as const;

  for (const [name, source] of cases) {
    it(`classifies ${name} as external`, async () => {
      assertExternal(await renderOnlyLink(source));
    });
  }

  it("leaves the href unchanged", async () => {
    const link = await renderOnlyLink(
      "[site](https://example.com/path?q=1#top)"
    );
    assert.equal(link.getAttribute("href"), "https://example.com/path?q=1#top");
  });

  it("does not add rel", async () => {
    const link = await renderOnlyLink("[site](https://example.com)");
    assert.equal(link.hasAttribute("rel"), false);
  });
});

describe("internal links", () => {
  const cases = [
    ["a root-relative path", "[post](/posts/example/)"],
    ["a fragment", "[section](#section)"],
    ["a query string", "[search](?q=nix)"],
    ["a ./ relative path", "[sibling](./sibling/)"],
    ["a ../ relative path", "[parent](../parent/)"],
    ["a bare relative path", "[page](page.html)"],
  ] as const;

  for (const [name, source] of cases) {
    it(`classifies ${name} as internal`, async () => {
      assertInternal(await renderOnlyLink(source));
    });
  }
});

describe("wikilinks", () => {
  it("keeps one internal-link class on a resolved wikilink", async () => {
    const link = await renderOnlyLink(`[[${homeTarget}|Home]]`);
    assertInternal(link);
    assert.equal(link.getAttribute("href"), "/");
    assert.deepEqual(classNames(link).sort(), ["internal-link"]);
  });

  it("keeps is-unresolved on a missing wikilink", async () => {
    const link = await renderOnlyLink("[[Missing note]]");
    assertInternal(link);
    assert.equal(link.getAttribute("href"), "/404");
    assert.deepEqual(classNames(link).sort(), [
      "internal-link",
      "is-unresolved",
    ]);
  });

  it("keeps one internal-link class on a same-page fragment", async () => {
    const link = await renderOnlyLink("[[#Local heading]]");
    assertInternal(link);
    assert.equal(link.getAttribute("href"), "#local-heading");
  });
});

describe("links inside callouts", () => {
  it("classifies links in a native callout", async () => {
    const links = await renderLinks(
      `> [!note]\n> [site](https://example.com) and [[${homeTarget}|Home]]`
    );
    assert.equal(links.length, 2);
    assertExternal(links[0]);
    assertInternal(links[1]);
  });

  it("classifies links in a converted ad-* fence", async () => {
    const links = await renderLinks(
      "```ad-note\ntitle: Links\n[site](https://example.com) and [[Missing note]]\n```"
    );
    assert.equal(links.length, 2);
    assertExternal(links[0]);
    assertInternal(links[1]);
    assert.ok(classNames(links[1]).includes("is-unresolved"));
  });
});

describe("mixed content", () => {
  it("classifies each link in a paragraph independently", async () => {
    const links = await renderLinks(
      `[a](https://example.com), [b](/posts/b/), [[${homeTarget}|c]], and https://example.org`
    );
    assert.equal(links.length, 4);
    assertExternal(links[0]);
    assertInternal(links[1]);
    assertInternal(links[2]);
    assertExternal(links[3]);
  });

  it("does not create links from inline code or fenced code", async () => {
    const links = await renderLinks(
      "`[site](https://example.com)`\n\n```md\n[site](https://example.com)\n```"
    );
    assert.equal(links.length, 0);
  });
});
