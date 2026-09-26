/**
 * Check, in Chrome, the behavior that the content stylesheets own: a
 * collapsed callout hides its body, and a code block's copy button stays
 * hidden until the block is hovered or holds focus.
 *
 * Why this level: the toggle and copy scripts only change classes and add
 * the button (test/browser/callouts.test.ts, copyCode.test.ts); whether
 * anything is hidden or shown is decided by CSS. These tests load the real
 * stylesheets (without the legacy layer) on fixture markup copied from the
 * build, so they fail if the rules stop hiding or revealing content, not
 * just if a class name changes. A separate file keeps the stylesheets away
 * from the script tests, which click buttons the CSS would hide.
 */
import "../../src/styles/content/callouts.css";
import "../../src/styles/content/code.css";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { initializeCalloutToggles } from "../../src/scripts/callouts.ts";
import { initializeCopyButtons } from "../../src/scripts/copyCode.ts";

let root: HTMLElement;

afterEach(() => {
  root?.remove();
});

function mount(html: string) {
  root = document.createElement("main");
  // The content rules are scoped to rendered Markdown (the site's <body>).
  root.className = "markdown-rendered";
  root.innerHTML = html;
  document.body.append(root);
}

const svg = (name: string) =>
  `<svg class="lucide lucide-${name}" data-lucide="${name}" aria-hidden="true"><path d="M0 0"></path></svg>`;

function callout(type: string, body: string) {
  return `<div class="callout is-collapsible" data-callout="${type}"><div class="callout-title"><div class="callout-icon">${svg("pencil")}</div><div class="callout-title-inner">${type}</div><div class="callout-fold">${svg("chevron-down")}</div></div><div class="callout-content">${body}</div></div>`;
}

const display = (element: Element) => getComputedStyle(element).display;

// Why: collapsing is the whole point of the fold control, and since the
// script only toggles `is-collapsed`, only the stylesheet can hide the body.
it("hides a collapsed callout's body and shows it again when expanded", async () => {
  mount(callout("note", "<p>Body</p>"));
  initializeCalloutToggles();
  const title = root.querySelector<HTMLElement>(".callout-title")!;
  const content = root.querySelector(".callout-content")!;
  expect(display(content)).toBe("block");

  await page.elementLocator(title).click();
  expect(display(content)).toBe("none");

  title.focus();
  await userEvent.keyboard("{Enter}");
  expect(display(content)).toBe("block");
});

// Why: the chevron is the only visual cue of the fold state, and nested
// callouts must not follow their parent's state (the rules use child
// combinators for that).
it("turns only the collapsed callout's chevron", async () => {
  mount(callout("aside", `<p>Text</p>${callout("tip", "<p>Nested</p>")}`));
  initializeCalloutToggles();
  const [outer, inner] = root.querySelectorAll<HTMLElement>(".callout");
  const chevron = (element: HTMLElement) =>
    element.querySelector(":scope > .callout-title .callout-fold svg")!;

  await page
    .elementLocator(inner!.querySelector(":scope > .callout-title")!)
    .click();
  await expect
    .poll(() => getComputedStyle(chevron(inner!)).transform)
    .not.toBe("none");
  expect(getComputedStyle(chevron(outer!)).transform).toBe("none");
  expect(display(outer!.querySelector(":scope > .callout-content")!)).toBe(
    "block"
  );
});

function codeBlock() {
  mount(
    '<pre class="astro-code shiki" tabindex="0" data-language="bash"><code class="language-bash"><span class="line" data-line="1"><span>echo hi</span></span></code></pre>'
  );
  initializeCopyButtons();
  const pre = root.querySelector("pre")!;
  const button = root.querySelector<HTMLButtonElement>(".copy-code-btn")!;
  const shown = () =>
    getComputedStyle(button).opacity === "1" &&
    getComputedStyle(button).pointerEvents === "auto";
  const label = () => getComputedStyle(pre, "::before").opacity;
  return { pre, button, shown, label };
}

// Why: the button must not cover code at rest, yet mouse users need it on
// hover; the language label moves aside so the two never overlap.
it("shows the copy button and hides the language label on hover", async () => {
  const { pre, shown, label } = codeBlock();
  expect(shown()).toBe(false);
  expect(label()).toBe("0.5");

  await userEvent.hover(pre);
  await expect.poll(shown).toBe(true);
  expect(label()).toBe("0");
});

// Why: a hidden button is still in the tab order, so keyboard users must
// see it as soon as focus enters the block, and it must stay usable once
// it has focus itself.
it("shows the copy button to keyboard users and lets Tab reach it", async () => {
  const { pre, button, shown } = codeBlock();
  const before = document.createElement("button");
  before.textContent = "before";
  root.prepend(before);
  before.focus();

  await userEvent.tab();
  expect(document.activeElement).toBe(pre);
  await expect.poll(shown).toBe(true);

  await userEvent.tab();
  expect(document.activeElement).toBe(button);
  await expect.poll(shown).toBe(true);
});
