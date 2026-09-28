/**
 * Test the real posts helpers with controlled collection entries. Astro supplies
 * astro:content during a build; Node needs a substitute for that virtual module.
 * Only getCollection is mocked. Filtering, sorting, and route checks run normally.
 */
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { before, beforeEach, describe, it, type Mock } from "node:test";

type PostsModule = typeof import("../src/content/posts.ts");
type Post = Parameters<PostsModule["getHomePost"]>[0][number];

let getCollection: Mock<(name: string) => Promise<Post[]>>;
let getPublishedPosts: PostsModule["getPublishedPosts"];
let getHomePost: PostsModule["getHomePost"];
let getPublishedArticles: PostsModule["getPublishedArticles"];
let getRecentArticles: PostsModule["getRecentArticles"];

before(async () => {
  const contentModuleUrl = `data:text/javascript,${encodeURIComponent(`
    import { mock } from 'node:test';
    export const getCollection = mock.fn(async () => []);
  `)}`;
  ({ getCollection } = (await import(contentModuleUrl)) as {
    getCollection: typeof getCollection;
  });

  const contentModuleHook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "astro:content") {
        return { url: contentModuleUrl, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });

  try {
    ({
      getPublishedPosts,
      getHomePost,
      getPublishedArticles,
      getRecentArticles,
    } = await import("../src/content/posts.ts"));
  } finally {
    // Keep this substitution local to the posts module's import.
    contentModuleHook.deregister();
  }
});

interface PostOptions {
  publish?: boolean;
  tags?: string[];
  permalink?: string;
  hide?: boolean;
  published?: string;
  lastUpdated?: string;
}

function post(id: string, options: PostOptions = {}): Post {
  const permalink = options.permalink ?? `/posts/${id}/`;
  return {
    id,
    collection: "posts",
    data: {
      pluginProps: {
        "dg-publish": options.publish ?? true,
        "dg-path": `${id}.md`,
        "dg-permalink": permalink,
        "dg-hide": options.hide ?? false,
        tags: options.tags ?? [],
        permalink,
      },
      rawNoteProps: {
        title: id,
        description: "A test post.",
        tags: [],
        published: options.published ?? "2026-01-01",
        last_updated: options.lastUpdated ?? "2026-01-01",
      },
    },
  };
}

const home = (id = "home") => post(id, { tags: ["gardenEntry"] });
const ids = (posts: Post[]) => posts.map(post => post.id);

beforeEach(() => {
  getCollection.mock.resetCalls();
  getCollection.mock.mockImplementation(async () => []);
});

describe("getPublishedPosts", () => {
  it("requests the posts collection and handles an empty collection", async () => {
    assert.deepEqual(await getPublishedPosts(), []);
    assert.equal(getCollection.mock.callCount(), 1);
    assert.deepEqual(getCollection.mock.calls[0].arguments, ["posts"]);
  });

  it("filters unpublished entries while preserving order and home notes", async () => {
    const posts = [
      post("second"),
      post("draft", { publish: false }),
      home(),
      post("first"),
    ];
    getCollection.mock.mockImplementation(async () => posts);
    assert.deepEqual(ids(await getPublishedPosts()), [
      "second",
      "home",
      "first",
    ]);
  });

  it("returns no entries when all posts are unpublished", async () => {
    getCollection.mock.mockImplementation(async () => [
      post("draft", { publish: false }),
    ]);
    assert.deepEqual(await getPublishedPosts(), []);
  });

  it("retains published posts marked dg-hide", async () => {
    const hidden = post("hidden", { hide: true });
    getCollection.mock.mockImplementation(async () => [hidden]);
    assert.deepEqual(await getPublishedPosts(), [hidden]);
  });

  it("rejects duplicate routes among published posts", async () => {
    getCollection.mock.mockImplementation(async () => [
      post("first", { permalink: "/shared/" }),
      post("second", { permalink: "/shared" }),
    ]);
    await assert.rejects(getPublishedPosts(), error => {
      assert.ok(error instanceof Error);
      for (const detail of ["/shared", "first", "second"]) {
        assert.ok(error.message.includes(detail));
      }
      return true;
    });
  });

  it("filters unpublished duplicates before checking routes", async () => {
    const published = post("published", { permalink: "/shared/" });
    getCollection.mock.mockImplementation(async () => [
      post("draft", { publish: false, permalink: "/shared" }),
      published,
    ]);
    assert.deepEqual(await getPublishedPosts(), [published]);
  });

  it("detects the published home's effective route collision", async () => {
    getCollection.mock.mockImplementation(async () => [
      home(),
      post("article", { permalink: "/" }),
    ]);
    await assert.rejects(getPublishedPosts(), /Duplicate route/);
  });

  it("propagates collection-loading errors", async () => {
    const failure = new Error("Collection could not be loaded");
    getCollection.mock.mockImplementation(async () => {
      throw failure;
    });
    await assert.rejects(getPublishedPosts(), error => error === failure);
  });

  it("preserves the collection and the selected entry objects", async () => {
    const posts = [post("draft", { publish: false }), home(), post("article")];
    const snapshot = structuredClone(posts);
    Object.freeze(posts);
    getCollection.mock.mockImplementation(async () => posts);
    const result = await getPublishedPosts();
    assert.deepEqual(posts, snapshot);
    assert.notEqual(result, posts);
    assert.equal(result[0], posts[1]);
    assert.equal(result[1], posts[2]);
  });
});

describe("getHomePost", () => {
  it("returns the one home among ordinary articles", () => {
    const entry = home();
    assert.equal(getHomePost([post("article"), entry]), entry);
  });

  for (const [name, posts] of [
    ["an empty collection", []],
    ["articles without a home", [post("article")]],
    ["two homes", [home("first"), home("second")]],
    [
      "a similar but nonmatching tag",
      [post("article", { tags: ["not-gardenEntry"] })],
    ],
  ] as [string, Post[]][]) {
    it(`rejects ${name}`, () => {
      assert.throws(() => getHomePost(posts), /gardenEntry/);
    });
  }

  it("reads the top-level tag even when the note has other tags", () => {
    const entry = post("home", { tags: ["topic", "gardenEntry", "another"] });
    assert.equal(getHomePost([entry]), entry);
  });

  it("does not treat a raw vault tag as the home marker", () => {
    const entry = post("article");
    entry.data.rawNoteProps.tags = ["gardenEntry"];
    assert.throws(() => getHomePost([entry]), /gardenEntry/);
  });
});

describe("getPublishedArticles", () => {
  it("handles empty and home-only inputs", () => {
    assert.deepEqual(getPublishedArticles([]), []);
    assert.deepEqual(getPublishedArticles([home()]), []);
  });

  it("excludes homes and keeps article order and object identity", () => {
    const first = post("first");
    const second = post("second", { tags: ["not-gardenEntry"] });
    const result = getPublishedArticles([first, home(), second]);
    assert.deepEqual(result, [first, second]);
    assert.equal(result[0], first);
    assert.equal(result[1], second);
  });
});

describe("getRecentArticles", () => {
  it("sorts by publication date, newest first, and defaults to three", () => {
    const posts = [
      post("oldest", { published: "2025-01-01", lastUpdated: "2030-01-01" }),
      post("newest", { published: "2026-03-01" }),
      home(),
      post("third", { published: "2026-01-01" }),
      post("second", { published: "2026-02-01" }),
    ];
    assert.deepEqual(ids(getRecentArticles(posts)), [
      "newest",
      "second",
      "third",
    ]);
  });

  for (const [limit, expected] of [
    [0, []],
    [-1, []],
    [1, ["newer"]],
    [2, ["newer", "older"]],
    [10, ["newer", "older"]],
  ] as [number, string[]][]) {
    it(`handles a limit of ${limit}`, () => {
      const posts = [post("older", { published: "2025-01-01" }), post("newer")];
      assert.deepEqual(ids(getRecentArticles(posts, limit)), expected);
    });
  }

  it("handles empty and home-only inputs", () => {
    assert.deepEqual(getRecentArticles([]), []);
    assert.deepEqual(getRecentArticles([home()]), []);
  });

  it("returns a single dated article", () => {
    const article = post("single");
    assert.deepEqual(getRecentArticles([article]), [article]);
  });

  it("compares timestamps rather than date strings", () => {
    const posts = [
      post("earlier", { published: "2026-01-02T00:30:00+02:00" }),
      post("later", { published: "2026-01-01T23:00:00Z" }),
    ];
    assert.deepEqual(ids(getRecentArticles(posts)), ["later", "earlier"]);
  });

  it("preserves input order for equal publication timestamps", () => {
    assert.deepEqual(ids(getRecentArticles([post("second"), post("first")])), [
      "second",
      "first",
    ]);
  });

  for (const published of ["not-a-date", ""]) {
    for (const singleArticle of [false, true]) {
      it(`rejects ${JSON.stringify(published)} with ${singleArticle ? "one article" : "multiple articles"}`, () => {
        const invalid = post("invalid", { published });
        const posts = singleArticle ? [invalid] : [post("valid"), invalid];
        assert.throws(() => getRecentArticles(posts), /Invalid date/);
      });
    }
  }

  it("ignores the excluded home's publication date", () => {
    const entry = post("home", {
      tags: ["gardenEntry"],
      published: "not-a-date",
    });
    assert.deepEqual(
      ids(getRecentArticles([entry, post("first"), post("second")])),
      ["first", "second"]
    );
  });
});

it("selection helpers preserve the input array and post data", () => {
  const posts = [
    post("older", { published: "2025-01-01" }),
    home(),
    post("newer"),
  ];
  const snapshot = structuredClone(posts);
  Object.freeze(posts);
  getHomePost(posts);
  getPublishedArticles(posts);
  const recent = getRecentArticles(posts);
  assert.deepEqual(posts, snapshot);
  assert.equal(recent[0], posts[2]);
});
