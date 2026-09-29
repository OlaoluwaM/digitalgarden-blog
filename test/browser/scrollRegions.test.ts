/**
 * Run the scroll-region initializer in Chrome on fixture callouts whose
 * content is wider or narrower than its box.
 *
 * Why this level: whether a region overflows depends on real layout
 * (scrollWidth against clientWidth) and on ResizeObserver, which only a
 * browser provides. The fixtures set the widths inline, so the tests do not
 * depend on the site's stylesheets.
 */
import { afterEach, expect, it } from "vitest";
import { initializeScrollRegions } from "../../src/scripts/scrollRegions.ts";

let root: HTMLElement;

afterEach(() => {
  root?.remove();
});

function fixture(contentWidths: number[], title = "Horner's Method") {
  root = document.createElement("main");
  root.innerHTML = contentWidths
    .map(
      width =>
        `<div class="callout"><div class="callout-title"><div class="callout-title-inner">${title}</div></div><div class="callout-content" style="width: 200px; overflow-x: auto"><div style="width: ${width}px; height: 10px"></div></div></div>`
    )
    .join("");
  document.body.append(root);
  return [...root.querySelectorAll<HTMLElement>(".callout-content")];
}

function nextFrames() {
  return new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
}

// Why: a region that scrolls sideways with nothing focusable inside cannot
// be scrolled from the keyboard (WCAG 2.1.1, axe scrollable-region-focusable).
// A tab stop plus a name lets keyboard and screen reader users reach it. The
// name comes from the callout's title, and the role is `group`, not a
// `region` landmark: several callouts can share a title, and landmarks need
// unique names (axe landmark-unique).
it("makes an overflowing region focusable and names it after its callout", () => {
  const [wide] = fixture([500]);
  initializeScrollRegions();
  expect(wide!.getAttribute("tabindex")).toBe("0");
  expect(wide!.getAttribute("role")).toBe("group");
  expect(wide!.getAttribute("aria-label")).toBe("Horner's Method, scrollable");
});

// Why: a callout's title can be empty; the region still needs a name.
it("falls back to a generic name without a title", () => {
  const [wide] = fixture([500], "");
  initializeScrollRegions();
  expect(wide!.getAttribute("aria-label")).toBe("Scrollable content");
});

// Why: a tab stop on a region that does not scroll is noise for keyboard
// users, so only overflowing regions get one.
it("leaves a region that fits alone", () => {
  const [narrow] = fixture([100]);
  initializeScrollRegions();
  expect(narrow!.hasAttribute("tabindex")).toBe(false);
  expect(narrow!.hasAttribute("role")).toBe(false);
  expect(narrow!.hasAttribute("aria-label")).toBe(false);
});

// Why: overflow depends on the viewport, so it changes when the window is
// resized or a phone is rotated; the tab stop must follow.
it("adds and removes the tab stop when the region's size changes", async () => {
  const [region] = fixture([300]);
  region!.style.width = "400px";
  initializeScrollRegions();
  expect(region!.hasAttribute("tabindex")).toBe(false);

  region!.style.width = "200px";
  await nextFrames();
  expect(region!.getAttribute("tabindex")).toBe("0");

  region!.style.width = "400px";
  await nextFrames();
  expect(region!.hasAttribute("tabindex")).toBe(false);
  expect(region!.hasAttribute("role")).toBe(false);
});

// Why: a collapsed callout's content is hidden, and a hidden element must
// not keep a tab stop.
it("removes the tab stop while the region is hidden", async () => {
  const [region] = fixture([500]);
  initializeScrollRegions();
  expect(region!.getAttribute("tabindex")).toBe("0");

  region!.style.display = "none";
  await nextFrames();
  expect(region!.hasAttribute("tabindex")).toBe(false);
});

// Why: the initializer runs on every page load and may run again; running
// it twice must not double the observers or change the result.
it("is safe to run twice", () => {
  const regions = fixture([500, 100]);
  initializeScrollRegions();
  initializeScrollRegions();
  expect(regions.map(region => region.getAttribute("tabindex"))).toEqual([
    "0",
    null,
  ]);
});

function tableFixture(widths: number[], inCallout = false) {
  root = document.createElement("main");
  const wrappers = widths
    .map(
      width =>
        `<div class="table-wrapper" style="width: 200px; overflow-x: auto"><table style="width: ${width}px"><tr><td>Cell</td></tr></table></div>`
    )
    .join("");
  root.innerHTML = inCallout
    ? `<div class="callout"><div class="callout-title"><div class="callout-title-inner">Horner's Method</div></div><div class="callout-content">${wrappers}</div></div>`
    : wrappers;
  document.body.append(root);
  return [...root.querySelectorAll<HTMLElement>(".table-wrapper")];
}

// Why: a table wider than the note column scrolls inside its wrapper, and
// keyboard users need the same tab stop to scroll it. It is named as a
// table, even inside a callout, because the table is what scrolls.
it("makes an overflowing table wrapper focusable and names it as a table", () => {
  for (const inCallout of [false, true]) {
    const [wide, narrow] = tableFixture([500, 100], inCallout);
    initializeScrollRegions();
    expect(wide!.getAttribute("tabindex")).toBe("0");
    expect(wide!.getAttribute("role")).toBe("group");
    expect(wide!.getAttribute("aria-label")).toBe("Table, scrollable");
    expect(narrow!.hasAttribute("tabindex")).toBe(false);
    root.remove();
  }
});

// Why: a diagram wider than the column scrolls in its figure, like a wide
// table, and needs the same tab stop. It is named after the diagram, from
// the SVG's own name.
it("makes an overflowing diagram focusable and names it after the diagram", () => {
  root = document.createElement("main");
  root.innerHTML = `<figure class="diagram" style="width: 200px; overflow-x: auto"><svg role="img" aria-label="Mermaid diagram" width="500" height="10"></svg></figure><figure class="diagram" style="width: 200px; overflow-x: auto"><title id="t">Publishing flow</title><svg role="img" aria-labelledby="t" width="500" height="10"></svg></figure>`;
  document.body.append(root);
  initializeScrollRegions();
  const [plain, titled] = root.querySelectorAll(".diagram");
  expect(plain!.getAttribute("tabindex")).toBe("0");
  expect(plain!.getAttribute("aria-label")).toBe("Mermaid diagram, scrollable");
  expect(titled!.getAttribute("aria-label")).toBe(
    "Publishing flow, scrollable"
  );
});
