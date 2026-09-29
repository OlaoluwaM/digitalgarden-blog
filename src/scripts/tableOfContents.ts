// A note's table of contents (TableOfContents.astro) works without this
// script: its links jump to their headings, the inline box is a <details>,
// and the phone sheet is a popover. This marks the section being read in
// every list (`aria-current="location"`), and closes the sheet once a link
// in it is chosen, so the reader lands on the heading.

// A heading counts as the one being read once its top passes this share of
// the viewport's height.
const READING_LINE = 0.3;

let initialized = false;

export function initializeTableOfContents() {
  const links = [
    ...document.querySelectorAll<HTMLAnchorElement>(".toc-list a[href^='#']"),
  ];
  if (links.length === 0 || initialized) return;
  initialized = true;

  const sheet = document.querySelector<HTMLElement>("#toc-sheet");
  sheet?.addEventListener("click", event => {
    if (event.target instanceof Element && event.target.closest("a")) {
      sheet.hidePopover();
    }
  });

  const idOf = (link: HTMLAnchorElement) =>
    decodeURIComponent(link.hash.slice(1));
  const headings = [...new Set(links.map(idOf))].flatMap(
    id => document.getElementById(id) ?? []
  );

  const markCurrent = () => {
    const line = window.innerHeight * READING_LINE;
    let current: HTMLElement | undefined;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top > line) break;
      current = heading;
    }
    for (const link of links) {
      if (current && idOf(link) === current.id) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  };

  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      markCurrent();
    });
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  markCurrent();
}
