import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertUniquePermalinks,
  permalinkSchema,
  type PostWithPermalink,
} from "../src/content/permalinks.ts";

describe("permalinkSchema", () => {
  for (const permalink of [
    "/",
    "/home/",
    "/posts/example/",
    "/posts/part-2/",
    "/posts/2026/first-post/",
    "/posts/café/",
    "/posts/example.html/",
    "/posts/version-2.0/",
    "/home",
    "/posts/example",
    "/posts/café",
    "/posts/version-2.0",
  ]) {
    it(`accepts ${JSON.stringify(permalink)} unchanged`, () => {
      assert.equal(permalinkSchema.parse(permalink), permalink);
    });
  }

  for (const permalink of [
    "",
    "posts/example/",
    "https://thunk.blog/posts/example/",
    "//thunk.blog/",
    "//",
    "/posts//example/",
    "/posts/example//",
    "/posts/example/?preview=true",
    "/posts/example/#section",
    " /posts/example/",
    "/posts/example/ ",
    "/posts/my note/",
    "/posts/example/\n",
    "/Posts/Example/",
    "/posts/cafÉ/",
    "/posts/my_note/",
    "/posts/./example/",
    "/posts/../example/",
    "/posts/.",
    "/posts/..",
    "/posts/my%20note/",
    "/posts\\example/",
  ]) {
    it(`rejects ${JSON.stringify(permalink)}`, () => {
      assert.equal(permalinkSchema.safeParse(permalink).success, false);
    });
  }

  for (const value of [undefined, null, 42, true, [], {}]) {
    it(`rejects non-string input ${JSON.stringify(value)}`, () => {
      assert.equal(permalinkSchema.safeParse(value).success, false);
    });
  }
});

function post(
  id: string,
  permalink: string,
  tags: string[] = []
): PostWithPermalink {
  return { id, data: { pluginProps: { permalink, tags } } };
}

function expectCollision(
  posts: PostWithPermalink[],
  route: string,
  firstId: string,
  secondId: string
): void {
  assert.throws(
    () => assertUniquePermalinks(posts),
    error => {
      assert.ok(error instanceof Error);
      for (const detail of [route, firstId, secondId]) {
        assert.ok(
          error.message.includes(detail),
          `Expected the error to identify ${JSON.stringify(detail)}`
        );
      }
      return true;
    }
  );
}

describe("assertUniquePermalinks", () => {
  it("accepts an empty published-post collection", () => {
    assert.doesNotThrow(() => assertUniquePermalinks([]));
  });

  it("accepts distinct routes, including a home note", () => {
    assert.doesNotThrow(() =>
      assertUniquePermalinks([
        post("Home", "/home/", ["gardenEntry"]),
        post("First", "/posts/first"),
        post("Second", "/posts/second/"),
      ])
    );
  });

  it("rejects a shared article route and identifies both notes", () => {
    expectCollision(
      [post("First", "/posts/shared/"), post("Second", "/posts/shared/")],
      "/posts/shared",
      "First",
      "Second"
    );
  });

  it("detects duplicates separated by other posts", () => {
    expectCollision(
      [
        post("First", "/posts/shared/"),
        post("Unrelated", "/posts/unrelated/"),
        post("Last", "/posts/shared/"),
      ],
      "/posts/shared",
      "First",
      "Last"
    );
  });

  it("reports every conflicting route and all involved post IDs", () => {
    const posts = [
      post("Alpha", "/posts/first/"),
      post("Delta", "/posts/second/"),
      post("Beta", "/posts/first"),
      post("Epsilon", "/posts/second"),
      post("Gamma", "/posts/first/"),
    ];

    assert.throws(
      () => assertUniquePermalinks(posts),
      error => {
        assert.ok(error instanceof Error);
        for (const detail of [
          "/posts/first",
          "/posts/second",
          "Alpha",
          "Beta",
          "Gamma",
          "Delta",
          "Epsilon",
        ]) {
          assert.ok(
            error.message.includes(detail),
            `Expected the error to identify ${JSON.stringify(detail)}`
          );
        }
        return true;
      }
    );
  });

  for (const slashFirst of [true, false]) {
    it(`rejects trailing-slash variants with the slash ${slashFirst ? "first" : "last"}`, () => {
      const withSlash = post("With Slash", "/posts/shared/");
      const withoutSlash = post("Without Slash", "/posts/shared");
      expectCollision(
        slashFirst ? [withSlash, withoutSlash] : [withoutSlash, withSlash],
        "/posts/shared",
        "With Slash",
        "Without Slash"
      );
    });
  }

  for (const homeFirst of [true, false]) {
    it(`rejects an article claiming / with home ${homeFirst ? "first" : "last"}`, () => {
      const home = post("Home", "/home/", ["other-tag", "gardenEntry"]);
      const article = post("Article", "/");
      expectCollision(
        homeFirst ? [home, article] : [article, home],
        "/",
        "Home",
        "Article"
      );
    });
  }

  it("rejects two home notes with different stored permalinks", () => {
    expectCollision(
      [
        post("First Home", "/home/", ["gardenEntry"]),
        post("Second Home", "/welcome/", ["gardenEntry"]),
      ],
      "/",
      "First Home",
      "Second Home"
    );
  });

  it("allows an article at the home note's unused stored permalink", () => {
    assert.doesNotThrow(() =>
      assertUniquePermalinks([
        post("Home", "/home/", ["gardenEntry"]),
        post("Article", "/home/"),
      ])
    );
  });

  it("matches the gardenEntry tag exactly", () => {
    assert.doesNotThrow(() =>
      assertUniquePermalinks([
        post("Home", "/home/", ["gardenEntry"]),
        post("Article", "/posts/article/", ["not-gardenEntry"]),
      ])
    );
  });

  it("preserves the input array and post data", () => {
    const posts = [
      post("Second", "/posts/second"),
      post("Home", "/home/", ["gardenEntry"]),
      post("First", "/posts/first/"),
    ];
    const original = structuredClone(posts);
    assertUniquePermalinks(Object.freeze(posts));
    assert.deepEqual(posts, original);
  });
});
