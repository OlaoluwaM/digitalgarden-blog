/**
 * Run the mobile navigation script in Chrome on NavShell's markup contract:
 * the hamburger's `aria-expanded` opens the file tree (the stylesheet shows
 * `#filetree` and `.fullpage-overlay` below lg while it is "true").
 *
 * Why this level: this is click, key, focus, and viewport handling, which
 * needs a browser. The fixture holds only the elements the script touches;
 * whether the tree actually shows is CSS, covered on the built site in
 * test/layout/site-layout.test.ts.
 */
import { afterEach, beforeEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { initializeMobileNavigation } from "../../src/scripts/mobileNavigation.ts";

let root: HTMLElement;

beforeEach(async () => {
  await page.viewport(390, 844);
});

afterEach(() => {
  root?.remove();
});

function mount() {
  root = document.createElement("div");
  root.innerHTML = `
    <nav class="navbar"><button type="button" class="hamburger-btn" aria-label="Toggle navigation" aria-expanded="false" aria-controls="filetree">☰</button></nav>
    <div class="fullpage-overlay" aria-hidden="true" style="width: 100px; height: 100px"></div>
    <div id="filetree" class="filetree-wrapper">
      <nav class="filetree-sidebar">
        <a href="/">Thunks &amp; Thoughts</a>
        <button type="button" class="search-button">Search</button>
      </nav>
    </div>`;
  document.body.append(root);
  initializeMobileNavigation();
  return {
    hamburger: root.querySelector<HTMLButtonElement>(".hamburger-btn")!,
    overlay: root.querySelector<HTMLElement>(".fullpage-overlay")!,
    tree: root.querySelector<HTMLElement>("#filetree")!,
  };
}

const expanded = (hamburger: HTMLElement) =>
  hamburger.getAttribute("aria-expanded");

// Why: the hamburger is the only way to reach the file tree on phones and
// tablets. Its `aria-expanded` is the tree's state, for the stylesheet and
// for screen readers alike.
it("opens and closes the file tree from the hamburger", async () => {
  const { hamburger } = mount();
  await userEvent.click(hamburger);
  expect(expanded(hamburger)).toBe("true");
  await userEvent.click(hamburger);
  expect(expanded(hamburger)).toBe("false");
});

// Why: the tree opens over the page, so keyboard users land in it (live
// left focus on the hamburger, behind the dimmed page's links).
it("moves focus into the tree when it opens", async () => {
  const { hamburger, tree } = mount();
  await userEvent.click(hamburger);
  expect(document.activeElement).toBe(tree.querySelector("a"));
});

// Why: the overlay covers the page beside the open tree; tapping it closes
// the tree, as on live.
it("closes when the overlay is tapped", async () => {
  const { hamburger, overlay } = mount();
  await userEvent.click(hamburger);
  await userEvent.click(overlay);
  expect(expanded(hamburger)).toBe("false");
});

// Why: Escape closes the tree from the keyboard and returns focus to the
// hamburger, where the reader opened it. Escape pressed elsewhere (in the
// search dialog, opened from the tree) belongs to that element.
it("closes on Escape and returns focus to the hamburger", async () => {
  const { hamburger } = mount();
  await userEvent.click(hamburger);
  await userEvent.keyboard("{Escape}");
  expect(expanded(hamburger)).toBe("false");
  expect(document.activeElement).toBe(hamburger);

  await userEvent.click(hamburger);
  const elsewhere = document.createElement("input");
  document.body.append(elsewhere);
  elsewhere.focus();
  await userEvent.keyboard("{Escape}");
  expect(expanded(hamburger)).toBe("true");
  elsewhere.remove();
});

// Why: from lg up the tree is always shown and the hamburger is hidden.
// A tree left open there would open again by itself when the window
// narrows, so widening closes it.
it("closes when the window widens to the desktop layout", async () => {
  const { hamburger } = mount();
  await userEvent.click(hamburger);
  await page.viewport(1200, 800);
  await expect.poll(() => expanded(hamburger)).toBe("false");
});

// Why: the initializer runs on every page load and may run again; twice
// must not toggle twice per click.
it("is safe to run twice", async () => {
  const { hamburger } = mount();
  initializeMobileNavigation();
  await userEvent.click(hamburger);
  expect(expanded(hamburger)).toBe("true");
});

// Why: pages without the navigation (the 404 page) run the same scripts.
it("does nothing on a page without the navigation", () => {
  expect(() => initializeMobileNavigation()).not.toThrow();
});
