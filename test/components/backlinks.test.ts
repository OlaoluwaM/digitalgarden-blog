/**
 * Component tests for `Backlinks.astro`, the "Mentioned in" list at the
 * end of a note.
 *
 * Why this level: which notes are listed is decided in
 * src/content/backlinks.ts (test/backlinks.test.ts); this component only
 * lays them out, so Astro's Container API renders it with plain props,
 * without building the site.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";
import { beforeAll, describe, expect, it } from "vitest";
import Backlinks from "../../src/components/Backlinks.astro";
import type { Post } from "../../src/content/posts.ts";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

function post(n: number, description = `Description ${n}.`): Post {
  return {
    id: `note-${n}`,
    data: {
      pluginProps: { permalink: `/posts/note-${n}/` },
      rawNoteProps: { title: `Note ${n}`, description },
    },
  } as unknown as Post;
}

async function render(posts: Post[]) {
  return parse(await container.renderToString(Backlinks, { props: { posts } }));
}

describe("Backlinks", () => {
  // Why: most notes have no backlinks; an empty "Mentioned in" heading
  // would be noise at the end of every one of them.
  it("renders nothing without backlinks", async () => {
    expect((await render([])).toString().trim()).toBe("");
  });

  // Why: the heading is a real h2, so screen-reader users can jump to the
  // list, and it names the section it heads.
  it("heads the list with a named h2", async () => {
    const html = await render([post(1)]);
    const section = html.querySelector("section.backlinks");
    const heading = html.querySelector("h2#backlinks-heading");
    expect(heading?.text.trim()).toBe("Mentioned in");
    expect(section?.getAttribute("aria-labelledby")).toBe("backlinks-heading");
  });

  // Why: each entry is what a reader needs to decide whether to follow it:
  // the note's title as a link, then its description. A vault placeholder
  // description is left out, as it is in Recent Posts.
  it("lists each note's title and description", async () => {
    const html = await render([post(1), post(2, "PLACEHOLDER: reword me")]);
    const items = html.querySelectorAll("li");
    expect(
      items.map(item => ({
        href: item.querySelector("a")?.getAttribute("href"),
        title: item.querySelector("a")?.text.trim(),
        description: item.querySelector("p")?.text.trim(),
      }))
    ).toEqual([
      {
        href: "/posts/note-1/",
        title: "Note 1",
        description: "Description 1.",
      },
      { href: "/posts/note-2/", title: "Note 2", description: undefined },
    ]);
    expect(html.querySelector("details")).toBeNull();
  });

  // Why: a much-linked note shouldn't end in a wall of links. The first
  // three show; the rest wait behind a native disclosure that works
  // without JavaScript.
  it("shows three and puts the rest behind Show more", async () => {
    const html = await render([1, 2, 3, 4, 5].map(n => post(n)));
    const shown = html.querySelectorAll("section.backlinks > ul > li");
    expect(shown.map(item => item.querySelector("a")?.text.trim())).toEqual([
      "Note 1",
      "Note 2",
      "Note 3",
    ]);
    const details = html.querySelector("details");
    expect(details?.querySelector("summary")?.text).toContain("Show 2 more");
    expect(
      details
        ?.querySelectorAll("li")
        .map(item => item.querySelector("a")?.text.trim())
    ).toEqual(["Note 4", "Note 5"]);
  });
});
