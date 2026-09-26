// The mobile file tree (NavShell describes the markup). Below lg the
// stylesheet shows `#filetree` and `.fullpage-overlay` while the
// hamburger's `aria-expanded` is "true"; this script flips it. Replaces
// live's Alpine `showFilesMobile` flag.

// The desktop layout, where the tree always shows (--breakpoint-lg).
const DESKTOP = "(min-width: 1000px)";

// Hamburgers we've already set up, so running the setup twice is harmless.
// Without this, each click would open the tree and close it again at once.
// It's a WeakSet rather than a Set, so an element that leaves the page can
// be freed from memory. And we don't mark the element with a class, so the
// page's HTML stays as it was, and a copy of an element never looks set up
// when it isn't.
const initialized = new WeakSet<HTMLButtonElement>();

export function initializeMobileNavigation() {
  const hamburger = document.querySelector<HTMLButtonElement>(
    "button.hamburger-btn[aria-controls]"
  );
  const tree = hamburger
    ? document.getElementById(hamburger.getAttribute("aria-controls")!)
    : null;
  const overlay = document.querySelector<HTMLElement>(".fullpage-overlay");
  if (!hamburger || !tree || initialized.has(hamburger)) return;
  initialized.add(hamburger);

  const isOpen = () => hamburger.getAttribute("aria-expanded") === "true";
  const setOpen = (open: boolean) => {
    hamburger.setAttribute("aria-expanded", String(open));
  };

  hamburger.addEventListener("click", () => {
    const open = !isOpen();
    setOpen(open);
    // The tree opens over the page, so keyboard users start in it.
    if (open) {
      tree.querySelector<HTMLElement>("a[href], button, summary")?.focus();
    }
  });

  overlay?.addEventListener("click", () => setOpen(false));

  // Only while focus is on the hamburger or in the tree: Escape elsewhere
  // (the search dialog, opened from the tree) belongs to that element.
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !isOpen()) return;
    setOpen(false);
    hamburger.focus();
  };
  hamburger.addEventListener("keydown", closeOnEscape);
  tree.addEventListener("keydown", closeOnEscape);

  // Desktop always shows the tree; an open state left over would reopen it
  // when the window narrows again.
  matchMedia(DESKTOP).addEventListener("change", event => {
    if (event.matches) setOpen(false);
  });
}
