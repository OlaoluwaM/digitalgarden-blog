import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markdownToHtml } from "satteri";

import { mkmdastWikilinksPlugin } from "../src/plugins/wikilinks.ts";

const wikilinkIndex = {
  "Some Note": "/posts/some-note/",
  "part 1": "/posts/part-1/",
  "part 2": "/posts/part-2/",
};

const mdastWikilinksPlugin = mkmdastWikilinksPlugin(wikilinkIndex);

const render = (markdown: string) =>
  markdownToHtml(markdown, {
    features: {
      wikilinks: true,
    },
    mdastPlugins: [mdastWikilinksPlugin],
  }).html;

describe("mdastWikilinksPlugin", () => {
  it("transforms a bare wikilink", () => {
    assert.equal(
      render("See [[Polynomials]]."),
      '<p>See <a href="/404" class="internal-link is-unresolved">Polynomials</a>.</p>\n'
    );
  });

  it("uses a wikilink alias as the visible label", () => {
    assert.equal(
      render("See [[Some Note|this note]]."),
      '<p>See <a href="/posts/some-note/" class="internal-link">this note</a>.</p>\n'
    );
  });

  it("supports an escaped alias pipe from the digitalgarden plugin", () => {
    assert.equal(
      render("See [[Some Note\\|this note]]."),
      '<p>See <a href="/posts/some-note/" class="internal-link">this note</a>.</p>\n'
    );
  });

  it("preserves text around multiple wikilinks", () => {
    assert.equal(
      render("See [[part 1|one]] and [[part 2]] first."),
      '<p>See <a href="/posts/part-1/" class="internal-link">one</a> and <a href="/posts/part-2/" class="internal-link">part 2</a> first.</p>\n'
    );
  });

  it("leaves ordinary Markdown links unchanged", () => {
    assert.equal(
      render("[Example](Example) and [external](https://example.com)."),
      '<p><a href="Example">Example</a> and <a href="https://example.com">external</a>.</p>\n'
    );
  });

  it("leaves wikilink syntax in code unchanged", () => {
    assert.equal(render("`[[Example]]`"), "<p><code>[[Example]]</code></p>\n");
    assert.equal(
      render("```text\n[[Example]]\n```"),
      '<pre><code class="language-text">[[Example]]\n</code></pre>\n'
    );
  });
});
