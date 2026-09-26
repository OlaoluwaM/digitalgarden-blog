/**
 * Component tests for `NoteHeader.astro`, which renders the note title, tags,
 * and created/updated timestamps that Eleventy's `pageheader.njk` renders
 * today. Home renders no header; that is the page's choice, tested in
 * `test/site-build.test.ts`.
 *
 * Why this level: the component's output is its whole contract, and Astro's
 * Container API renders it in isolation (title, tags, dates) without
 * building the site or needing real content collection entries.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";
import { beforeAll, describe, expect, it } from "vitest";
import NoteHeader from "../../src/components/NoteHeader.astro";
import type { Post } from "../../src/content/posts.ts";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

interface FakePostOptions {
  title?: string;
  tags?: string[];
  published?: string;
  last_updated?: string;
}

// Build a minimal fake `Post`, cast through `unknown` like
// `test/search-index.test.ts` does, since the component only ever reads
// `post.data.rawNoteProps`.
function fakePost({
  title = "Be deliberate",
  tags = ["non-technical", "self-development"],
  published = "2026-03-20T15:42",
  last_updated = "2026-08-12T13:49",
}: FakePostOptions = {}): Post {
  return {
    data: {
      rawNoteProps: { title, tags, published, last_updated },
    },
  } as unknown as Post;
}

async function renderHeader(props: { post: Post }) {
  const html = await container.renderToString(NoteHeader, { props });
  return { html, root: parse(html) };
}

describe("NoteHeader", () => {
  // Why: the note title is the one piece of content every reader needs;
  // pin it to `rawNoteProps.title` so a schema or prop rename is caught here.
  it("renders the note title as the h1", async () => {
    const { root } = await renderHeader({
      post: fakePost({ title: "Be deliberate" }),
    });
    expect(root.querySelector("h1")?.text).toBe("Be deliberate");
  });

  // Why: live tags are `<button onclick="toggleTagSearch(this)">`, which do
  // nothing without JS. We deliberately swap them for plain `<a href>` links
  // to `/?q=<encoded #tag>` so tag search works before the JS search port
  // lands. This pins the href-encoding contract, including a tag with
  // characters (`+`) that `encodeURIComponent` must escape, and that tags
  // render as plain text (not further links) and in frontmatter order.
  it("renders each tag as a link to the encoded tag search query, in order", async () => {
    const { root } = await renderHeader({
      post: fakePost({ tags: ["non-technical", "c++"] }),
    });
    const links = root.querySelectorAll(".header-tags a.tag");
    expect(links.map(a => a.text)).toEqual(["#non-technical", "#c++"]);
    expect(links.map(a => a.getAttribute("href"))).toEqual([
      "/?q=%23non-technical",
      "/?q=%23c%2B%2B",
    ]);
  });

  // Why: the live markup always renders `.header-tags`, even for a note with
  // no tags (an empty div). Dropping it for an empty array would be a subtle
  // layout regression (e.g. gap/margin assumptions in the legacy CSS).
  it("still renders an empty .header-tags div when there are no tags", async () => {
    const { root } = await renderHeader({
      post: fakePost({ tags: [] }),
    });
    const tagsDiv = root.querySelector(".header-tags");
    expect(tagsDiv).not.toBeNull();
    expect(tagsDiv?.querySelectorAll("a.tag")).toHaveLength(0);
  });

  // Why: pins the Created timestamp's formatted text, raw `datetime`
  // attribute, title/aria-label, and icon together, since Eleventy filled
  // these from Luxon in the browser and a build-time miss on any one of
  // them (wrong icon, unformatted text, formatted-instead-of-raw datetime)
  // would only show up as a visual diff against the live site.
  it("renders the Created timestamp with formatted text, raw datetime, and its icon", async () => {
    const { root } = await renderHeader({
      post: fakePost({ published: "2026-03-20T15:42" }),
    });
    const createdDiv = root.querySelector(
      '.timestamps div[title="Created at"]'
    );
    expect(createdDiv?.getAttribute("aria-label")).toBe("Created at");
    expect(
      createdDiv?.querySelector("svg.lucide-calendar-plus")
    ).not.toBeNull();
    const time = createdDiv?.querySelector("time.human-date");
    expect(time?.getAttribute("datetime")).toBe("2026-03-20T15:42");
    expect(time?.text).toBe("Mar 20, 2026");
  });

  // Why: same contract as Created, but for Updated — a copy-paste between
  // the two blocks (wrong field, wrong icon, wrong title) is the likeliest
  // bug, so it needs its own pinned assertions.
  it("renders the Updated timestamp with formatted text, raw datetime, and its icon", async () => {
    const { root } = await renderHeader({
      post: fakePost({ last_updated: "2026-08-12T13:49" }),
    });
    const updatedDiv = root.querySelector(
      '.timestamps div[title="Updated at"]'
    );
    expect(updatedDiv?.getAttribute("aria-label")).toBe("Updated at");
    expect(
      updatedDiv?.querySelector("svg.lucide-calendar-clock")
    ).not.toBeNull();
    const time = updatedDiv?.querySelector("time.human-date");
    expect(time?.getAttribute("datetime")).toBe("2026-08-12T13:49");
    expect(time?.text).toBe("Aug 12, 2026");
  });

  // Why: the live markup has exactly one space between the icon and the
  // time text (`<svg .../> <time ...>`). Both no space and multiple spaces
  // are silent regressions that only a raw-HTML check (not a parsed-DOM
  // text check, which normalizes whitespace) can catch.
  it("keeps a single space between each icon and its time element", async () => {
    const { html } = await renderHeader({ post: fakePost() });
    expect(html).toMatch(/lucide-calendar-plus[^]*?<\/svg> <time\b/);
    expect(html).toMatch(/lucide-calendar-clock[^]*?<\/svg> <time\b/);
  });

  // Why: the h1 must not carry `data-note-icon`, the attribute the live site
  // uses to show a per-note icon — note icons are off in this rewrite, and
  // this guards against it reappearing via a copy-pasted live snippet.
  it("does not render a data-note-icon attribute on the h1", async () => {
    const { root } = await renderHeader({ post: fakePost() });
    expect(root.querySelector("h1")?.getAttribute("data-note-icon")).toBe(
      undefined
    );
  });
});
