/**
 * Run the mobile navigation script in Chrome on NavShell's markup contract:
 * below lg the file tree (`#filetree`) is a popover that the hamburger
 * opens with `popovertarget`. The browser opens and closes it (a tap
 * outside, Escape); the script adds what the browser does not.
 *
 * Why this level: this is popover, focus, and viewport behavior, which
 * needs a browser. The fixture holds only the elements the script touches;
 * the built pages, with and without JavaScript, are covered in
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
  root?.querySelector<HTMLElement>("[popover]")?.hidePopover();
  root?.remove();
});

function mount() {
  root = document.createElement("div");
  root.innerHTML = `
    <nav class="navbar"><button type="button" class="hamburger-btn" aria-label="Toggle navigation" popovertarget="filetree">☰</button></nav>
    <div id="filetree" class="filetree-wrapper" popover="auto">
      <nav class="filetree-sidebar">
        <a href="/">Thunks &amp; Thoughts</a>
        <button type="button" class="search-button">Search</button>
      </nav>
    </div>`;
  document.body.append(root);
  initializeMobileNavigation();
  return {
    hamburger: root.querySelector<HTMLButtonElement>(".hamburger-btn")!,
    tree: root.querySelector<HTMLElement>("#filetree")!,
  };
}

const isOpen = (tree: HTMLElement) => tree.matches(":popover-open");

// Why: the tree opens over the page, so keyboard users land in it (live
// left focus on the hamburger, behind the dimmed page's links). The
// browser does not move focus into a popover by itself.
it("moves focus into the tree when it opens", async () => {
  const { hamburger, tree } = mount();
  await userEvent.click(hamburger);
  expect(isOpen(tree)).toBe(true);
  await expect.poll(() => document.activeElement).toBe(tree.querySelector("a"));
});

// Why: Escape closes the tree and focus goes back to the hamburger, where
// the reader opened it. The browser does both for a popover; this pins it,
// so a change that breaks the popover (or steals focus) shows up here.
it("closes on Escape and returns focus to the hamburger", async () => {
  const { hamburger, tree } = mount();
  await userEvent.click(hamburger);
  await expect.poll(() => document.activeElement).toBe(tree.querySelector("a"));
  await userEvent.keyboard("{Escape}");
  expect(isOpen(tree)).toBe(false);
  expect(document.activeElement).toBe(hamburger);
});

// Why: from lg up the tree is always shown and the hamburger is hidden. A
// tree left open there stays in the top layer over a dimmed page, so
// widening closes it.
it("closes when the window widens to the desktop layout", async () => {
  const { hamburger, tree } = mount();
  await userEvent.click(hamburger);
  await page.viewport(1200, 800);
  await expect.poll(() => isOpen(tree)).toBe(false);
});

// Why: the initializer runs on every page load and may run again; twice
// must not break opening.
it("is safe to run twice", async () => {
  const { hamburger, tree } = mount();
  initializeMobileNavigation();
  await userEvent.click(hamburger);
  expect(isOpen(tree)).toBe(true);
  await expect.poll(() => document.activeElement).toBe(tree.querySelector("a"));
});

// Why: pages without the navigation (the 404 page) run the same scripts.
it("does nothing on a page without the navigation", () => {
  expect(() => initializeMobileNavigation()).not.toThrow();
});
