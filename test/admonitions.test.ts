import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markdownToHtml } from "satteri";

import { mkmdastAdmonitionCalloutPlugin } from "../src/plugins/mdast/admonitions.ts";

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
      '<blockquote>\n<p>[!note]</p>\n<p>See <a href="/posts/some-note/" class="internal-link">this note</a>.</p>\n</blockquote>\n'
    );
  });

  it("marks an unresolved wikilink in an admonition body", () => {
    assert.equal(
      render("```ad-note\nSee [[Missing Note]].\n```"),
      '<blockquote>\n<p>[!note]</p>\n<p>See <a href="/404" class="internal-link is-unresolved">Missing Note</a>.</p>\n</blockquote>\n'
    );
  });

  it("leaves an ordinary Markdown link unchanged", () => {
    assert.equal(
      render("```ad-note\nSee [Example](example.com).\n```"),
      '<blockquote>\n<p>[!note]</p>\n<p>See <a href="example.com">Example</a>.</p>\n</blockquote>\n'
    );
  });

  it("leaves wikilink syntax in inline code unchanged", () => {
    assert.equal(
      render("```ad-note\n`[[Some Note]]`\n```"),
      "<blockquote>\n<p>[!note]</p>\n<p><code>[[Some Note]]</code></p>\n</blockquote>\n"
    );
  });
});

describe("nested admonition conversion", () => {
  it("converts an inner ad-aside while preserving ordinary code and surrounding text", () => {
    // Reduced from the Maths post: a five-backtick outer admonition contains
    // ordinary code and a three-backtick aside. No HAST callout plugin runs here.
    const markdown = [
      "`````ad-note",
      "title: Horner's Method",
      "```",
      "Horner(a, x)",
      "  return p",
      "```",
      "",
      "Before.",
      "",
      "```ad-aside",
      "Inner **explanation**.",
      "```",
      "",
      "After.",
      "`````",
    ].join("\n");
    const expected = [
      "> [!note] Horner's Method",
      ">",
      "> ```",
      "> Horner(a, x)",
      ">   return p",
      "> ```",
      ">",
      "> Before.",
      ">",
      "> > [!aside]",
      "> >",
      "> > Inner **explanation**.",
      ">",
      "> After.",
    ].join("\n");
    assert.equal(render(markdown), markdownToHtml(expected).html);
  });

  it("converts three levels of admonitions without mixing their titles or collapse states", () => {
    const markdown = [
      "`````ad-note",
      "title: Outer",
      "collapse: true",
      "Outer before.",
      "",
      "````ad-tip",
      "title: Middle",
      "collapse: false",
      "Middle before.",
      "",
      "```ad-warning",
      "title: Inner",
      "collapse: true",
      "Inside.",
      "```",
      "",
      "Middle after.",
      "````",
      "",
      "Outer after.",
      "`````",
    ].join("\n");
    const expected = [
      "> [!note]- Outer",
      ">",
      "> Outer before.",
      ">",
      "> > [!tip] Middle",
      "> >",
      "> > Middle before.",
      "> >",
      "> > > [!warning]- Inner",
      "> > >",
      "> > > Inside.",
      "> >",
      "> > Middle after.",
      ">",
      "> Outer after.",
    ].join("\n");
    assert.equal(render(markdown), markdownToHtml(expected).html);
  });

  it("resolves nested wikilinks against the nested source and preserves literal code", () => {
    const markdown = [
      "````ad-note",
      "A longer outer paragraph makes inner source offsets different.",
      "",
      "```ad-aside",
      "See [[Some Note\\|this note]] and [[Missing Note]].",
      "",
      "Keep `[!note] [[Some Note]]` and [Example](example.com).",
      "```",
      "````",
    ].join("\n");
    // Compare with an already-converted nested quote. The existing isolated
    // tests above independently check the actual link URLs and CSS classes.
    const expected = [
      "````ad-note",
      "A longer outer paragraph makes inner source offsets different.",
      "",
      "> [!aside]",
      ">",
      "> See [[Some Note\\|this note]] and [[Missing Note]].",
      ">",
      "> Keep `[!note] [[Some Note]]` and [Example](example.com).",
      "````",
    ].join("\n");
    assert.equal(render(markdown), render(expected));
  });

  it("leaves ad-* examples inside an ordinary code fence literal", () => {
    const markdown = [
      "`````ad-note",
      "````text",
      "```ad-aside",
      "[[Some Note]] is literal here.",
      "```",
      "````",
      "`````",
    ].join("\n");
    const expected = [
      "> [!note]",
      ">",
      "> ````text",
      "> ```ad-aside",
      "> [[Some Note]] is literal here.",
      "> ```",
      "> ````",
    ].join("\n");
    assert.equal(render(markdown), markdownToHtml(expected).html);
  });
});
