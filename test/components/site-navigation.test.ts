/**
 * Component tests for the site navigation (T3) — the desktop sidebar,
 * mobile navbar, and file tree, rebuilt without Alpine.js per the live
 * markup recorded from https://thunk.blog.
 *
 * These render `NavShell.astro` (the presentational half of
 * `SiteNavigation.astro`) with a hand-built `tree` fixture, not
 * `SiteNavigation.astro` itself. `SiteNavigation` calls `getPublishedPosts()`
 * (`astro:content`), and this project's Container API + `vitest.astro.config.mts`
 * setup cannot resolve that: `getCollection("posts")` reports the collection
 * as empty even immediately after a real `astro build` populated it in the
 * same worktree. Since every other component test here (`icon.test.ts`) and
 * every existing content test (`posts.test.ts`, `search-index.test.ts`)
 * either avoids `astro:content` entirely or substitutes it, this is that
 * same pattern: test the markup deterministically against a fixture, and
 * leave the real `getPublishedPosts()` + `buildFileTree()` wiring to
 * `npm run build:astro` (confirmed to render all 14 live posts correctly)
 * and to `test/file-tree.test.ts` (the tree builder's own unit tests).
 *
 * Why this level: the markup (classes, nesting, which note is marked
 * active) is what `src/styles/components/navigation.css`, the layout tests,
 * and the upcoming mobile-navigation script select against. Visual parity
 * (sidebar width, colors, the 1000px breakpoint) is checked separately with
 * a real browser, not here.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse, type HTMLElement } from "node-html-parser";
import { beforeAll, describe, expect, it } from "vitest";
import NavShell from "../../src/components/NavShell.astro";
import type { FileTreeNode } from "../../src/content/file-tree.ts";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

// Mirrors the live site's actual shape: a " Posts" folder (leading space,
// exactly as it is in the real dg-path) holding two notes, plus the garden
// entry ("Home") at the root. `file-tree.test.ts` covers building this
// shape from posts; here it only needs to exist so the markup can be
// checked against it.
const fixtureTree: readonly FileTreeNode[] = [
  {
    type: "folder",
    name: " Posts",
    children: [
      {
        type: "file",
        title: "Implementing Redis INFO in Haskell",
        href: "/posts/implementing-redis-info-in-haskell/",
      },
      {
        type: "file",
        title: "Be deliberate",
        href: "/posts/be-deliberate/",
      },
    ],
  },
  { type: "file", title: "Home", href: "/" },
];

async function renderNav(activePathname: string): Promise<HTMLElement> {
  const html = await container.renderToString(NavShell, {
    props: { tree: fixtureTree, activePathname },
  });
  return parse(html);
}

describe("structure", () => {
  // Why: these are the load-bearing classes and nesting the navigation
  // styles, layout tests, and scripts target. If the shape drifts here,
  // styling or behavior silently breaks.
  it("renders the mobile navbar with a hamburger and site name", async () => {
    const root = await renderNav("/");
    const navbar = root.querySelector(".navbar");
    expect(navbar).not.toBeNull();
    expect(navbar!.querySelector(".navbar-inner")).not.toBeNull();

    const hamburger = navbar!.querySelector("button.hamburger-btn");
    expect(hamburger).not.toBeNull();
    expect(hamburger!.getAttribute("aria-label")).toBe("Toggle navigation");

    const heading = navbar!.querySelector("h1.site-name-header");
    expect(heading?.text).toBe("Thunks & Thoughts");
  });

  it("renders the desktop sidebar with the filetree wrapper and site name", async () => {
    const root = await renderNav("/");
    const wrapper = root.querySelector(".filetree-wrapper");
    expect(wrapper).not.toBeNull();

    const sidebar = wrapper!.querySelector("nav.filetree-sidebar");
    expect(sidebar).not.toBeNull();
    // Eleventy renders the sidebar's <h1> without the navbar's
    // `site-name-header` class; kept for parity with its markup.
    const heading = sidebar!.querySelector(":scope > a > h1");
    expect(heading?.classList.contains("site-name-header")).toBe(false);
    expect(heading?.text).toBe("Thunks & Thoughts");
  });

  // Why: a `.fullpage-overlay` must exist for the later mobile-toggle task
  // to show/hide, even though nothing makes it visible yet.
  it("renders the mobile overlay element", async () => {
    const root = await renderNav("/");
    expect(root.querySelector(".fullpage-overlay")).not.toBeNull();
  });

  // Why: mirrors Eleventy's root `<div class="folder" x-data="{isOpen:
  // true}">` — always open, so it is a plain container with no toggle.
  it("wraps the file tree in a root .folder with no toggle affordance", async () => {
    const root = await renderNav("/");
    const rootFolder = root.querySelector(".filetree-sidebar > .folder");
    expect(rootFolder).not.toBeNull();
    expect(rootFolder!.tagName).toBe("DIV");
  });
});

describe("search buttons", () => {
  // Why: Eleventy used a `div[role=button]` with onclick/onkeydown; a real
  // `<button>` gets focus and keyboard activation for free and needs no
  // hand-rolled keydown handler. Both the navbar and sidebar copies must be
  // real buttons with an accessible name, even while search itself is inert.
  it("renders both search triggers as real buttons with an accessible name", async () => {
    const root = await renderNav("/");
    const buttons = root.querySelectorAll("button.search-button");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("type")).toBe("button");
      expect(button.getAttribute("aria-label")).toBe("Search");
      expect(button.querySelector(".search-icon svg")).not.toBeNull();
      expect(button.querySelector(".search-text")?.text).toBe("Search");
    }
  });
});

describe("folders", () => {
  // Why: the live " Posts" folder starts collapsed until a visitor clicks
  // it (Alpine's `$persist(false)` default). A native <details> without an
  // `open` attribute reproduces that default with no JS at all.
  it("renders folders as closed <details> by default", async () => {
    const root = await renderNav("/");
    const details = root.querySelectorAll("details.folder.inner-folder");
    expect(details.length).toBeGreaterThan(0);
    for (const el of details) {
      expect(el.hasAttribute("open")).toBe(false);
    }
  });

  it("names the folder after its raw dg-path segment, leading space included", async () => {
    const root = await renderNav("/");
    const names = root.querySelectorAll(".foldername").map(el => el.text);
    expect(names).toContain(" Posts");
  });

  // Why: the summary is the clickable disclosure control; it must carry
  // Eleventy's classes so `_navigation.scss` and the base theme's
  // `.foldername-wrapper` rules still apply.
  it("uses a summary with the foldername-wrapper classes as the folder's header", async () => {
    const root = await renderNav("/");
    const summary = root.querySelector("details.folder.inner-folder > summary");
    expect(summary?.classList.contains("foldername-wrapper")).toBe(true);
    expect(summary?.classList.contains("align-icon")).toBe(true);
    expect(summary!.querySelectorAll("svg.lucide-chevron-down")).toHaveLength(
      1
    );
    expect(summary!.querySelectorAll("svg.lucide-chevron-right")).toHaveLength(
      1
    );
  });
});

describe("notes", () => {
  // Why: pins the tree's title/href pass-through so a rendering bug (wrong
  // prop wired up, swapped title/href) is caught here rather than only
  // showing up as a visual glitch later.
  it("links a note by its href and title", async () => {
    const root = await renderNav("/");
    const links = root.querySelectorAll("a.filename");
    const link = links.find(
      a => a.getAttribute("href") === "/posts/be-deliberate/"
    );
    expect(link).toBeDefined();
    expect(link!.text.trim()).toBe("Be deliberate");
    expect(link!.getAttribute("data-note-icon")).toBe("");
  });

  it("links the garden entry (Home) to /", async () => {
    const root = await renderNav("/");
    const links = root.querySelectorAll("a.filename");
    const home = links.find(a => a.text.trim() === "Home");
    expect(home).toBeDefined();
    expect(home!.getAttribute("href")).toBe("/");
  });

  // Why: only the note matching the current page should carry
  // `active-note`; a stale or over-eager match would highlight the wrong
  // (or every) entry.
  it("marks only the current page's note as active", async () => {
    const root = await renderNav("/posts/be-deliberate/");
    const active = root.querySelectorAll(".notelink.active-note");
    expect(active).toHaveLength(1);
    expect(active[0]!.querySelector("a.filename")!.getAttribute("href")).toBe(
      "/posts/be-deliberate/"
    );
  });

  it("marks no note active when the current page matches none of them", async () => {
    const root = await renderNav("/not-a-real-page/");
    expect(root.querySelectorAll(".notelink.active-note")).toHaveLength(0);
  });

  it("marks the home note active on /", async () => {
    const root = await renderNav("/");
    const active = root.querySelectorAll(".notelink.active-note");
    expect(active).toHaveLength(1);
    expect(active[0]!.querySelector("a.filename")!.text.trim()).toBe("Home");
  });
});

describe("no Alpine left behind", () => {
  // Why: the whole point of T3 is to drop Alpine.js; any surviving
  // `x-*`/`@click`/`$persist` binding would be dead weight at best and a
  // console error at worst, since Alpine is not loaded.
  it("contains no Alpine directives or its persist plugin", async () => {
    const html = await container.renderToString(NavShell, {
      props: { tree: fixtureTree, activePathname: "/" },
    });
    expect(html).not.toMatch(/x-data|x-show|x-init|x-on|@click|\$persist/);
  });
});
