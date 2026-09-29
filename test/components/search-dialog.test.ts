/**
 * Component tests for the search dialog's markup: the hooks the search
 * script binds to, and the static text it shows or hides.
 *
 * Why this level: the dialog's markup is a contract between this component,
 * its stylesheet (src/styles/components/search.css), and the search script.
 * The script fills the results and preview and sets the state; everything
 * it does not build is here. Whether each state shows the right parts is
 * CSS, checked on the built site in test/layout/site-layout.test.ts.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse, type HTMLElement } from "node-html-parser";
import { beforeAll, describe, expect, it } from "vitest";
import SearchDialog from "../../src/components/SearchDialog.astro";

let container: AstroContainer;
let root: HTMLElement;

beforeAll(async () => {
  container = await AstroContainer.create();
  root = parse(await container.renderToString(SearchDialog));
});

describe("dialog", () => {
  // Why: the live search box was a `div` toggled with an `active` class, so
  // focus could leave it and the page behind stayed reachable. A native
  // <dialog> opened with showModal() keeps focus inside, makes the page
  // inert, and closes on Escape. It must start closed, and it needs a name
  // for screen readers to announce.
  it("is a closed dialog named Search", () => {
    const dialog = root.querySelector("dialog#globalsearch");
    expect(dialog?.classList.contains("search-container")).toBe(true);
    expect(dialog?.hasAttribute("open")).toBe(false);
    expect(dialog?.getAttribute("aria-label")).toBe("Search");
    // Clicks outside the box land on the dialog itself, which is how the
    // script tells them apart from clicks inside.
    expect(dialog?.querySelector(":scope > .search-box")).not.toBeNull();
  });
});

describe("search field", () => {
  // Why: the script reads the query from `#term`, and the dialog focuses
  // the field on opening only if it carries `autofocus`. The combobox
  // attributes tie the field to the results list, so screen readers
  // announce the result that the arrow keys select; the script keeps
  // `aria-expanded` and `aria-activedescendant` current.
  it("is a named combobox that controls the results list", () => {
    const input = root.querySelector("input#term");
    // A text field: a search field clears itself on Escape instead of
    // letting the dialog close. Phones still show a search keyboard.
    expect(input?.getAttribute("type")).toBe("text");
    expect(input?.getAttribute("inputmode")).toBe("search");
    expect(input?.getAttribute("enterkeyhint")).toBe("search");
    expect(input?.hasAttribute("autofocus")).toBe(true);
    expect(input?.getAttribute("aria-label")).toBe("Search notes");
    expect(input?.getAttribute("placeholder")).toBe("Start typing...");
    expect(input?.getAttribute("role")).toBe("combobox");
    expect(input?.getAttribute("aria-autocomplete")).toBe("list");
    expect(input?.getAttribute("aria-expanded")).toBe("false");
    expect(input?.getAttribute("aria-controls")).toBe("search-results");
    // Browsers would otherwise offer earlier queries over the results.
    expect(input?.getAttribute("autocomplete")).toBe("off");
  });
});

describe("results", () => {
  // Why: the stylesheet shows the parts of the dialog by this one state,
  // which the script sets after each search (`idle`, `results`, `empty`).
  // The page must load in `idle`, before any search.
  it("starts in the idle state with its hint", () => {
    const layout = root.querySelector(".search-layout#search-layout");
    expect(layout?.getAttribute("data-state")).toBe("idle");
    expect(layout?.querySelector(".search-idle p")?.text).toBe(
      "Type to search the notes"
    );
  });

  // Why: the script appends one `role="option"` element per result to this
  // list; it must exist, be named, and start empty.
  it("has an empty, named results listbox", () => {
    const list = root.querySelector("#search-results");
    expect(list?.getAttribute("role")).toBe("listbox");
    expect(list?.getAttribute("aria-label")).toBe("Results");
    expect(list?.childNodes).toHaveLength(0);
  });

  // Why: the live script built this message with innerHTML around the raw
  // query, so a query could inject markup. Here the text is static and the
  // script writes the query into its own element as text.
  it("has a no-results message with an empty slot for the query", () => {
    const message = root.querySelector(".no-results");
    expect(message?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true"
    );
    expect(message?.querySelector(".no-results-query")?.text).toBe("");
    expect(message?.text.replace(/\s+/g, " ").trim()).toBe("No results for “”");
  });
});

describe("preview", () => {
  // Why: the stylesheet shows the placeholder only while `#preview-content`
  // is `:empty`, so the element must not contain even whitespace until the
  // script fills it.
  it("has a placeholder and an empty preview container", () => {
    const panel = root.querySelector(".search-preview-panel#search-preview");
    expect(panel?.querySelector(".preview-placeholder")?.text.trim()).toBe(
      "Select a result to preview"
    );
    expect(
      panel?.querySelector(".preview-placeholder svg.lucide-file-text")
    ).not.toBeNull();
    const content = panel?.querySelector(".preview-content#preview-content");
    expect(content).not.toBeNull();
    expect(content?.innerHTML).toBe("");
  });
});

describe("keyboard hints", () => {
  // Why: the hints name keys, so they use <kbd> (live used <code>), and
  // their text is the live site's.
  it("lists the three hints with their keys", () => {
    const hints = root
      .querySelectorAll(".search-box-footer .navigation-hint")
      .map(hint => ({
        key: hint.querySelector("kbd")?.text,
        text: hint.text.replace(/\s+/g, " ").trim(),
      }));
    expect(hints).toEqual([
      { key: "Enter", text: "Enter to select" },
      { key: "⇅", text: "⇅ to navigate" },
      { key: "ESC", text: "ESC to close" },
    ]);
  });
});
