import { createElement, Maximize2, X, type IconNode } from "lucide";

// Image lightbox: every note image that is not inside a link or another
// control opens, enlarged, in one shared modal <dialog>. Without JavaScript
// the page is unchanged. The markup the script builds is styled by class in
// styles/components/lightbox.css:
//
//   <button class="lightbox-trigger" aria-haspopup="dialog" aria-label="Enlarge image: …">
//     <img …> <span class="lightbox-badge" aria-hidden="true"><svg …></svg></span>
//   </button>
//
//   <dialog class="image-lightbox" aria-label="…">
//     <img> <button class="image-lightbox-close" aria-label="Close"><svg …></svg></button>
//   </dialog>
//
// The browser closes the dialog on Escape and moves focus into it. The script
// closes it on a click on the backdrop or the padding (a press that began and
// ended there, and not the second click of a double-click), and puts focus
// back on the button that opened it (not every browser focuses a button on
// click, or restores focus after a click opened the dialog, so the script
// focuses it first and again on close). A held Enter does not toggle the
// dialog open and shut. Search closes the dialog itself when it opens
// (searchDialog.ts): one modal at a time.

const TRIGGER_CLASS_NAME = "lightbox-trigger";
const DIALOG_CLASS_NAME = "image-lightbox";
// An image inside any of these is left alone.
const INERT_ANCESTORS = 'a, button, label, summary, [role="button"], dialog';

let dialog: HTMLDialogElement | undefined;
// The trigger that opened the dialog, to give focus back to on close.
let opener: HTMLElement | undefined;

export function initializeImageLightbox() {
  document
    .querySelectorAll<HTMLImageElement>("main.content img")
    .forEach(image => {
      // Not an image that is part of another control: a link's image keeps
      // following its link; one in a label (task items), button, summary, or
      // role=button element (a collapsible callout's title) would nest one
      // control in another. Our own button covers running twice.
      if (image.closest(INERT_ANCESTORS)) return;

      // A <picture> goes into the button whole, so the browser still picks
      // its source.
      const target =
        image.parentElement instanceof HTMLPictureElement
          ? image.parentElement
          : image;
      const alt = image.getAttribute("alt")?.trim() ?? "";

      const button = document.createElement("button");
      button.type = "button";
      button.className = TRIGGER_CLASS_NAME;
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute(
        "aria-label",
        alt ? `Enlarge image: ${alt}` : "Enlarge image"
      );

      const badge = document.createElement("span");
      badge.className = "lightbox-badge";
      badge.setAttribute("aria-hidden", "true");
      badge.append(icon(Maximize2, "maximize-2", 14));

      target.replaceWith(button);
      button.append(target, badge);
      button.addEventListener("click", () => open(image, alt, button));
      button.addEventListener("keydown", ignoreHeldEnter);
    });
}

function open(
  image: HTMLImageElement,
  alt: string,
  trigger: HTMLButtonElement
) {
  const shared = ensureDialog();

  // A fresh image for each picture. An <img> given a new src keeps showing
  // the old picture (and reporting its old currentSrc) until the new file
  // arrives, which would show the last picture under the new one's alt text.
  const enlarged = document.createElement("img");
  enlarged.decoding = "async";
  shared.querySelector(":scope > img")?.remove();
  shared.prepend(enlarged);

  // The same picture, with the original's candidates and a size of the whole
  // viewport so that the browser can choose a larger file than the note used.
  enlarged.alt = image.getAttribute("alt") ?? "";
  copyAttribute(image, enlarged, "src");
  const srcset = image.getAttribute("srcset");
  if (srcset) {
    enlarged.setAttribute("srcset", srcset);
    enlarged.setAttribute("sizes", "100vw");
  }
  // `sizes="100vw"` also makes the image's own width the viewport's, which
  // would stretch a small file. The stylesheet caps the width at the file's,
  // read here: the widest candidate, else the loaded image's size. With
  // neither known there is no cap.
  const fileWidth = widestCandidate(srcset) || image.naturalWidth;
  if (fileWidth > 0) {
    enlarged.style.setProperty("--lightbox-file-width", `${fileWidth}px`);
  }
  shared.setAttribute("aria-label", alt || "Image");

  if (!shared.open) {
    // Not every browser focuses a button on click (Safari). The dialog gives
    // focus back to what had it when it opened, so make sure that is the
    // trigger.
    trigger.focus({ preventScroll: true });
    opener = trigger;
    // The lock removes the page's scrollbar. With a classic scrollbar that
    // makes the page wider and re-wraps it behind the dialog, so the page
    // keeps the scrollbar's width as a margin (lightbox.css). It is 0 with
    // overlay scrollbars, which take no space. (CSS cannot measure it, and
    // `scrollbar-gutter: stable` reserves a gutter even where there is none
    // to lose, in Chrome's headless mode.)
    document.documentElement.style.setProperty(
      "--lightbox-scrollbar",
      // Never negative (pinch zoom can make the viewport the wider one).
      `${Math.max(0, window.innerWidth - document.documentElement.clientWidth)}px`
    );
    shared.showModal();
  }
}

/** The largest `w` descriptor in a srcset, or 0 if there is none. */
function widestCandidate(srcset: string | null) {
  // A descriptor ends a candidate (URLs may hold commas, so do not split).
  const widths = [...(srcset ?? "").matchAll(/\s(\d+)w\s*(?:,|$)/g)].map(
    match => Number(match[1])
  );
  return Math.max(0, ...widths);
}

function ensureDialog() {
  // Re-create it if something removed it from the page.
  if (dialog?.isConnected) return dialog;

  const created = document.createElement("dialog");
  created.className = DIALOG_CLASS_NAME;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "image-lightbox-close";
  close.setAttribute("aria-label", "Close");
  close.append(icon(X, "x", 20));
  close.addEventListener("click", () => {
    created.close();
    swallowFollowUpClicks();
  });

  created.append(close);

  // Browsers give focus back to the trigger natively, but Safari has done so
  // only when the dialog was opened from the keyboard (WebKit bug 236322).
  // So focus it here too; where the browser already did, this changes
  // nothing. Not while another modal is open: search closes this dialog to
  // open itself, and focus belongs in search.
  created.addEventListener("close", () => {
    if (!document.querySelector("dialog:modal")) {
      opener?.focus({ preventScroll: true });
    }
    opener = undefined;
  });

  created.addEventListener("keydown", ignoreHeldEnter);

  // A click on the backdrop lands on the dialog itself, and so does one in
  // the padding around the image. But a click is a press and a release, and
  // when they are on different elements (backdrop to image, or off the close
  // button) the browser fires it on their common ancestor, the dialog. So
  // close only when the press began and ended on the dialog itself. A click
  // with no pointer events before it (a script's) counts as on the dialog.
  let pressed: EventTarget | null | undefined;
  let released: EventTarget | null | undefined;
  created.addEventListener("pointerdown", event => {
    pressed = event.target;
    released = undefined;
  });
  created.addEventListener("pointerup", event => {
    released = event.target;
  });
  created.addEventListener("click", event => {
    const onDialog =
      (pressed === undefined || pressed === created) &&
      (released === undefined || released === created);
    pressed = released = undefined;
    // A double-click on a trigger is two clicks: the second lands on the
    // backdrop where the trigger was, and must not undo the first.
    if (event.detail > 1) return;
    if (event.target === created && onDialog) {
      created.close();
      swallowFollowUpClicks();
    }
  });

  document.body.append(created);
  dialog = created;
  return created;
}

// After a click closes the dialog, the rest of a double-click (or a quick
// double-tap) is still coming, and it lands on the page that was under the
// dialog: the second click of a double-click on Close pressed the search
// button beneath it, and one on the backdrop followed a link. Clicks that
// carry a count above one are swallowed in the capture phase, before any
// handler or default action (a link's navigation, a button's popover), for
// the length of a double-click. A fresh single click is not touched.
const DOUBLE_CLICK_WINDOW_MS = 600;
function swallowFollowUpClicks() {
  const swallow = (event: MouseEvent) => {
    if (event.detail <= 1) return;
    event.stopPropagation();
    event.preventDefault();
  };
  document.addEventListener("click", swallow, true);
  setTimeout(
    () => document.removeEventListener("click", swallow, true),
    DOUBLE_CLICK_WINDOW_MS
  );
}

// Enter presses a button on keydown, and each auto-repeat of a held Enter
// presses it again. Opening moves focus to Close and closing moves it back
// to the image's button, so a held Enter would toggle the dialog open and
// shut. Repeats do nothing on either. (Space presses a button on keyup, so
// holding it presses once.)
function ignoreHeldEnter(event: KeyboardEvent) {
  if (event.repeat && event.key === "Enter") event.preventDefault();
}

function copyAttribute(from: Element, to: Element, name: string) {
  const value = from.getAttribute(name);
  if (value === null) to.removeAttribute(name);
  else to.setAttribute(name, value);
}

// The same markup as components/Icon.astro renders at build time, so the
// site's icon rules match: Lucide's attributes and the classes `lucide`,
// `lucide-{name}`, and `svg-icon`.
function icon(node: IconNode, name: string, size: number) {
  return createElement(node, {
    class: `lucide lucide-${name} svg-icon`,
    "data-lucide": name,
    "aria-hidden": "true",
    width: size,
    height: size,
  });
}
