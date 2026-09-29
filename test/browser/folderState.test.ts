/**
 * Run the folder-state script in Chrome on FileTreeEntry's markup: each
 * folder is a <details> with its path in `data-folder-path`, and its open
 * state is remembered across pages in localStorage.
 *
 * Why this level: <details> toggling and localStorage are browser features.
 * The fixture holds only folders; the built tree's paths are covered by
 * test/components/site-navigation.test.ts.
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { initializeFolderState } from "../../src/scripts/folderState.ts";

let root: HTMLElement;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  root?.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

function mount() {
  root = document.createElement("div");
  root.innerHTML = `
    <details class="folder inner-folder" data-folder-path=" Posts">
      <summary class="foldername-wrapper">Posts</summary>
      <details class="folder inner-folder" data-folder-path=" Posts/Series">
        <summary class="foldername-wrapper">Series</summary>
        <a href="/p1/">Part 1</a>
      </details>
    </details>`;
  document.body.append(root);
  const [posts, series] = root.querySelectorAll<HTMLDetailsElement>("details");
  return { posts: posts!, series: series! };
}

// Why: live (Alpine's `$persist`) kept each folder open or closed across
// pages under `_x_` plus its path, as JSON. Reading the same keys keeps
// returning visitors' folders as they left them after the switch.
it("restores each folder's saved state, as live stored it", () => {
  localStorage.setItem("_x_ Posts/Series", "true");
  localStorage.setItem("_x_ Posts", "false");
  const { posts, series } = mount();
  initializeFolderState();
  expect(posts.open).toBe(false);
  expect(series.open).toBe(true);
});

// Why: without saved state a folder stays closed, live's default.
it("leaves folders closed without saved state", () => {
  localStorage.setItem("_x_ Posts", "not json");
  const { posts, series } = mount();
  initializeFolderState();
  expect([posts.open, series.open]).toEqual([false, false]);
});

// Why: opening or closing a folder is remembered for the next page.
it("saves a folder's state when it is toggled", async () => {
  const { posts } = mount();
  initializeFolderState();
  await userEvent.click(posts.querySelector("summary")!);
  await expect.poll(() => localStorage.getItem("_x_ Posts")).toBe("true");
  await userEvent.click(posts.querySelector("summary")!);
  await expect.poll(() => localStorage.getItem("_x_ Posts")).toBe("false");
});

// Why: storage can be unavailable (blocked site data, some private
// windows) and then throws. Folders must still open and close.
it("keeps working when storage throws", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => errors.push(event.error);
  window.addEventListener("error", onError);
  const { posts } = mount();

  expect(() => initializeFolderState()).not.toThrow();
  await userEvent.click(posts.querySelector("summary")!);
  expect(posts.open).toBe(true);
  await new Promise(done => setTimeout(done, 20));
  window.removeEventListener("error", onError);
  expect(errors).toEqual([]);
});

// Why: the initializer runs on every page load and may run again; twice
// must not restore over a folder the reader has since toggled.
it("is safe to run twice", async () => {
  const { posts } = mount();
  initializeFolderState();
  await userEvent.click(posts.querySelector("summary")!);
  await expect.poll(() => localStorage.getItem("_x_ Posts")).toBe("true");
  localStorage.setItem("_x_ Posts", "false");
  initializeFolderState();
  expect(posts.open).toBe(true);
});
