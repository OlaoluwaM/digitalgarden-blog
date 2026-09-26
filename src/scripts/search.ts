// Searching from the search dialog (SearchDialog.astro describes the
// markup): the field's value is searched once the reader pauses, and the
// results, the
// no-results message, and the dialog's state are written into the dialog.
// Everything from the index is inserted as text, and matches are marked on
// the text itself, never by editing HTML strings.
//
// Opening and closing the dialog, moving the selection, and the preview
// are separate.
import type { createSearchEngine, SearchDocument } from "./searchEngine.ts";
import { excerpt, highlightSegments, searchTerms } from "./searchText.ts";

type SearchEngine = ReturnType<typeof createSearchEngine>;
type SearchState = "idle" | "results" | "empty";

const INDEX_URL = "/searchIndex.json";
const EXCERPT_LENGTH = 120;
// Search once typing pauses this long (live: 200ms).
const SEARCH_DELAY = 150;

// Fields already wired, so re-running the initializer is safe.
const initialized = new WeakSet<HTMLInputElement>();

export async function fetchSearchDocuments(): Promise<SearchDocument[]> {
  const response = await fetch(INDEX_URL);
  if (!response.ok) {
    throw new Error(`${INDEX_URL} answered ${response.status}`);
  }
  return response.json();
}

export function initializeSearch(
  loadDocuments: () => Promise<SearchDocument[]> = fetchSearchDocuments
) {
  const field = document.querySelector<HTMLInputElement>("#term");
  const layout = document.querySelector<HTMLElement>("#search-layout");
  const list = document.querySelector<HTMLElement>("#search-results");
  const querySlot = document.querySelector<HTMLElement>(".no-results-query");
  if (!field || !layout || !list || !querySlot || initialized.has(field)) {
    return;
  }
  initialized.add(field);

  // The index and the engine (FlexSearch) load on first use, together; a
  // failed load is forgotten so the next query tries again.
  let engine: Promise<SearchEngine> | undefined;
  const loadEngine = () =>
    (engine ??= Promise.all([loadDocuments(), import("./searchEngine.ts")])
      .then(([documents, { createSearchEngine }]) =>
        createSearchEngine(documents)
      )
      .catch(error => {
        engine = undefined;
        throw error;
      }));

  const show = (state: SearchState, results: HTMLElement[] = []) => {
    layout.dataset.state = state;
    list.replaceChildren(...results);
    field.setAttribute("aria-expanded", String(results.length > 0));
    if (results[0]) {
      field.setAttribute("aria-activedescendant", results[0].id);
    } else {
      field.removeAttribute("aria-activedescendant");
    }
  };

  // Each change gets a number; a search that finishes after a newer change
  // is dropped.
  let latest = 0;
  let pending: ReturnType<typeof setTimeout> | undefined;

  const runSearch = async (run: number, query: string) => {
    let search: SearchEngine;
    try {
      search = await loadEngine();
    } catch (error) {
      console.error("Search index failed to load:", error);
      return;
    }
    if (run !== latest) return;

    const terms = searchTerms(query);
    const results = search
      .search(query)
      .map((entry, index) => resultOption(entry, index, terms));
    if (results.length > 0) {
      show("results", results);
    } else {
      querySlot.textContent = query;
      show("empty");
    }
  };

  field.addEventListener("focus", () => {
    loadEngine().catch(() => {});
  });
  // Every change to the value fires `input`: typing, paste, the clear
  // button, dictation. Clearing shows the hint at once.
  field.addEventListener("input", () => {
    clearTimeout(pending);
    const run = ++latest;
    const query = field.value.trim();
    if (!query) {
      show("idle");
      return;
    }
    pending = setTimeout(() => void runSearch(run, query), SEARCH_DELAY);
  });
}

function resultOption(
  entry: SearchDocument,
  index: number,
  terms: readonly string[]
) {
  const option = element("a", "searchresult");
  option.id = `search-result-${index}`;
  option.href = entry.url;
  option.tabIndex = -1;
  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", String(index === 0));

  option.append(highlighted("result-title", entry.title, terms));
  if (entry.tags.length > 0) {
    const tags = element("span", "result-tags");
    for (const tag of entry.tags) {
      const chip = element("span", "tag");
      chip.textContent = `#${tag}`;
      tags.append(chip);
    }
    option.append(tags);
  }
  option.append(
    highlighted(
      "result-excerpt",
      excerpt(entry.content, terms, EXCERPT_LENGTH),
      terms
    )
  );
  return option;
}

/** A span of text with each match wrapped in a <mark>. */
function highlighted(
  className: string,
  text: string,
  terms: readonly string[]
) {
  const span = element("span", className);
  span.append(markMatches(text, terms));
  return span;
}

/** Text as text nodes, with each match wrapped in a <mark>. */
export function markMatches(text: string, terms: readonly string[]) {
  const fragment = document.createDocumentFragment();
  for (const segment of highlightSegments(text, terms)) {
    if (segment.match) {
      const mark = element("mark", "search-highlight");
      mark.textContent = segment.text;
      fragment.append(mark);
    } else {
      fragment.append(segment.text);
    }
  }
  return fragment;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string
) {
  const created = document.createElement(tag);
  created.className = className;
  return created;
}
