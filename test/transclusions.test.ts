/**
 * Render the publisher's transclusion markup (test/support/publisher-embed.ts)
 * through the site's Markdown processor: the embed's title becomes a label,
 * an untitled embed is labelled with its note, the link is named for its
 * note and its heading fragment matches the embedded heading, and the
 * embedded Markdown renders like the note's own (wikilinks, heading IDs).
 *
 * Why this level: the plugin reads raw HTML blocks around ordinary Markdown,
 * so only the real processor, with the other plugins and the heading IDs it
 * assigns, shows what a page receives. No published note embeds another
 * yet, so the markup is built by hand. The card's look is in
 * test/layout/transclusions.test.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateConfig } from "astro/config";
import { parse } from "node-html-parser";
import siteConfig from "../astro.config.ts";
import { publisherEmbed } from "./support/publisher-embed.ts";

// A published note in the real wikilink index. Its title differs from its
// file name ("Dotfiles Reorg"), which the header must not show.
const SOURCE_URL = "/posts/dotfiles-reorg-a-journey/";
const SOURCE_TITLE = "Dotfiles Reorg: A Journey";

const { markdown } = await validateConfig(
  siteConfig,
  fileURLToPath(new URL("../", import.meta.url)),
  "build"
);
const renderer = await markdown.processor.createRenderer(markdown);

async function render(source: string) {
  const { code, metadata } = await renderer.render(source, {
    frontmatter: {},
  });
  return {
    root: parse(code),
    headings: metadata.headings,
    frontmatter: metadata.frontmatter,
  };
}

describe("transclusions", () => {
  // Why: the publisher writes `![[Note|Title]]`'s title as a `#` heading,
  // which would be a second h1 on the page and an entry in its outline.
  // It is the card's label, so it becomes a paragraph.
  it("turns the embed title into a label", async () => {
    const { root, headings } = await render(
      publisherEmbed({
        href: SOURCE_URL,
        title: "# IO, an epiphany",
        body: "Embedded text.",
      })
    );
    assert.equal(root.querySelector("h1"), null);
    assert.equal(
      root.querySelector(".markdown-embed-title > p")?.textContent,
      "IO, an epiphany"
    );
    assert.deepEqual(headings, []);
  });

  // Why: the publisher writes a header only for `![[Note|Title]]`; the
  // card's header names the source note, by the title its page shows, for
  // every published embed.
  it("labels an untitled embed with its note's title", async () => {
    const { root } = await render(
      publisherEmbed({ href: SOURCE_URL, body: "Embedded text." })
    );
    const header = root.querySelector(".markdown-embed-title > p");
    assert.equal(header?.textContent, `From ${SOURCE_TITLE}`);
    // The header comes before the embedded text.
    assert.equal(
      root.querySelector(".markdown-embed")?.firstElementChild,
      header?.parentNode
    );
  });

  // Why: an unpublished note's text still arrives, without a link; there is
  // no page to name or open.
  it("leaves an unpublished note's embed without a header or link", async () => {
    const { root } = await render(publisherEmbed({ body: "Private text." }));
    assert.equal(root.querySelector(".markdown-embed-title"), null);
    assert.equal(root.querySelector(".markdown-embed-link"), null);
    assert.equal(
      root.querySelector(".markdown-embed > p")?.textContent,
      "Private text."
    );
  });

  // Why: every embed's link was named "Open link", so a list of a page's
  // links showed several with the same name and no destination. The icon
  // is decoration.
  it("names the link for its note's title and hides the icon", async () => {
    const { root } = await render(
      publisherEmbed({ href: SOURCE_URL, body: "Embedded text." })
    );
    const link = root.querySelector(".markdown-embed-link");
    assert.equal(link?.getAttribute("aria-label"), `Open ${SOURCE_TITLE}`);
    assert.equal(link?.getAttribute("href"), SOURCE_URL);
    assert.equal(
      link?.querySelector("svg")?.getAttribute("aria-hidden"),
      "true"
    );
  });

  // Why: the publisher slugs `![[Note#Heading]]` its own way
  // (`#Why-(part-2)`), which matches no heading ID on the site; the link
  // must land on the heading the embed starts with.
  it("points a section embed's link at the heading's ID", async () => {
    const { root } = await render(
      publisherEmbed({
        href: `${SOURCE_URL}#Why-(part-2)`,
        body: "## Why? (part 2)\n\nEmbedded text.",
      })
    );
    const id = root.querySelector(".markdown-embed h2")?.getAttribute("id");
    assert.equal(id, "why-part-2");
    assert.equal(
      root.querySelector(".markdown-embed-link")?.getAttribute("href"),
      `${SOURCE_URL}#${id}`
    );
  });

  // Why: a block embed (`![[Note#^block-id]]`) links to `#block-id`,
  // which plugins/mdast/blockIds.ts gives the block on the source page; it
  // must not be re-slugged like a heading fragment.
  it("keeps a block embed's fragment", async () => {
    const { root } = await render(
      publisherEmbed({
        href: `${SOURCE_URL}#block-id`,
        body: "The embedded block.",
      })
    );
    assert.equal(
      root.querySelector(".markdown-embed-link")?.getAttribute("href"),
      `${SOURCE_URL}#block-id`
    );
  });

  // Why: the publisher leaves an embed's wikilinks for the site to resolve,
  // in the same full-path form as the note's own.
  it("resolves wikilinks inside an embed", async () => {
    const { root } = await render(
      publisherEmbed({
        href: SOURCE_URL,
        body: "See [[Outbox/Digital Garden & Blog/Home\\|Home]].",
      })
    );
    const link = root.querySelector(".markdown-embed a.internal-link");
    assert.equal(link?.getAttribute("href"), "/");
    assert.equal(link?.classList.contains("is-unresolved"), false);
  });

  // Why: the table of contents leaves out an embedded note's headings, by
  // their positions in Astro's headings. The count must match the
  // headings Astro collects: a heading the admonition plugin adds counts,
  // an embed title turned label doesn't, and every heading inside an
  // embed, nested or after a nested one, is embedded.
  it("records embedded headings' positions in Astro's headings", async () => {
    const { headings, frontmatter } = await render(
      [
        "## Own",
        "```ad-note\ntitle: Aside\n## In an admonition\n```",
        publisherEmbed({
          href: SOURCE_URL,
          title: "# Embed title",
          body: [
            "## Embedded",
            publisherEmbed({ body: "### Nested" }),
            "### After the nested embed",
          ].join("\n\n"),
        }),
        "## Own again",
      ].join("\n\n")
    );
    assert.deepEqual(
      headings.map(heading => heading.text),
      [
        "Own",
        "In an admonition",
        "Embedded",
        "Nested",
        "After the nested embed",
        "Own again",
      ]
    );
    assert.deepEqual(frontmatter.embeddedHeadings, [2, 3, 4]);
  });

  // Why: embedding a note whose heading the page already has (or the same
  // note twice) repeats the heading; each needs its own ID for fragments,
  // the table of contents, and valid HTML.
  it("keeps heading IDs unique across the page and its embeds", async () => {
    const embed = publisherEmbed({
      href: SOURCE_URL,
      body: "## Setup\n\nEmbedded text.",
    });
    const { root } = await render(`## Setup\n${embed}${embed}`);
    assert.deepEqual(
      root.querySelectorAll("h2").map(heading => heading.getAttribute("id")),
      ["setup", "setup-1", "setup-2"]
    );
  });
});
