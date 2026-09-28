/**
 * Unit tests for `buildFileTree`, the sidebar/mobile file-tree builder. This
 * ports the sort rules from Eleventy's `src/helpers/filetreeUtils.js`
 * (`sortTree`, ~lines 33-80: folders before files, notes by created date
 * newest first, natural-name fallback; `pinned` is unused there and here).
 *
 * Why this level: the tree shape and ordering are pure data transforms with
 * no Astro or DOM involved, so a plain `node --test` unit test is the
 * cheapest level that can pin the exact structure `SiteNavigation` renders.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFileTree, type FileTreeNode } from "../src/content/file-tree.ts";

type Posts = Parameters<typeof buildFileTree>[0];

interface PostOptions {
  dgPath: string;
  title?: string;
  permalink?: string;
  published?: string;
  topLevelTags?: string[];
}

function post({
  dgPath,
  title = dgPath.split("/").pop()!.replace(/\.md$/, ""),
  permalink = "/posts/" + title.toLowerCase().replace(/\s+/g, "-") + "/",
  published = "2026-01-01T00:00",
  topLevelTags = [],
}: PostOptions) {
  return {
    data: {
      pluginProps: {
        "dg-path": dgPath,
        permalink,
        tags: topLevelTags,
      },
      rawNoteProps: {
        title,
        published,
      },
    },
  };
}

const tree = (...posts: ReturnType<typeof post>[]) =>
  buildFileTree(posts as unknown as Posts);

// A folder node is expected wherever a test needs to assert on its children;
// this narrows without repeating the same `if` guard in every test.
function folder(node: FileTreeNode) {
  assert.equal(node.type, "folder");
  return node;
}

function file(node: FileTreeNode) {
  assert.equal(node.type, "file");
  return node;
}

describe("folder grouping", () => {
  // Why: the live site's actual folder name is " Posts" (a leading space,
  // baked into every post's real `dg-path`). If the builder trimmed or
  // otherwise normalized it, the folder name shown in the sidebar would
  // silently drift from what's on disk.
  it("groups posts sharing a dg-path prefix into one folder, preserving a leading space", () => {
    const result = tree(
      post({ dgPath: " Posts/Be deliberate.md" }),
      post({ dgPath: " Posts/On maths and engineering.md" })
    );

    assert.equal(result.length, 1);
    const posts = folder(result[0]!);
    assert.equal(posts.name, " Posts");
    assert.equal(posts.children.length, 2);
  });

  // Why: Eleventy's tree supports arbitrary nesting depth (folders inside
  // folders); the builder must recurse rather than assuming a fixed depth
  // of two, even though today's content only goes one folder deep.
  it("recurses into nested folders at any depth", () => {
    const result = tree(post({ dgPath: "A/B/C/Deep.md" }));

    const a = folder(result[0]!);
    assert.equal(a.name, "A");
    const b = folder(a.children[0]!);
    assert.equal(b.name, "B");
    const c = folder(b.children[0]!);
    assert.equal(c.name, "C");
    const leaf = file(c.children[0]!);
    assert.equal(leaf.title, "Deep");
  });
});

describe("root ordering", () => {
  // Why: this is the live shape at thunk.blog: the " Posts" folder renders
  // before the "Home" note even though Home's own `published` date is
  // newer. Folders must beat files regardless of date.
  it("puts folders before files at the same level, even when the file is newer", () => {
    const result = tree(
      post({ dgPath: "Home.md", published: "2099-01-01T00:00" }),
      post({ dgPath: " Posts/Be deliberate.md", published: "2020-01-01T00:00" })
    );

    assert.equal(result[0]!.type, "folder");
    assert.equal(result[1]!.type, "file");
  });
});

describe("file ordering within a folder", () => {
  // Why: this is the primary reading order for the sidebar — readers expect
  // their most recent writing first, matching Eleventy's `created` (here,
  // `published`) descending sort.
  it("sorts files newest published first", () => {
    const result = tree(
      post({ dgPath: "P/Older.md", published: "2024-01-01T00:00" }),
      post({ dgPath: "P/Newest.md", published: "2026-01-01T00:00" }),
      post({ dgPath: "P/Middle.md", published: "2025-01-01T00:00" })
    );

    const children = folder(result[0]!).children.map(n => file(n).title);
    assert.deepEqual(children, ["Newest", "Middle", "Older"]);
  });

  // Why: Eleventy's `defaultCompare` only reaches `naturalCompare` when a
  // date is missing on at least one side (two present, comparable dates are
  // compared directly, even when equal). `naturalCompare` treats embedded
  // numbers as numbers, not characters, so "File 2" sorts before "File 10" —
  // a plain lexicographic fallback would get this backwards.
  it("falls back to a natural (numeric-aware) name compare when dates are missing", () => {
    const result = tree(
      post({ dgPath: "P/File 10.md", published: "" }),
      post({ dgPath: "P/File 2.md", published: "" })
    );

    const children = folder(result[0]!).children.map(n => file(n).title);
    assert.deepEqual(children, ["File 2", "File 10"]);
  });
});

describe("titles and hrefs", () => {
  // Why: the sidebar shows the human title from Obsidian's note properties,
  // not the raw filename, so this must come from `rawNoteProps.title`.
  it("uses rawNoteProps.title as the display name", () => {
    const result = tree(
      post({ dgPath: "P/note.md", title: "A Very Different Title" })
    );
    const leaf = file(folder(result[0]!).children[0]!);
    assert.equal(leaf.title, "A Very Different Title");
  });

  // Why: every other article's link is `pluginProps.permalink`, the
  // digital-garden plugin's processed URL, not the raw `dg-permalink`.
  it("uses pluginProps.permalink as the href for an ordinary post", () => {
    const result = tree(
      post({ dgPath: "P/note.md", permalink: "/posts/note/" })
    );
    const leaf = file(folder(result[0]!).children[0]!);
    assert.equal(leaf.href, "/posts/note/");
  });

  // Why: the garden entry always routes to "/", regardless of its own
  // permalink value or where its dg-path happens to place it in the tree.
  it("routes the garden entry (gardenEntry tag) to / regardless of its permalink", () => {
    const result = tree(
      post({
        dgPath: "Home.md",
        permalink: "/home/",
        topLevelTags: ["gardenEntry"],
      })
    );
    const leaf = file(result[0]!);
    assert.equal(leaf.href, "/");
  });
});

describe("purity", () => {
  // Why: `buildFileTree` is documented as a pure function; nothing about
  // rendering the sidebar should ever be able to corrupt the posts array
  // pages also use to render content and search.
  it("does not mutate the posts array or the post objects it is given", () => {
    const input = [
      post({ dgPath: " Posts/A.md", topLevelTags: ["x"] }),
      post({ dgPath: "Home.md", topLevelTags: ["gardenEntry"] }),
    ];
    const snapshot = structuredClone(input);

    buildFileTree(input as unknown as Posts);

    assert.deepEqual(input, snapshot);
  });
});
