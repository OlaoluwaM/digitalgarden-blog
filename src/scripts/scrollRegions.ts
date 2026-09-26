// Content boxes that scroll sideways (callout bodies holding wide math) need
// a tab stop, or keyboard users cannot scroll them (WCAG 2.1.1). Only boxes
// that actually overflow get one, and overflow depends on the viewport, so a
// ResizeObserver re-checks each box whenever its size changes, including
// when a callout collapses and hides it.
const SCROLL_REGION_SELECTOR = ".callout-content";
const FALLBACK_LABEL = "Scrollable content";

// Boxes we're already watching, so running the setup twice is harmless.
// Without this, we'd ask to watch the same box again.
// It's a WeakSet rather than a Set, so an element that leaves the page can
// be freed from memory. And we don't mark the element with a class, so the
// page's HTML stays as it was, and a copy of an element never looks set up
// when it isn't.
const observed = new WeakSet<HTMLElement>();

const resizeObserver = new ResizeObserver(entries => {
  for (const entry of entries) updateRegion(entry.target as HTMLElement);
});

export function initializeScrollRegions() {
  document
    .querySelectorAll<HTMLElement>(SCROLL_REGION_SELECTOR)
    .forEach(region => {
      updateRegion(region);
      if (observed.has(region)) return;
      resizeObserver.observe(region);
      observed.add(region);
    });
}

function updateRegion(region: HTMLElement) {
  // A hidden box has no size, so it never counts as overflowing.
  const overflows = region.scrollWidth > region.clientWidth;
  if (overflows) {
    region.setAttribute("tabindex", "0");
    // A group, not a `region` landmark: callouts can share a title, and
    // landmarks need unique names.
    region.setAttribute("role", "group");
    region.setAttribute("aria-label", labelFor(region));
  } else {
    region.removeAttribute("tabindex");
    region.removeAttribute("role");
    region.removeAttribute("aria-label");
  }
}

function labelFor(region: HTMLElement) {
  const title = region
    .closest(".callout")
    ?.querySelector(":scope > .callout-title .callout-title-inner")
    ?.textContent?.trim();
  return title ? `${title}, scrollable` : FALLBACK_LABEL;
}
