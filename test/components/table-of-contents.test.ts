/**
 * Component tests for `TableOfContents.astro`: one list of a note's
 * sections, drawn three ways (designs A, B, and D in
 * https://claude.ai/artifact/GrmM5QYkynByeushqTNvy4). The stylesheet shows
 * one of them per width; test/layout/table-of-contents.test.ts checks that
 * in Chrome.
 *
 * Why this level: the markup is the contract the stylesheet, the script,
 * and assistive technology rely on (landmarks, the popover wiring, links to
 * the heading ids), and the Container API renders it without a build.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse, type HTMLElement } from "node-html-parser";
import { beforeAll, describe, expect, it } from "vitest";
import TableOfContents from "../../src/components/TableOfContents.astro";
import type { ContentsEntry } from "../../src/content/table-of-contents.ts";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

const entries: ContentsEntry[] = [
  { depth: 2, slug: "the-info-command", text: "The INFO command" },
  { depth: 3, slug: "sections-and-fields", text: "Sections & fields" },
  { depth: 2, slug: "whats-next", text: "What's next" },
];

async function render(props: { entries: ContentsEntry[] }) {
  return parse(await container.renderToString(TableOfContents, { props }));
}

const links = (element: HTMLElement | null) =>
  (element?.querySelectorAll("a") ?? []).map(link => ({
    href: link.getAttribute("href"),
    text: link.text.trim(),
    depth: link.getAttribute("data-depth"),
  }));

const expectedLinks = [
  { href: "#the-info-command", text: "The INFO command", depth: "2" },
  { href: "#sections-and-fields", text: "Sections & fields", depth: "3" },
  { href: "#whats-next", text: "What's next", depth: "2" },
];

describe("TableOfContents", () => {
  // Why: the page passes whatever contentsEntries returns; an empty list
  // means the note has too few sections, and nothing may render (no empty
  // landmark, no button that opens nothing).
  it("renders nothing without entries", async () => {
    const root = await render({ entries: [] });
    expect(root.toString().trim()).toBe("");
  });

  // Why: wide screens get a rail beside the note (A). It is a landmark
  // with its own name, so screen reader users can jump to it, and each
  // link targets the id Astro gives its heading.
  it("draws the rail as a navigation landmark of heading links", async () => {
    const root = await render({ entries });
    const rail = root.querySelector(".toc-rail nav");
    expect(rail?.getAttribute("aria-label")).toBe("On this page");
    expect(links(rail)).toEqual(expectedLinks);
  });

  // Why: from 800px to 1399px the list sits under the header (B), closed
  // by default so it doesn't push the note down. A <details> element opens
  // and closes without JavaScript, and its summary counts the sections.
  it("draws the inline box as a closed details element", async () => {
    const root = await render({ entries });
    const details = root.querySelector("details.toc-inline");
    expect(details?.hasAttribute("open")).toBe(false);
    expect(
      details?.querySelector("summary")?.text.replace(/\s+/g, " ").trim()
    ).toBe("Contents · 3 sections");
    expect(details?.querySelector("nav")?.getAttribute("aria-label")).toBe(
      "Contents"
    );
    expect(links(details?.querySelector("nav") ?? null)).toEqual(expectedLinks);
  });

  // Why: phones get a Contents button that opens a sheet (D). The button
  // opens the popover through `popovertarget`, so it works without
  // JavaScript, and the sheet's close button names what it closes.
  it("draws the phone button and the sheet it opens", async () => {
    const root = await render({ entries });
    const button = root.querySelector("button.toc-button");
    const sheet = root.querySelector(".toc-sheet");
    expect(button?.getAttribute("type")).toBe("button");
    expect(button?.text.trim()).toBe("Contents");
    expect(sheet?.getAttribute("popover")).toBe("auto");
    expect(button?.getAttribute("popovertarget")).toBe(sheet?.id);
    const close = sheet?.querySelector("button");
    expect(close?.getAttribute("popovertarget")).toBe(sheet?.id);
    expect(close?.getAttribute("popovertargetaction")).toBe("hide");
    expect(close?.getAttribute("aria-label")).toBe("Close contents");
    expect(sheet?.querySelector("nav")?.getAttribute("aria-label")).toBe(
      "On this page"
    );
    expect(links(sheet?.querySelector("nav") ?? null)).toEqual(expectedLinks);
  });

  // Why: printed notes have no use for navigation, as with the site's
  // other chrome.
  it("hides every variant when printing", async () => {
    const root = await render({ entries });
    for (const selector of [
      ".toc-rail",
      "details.toc-inline",
      "button.toc-button",
      ".toc-sheet",
    ]) {
      expect(
        root.querySelector(selector)?.classList.contains("print:hidden"),
        selector
      ).toBe(true);
    }
  });
});
