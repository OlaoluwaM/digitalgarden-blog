/**
 * Build search index entries from published posts. Eleventy's index
 * (`src/site/search-index.njk`) is the reference, with agreed changes: no
 * unused `date`, only the note's own tags, and content taken from rendered
 * HTML so callout markers do not leak into search text.
 * Rendered HTML comes from the site's Astro processor where it matters.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateConfig } from "astro/config";
import siteConfig from "../astro.config.ts";
import { buildSearchIndex } from "../src/content/search-index.ts";

const { markdown } = await validateConfig(
  siteConfig,
  fileURLToPath(new URL("../", import.meta.url)),
  "build"
);
const renderer = await markdown.processor.createRenderer(markdown);

async function renderHtml(source: string) {
  return (await renderer.render(source)).code;
}

interface PostOptions {
  id?: string;
  title?: string;
  permalink?: string;
  topLevelTags?: string[];
  tags?: string[];
  html?: string;
  rendered?: boolean;
}

function post({
  id = "post.md",
  title = "A post",
  permalink = "/posts/a-post/",
  topLevelTags = [],
  tags = [],
  html = "<p>Body</p>",
  rendered = true,
}: PostOptions = {}) {
  return {
    id,
    data: {
      pluginProps: {
        "dg-publish": true,
        tags: topLevelTags,
        "dg-path": id,
        permalink,
        "dg-permalink": permalink,
      },
      rawNoteProps: {
        title,
        description: "",
        tags,
        published: "2026-01-01T00:00",
        last_updated: "2026-01-01T00:00",
      },
    },
    ...(rendered ? { rendered: { html } } : {}),
  };
}

type Posts = Parameters<typeof buildSearchIndex>[0];
const index = (...posts: ReturnType<typeof post>[]) =>
  buildSearchIndex(posts as unknown as Posts);

describe("entry shape", () => {
  it("emits title, url, content, and tags only", () => {
    const [entry] = index(post());
    assert.deepEqual(Object.keys(entry!).sort(), [
      "content",
      "tags",
      "title",
      "url",
    ]);
  });

  it("uses the note title property", () => {
    const [entry] = index(post({ title: "Dotfiles Reorg: A Journey" }));
    assert.equal(entry!.title, "Dotfiles Reorg: A Journey");
  });

  it("serializes to JSON without loss", () => {
    const entries = index(post({ title: 'Quotes "and" \\ slashes' }));
    assert.deepEqual(JSON.parse(JSON.stringify(entries)), entries);
  });
});

describe("urls", () => {
  it("uses the processed permalink for articles", () => {
    const [entry] = index(post({ permalink: "/posts/be-deliberate/" }));
    assert.equal(entry!.url, "/posts/be-deliberate/");
  });

  it("routes the garden entry to /", () => {
    const [entry] = index(
      post({ permalink: "/home/", topLevelTags: ["gardenEntry"] })
    );
    assert.equal(entry!.url, "/");
  });
});

describe("tags", () => {
  it("uses the note's own tags", () => {
    const [entry] = index(
      post({
        topLevelTags: ["non-technical", "self-development"],
        tags: ["non-technical", "self-development"],
      })
    );
    assert.deepEqual(entry!.tags, ["non-technical", "self-development"]);
  });

  it("does not add Eleventy's note or gardenEntry tags", () => {
    const [home, article] = index(
      post({ id: "Home.md", topLevelTags: ["gardenEntry"], tags: [] }),
      post({ id: "a.md", tags: ["haskell"] })
    );
    assert.deepEqual(home!.tags, []);
    assert.deepEqual(article!.tags, ["haskell"]);
  });
});

describe("content", () => {
  it("strips markup to plain text", () => {
    const [entry] = index(
      post({ html: "<p>Some <strong>bold</strong> and <code>code</code>.</p>" })
    );
    assert.equal(entry!.content, "Some bold and code.");
  });

  it("separates text from adjacent blocks", () => {
    const [entry] = index(
      post({
        html: "<h1>Title</h1><p>First</p><ul><li>one</li><li>two</li></ul>",
      })
    );
    assert.equal(entry!.content, "Title First one two");
  });

  it("decodes character references once", () => {
    const [entry] = index(
      post({ html: "<p>A &amp; B &lt;tag&gt; &quot;q&quot; &amp;amp;</p>" })
    );
    assert.equal(entry!.content, 'A & B <tag> "q" &amp;');
  });

  it("collapses whitespace and trims", () => {
    const [entry] = index(post({ html: "\n<p>  a\n\n  b\t c </p>\n\n" }));
    assert.equal(entry!.content, "a b c");
  });

  it("keeps code block text", async () => {
    const [entry] = index(
      post({ html: await renderHtml('```hs\nmain = putStrLn "hi"\n```') })
    );
    assert.equal(entry!.content, 'main = putStrLn "hi"');
  });

  it("includes callout text without Obsidian markers", async () => {
    const [entry] = index(
      post({ html: await renderHtml("> [!quote] Clear\n> Be deliberate.") })
    );
    assert.doesNotMatch(entry!.content, /\[!/);
    assert.match(entry!.content, /Clear/);
    assert.match(entry!.content, /Be deliberate\./);
  });

  it("includes converted ad-* callout text", async () => {
    const [entry] = index(
      post({
        html: await renderHtml(
          "```ad-note\ntitle: Invariant\nHolds always.\n```"
        ),
      })
    );
    assert.doesNotMatch(entry!.content, /ad-note|title:/);
    assert.match(entry!.content, /Invariant/);
    assert.match(entry!.content, /Holds always\./);
  });

  it("uses resolved wikilink text, not raw wikilink syntax", async () => {
    const [entry] = index(
      post({ html: await renderHtml("See [[Missing note|the missing note]].") })
    );
    assert.equal(entry!.content, "See the missing note.");
  });

  it("fails with the post id when rendered HTML is missing", () => {
    assert.throws(
      () => index(post({ id: "Broken.md", rendered: false })),
      /Broken\.md/
    );
  });
});

describe("collection handling", () => {
  it("keeps one entry per post in input order", () => {
    const entries = index(
      post({ id: "b.md", title: "B", permalink: "/b/" }),
      post({ id: "a.md", title: "A", permalink: "/a/" }),
      post({ id: "c.md", title: "C", permalink: "/c/" })
    );
    assert.deepEqual(
      entries.map(entry => entry.title),
      ["B", "A", "C"]
    );
  });

  it("returns an empty index for no posts", () => {
    assert.deepEqual(index(), []);
  });

  it("does not mutate the posts or share tag arrays with them", () => {
    const input = post({ tags: ["haskell"] });
    const snapshot = structuredClone(input);
    const [entry] = index(input);
    entry!.tags.push("changed");
    assert.deepEqual(input, snapshot);
  });
});
