/**
 * Run the callout toggle initializer in Chrome with real clicks, focus, and
 * key presses. Fixtures copy the callout markup the Astro build emits. These
 * tests check classes and ARIA state; hiding content is the stylesheet's job.
 */
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { initializeCalloutToggles } from "../../src/scripts/callouts.ts";

let root: HTMLElement;

afterEach(() => {
  root?.remove();
});

function callout(
  type: string,
  body: string,
  { collapsed = false, collapsible = true } = {}
) {
  const classes = [
    "callout",
    ...(collapsible ? ["is-collapsible"] : []),
    ...(collapsed ? ["is-collapsed"] : []),
  ].join(" ");
  return `<div class="${classes}" data-callout="${type}"><div class="callout-title"><div class="callout-title-inner"><p class="callout-title-content">${type}</p></div><div class="callout-fold"><i icon-name="chevron-down"></i></div></div><div class="callout-content">${body}</div></div>`;
}

function fixture(html: string) {
  root = document.createElement("main");
  root.innerHTML = html;
  document.body.append(root);
  initializeCalloutToggles();
  const callouts = [...root.querySelectorAll<HTMLElement>(".callout")];
  const titleOf = (element: HTMLElement) =>
    element.querySelector<HTMLElement>(":scope > .callout-title")!;
  return { callouts, titleOf };
}

function expectState(element: HTMLElement, title: HTMLElement, open: boolean) {
  expect(element.classList.contains("is-collapsed")).toBe(!open);
  expect(title.getAttribute("aria-expanded")).toBe(String(open));
  // State belongs on the callout; ARIA belongs on the button-like title.
  expect(title.classList.contains("is-collapsed")).toBe(false);
  expect(element.hasAttribute("aria-expanded")).toBe(false);
}

it("makes an open callout's title a focusable, expanded button", () => {
  const { callouts, titleOf } = fixture(callout("note", "<p>Body</p>"));
  const title = titleOf(callouts[0]!);
  expect(title.getAttribute("tabindex")).toBe("0");
  expect(title.getAttribute("role")).toBe("button");
  expectState(callouts[0]!, title, true);
});

it("marks a callout that starts collapsed as not expanded", () => {
  const { callouts, titleOf } = fixture(
    callout("note", "<p>Body</p>", { collapsed: true })
  );
  expectState(callouts[0]!, titleOf(callouts[0]!), false);
});

it("toggles the callout and title state on click", async () => {
  const { callouts, titleOf } = fixture(callout("note", "<p>Body</p>"));
  const [element] = callouts;
  const title = titleOf(element!);

  await page.elementLocator(title).click();
  expectState(element!, title, false);

  await page.elementLocator(title).click();
  expectState(element!, title, true);
});

it("toggles when clicking inside the title's children", async () => {
  const { callouts, titleOf } = fixture(callout("note", "<p>Body</p>"));
  const [element] = callouts;
  await page
    .elementLocator(element!.querySelector(".callout-title-content")!)
    .click();
  expectState(element!, titleOf(element!), false);
});

it("does not toggle when clicking the content", async () => {
  const { callouts, titleOf } = fixture(callout("note", "<p>Body</p>"));
  const [element] = callouts;
  await page
    .elementLocator(element!.querySelector(".callout-content p")!)
    .click();
  expectState(element!, titleOf(element!), true);
});

for (const [name, key] of [
  ["Enter", "{Enter}"],
  ["Space", " "],
] as const) {
  it(`toggles with ${name} when the title has focus`, async () => {
    const { callouts, titleOf } = fixture(callout("note", "<p>Body</p>"));
    const [element] = callouts;
    const title = titleOf(element!);

    title.focus();
    await userEvent.keyboard(key);
    expectState(element!, title, false);

    await userEvent.keyboard(key);
    expectState(element!, title, true);
  });
}

it("prevents the default action only for Enter and Space", () => {
  const { callouts, titleOf } = fixture(callout("note", "<p>Body</p>"));
  const title = titleOf(callouts[0]!);
  const press = (key: string) => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    title.dispatchEvent(event);
    return event.defaultPrevented;
  };

  expect(press("Enter")).toBe(true);
  expect(press(" ")).toBe(true);
  expect(press("a")).toBe(false);
  expect(press("Tab")).toBe(false);
});

it("ignores other keys", async () => {
  const { callouts, titleOf } = fixture(callout("note", "<p>Body</p>"));
  const [element] = callouts;
  const title = titleOf(element!);

  title.focus();
  await userEvent.keyboard("a");
  await userEvent.keyboard("{Escape}");
  expectState(element!, title, true);
});

it("toggles nested callouts independently", async () => {
  const { callouts, titleOf } = fixture(
    callout("note", `<p>Outer</p>${callout("aside", "<p>Inner</p>")}`)
  );
  const [outer, inner] = callouts;

  await page.elementLocator(titleOf(inner!)).click();
  expectState(inner!, titleOf(inner!), false);
  expectState(outer!, titleOf(outer!), true);

  await page.elementLocator(titleOf(outer!)).click();
  expectState(outer!, titleOf(outer!), false);
  expectState(inner!, titleOf(inner!), false);
});

it("leaves callouts without is-collapsible untouched", async () => {
  const { callouts, titleOf } = fixture(
    callout("note", "<p>Body</p>", { collapsible: false })
  );
  const [element] = callouts;
  const title = titleOf(element!);

  expect(title.hasAttribute("role")).toBe(false);
  expect(title.hasAttribute("tabindex")).toBe(false);
  expect(title.hasAttribute("aria-expanded")).toBe(false);

  await page.elementLocator(title).click();
  expect(element!.classList.contains("is-collapsed")).toBe(false);
});

it("skips a collapsible callout without a direct title", () => {
  root = document.createElement("main");
  root.innerHTML =
    '<div class="callout is-collapsible"><div class="callout-content"><p>Body</p></div></div>';
  document.body.append(root);
  expect(() => initializeCalloutToggles()).not.toThrow();
});

it("adds listeners once when initialized repeatedly", async () => {
  const { callouts, titleOf } = fixture(callout("note", "<p>Body</p>"));
  const [element] = callouts;
  const title = titleOf(element!);
  // One more run (two in total): duplicate listeners would toggle twice,
  // cancelling out, so a single toggle proves there is one listener.
  initializeCalloutToggles();

  await page.elementLocator(title).click();
  expectState(element!, title, false);

  title.focus();
  await userEvent.keyboard("{Enter}");
  expectState(element!, title, true);
});
