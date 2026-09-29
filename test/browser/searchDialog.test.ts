/**
 * Run the search dialog's wiring in Chrome on the dialog's markup contract
 * (src/components/SearchDialog.astro): opening and closing, moving the
 * selection, following a result, the preview, and tag searches.
 *
 * Why this level: all of it is event handling on a real <dialog> (modal
 * state, focus, clicks, key presses) and fetched HTML turned into
 * elements, which needs a browser. The fixture holds only the elements the
 * scripts touch, with the search itself running on fixture entries; the
 * built pages are covered in test/layout/site-layout.test.ts.
 */
import {
  afterEach,
  beforeEach,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { userEvent } from "vitest/browser";
import { initializeSearch } from "../../src/scripts/search.ts";
import { initializeSearchDialog } from "../../src/scripts/searchDialog.ts";
import { initializeSearchPreview } from "../../src/scripts/searchPreview.ts";
import type { SearchDocument } from "../../src/scripts/searchEngine.ts";

const documents: SearchDocument[] = [
  {
    title: "IO in Haskell, an epiphany",
    url: "/posts/io/",
    tags: ["software-engineering", "haskell"],
    content:
      "It seems to me like IO is Haskell's way of modelling a span of statements.",
  },
  {
    title: "Implementing Redis INFO in Haskell",
    url: "/posts/redis/",
    tags: ["software-engineering", "haskell"],
    content: "Cabal's custom setup script, in Haskell.",
  },
  {
    title: "Be deliberate",
    url: "/posts/deliberate/",
    tags: ["self-development"],
    content: "Create your life rather than live it.",
  },
];

/** The main.content of each fixture note, as its page would serve it. */
const notes: Record<string, string> = {
  "/posts/io/":
    '<header><h1>IO in Haskell, an epiphany</h1></header><h2 id="why">Why</h2><p>Haskell &lt;span class&gt; <a href="#why">here</a></p><footer>Footer</footer>',
  "/posts/redis/": "<p>Redis in Haskell.</p>",
  "/posts/deliberate/": "<p>Be deliberate.</p>",
};

// fetch() takes a string, a URL, or a Request.
const requestUrl = (input: RequestInfo | URL) =>
  input instanceof Request ? input.url : String(input);

let root: HTMLElement;
let fetchSpy: MockInstance<typeof window.fetch>;
let delays: Record<string, Promise<void>>;

beforeEach(() => {
  delays = {};
  fetchSpy = vi.spyOn(window, "fetch").mockImplementation(async input => {
    const url = requestUrl(input);
    await delays[url];
    return new Response(
      `<!doctype html><body><main class="content">${notes[url]}</main></body>`
    );
  });
});

afterEach(() => {
  root?.querySelector<HTMLDialogElement>("dialog")?.close();
  root?.remove();
  fetchSpy.mockRestore();
  history.replaceState(null, "", location.pathname);
});

function mount() {
  root = document.createElement("div");
  root.innerHTML = `
    <button type="button" class="search-button" aria-controls="globalsearch">Search <span class="search-keys"><code class="search-key-modifier">Ctrl</code> + <code>K</code></span></button>
    <button type="button" class="search-button" aria-controls="globalsearch">Search</button>
    <a class="tag" href="/?q=%23haskell">#haskell</a>
    <dialog id="globalsearch" aria-label="Search" style="width: 900px; height: 600px; padding: 50px">
      <div class="search-box">
        <input id="term" type="search" role="combobox" aria-expanded="false" aria-controls="search-results" autofocus>
        <div id="search-layout" data-state="idle">
          <div id="search-results" role="listbox" aria-label="Results"></div>
          <div class="no-results"><span class="no-results-query"></span></div>
          <div id="search-preview" class="search-preview-panel"><div id="preview-content" class="preview-content"></div></div>
        </div>
      </div>
    </dialog>`;
  document.body.append(root);
  initializeSearch(() => Promise.resolve(documents));
  initializeSearchDialog();
  initializeSearchPreview();
  return {
    dialog: root.querySelector<HTMLDialogElement>("#globalsearch")!,
    buttons: [...root.querySelectorAll<HTMLButtonElement>(".search-button")],
    field: root.querySelector<HTMLInputElement>("#term")!,
    list: root.querySelector<HTMLElement>("#search-results")!,
    preview: root.querySelector<HTMLElement>("#preview-content")!,
    panel: root.querySelector<HTMLElement>("#search-preview")!,
  };
}

const selected = (list: HTMLElement) =>
  list.querySelector('[aria-selected="true"]')?.getAttribute("href");

async function searchFor(field: HTMLInputElement, query: string) {
  field.value = query;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  await expect
    .poll(() => field.closest("dialog")!.querySelector(".searchresult"))
    .not.toBeNull();
}

// Why: both search buttons (navbar and sidebar) open the dialog as a
// modal, which focuses the search field. A click outside the box (on the
// dialog's backdrop area) closes it, as on live; a click inside does not.
it("opens from either search button and closes on a click outside", async () => {
  const { dialog, buttons, field } = mount();
  for (const button of buttons) {
    await userEvent.click(button);
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(field);

    await userEvent.click(field);
    expect(dialog.open).toBe(true);
    // The dialog's padding is outside the box, like the backdrop area.
    await userEvent.click(dialog, { position: { x: 5, y: 5 } });
    expect(dialog.open).toBe(false);
  }
});

// Why: Ctrl+K (⌘+K on Macs) opens search from anywhere on the page and
// closes it again, as on live; other keys do nothing.
it("toggles with Ctrl+K or ⌘+K", async () => {
  const { dialog } = mount();
  await userEvent.keyboard("k");
  expect(dialog.open).toBe(false);
  await userEvent.keyboard("{Control>}k{/Control}");
  expect(dialog.open).toBe(true);
  await userEvent.keyboard("{Control>}k{/Control}");
  expect(dialog.open).toBe(false);
  await userEvent.keyboard("{Meta>}k{/Meta}");
  expect(dialog.open).toBe(true);
});

// Why: `/?q=…` links open search with that query (the note header's tag
// links point there, so they work without JavaScript too).
it("opens with the query from ?q=", async () => {
  history.replaceState(null, "", "?q=%23haskell");
  const { dialog, field, list } = mount();
  expect(dialog.open).toBe(true);
  expect(field.value).toBe("#haskell");
  await expect
    .poll(() => list.querySelectorAll(".searchresult").length)
    .toBe(2);
});

// Why: with JavaScript, a tag link searches in place instead of loading
// the home page, as live's tag buttons did. A click meant for a new tab
// still follows the link.
it("searches a tag link's tag in place", async () => {
  const { dialog, field } = mount();
  const tag = root.querySelector<HTMLAnchorElement>("a.tag")!;
  const followed = vi.fn((event: Event) => event.preventDefault());

  tag.addEventListener("click", followed);
  tag.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })
  );
  expect(dialog.open).toBe(false);

  await userEvent.click(tag);
  expect(dialog.open).toBe(true);
  expect(field.value).toBe("#haskell");
  expect(followed.mock.calls.at(-1)![0].defaultPrevented).toBe(true);
});

// Why: Macs use ⌘ for the shortcut, so the button's hint says so. Only the
// key's text changes (live rewrote the hint with innerHTML).
it("labels the shortcut ⌘ on Apple platforms", () => {
  const platform = vi.spyOn(navigator, "platform", "get");
  platform.mockReturnValue("MacIntel");
  mount();
  expect(root.querySelector(".search-key-modifier")!.textContent).toBe("⌘");
  root.remove();

  platform.mockReturnValue("Linux x86_64");
  mount();
  expect(root.querySelector(".search-key-modifier")!.textContent).toBe("Ctrl");
  platform.mockRestore();
});

// Why: focus stays in the search field while the arrow keys move the
// selection, wrapping at either end, so the field must point screen
// readers at the selected option, and the key must not move the caret.
it("moves the selection with the arrow keys, wrapping around", async () => {
  const { buttons, field, list } = mount();
  await userEvent.click(buttons[0]!);
  await searchFor(field, "haskell");
  expect(selected(list)).toBe("/posts/io/");

  await userEvent.keyboard("{ArrowDown}");
  expect(selected(list)).toBe("/posts/redis/");
  expect(field.getAttribute("aria-activedescendant")).toBe("search-result-1");
  await userEvent.keyboard("{ArrowDown}");
  expect(selected(list)).toBe("/posts/io/");
  await userEvent.keyboard("{ArrowUp}");
  expect(selected(list)).toBe("/posts/redis/");
  expect(list.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);

  const arrow = new KeyboardEvent("keydown", {
    key: "ArrowUp",
    bubbles: true,
    cancelable: true,
  });
  field.dispatchEvent(arrow);
  expect(arrow.defaultPrevented).toBe(true);
});

// Why: pointing at a result selects it (and previews it), as on live.
it("selects the result under the pointer", async () => {
  const { buttons, field, list } = mount();
  await userEvent.click(buttons[0]!);
  await searchFor(field, "haskell");
  await userEvent.hover(list.querySelectorAll(".searchresult")[1]!);
  expect(selected(list)).toBe("/posts/redis/");
  expect(field.getAttribute("aria-activedescendant")).toBe("search-result-1");
});

// Why: Enter opens the selected result, which is a link, so it follows
// the link like a click would.
it("follows the selected result on Enter", async () => {
  const { buttons, field, list } = mount();
  await userEvent.click(buttons[0]!);
  await searchFor(field, "haskell");
  await userEvent.keyboard("{ArrowDown}");
  const followed = vi.fn((event: Event) => event.preventDefault());
  list.addEventListener("click", followed);

  await userEvent.keyboard("{Enter}");
  expect(followed).toHaveBeenCalledTimes(1);
  expect(
    (followed.mock.calls[0]![0].target as Element).getAttribute("href")
  ).toBe("/posts/redis/");
});

// Why: the preview shows the selected note: its title and tags from the
// result, then the note's text fetched from its page. Matches are marked
// on the text (markup-looking text stays text), and ids are dropped so the
// preview cannot duplicate ids or capture the page's own anchors.
it("previews the selected note", async () => {
  const { buttons, field, preview } = mount();
  await userEvent.click(buttons[0]!);
  await searchFor(field, "haskell span");
  await expect
    .poll(() => preview.querySelector(".preview-body"))
    .not.toBeNull();

  expect(preview.querySelector(".preview-title")!.textContent).toBe(
    "IO in Haskell, an epiphany"
  );
  expect(
    [...preview.querySelectorAll(".preview-tags button.tag")].map(tag => [
      tag.getAttribute("type"),
      tag.textContent,
    ])
  ).toEqual([
    ["button", "#software-engineering"],
    ["button", "#haskell"],
  ]);
  const body = preview.querySelector(".preview-body")!;
  expect(body.querySelector(":scope > h2")!.textContent).toBe("Why");
  expect(body.querySelector("[id]")).toBeNull();
  expect(body.querySelector("p")!.textContent).toBe(
    "Haskell <span class> here"
  );
  expect(
    [...body.querySelectorAll("p mark.search-highlight")].map(
      mark => mark.textContent
    )
  ).toEqual(["Haskell", "span"]);
  expect(body.querySelector("p span")).toBeNull();
});

// Why: the preview follows the selection. Each note is fetched once, and
// when the selection moves on before a note arrives, the note it moved to
// wins.
it("follows the selection, fetching each note once", async () => {
  let release!: () => void;
  delays["/posts/io/"] = new Promise(done => (release = done));
  const { buttons, field, preview } = mount();
  await userEvent.click(buttons[0]!);
  await searchFor(field, "haskell");

  await userEvent.keyboard("{ArrowDown}");
  await expect
    .poll(() => preview.querySelector(".preview-title")?.textContent)
    .toBe("Implementing Redis INFO in Haskell");
  release();
  await new Promise(done => setTimeout(done, 50));
  expect(preview.querySelector(".preview-title")!.textContent).toBe(
    "Implementing Redis INFO in Haskell"
  );

  await userEvent.keyboard("{ArrowUp}{ArrowDown}{ArrowUp}");
  await expect
    .poll(() => preview.querySelector(".preview-title")?.textContent)
    .toBe("IO in Haskell, an epiphany");
  expect(fetchSpy.mock.calls.map(([input]) => requestUrl(input))).toEqual([
    "/posts/io/",
    "/posts/redis/",
  ]);
});

// Why: without results there is nothing to preview; the placeholder
// shows again.
it("empties the preview when the results go away", async () => {
  const { buttons, field, preview } = mount();
  await userEvent.click(buttons[0]!);
  await searchFor(field, "haskell");
  await expect.poll(() => preview.childElementCount).toBeGreaterThan(0);

  field.value = "";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  await expect.poll(() => preview.childElementCount).toBe(0);
});

// Why: a tag in the preview searches that tag, as on live.
it("searches a preview tag", async () => {
  const { buttons, field, list, preview } = mount();
  await userEvent.click(buttons[0]!);
  await searchFor(field, "deliberate");
  await expect
    .poll(() => preview.querySelector(".preview-tags button"))
    .not.toBeNull();

  await userEvent.click(preview.querySelector(".preview-tags button")!);
  expect(field.value).toBe("#self-development");
  expect(document.activeElement).toBe(field);
  await expect
    .poll(() => list.querySelector(".result-title")?.textContent)
    .toBe("Be deliberate");
});

// Why: phones hide the preview panel, so fetching notes for it would only
// cost data.
it("fetches nothing while the preview panel is hidden", async () => {
  const { buttons, field, panel } = mount();
  panel.style.display = "none";
  await userEvent.click(buttons[0]!);
  await searchFor(field, "haskell");
  await userEvent.keyboard("{ArrowDown}");
  await new Promise(done => setTimeout(done, 50));
  expect(fetchSpy).not.toHaveBeenCalled();
});

// Why: the initializers run on every page load and may run again; twice
// must not open, move, or fetch twice.
it("is safe to run twice", async () => {
  const { dialog, buttons, field, list } = mount();
  initializeSearchDialog();
  initializeSearchPreview();
  await userEvent.click(buttons[0]!);
  expect(dialog.open).toBe(true);
  await searchFor(field, "haskell");
  await userEvent.keyboard("{ArrowDown}");
  expect(selected(list)).toBe("/posts/redis/");
  await expect.poll(() => fetchSpy.mock.calls.length).toBe(2);
  await new Promise(done => setTimeout(done, 50));
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});
