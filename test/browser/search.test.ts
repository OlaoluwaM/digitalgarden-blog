/**
 * Run the search dialog's script in Chrome on the dialog's markup contract
 * (src/components/SearchDialog.astro): typing searches, and the results,
 * the no-results message, and the state are written into the dialog.
 *
 * Why this level: the fixes to live's search are about the DOM (text must
 * stay text, and paste or the clear button must search), and input events
 * and element trees need a browser. The fixture holds only the elements
 * the script touches; the built dialog with the real index is covered in
 * test/layout/site-layout.test.ts. The search logic itself has Node tests
 * (test/search-engine.test.ts).
 */
import { afterEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { initializeSearch } from "../../src/scripts/search.ts";
import type { SearchDocument } from "../../src/scripts/searchEngine.ts";

const documents: SearchDocument[] = [
  {
    title: "IO in Haskell, an epiphany",
    url: "/posts/io-in-haskell-an-epiphany/",
    tags: ["software-engineering", "haskell"],
    content: "It seems to me like IO is Haskell's way of modelling statements.",
  },
  {
    title: "How to produce multiple executables from a stack project",
    url: "/posts/how-to-produce-multiple-executables-from-a-stack-project/",
    tags: ["software-engineering", "haskell"],
    content: "Run stack exec my-exe -- <options-to-pass-to-executable> here.",
  },
  {
    title: 'A <img src="x" onerror="alert(1)"> span class demo',
    url: "/posts/markup/",
    tags: ["<b>bold</b>"],
    content: "Text about a span with a class.",
  },
];

let root: HTMLElement;

afterEach(() => {
  root?.remove();
});

function mount() {
  root = document.createElement("div");
  root.innerHTML = `
    <input id="term" type="search" role="combobox" aria-expanded="false" aria-controls="search-results">
    <div id="search-layout" data-state="idle">
      <p class="search-idle">Enter your search text in the box above</p>
      <div id="search-results" role="listbox" aria-label="Results"></div>
      <div class="no-results"><p>No results for “<span class="no-results-query"></span>”</p></div>
    </div>`;
  document.body.append(root);
  return {
    field: root.querySelector<HTMLInputElement>("#term")!,
    layout: root.querySelector<HTMLElement>("#search-layout")!,
    list: root.querySelector<HTMLElement>("#search-results")!,
    query: root.querySelector<HTMLElement>(".no-results-query")!,
  };
}

/** Change the value the way paste, the clear button, and dictation do. */
function setValue(field: HTMLInputElement, value: string) {
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

const load = () => Promise.resolve(documents);
const options = (list: HTMLElement) => [
  ...list.querySelectorAll<HTMLAnchorElement>(".searchresult"),
];

// Why: live searched on `keydown`, so pasting with the mouse, the field's
// clear button, and dictation changed the query without searching. Every
// change to the value fires `input`.
it("searches whenever the value changes, however it changed", async () => {
  const { field, layout, list } = mount();
  initializeSearch(load);

  setValue(field, "epiphany");
  await expect.poll(() => layout.dataset.state).toBe("results");
  expect(options(list)).toHaveLength(1);

  await userEvent.clear(field);
  await userEvent.type(field, "stack");
  await expect
    .poll(() => options(list).map(option => option.getAttribute("href")))
    .toEqual([
      "/posts/how-to-produce-multiple-executables-from-a-stack-project/",
    ]);
});

// Why: a search per keystroke would redraw the list while the reader is
// still typing. Live waited for a 200ms pause; this waits 150ms, and only
// the last value is searched.
it("searches once the reader pauses for 150ms", async () => {
  const { field, layout, list } = mount();
  const loader = vi.fn(load);
  initializeSearch(loader);
  vi.useFakeTimers();
  try {
    setValue(field, "ha");
    vi.advanceTimersByTime(100);
    setValue(field, "stack");
    vi.advanceTimersByTime(149);
    // The pause restarted with "stack", so nothing has searched yet (the
    // first search would load the index).
    expect(loader).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(loader).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }

  await expect.poll(() => layout.dataset.state).toBe("results");
  expect(options(list)).toHaveLength(1);
  expect(list.querySelector(".result-title")!.textContent).toBe(
    "How to produce multiple executables from a stack project"
  );
});

// Why: each result is a link to its note (so it opens in a new tab like
// any link) and an option of the listbox. The first is selected, and the
// field points at it, so Enter and screen readers start there.
it("lists results as options, the first selected", async () => {
  const { field, layout, list } = mount();
  initializeSearch(load);
  setValue(field, "#haskell");
  await expect.poll(() => layout.dataset.state).toBe("results");

  const [first, second] = options(list);
  expect(first!.id).toBe("search-result-0");
  expect(first!.getAttribute("role")).toBe("option");
  expect(first!.getAttribute("aria-selected")).toBe("true");
  expect(first!.getAttribute("tabindex")).toBe("-1");
  expect(first!.getAttribute("href")).toBe("/posts/io-in-haskell-an-epiphany/");
  expect(first!.querySelector(".result-title")!.textContent).toBe(
    "IO in Haskell, an epiphany"
  );
  expect(
    [...first!.querySelectorAll(".result-tags .tag")].map(
      tag => tag.textContent
    )
  ).toEqual(["#software-engineering", "#haskell"]);
  expect(first!.querySelector(".result-excerpt")!.textContent).toBe(
    "It seems to me like IO is Haskell's way of modelling statements."
  );
  expect(second!.getAttribute("aria-selected")).toBe("false");
  expect(field.getAttribute("aria-expanded")).toBe("true");
  expect(field.getAttribute("aria-activedescendant")).toBe("search-result-0");
});

// Why: live built results with innerHTML, so a title, tag, or excerpt
// holding `<...>` became elements. The index stores decoded text (a
// command placeholder in the stack post), so that was both a rendering bug
// and an injection path. Everything must arrive as text.
it("shows titles, tags, and excerpts as text", async () => {
  const { field, layout, list } = mount();
  initializeSearch(load);

  setValue(field, "demo");
  await expect.poll(() => layout.dataset.state).toBe("results");
  const [result] = options(list);
  expect(result!.querySelector("img, b")).toBeNull();
  expect(result!.querySelector(".result-title")!.textContent).toBe(
    'A <img src="x" onerror="alert(1)"> span class demo'
  );
  expect(result!.querySelector(".result-tags .tag")!.textContent).toBe(
    "#<b>bold</b>"
  );

  setValue(field, "executable");
  await expect
    .poll(() => list.querySelector(".result-excerpt")?.textContent)
    .toBe("Run stack exec my-exe -- <options-to-pass-to-executable> here.");
});

// Why: live wrapped matches by rewriting the HTML string one term at a
// time, so a query such as "span class" matched its own inserted markup
// and garbled the result. Matches are marked on the text: the text reads
// the same, and each match is one <mark>.
it("marks matches without changing the text", async () => {
  const { field, layout, list } = mount();
  initializeSearch(load);
  setValue(field, "span class");
  await expect.poll(() => layout.dataset.state).toBe("results");

  const title = list.querySelector(".result-title")!;
  expect(title.textContent).toBe(
    'A <img src="x" onerror="alert(1)"> span class demo'
  );
  expect(
    [...title.querySelectorAll("mark.search-highlight")].map(
      mark => mark.textContent
    )
  ).toEqual(["span", "class"]);
  expect(
    [...list.querySelectorAll(".result-excerpt mark")].map(
      mark => mark.textContent
    )
  ).toEqual(["span", "class"]);
});

// Why: the no-results message repeats the query, which live inserted as
// HTML; a `?q=` link could have injected markup. It is written as text,
// and the results of the previous query are cleared.
it("reports no results with the query as text", async () => {
  const { field, layout, list, query } = mount();
  initializeSearch(load);
  setValue(field, "haskell");
  await expect.poll(() => layout.dataset.state).toBe("results");

  setValue(field, "<b>zzqqxx</b>");
  await expect.poll(() => layout.dataset.state).toBe("empty");
  expect(query.textContent).toBe("<b>zzqqxx</b>");
  expect(query.querySelector("b")).toBeNull();
  expect(options(list)).toHaveLength(0);
  expect(field.getAttribute("aria-expanded")).toBe("false");
  expect(field.hasAttribute("aria-activedescendant")).toBe(false);
});

// Why: clearing the field (backspace or the clear button) goes back to the
// hint, not to the last results.
it("returns to the hint when the query is cleared", async () => {
  const { field, layout, list } = mount();
  initializeSearch(load);
  setValue(field, "haskell");
  await expect.poll(() => layout.dataset.state).toBe("results");

  setValue(field, "  ");
  await expect.poll(() => layout.dataset.state).toBe("idle");
  expect(options(list)).toHaveLength(0);
  expect(field.getAttribute("aria-expanded")).toBe("false");
  expect(field.hasAttribute("aria-activedescendant")).toBe(false);
});

// Why: every page has the dialog, but few visits search. The index
// (tens of kilobytes) loads when the field is first focused (opening the
// dialog focuses it) or typed in, once.
it("loads the index once, on first use", async () => {
  const { field, layout } = mount();
  const loader = vi.fn(load);
  initializeSearch(loader);
  expect(loader).not.toHaveBeenCalled();

  field.focus();
  expect(loader).toHaveBeenCalledTimes(1);
  setValue(field, "haskell");
  setValue(field, "epiphany");
  await expect.poll(() => layout.dataset.state).toBe("results");
  expect(loader).toHaveBeenCalledTimes(1);
});

// Why: queries typed while the index is still loading all wait for it.
// Only the latest may render: a query cleared before the index arrived
// must not bring its results back over the hint.
it("renders only the latest query when the index arrives", async () => {
  const { field, layout, list } = mount();
  let resolve!: (value: SearchDocument[]) => void;
  initializeSearch(() => new Promise(done => (resolve = done)));

  // Each query waits out the typing pause, then waits for the index.
  setValue(field, "haskell");
  await new Promise(done => setTimeout(done, 200));
  setValue(field, "stack");
  await new Promise(done => setTimeout(done, 200));
  resolve(documents);
  await expect.poll(() => layout.dataset.state).toBe("results");
  expect(options(list)).toHaveLength(1);
  expect(list.querySelector(".result-title")!.textContent).toBe(
    "How to produce multiple executables from a stack project"
  );
});

it("keeps the hint when the query is cleared while the index loads", async () => {
  const { field, layout, list } = mount();
  let resolve!: (value: SearchDocument[]) => void;
  initializeSearch(() => new Promise(done => (resolve = done)));

  setValue(field, "haskell");
  // Past the typing pause, so the search is waiting for the index.
  await new Promise(done => setTimeout(done, 200));
  setValue(field, "");
  resolve(documents);
  // Let the pending search finish: the engine module is loaded and cached
  // by then, and a timer runs after the search's promise callbacks.
  await import("../../src/scripts/searchEngine.ts");
  await new Promise(done => setTimeout(done, 50));
  expect(layout.dataset.state).toBe("idle");
  expect(options(list)).toHaveLength(0);
});

// Why: a failed download (a dropped connection) must not break search for
// the rest of the visit; the next query tries again.
it("retries loading after a failure", async () => {
  const { field, layout } = mount();
  const loader = vi
    .fn<() => Promise<SearchDocument[]>>()
    .mockRejectedValueOnce(new Error("offline"))
    .mockImplementation(load);
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  initializeSearch(loader);

  setValue(field, "haskell");
  await expect.poll(() => error.mock.calls.length).toBe(1);
  expect(layout.dataset.state).toBe("idle");
  setValue(field, "haskell");
  await expect.poll(() => layout.dataset.state).toBe("results");
  expect(loader).toHaveBeenCalledTimes(2);
  error.mockRestore();
});

// Why: the initializer runs on every page load and may run again; running
// it twice must not load twice or render every result twice.
it("is safe to run twice", async () => {
  const { field, layout, list } = mount();
  const loader = vi.fn(load);
  initializeSearch(loader);
  initializeSearch(loader);
  setValue(field, "epiphany");
  await expect.poll(() => layout.dataset.state).toBe("results");
  expect(options(list)).toHaveLength(1);
  expect(loader).toHaveBeenCalledTimes(1);
});

// Why: pages without the dialog (the 404 page) run the same scripts.
it("does nothing on a page without the dialog", () => {
  expect(() => initializeSearch(load)).not.toThrow();
});
