// Remember each file-tree folder's open state across pages (FileTreeEntry
// renders folders as <details data-folder-path>). Replaces live's Alpine
// `$persist(false).as(path)`, and reads and writes its keys (`_x_` plus
// the path, JSON values), so returning visitors keep their folders.

const KEY_PREFIX = "_x_";

// Folders we've already set up, so running the setup twice is harmless.
// Without this, the second run would put back the saved state over a folder
// the reader has opened or closed since.
// It's a WeakSet rather than a Set, so an element that leaves the page can
// be freed from memory. And we don't mark the element with a class, so the
// page's HTML stays as it was, and a copy of an element never looks set up
// when it isn't.
const initialized = new WeakSet<HTMLDetailsElement>();

// Storage can be unavailable (blocked site data) and then throws; folders
// still work, they are just not remembered.
function load(path: string): boolean | undefined {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(KEY_PREFIX + path) ?? "null"
    );
    return typeof saved === "boolean" ? saved : undefined;
  } catch {
    return undefined;
  }
}

function save(path: string, open: boolean) {
  try {
    localStorage.setItem(KEY_PREFIX + path, JSON.stringify(open));
  } catch {
    // Not remembered.
  }
}

// Saves as soon as `open` changes. The `toggle` event is dispatched later,
// in a task of its own, and can be lost when the reader follows a link
// right after opening a folder.
const observer = new MutationObserver(records => {
  for (const { target } of records) {
    const folder = target as HTMLDetailsElement;
    const path = folder.dataset.folderPath;
    if (path !== undefined) save(path, folder.open);
  }
});

export function initializeFolderState() {
  for (const folder of document.querySelectorAll<HTMLDetailsElement>(
    "details[data-folder-path]"
  )) {
    const path = folder.dataset.folderPath;
    if (path === undefined || initialized.has(folder)) continue;
    initialized.add(folder);
    const saved = load(path);
    if (saved !== undefined) folder.open = saved;
    observer.observe(folder, { attributeFilter: ["open"] });
  }
}
