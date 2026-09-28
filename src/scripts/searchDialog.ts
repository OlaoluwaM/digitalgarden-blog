// Opening, closing, and moving through the search dialog
// (SearchDialog.astro describes the markup). search.ts searches and
// renders the results; searchPreview.ts shows the selected one.
//
// - The search buttons, Ctrl+K or ⌘+K, a `?q=` link, and tag links or
//   buttons open it; Escape (native), Ctrl+K again, or a click outside the
//   box close it.
// - The arrow keys move the selection (`aria-selected` on the option,
//   `aria-activedescendant` on the field) while focus stays in the field;
//   the pointer selects too, and Enter follows the selected result.

// Dialogs we've already set up, so running the setup twice is harmless.
// Without this, every click and key press would be handled twice.
// It's a WeakSet rather than a Set, so an element that leaves the page can
// be freed from memory. And we don't mark the element with a class, so the
// page's HTML stays as it was, and a copy of an element never looks set up
// when it isn't.
const initialized = new WeakSet<HTMLDialogElement>();

export function initializeSearchDialog() {
  const dialog = document.querySelector<HTMLDialogElement>("#globalsearch");
  const field = document.querySelector<HTMLInputElement>("#term");
  const list = document.querySelector<HTMLElement>("#search-results");
  if (!dialog || !field || !list || initialized.has(dialog)) return;
  initialized.add(dialog);

  const open = () => {
    if (!dialog.open) dialog.showModal();
  };
  /** Open the dialog and search for `query`, as if it had been typed. */
  const searchFor = (query: string) => {
    open();
    field.value = query;
    field.focus();
    field.dispatchEvent(new Event("input", { bubbles: true }));
  };

  for (const button of document.querySelectorAll<HTMLElement>(
    '[aria-controls="globalsearch"]'
  )) {
    button.addEventListener("click", open);
  }

  document.addEventListener("keydown", event => {
    if (!dialog.isConnected) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (dialog.open) dialog.close();
      else open();
    }
  });

  // The dialog covers the viewport around the box, so a click whose target
  // is the dialog itself landed outside the box.
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });

  // Tags search in place: links in the note header (their `?q=` href works
  // without JavaScript), buttons in the preview. A click meant for a new
  // tab or window still follows the link.
  document.addEventListener("click", event => {
    const target = event.target;
    const tag = target instanceof Element ? target.closest(".tag") : null;
    if (!tag || !dialog.isConnected) return;
    let query: string | null = null;
    if (tag instanceof HTMLAnchorElement) {
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      query = new URL(tag.href).searchParams.get("q");
    } else if (tag instanceof HTMLButtonElement) {
      query = tag.textContent.trim();
    }
    if (!query) return;
    event.preventDefault();
    searchFor(query);
  });

  const options = () => [
    ...list.querySelectorAll<HTMLAnchorElement>('[role="option"]'),
  ];
  const select = (option: HTMLElement) => {
    for (const other of options()) {
      other.setAttribute("aria-selected", String(other === option));
    }
    field.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({ block: "nearest" });
  };

  field.addEventListener("keydown", event => {
    const all = options();
    const current = all.findIndex(
      option => option.getAttribute("aria-selected") === "true"
    );
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (all.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      select(all[(current + step + all.length) % all.length]!);
    } else if (event.key === "Enter" && all[current]) {
      event.preventDefault();
      all[current].click();
    }
  });

  list.addEventListener("mouseover", event => {
    const option = (event.target as Element).closest<HTMLElement>(
      '[role="option"]'
    );
    if (option && option.getAttribute("aria-selected") !== "true") {
      select(option);
    }
  });

  // Macs use ⌘ for the shortcut.
  if (/Mac|iPhone|iPad|iPod/.test(navigator.platform)) {
    for (const key of document.querySelectorAll(".search-key-modifier")) {
      key.textContent = "⌘";
    }
  }

  const query = new URLSearchParams(location.search).get("q");
  if (query) searchFor(query);
}
