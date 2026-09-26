// The search dialog's preview of the selected result (SearchDialog.astro
// describes the markup): the result's title and tags, then the note's
// `main.content` fetched from its page. It follows the field's
// `aria-activedescendant`, which search.ts sets when it renders results
// and searchDialog.ts when the selection moves.
import { element, markMatches } from "./search.ts";
import { searchTerms } from "./searchText.ts";
import { initializeScrollRegions } from "./scrollRegions.ts";

// Fields already wired, so re-running the initializer is safe.
const initialized = new WeakSet<HTMLInputElement>();

export function initializeSearchPreview() {
  const field = document.querySelector<HTMLInputElement>("#term");
  const panel = document.querySelector<HTMLElement>("#search-preview");
  const content = document.querySelector<HTMLElement>("#preview-content");
  if (!field || !panel || !content || initialized.has(field)) return;
  initialized.add(field);

  // Pages fetched (or being fetched) for this visit, by URL. A failed fetch
  // is forgotten so the next selection tries again.
  const pages = new Map<string, Promise<string>>();
  const fetchPage = (url: string) => {
    let page = pages.get(url);
    if (!page) {
      page = fetch(url).then(response => {
        if (!response.ok) throw new Error(`${url} answered ${response.status}`);
        return response.text();
      });
      page.catch(() => pages.delete(url));
      pages.set(url, page);
    }
    return page;
  };

  // Each preview gets a number; a note that arrives after the selection
  // moved on is dropped.
  let latest = 0;

  const show = async () => {
    const run = ++latest;
    const id = field.getAttribute("aria-activedescendant");
    const option = id ? document.getElementById(id) : null;
    if (!option) {
      content.replaceChildren();
      return;
    }
    // Phones hide the panel; fetching for it would only cost data.
    if (!panel.checkVisibility()) return;

    const url = option.getAttribute("href")!;
    let html: string;
    try {
      html = await fetchPage(url);
    } catch (error) {
      console.error("Search preview failed to load:", error);
      return;
    }
    if (run !== latest) return;

    const terms = searchTerms(field.value);
    const title = element("div", "preview-title");
    title.append(
      markMatches(
        option.querySelector(".result-title")?.textContent ?? "",
        terms
      )
    );
    const tags = element("div", "preview-tags");
    for (const chip of option.querySelectorAll(".result-tags .tag")) {
      const button = element("button", "tag");
      button.type = "button";
      button.textContent = chip.textContent;
      tags.append(button);
    }
    const body = element("div", "preview-body");
    const main = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("main.content");
    if (main) body.append(...main.childNodes);
    prepareBody(body, terms);

    content.replaceChildren(
      ...(tags.childElementCount > 0 ? [title, tags, body] : [title, body])
    );
    // Callouts with wide math can overflow the narrow panel.
    initializeScrollRegions();
  };

  new MutationObserver(() => void show()).observe(field, {
    attributeFilter: ["aria-activedescendant"],
  });
}

/**
 * Drop ids, which would duplicate the page's own (and capture its `#`
 * links), and mark matches in the note's text.
 */
function prepareBody(body: HTMLElement, terms: readonly string[]) {
  for (const withId of body.querySelectorAll("[id]")) {
    withId.removeAttribute("id");
  }
  if (terms.length === 0) return;
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  for (const text of texts) {
    if (text.parentElement?.closest("script, style")) continue;
    const marked = markMatches(text.data, terms);
    if (marked.querySelector("mark")) text.replaceWith(marked);
  }
}
