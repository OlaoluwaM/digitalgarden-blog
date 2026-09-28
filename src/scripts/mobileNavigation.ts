// The mobile file tree (NavShell describes the markup). Below lg the tree
// is a popover the hamburger opens with `popovertarget`, so the browser
// opens and closes it, with or without JavaScript. This script adds what
// the browser does not: focus moves into the tree when it opens, and
// widening to the desktop layout closes it. Replaces live's Alpine
// `showFilesMobile` flag.

// The desktop layout, where the tree always shows (--breakpoint-lg).
const DESKTOP = "(min-width: 62.5rem)";

// Trees we've already set up, so running the setup twice is harmless.
// Without this, each opening would be handled twice.
// It's a WeakSet rather than a Set, so an element that leaves the page can
// be freed from memory. And we don't mark the element with a class, so the
// page's HTML stays as it was, and a copy of an element never looks set up
// when it isn't.
const initialized = new WeakSet<HTMLElement>();

export function initializeMobileNavigation() {
  const hamburger = document.querySelector<HTMLButtonElement>(
    "button.hamburger-btn[popovertarget]"
  );
  const tree = hamburger
    ? document.getElementById(hamburger.getAttribute("popovertarget")!)
    : null;
  if (!tree || initialized.has(tree)) return;
  initialized.add(tree);

  // The tree opens over the page, so keyboard users start in it. (The
  // browser returns focus to the hamburger when it closes.)
  tree.addEventListener("toggle", event => {
    if (event.newState === "open") {
      tree.querySelector<HTMLElement>("a[href], button, summary")?.focus();
    }
  });

  // From lg up the tree shows in place. Left open, it would stay in the top
  // layer over a dimmed page.
  matchMedia(DESKTOP).addEventListener("change", event => {
    if (event.matches && tree.matches(":popover-open")) tree.hidePopover();
  });
}
