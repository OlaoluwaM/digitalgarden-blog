/**
 * Unit tests for `buildBacklinks` (src/content/backlinks.ts): which notes
 * count as mentioning a note, and in what order.
 *
 * Why this level: the rules work on each note's rendered HTML and its
 * frontmatter, so plain objects in that shape exercise every rule without
 * building the site. test/layout/backlinks.test.ts checks the list on a
 * built page.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBacklinks } from "../src/content/backlinks.ts";
import type { Post } from "../src/content/posts.ts";

interface NoteOptions {
  html?: string;
  published?: string;
  hide?: boolean;
  home?: boolean;
}

/** A published note in the shape the content collection gives it. */
function note(
  permalink: string,
  {
    html = "<p>Text.</p>",
    published = "2026-01-01T00:00",
    hide,
    home,
  }: NoteOptions = {}
): Post {
  return {
    id: permalink,
    data: {
      pluginProps: {
        permalink,
        tags: home ? ["gardenEntry"] : [],
        ...(hide ? { hide: true } : {}),
      },
      rawNoteProps: { title: permalink, published },
    },
    rendered: { html },
  } as unknown as Post;
}

/** The permalinks of the notes listed as mentioning `permalink`. */
function mentions(posts: Post[], permalink: string): string[] {
  return (buildBacklinks(posts).get(permalink) ?? []).map(
    post => post.data.pluginProps.permalink
  );
}

const TARGET = "/posts/target/";
const link = (href: string) =>
  `<p>See <a href="${href}" class="internal-link">it</a>.</p>`;

describe("buildBacklinks", () => {
  // Why: the core rule. A resolved wikilink or Markdown link to the note,
  // with or without a heading fragment or a trailing slash, is a mention.
  it("counts links to the note's permalink, however they're written", () => {
    const posts = [
      note(TARGET),
      note("/posts/plain/", { html: link("/posts/target/") }),
      note("/posts/heading/", { html: link("/posts/target/#setup") }),
      note("/posts/no-slash/", { html: link("/posts/target") }),
    ];
    assert.deepEqual(mentions(posts, TARGET).toSorted(), [
      "/posts/heading/",
      "/posts/no-slash/",
      "/posts/plain/",
    ]);
  });

  // Why: a note that links twice is still one mention; a list with
  // duplicates would suggest two different notes.
  it("lists a note once, however often it links", () => {
    const posts = [
      note(TARGET),
      note("/posts/twice/", { html: link(TARGET) + link(`${TARGET}#again`) }),
    ];
    assert.deepEqual(mentions(posts, TARGET), ["/posts/twice/"]);
  });

  // Why: only links on the site can point at a note. External links, an
  // unresolved wikilink (`/404`), and a link to a heading on the same page
  // aren't mentions of any note.
  it("ignores external, unresolved, and same-page links", () => {
    const posts = [
      note(TARGET),
      note("/posts/other/", {
        html:
          link("https://example.com/posts/target/") +
          link("/404") +
          link("#setup"),
      }),
    ];
    assert.deepEqual([...buildBacklinks(posts).keys()], []);
  });

  // Why: an embed shows its source note and links to it, so it mentions
  // that note; the embedded text's own links belong to the embedded note,
  // not to the note embedding it.
  it("counts an embed's source, not the links inside the embed", () => {
    const embed =
      '<div class="transclusion internal-embed is-loaded">' +
      `<a class="markdown-embed-link" href="${TARGET}" aria-label="Open Target"></a>` +
      `<div class="markdown-embed">${link("/posts/inner/")}</div></div>`;
    const posts = [
      note(TARGET),
      note("/posts/inner/"),
      note("/posts/embedder/", { html: embed }),
    ];
    assert.deepEqual(mentions(posts, TARGET), ["/posts/embedder/"]);
    assert.deepEqual(mentions(posts, "/posts/inner/"), []);
  });

  // Why: Home links to what it lists, so it would appear under every post;
  // a hidden post (`dg-hide`) should be reachable only by a direct link; a
  // note's link to itself says nothing.
  it("leaves out Home, hidden posts, and the note itself", () => {
    const posts = [
      note(TARGET, { html: link(TARGET) }),
      note("/", { home: true, html: link(TARGET) }),
      note("/posts/hidden/", { hide: true, html: link(TARGET) }),
    ];
    assert.deepEqual(mentions(posts, TARGET), []);
  });

  // Why: the list shows the newest mentions first, as Recent Posts does,
  // and the component shows only the first few before "Show more".
  it("orders mentions newest first", () => {
    const posts = [
      note(TARGET),
      note("/posts/old/", {
        published: "2026-01-01T00:00",
        html: link(TARGET),
      }),
      note("/posts/new/", {
        published: "2026-03-01T00:00",
        html: link(TARGET),
      }),
      note("/posts/mid/", {
        published: "2026-02-01T00:00",
        html: link(TARGET),
      }),
    ];
    assert.deepEqual(mentions(posts, TARGET), [
      "/posts/new/",
      "/posts/mid/",
      "/posts/old/",
    ]);
  });

  // Why: without rendered HTML there is nothing to read links from; failing
  // names the note instead of silently dropping its mentions.
  it("fails on a note without rendered HTML", () => {
    const broken = { ...note("/posts/broken/"), rendered: undefined } as Post;
    assert.throws(() => buildBacklinks([broken]), /\/posts\/broken\//);
  });
});
