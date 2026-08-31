import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markdownToHtml } from "satteri";

import { mkmdastAdmonitionCalloutPlugin } from "../src/plugins/admonitions.ts";

const wikilinkIndex = {
  "Some Note": "/posts/some-note/",
};

const mdastAdmonitionCalloutPlugin =
  mkmdastAdmonitionCalloutPlugin(wikilinkIndex);

const render = (markdown: string) =>
  markdownToHtml(markdown, {
    features: {
      wikilinks: true,
    },
    mdastPlugins: [mdastAdmonitionCalloutPlugin],
  }).html;

describe("mdastAdmonitionCalloutPlugin", () => {
  it("resolves a wikilink in an admonition body", () => {
    assert.equal(
      render("```ad-note\ntitle: Example\n\nSee [[Some Note]].\n```"),
      '<blockquote>\n<p>[!note] Example</p>\n<p>See <a href="/posts/some-note/" class="internal-link">Some Note</a>.</p>\n</blockquote>\n'
    );
  });

  it("uses a wikilink alias as the visible label", () => {
    assert.equal(
      render("```ad-note\nSee [[Some Note|this note]].\n```"),
      '<blockquote>\n<p>[!note] Note</p>\n<p>See <a href="/posts/some-note/" class="internal-link">this note</a>.</p>\n</blockquote>\n'
    );
  });

  it("marks an unresolved wikilink in an admonition body", () => {
    assert.equal(
      render("```ad-note\nSee [[Missing Note]].\n```"),
      '<blockquote>\n<p>[!note] Note</p>\n<p>See <a href="/404" class="internal-link is-unresolved">Missing Note</a>.</p>\n</blockquote>\n'
    );
  });

  it("leaves an ordinary Markdown link unchanged", () => {
    assert.equal(
      render("```ad-note\nSee [Example](example.com).\n```"),
      '<blockquote>\n<p>[!note] Note</p>\n<p>See <a href="example.com">Example</a>.</p>\n</blockquote>\n'
    );
  });

  it("leaves wikilink syntax in inline code unchanged", () => {
    assert.equal(
      render("```ad-note\n`[[Some Note]]`\n```"),
      "<blockquote>\n<p>[!note] Note</p>\n<p><code>[[Some Note]]</code></p>\n</blockquote>\n"
    );
  });
});
