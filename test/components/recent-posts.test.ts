/**
 * Component tests for `RecentPosts.astro`, which renders a list of recent
 * posts with links, descriptions, and formatted dates.
 *
 * Why this level: the component's HTML output is its whole contract. We test
 * structure, CSS classes, content order, conditional rendering, and date
 * formatting, all verifiable by parsing the rendered HTML without building
 * the whole site.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";
import { beforeAll, describe, expect, it } from "vitest";
import RecentPosts from "../../src/components/RecentPosts.astro";
import type { Post } from "../../src/content/posts";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

interface PostOptions {
  title?: string;
  permalink?: string;
  description?: string;
  published?: string;
}

/**
 * Create a fake Post object for testing. Includes the minimal shape that
 * RecentPosts needs: rawNoteProps.title, rawNoteProps.description,
 * rawNoteProps.published, and pluginProps.permalink.
 */
function fakePost({
  title = "Test Post",
  permalink = "/posts/test/",
  description = "A test description",
  published = "2026-05-28T12:19",
}: PostOptions = {}): Post {
  return {
    id: "test.md",
    slug: "test",
    collection: "posts",
    data: {
      pluginProps: {
        "dg-publish": true,
        permalink,
        "dg-path": "test",
        "dg-permalink": permalink,
        tags: [],
      },
      rawNoteProps: {
        title,
        description,
        tags: [],
        published,
        last_updated: "2026-01-01T00:00",
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

async function renderRecentPosts(posts: Post[]) {
  const html = await container.renderToString(RecentPosts, {
    props: { posts },
  });
  return parse(html);
}

describe("RecentPosts", () => {
  // Why: the section wraps the list in a container with a known class so
  // parent layouts can style and position it correctly.
  it("renders a section with class 'recent-notes'", async () => {
    const doc = await renderRecentPosts([fakePost()]);
    const section = doc.querySelector("section.recent-notes");
    expect(section).not.toBeNull();
  });

  // Why: the section title is a level-2 heading on the live site; skipping
  // it would break outline and accessibility.
  it("includes an h2 with text 'Recent Posts'", async () => {
    const doc = await renderRecentPosts([fakePost()]);
    const h2 = doc.querySelector("section.recent-notes h2");
    expect(h2?.text).toBe("Recent Posts");
  });

  // Why: the list markup structure is loaded by the legacy CSS for spacing
  // and list styling; changing from <ul>/<li> to divs would require CSS updates.
  it("wraps posts in an unordered list", async () => {
    const doc = await renderRecentPosts([fakePost()]);
    const ul = doc.querySelector("section.recent-notes ul");
    expect(ul).not.toBeNull();
  });

  // Why: the live site renders one <li> per post; the order must be preserved
  // so recent articles are first. RecentPosts receives them pre-sorted by
  // getRecentArticles() already in descending recency order.
  it("renders one list item per post in order", async () => {
    const posts = [
      fakePost({ title: "First", published: "2026-05-30" }),
      fakePost({ title: "Second", published: "2026-05-28" }),
      fakePost({ title: "Third", published: "2026-05-25" }),
    ];
    const doc = await renderRecentPosts(posts);
    const items = doc.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[0]?.text).toContain("First");
    expect(items[1]?.text).toContain("Second");
    expect(items[2]?.text).toContain("Third");
  });

  // Why: post links must carry the internal-link class so the legacy CSS
  // applies wiki-link styling (color, icons, hover state).
  it("links each post with class 'internal-link'", async () => {
    const doc = await renderRecentPosts([
      fakePost({ title: "Test", permalink: "/posts/test/" }),
    ]);
    const link = doc.querySelector("a.internal-link");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/posts/test/");
  });

  // Why: the link text is the post's title from rawNoteProps. This matches
  // the live behavior.
  it("uses the post title as link text", async () => {
    const doc = await renderRecentPosts([
      fakePost({ title: "Implementing Redis INFO in Haskell" }),
    ]);
    const link = doc.querySelector("a");
    expect(link?.text).toBe("Implementing Redis INFO in Haskell");
  });

  // Why: descriptions are optional; if missing, the <p> should not be
  // rendered. This allows posts without a description field to render
  // cleanly without empty paragraphs.
  it("omits the description paragraph when description is empty", async () => {
    const doc = await renderRecentPosts([fakePost({ description: "" })]);
    const para = doc.querySelector("li p");
    expect(para).toBeNull();
  });

  // Why: the teaser must follow the same rule as the meta description. A
  // post published with the vault placeholder ("PLACEHOLDER: reword me")
  // must not show it on Home, even though its own page correctly omits it.
  it("omits placeholder and blank descriptions", async () => {
    const doc = await renderRecentPosts([
      fakePost({ description: "PLACEHOLDER: reword me" }),
      fakePost({ description: "   " }),
    ]);
    expect(doc.querySelector("li p")).toBeNull();
  });

  // Why: when a description exists, it appears in a <p> tag after the link.
  // This matches the live markup.
  it("renders the description in a <p> when non-empty", async () => {
    const doc = await renderRecentPosts([
      fakePost({ description: "You're INFO a treat" }),
    ]);
    const para = doc.querySelector("li p");
    expect(para?.text).toBe("You're INFO a treat");
  });

  // Why: the live site formats the date "May 28, 2026" from the ISO date
  // string "2026-05-28T12:19". The formatNoteDate function handles this
  // conversion. The formatted text appears in the element.
  it("formats and displays the published date", async () => {
    const doc = await renderRecentPosts([
      fakePost({ published: "2026-05-28T12:19:00" }),
    ]);
    const time = doc.querySelector("time");
    expect(time?.text).toBe("May 28, 2026");
  });

  // Why: the datetime attribute holds the raw published string for
  // accessibility and semantic HTML; it allows readers and assistive
  // technology to understand the exact timestamp. This matches the task spec.
  it("sets the datetime attribute to the raw published string", async () => {
    const doc = await renderRecentPosts([
      fakePost({ published: "2026-05-28T12:19:00" }),
    ]);
    const time = doc.querySelector("time");
    expect(time?.getAttribute("datetime")).toBe("2026-05-28T12:19:00");
  });

  // Why: the legacy CSS positions and styles the date through the
  // recent-note-date class. The human-date class is legacy markup that the
  // CSS also references.
  it("adds classes 'human-date' and 'recent-note-date' to the time element", async () => {
    const doc = await renderRecentPosts([fakePost()]);
    const time = doc.querySelector("time");
    expect(time?.classList.contains("human-date")).toBe(true);
    expect(time?.classList.contains("recent-note-date")).toBe(true);
  });

  // Why: when the posts array is empty, rendering nothing prevents an empty
  // section from appearing in the layout. This is cleaner than rendering a
  // section with no posts inside.
  it("renders nothing when posts is empty", async () => {
    const html = await container.renderToString(RecentPosts, {
      props: { posts: [] },
    });
    expect(html.trim()).toBe("");
  });

  // Why: a post without a description and others with descriptions must all
  // render correctly in the same list. This tests the conditional rendering
  // in context.
  it("mixes posts with and without descriptions", async () => {
    const posts = [
      fakePost({
        title: "With Description",
        description: "Has a description",
      }),
      fakePost({
        title: "Without Description",
        description: "",
      }),
    ];
    const doc = await renderRecentPosts(posts);
    const items = doc.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]?.querySelector("p")?.text).toBe("Has a description");
    expect(items[1]?.querySelector("p")).toBeNull();
  });
});
