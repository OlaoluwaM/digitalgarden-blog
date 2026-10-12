/**
 * Run the image lightbox in Chrome on fixture markup: which images get a
 * trigger, what the trigger and the shared dialog are called, opening,
 * closing in every way, and where focus goes after. A second group loads the
 * real stylesheets and checks the geometry that only CSS decides: a wrapped
 * image looks exactly as it did, the badge and the close button sit where the
 * design puts them, and the enlarged image fits the viewport.
 *
 * Why this level: opening, closing, and focus are behavior of a real
 * <dialog> (modal state, the top layer, Escape, clicks), and the geometry is
 * computed layout, so neither exists without a browser. The fixture holds
 * only what the script touches; the built note, at two phone and desktop
 * widths and with axe, is covered in test/layout/lightbox.test.ts.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { page, userEvent } from "vitest/browser";
import { initializeImageLightbox } from "../../src/scripts/imageLightbox.ts";
import baseCss from "../../src/styles/base.css?raw";
import lightboxCss from "../../src/styles/components/lightbox.css?raw";
import preflightCss from "tailwindcss/preflight.css?raw";
import tokensCss from "../../src/styles/tokens.css?raw";
import typographyCss from "../../src/styles/content/typography.css?raw";

let root: HTMLElement;

afterEach(() => {
  document.querySelectorAll("dialog.image-lightbox").forEach(d => d.remove());
  root?.remove();
});

/** Astro's note image: lazy, with a srcset and its pixel size. */
const noteImage = (alt: string | null, extra = "") =>
  `<img data-astro-image src="/_astro/a.400.webp" srcset="/_astro/a.400.webp 400w, /_astro/a.515.webp 515w" sizes="(max-width: 515px) 100vw, 515px" width="515" height="500"${alt === null ? "" : ` alt="${alt}"`} loading="lazy" decoding="async"${extra}>`;

function mount(html: string) {
  root = document.createElement("main");
  root.className = "content";
  root.innerHTML = html;
  document.body.append(root);
  initializeImageLightbox();
  return root;
}

const triggers = () => [
  ...root.querySelectorAll<HTMLButtonElement>("button.lightbox-trigger"),
];
const lightboxes = () => [
  ...document.querySelectorAll<HTMLDialogElement>("dialog.image-lightbox"),
];
const dialog = () => {
  const [only, ...rest] = lightboxes();
  expect(only, "the lightbox dialog").toBeDefined();
  expect(rest).toEqual([]);
  return only!;
};
const dialogImage = () => dialog().querySelector("img")!;
const closeButton = () =>
  dialog().querySelector<HTMLButtonElement>("button[aria-label='Close']")!;
const isOpen = () => lightboxes().some(d => d.open && d.matches(":modal"));

describe("the trigger", () => {
  // Why: the owner's rule is "every image in a note"; each one needs exactly
  // one real button, named for what it enlarges, so a screen reader hears
  // the action and the picture and a keyboard user can reach it.
  it("wraps each note image in one named button", () => {
    mount(
      `<p>${noteImage("A graph of latency")}</p><p>${noteImage("A second picture")}</p>`
    );
    const [first, second] = triggers();
    expect(triggers()).toHaveLength(2);
    expect(first!.type).toBe("button");
    expect(first!.getAttribute("aria-haspopup")).toBe("dialog");
    expect(first!.getAttribute("aria-label")).toBe(
      "Enlarge image: A graph of latency"
    );
    expect(second!.getAttribute("aria-label")).toBe(
      "Enlarge image: A second picture"
    );
    expect(first!.querySelectorAll("img")).toHaveLength(1);
    expect(first!.parentElement!.tagName).toBe("P");
  });

  // Why: an image with no alt text (empty or missing) has nothing to say
  // after the colon; "Enlarge image: " would be read as an unfinished label.
  it("drops the colon when the image has no alt text", () => {
    mount(
      `<p>${noteImage("")}</p><p>${noteImage(null)}</p><p>${noteImage("  ")}</p>`
    );
    expect(triggers().map(b => b.getAttribute("aria-label"))).toEqual([
      "Enlarge image",
      "Enlarge image",
      "Enlarge image",
    ]);
  });

  // Why: the badge is decoration: the button's own name already says what it
  // does, so a screen reader must not also read an unnamed graphic.
  it("puts a hidden badge with the maximize icon inside the button", () => {
    mount(`<p>${noteImage("x")}</p>`);
    const badge = triggers()[0]!.querySelector("[aria-hidden='true']")!;
    expect(
      badge.querySelector("svg.lucide.lucide-maximize-2.svg-icon")
    ).not.toBeNull();
  });

  // Why: a linked image already has a job (it follows its link); a button
  // inside a link would be invalid HTML and would steal the link's click.
  // An image outside the note column (the site chrome) is not a note image.
  it("leaves linked images and images outside the note column alone", () => {
    mount(
      `<p><a href="/elsewhere/">${noteImage("Linked")}</a></p><p>${noteImage("Plain")}</p>`
    );
    const outside = document.createElement("div");
    outside.innerHTML = noteImage("Chrome");
    document.body.append(outside);
    initializeImageLightbox();
    try {
      expect(triggers().map(b => b.getAttribute("aria-label"))).toEqual([
        "Enlarge image: Plain",
      ]);
      expect(outside.querySelector("button")).toBeNull();
      expect(root.querySelector("a > img")).not.toBeNull();
    } finally {
      outside.remove();
    }
  });

  // Why: an image inside another control (a task item's label, a button, a
  // summary, a collapsible callout's title, which is role=button) is part of
  // that control. A button inside it would be nested interactive content
  // (invalid, and a second tab stop for one control), so those are left alone.
  it("leaves images inside other controls alone", () => {
    mount(
      `<ul><li><label><input type="checkbox" disabled> ${noteImage("In a label")}</label></li></ul>` +
        `<p><button type="button">${noteImage("In a button")}</button></p>` +
        `<details><summary>${noteImage("In a summary")}</summary>x</details>` +
        `<div role="button" tabindex="0">${noteImage("In a role")}</div>` +
        `<p>${noteImage("Plain")}</p>`
    );
    expect(triggers().map(b => b.getAttribute("aria-label"))).toEqual([
      "Enlarge image: Plain",
    ]);
  });

  // Why: the initializer runs on every page load and may run again; a second
  // run must not nest a button in a button or add a second badge.
  it("does not wrap twice when run again", () => {
    mount(`<p>${noteImage("Once")}</p>`);
    initializeImageLightbox();
    initializeImageLightbox();
    expect(triggers()).toHaveLength(1);
    expect(root.querySelectorAll("button button")).toHaveLength(0);
    expect(root.querySelectorAll("button svg")).toHaveLength(1);
  });

  // Why: Astro may emit a <picture> around an image; the button must hold the
  // whole picture so the browser still chooses the source.
  it("wraps a picture, not just its img", () => {
    mount(
      `<p><picture><source srcset="/a.avif" type="image/avif">${noteImage("In a picture")}</picture></p>`
    );
    const [button] = triggers();
    expect(button!.firstElementChild!.tagName).toBe("PICTURE");
    expect(root.querySelectorAll("picture")).toHaveLength(1);
  });

  // Why: pages without notes (the 404 page) run the same scripts.
  it("does nothing on a page without images", () => {
    mount("<p>No pictures.</p>");
    expect(lightboxes()).toHaveLength(0);
  });
});

describe("opening", () => {
  // Why: the dialog is the feature. It must be modal (the page behind goes
  // inert and the top layer carries it over everything) and show the same
  // picture: the same alt and src, plus the original srcset with sizes of
  // 100vw so the browser may fetch a larger file than the note displayed.
  it("opens one modal dialog with the same image and a wider srcset", async () => {
    mount(`<p>${noteImage("A graph of latency")}</p>`);
    await userEvent.click(triggers()[0]!);

    expect(isOpen()).toBe(true);
    expect(dialogImage().getAttribute("alt")).toBe("A graph of latency");
    expect(dialogImage().getAttribute("src")).toBe("/_astro/a.400.webp");
    expect(dialogImage().getAttribute("srcset")).toBe(
      "/_astro/a.400.webp 400w, /_astro/a.515.webp 515w"
    );
    expect(dialogImage().getAttribute("sizes")).toBe("100vw");
    expect(dialog().parentElement).toBe(document.body);
  });

  // Why: a modal dialog with no name is announced as just "dialog". The
  // name comes from the image's alt, and falls back to "Image" when the
  // image has none, so it is never blank.
  it("names the dialog from the alt text, or 'Image'", async () => {
    mount(`<p>${noteImage("A graph of latency")}</p><p>${noteImage("")}</p>`);
    await userEvent.click(triggers()[0]!);
    await expect
      .element(page.getByRole("dialog", { name: "A graph of latency" }))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(triggers()[1]!);
    await expect
      .element(page.getByRole("dialog", { name: "Image" }))
      .toBeVisible();
  });

  // Why: an image without a srcset (a remote image, an SVG) must not get an
  // empty or stale one; and the one shared dialog must show the image that
  // was just chosen, not the first one it ever showed.
  it("reuses one dialog and shows the chosen image each time", async () => {
    mount(
      `<p>${noteImage("First")}</p><p><img src="/plain.png" alt="Second"></p>`
    );
    await userEvent.click(triggers()[0]!);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(triggers()[1]!);

    expect(lightboxes()).toHaveLength(1);
    expect(dialogImage().getAttribute("alt")).toBe("Second");
    expect(dialogImage().getAttribute("src")).toBe("/plain.png");
    expect(dialogImage().hasAttribute("srcset")).toBe(false);
    expect(dialogImage().hasAttribute("sizes")).toBe(false);
  });

  // Why: an <img> that gets a new src keeps showing its old picture (and
  // its old currentSrc) until the new file loads, so the shared dialog would
  // show the first picture under the second one's alt text for as long as
  // the second takes to load, a long time on a phone. Each open gets a fresh
  // image. The second picture never loads here, and the first is checked
  // the instant the dialog opens.
  it("does not show the previous picture while the next one loads", async () => {
    const first = await pictureUrl(120, 80);
    try {
      mount(
        `<p><img src="${first}" width="120" height="80" alt="First"></p>` +
          `<p><img src="/never-loads-${Date.now()}.png" alt="Second"></p>`
      );
      await userEvent.click(triggers()[0]!);
      await expect
        .poll(() => dialogImage().complete && dialogImage().currentSrc)
        .toBe(first);
      await userEvent.keyboard("{Escape}");

      triggers()[1]!.click();
      const shown = dialogImage();
      expect(shown.getAttribute("alt")).toBe("Second");
      expect(shown.currentSrc).not.toBe(first);
      expect(shown.naturalWidth).toBe(0);
    } finally {
      URL.revokeObjectURL(first);
    }
  });

  // Why: a button must work from the keyboard, not only a click.
  it("opens from the keyboard", async () => {
    mount(`<p>${noteImage("Keyboard")}</p>`);
    triggers()[0]!.focus();
    await userEvent.keyboard("{Enter}");
    expect(isOpen()).toBe(true);
  });
});

describe("closing", () => {
  const open = async (alt = "Picture") => {
    mount(`<p>${noteImage(alt)}</p>`);
    const trigger = triggers()[0]!;
    trigger.focus();
    await userEvent.click(trigger);
    expect(isOpen()).toBe(true);
    return trigger;
  };

  // Why: Escape is the native way out of a modal; the script must not break
  // it. Focus has to land back on the button that opened the dialog, or a
  // keyboard user restarts from the top of the page.
  it("closes on Escape and returns focus to the trigger", async () => {
    const trigger = await open();
    await userEvent.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  // Why: touch users have no Escape key; the close button is their way out.
  it("closes with the close button and returns focus", async () => {
    const trigger = await open();
    await userEvent.click(closeButton());
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  // Why: tapping the dark area around the picture is how people dismiss a
  // lightbox. The click lands on the dialog element itself (its padding
  // and, over the viewport, the backdrop).
  it("closes on a click outside the image and returns focus", async () => {
    const trigger = await open();
    await page.elementLocator(dialog()).click({ position: { x: 3, y: 3 } });
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  // Why: the opposite mistake: a tap on the picture itself (to look closer,
  // or to start a pinch) must not dismiss it.
  it("stays open when the image itself is clicked", async () => {
    await open();
    await userEvent.click(dialogImage());
    expect(isOpen()).toBe(true);
  });

  // Why: after a click closes the dialog, the rest of a double-click is
  // swallowed for 600ms so it can't press what lay under the dialog. The
  // window must close again: a double-click on the page afterwards is the
  // reader's own and must arrive, and no listener may be left behind.
  it("swallows a follow-up double-click for 600ms only", async () => {
    // Earlier tests close the dialog with real clicks, and their windows
    // run on real timers; let them end so only this test's window counts.
    await new Promise(resolve => setTimeout(resolve, 650));
    await open();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      closeButton().click();
      expect(isOpen()).toBe(false);
      const target = document.createElement("button");
      document.body.append(target);
      const arrived = vi.fn();
      target.addEventListener("click", arrived);
      const secondClick = () =>
        target.dispatchEvent(
          new MouseEvent("click", { bubbles: true, detail: 2 })
        );

      vi.advanceTimersByTime(599);
      secondClick();
      expect(arrived).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2);
      secondClick();
      expect(arrived).toHaveBeenCalledTimes(1);
      target.remove();
    } finally {
      // Ends this window even if an assertion failed, so its listener can't
      // swallow clicks in later tests.
      vi.runAllTimers();
      vi.useRealTimers();
    }
  });

  // Why: a double-click on the trigger is two clicks. The first opens the
  // dialog, and the second lands wherever the trigger was, which is now the
  // backdrop. That second click must not undo the first.
  it("stays open after a double-click on the trigger", async () => {
    mount(`<p>${noteImage("Double")}</p>`);
    await page
      .elementLocator(triggers()[0]!)
      .dblClick({ position: { x: 2, y: 2 } });
    expect(isOpen()).toBe(true);
  });

  // Why: a click is "press and release on the same thing". When a press
  // starts on the backdrop and ends on the image (or starts on the close
  // button and ends off it), the browser fires the click on their common
  // ancestor, the dialog itself, which looks like a backdrop click. Only a
  // press that began and ended on the dialog itself dismisses it. The
  // events are dispatched as Chrome orders them.
  describe("a press that crosses elements", () => {
    const press = (from: Element, to: Element, click: Element = dialog()) => {
      from.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      to.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      click.dispatchEvent(
        new MouseEvent("click", { bubbles: true, detail: 1 })
      );
    };

    it("closes when it starts and ends on the backdrop", async () => {
      await open();
      press(dialog(), dialog());
      expect(isOpen()).toBe(false);
    });

    it("stays open when it starts on the backdrop and ends on the image", async () => {
      await open();
      press(dialog(), dialogImage());
      expect(isOpen()).toBe(true);
    });

    it("stays open when it starts on the close button and ends on the backdrop", async () => {
      await open();
      press(closeButton(), dialog());
      expect(isOpen()).toBe(true);
    });

    it("stays open when it starts on the image and ends on the backdrop", async () => {
      await open();
      press(dialogImage(), dialog());
      expect(isOpen()).toBe(true);
    });
  });

  // Why: the browser gives focus back to whatever had it before
  // showModal(). Safari does not focus a button on click, so there the
  // trigger had no focus to return; the script focuses it first. A click
  // that leaves the trigger unfocused (here, a script's) is that case.
  it("returns focus even if the trigger was not focused when opened", async () => {
    mount(`<p>${noteImage("Unfocused")}</p>`);
    const trigger = triggers()[0]!;
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(isOpen()).toBe(true);
    expect(document.activeElement).not.toBe(trigger);
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(trigger);
  });

  // Why: Chrome gives focus back to the trigger natively, which hides
  // whether the script does. Safari has restored focus only when the dialog
  // was opened from the keyboard (WebKit bug 236322), so the script must
  // focus the trigger itself on every close path. A spy sees only script
  // calls to focus(), never the browser's own restore.
  for (const [how, close] of [
    ["Escape", () => userEvent.keyboard("{Escape}")],
    ["the close button", () => userEvent.click(closeButton())],
    [
      "a click outside the image",
      () => page.elementLocator(dialog()).click({ position: { x: 3, y: 3 } }),
    ],
  ] as const) {
    it(`focuses the trigger itself after ${how}`, async () => {
      const trigger = await open();
      const focus = vi.spyOn(trigger, "focus");
      await close();
      await expect.poll(() => focus.mock.calls.length).toBeGreaterThan(0);
      expect(document.activeElement).toBe(trigger);
    });
  }

  // Why: the close button is the dialog's first control, so a keyboard user
  // who opened it can close it with Enter at once.
  it("puts focus on the close button when it opens", async () => {
    await open();
    expect(document.activeElement).toBe(closeButton());
  });
});

// The stylesheets are written for Tailwind, which the browser tests do not
// run: `--spacing(n)`, `--alpha(c / n%)`, and `@variant md` are rewritten
// here to the CSS Tailwind would emit, and the theme tokens become :root
// properties. Everything else (selectors, @layer, @scope, nesting) is the
// real file. These rewrites are a stand-in for Tailwind, not a check of it:
// test/layout/lightbox.test.ts is the check against the real Tailwind output
// (the same sizes and insets, on the built site).
const unTailwind = (css: string) =>
  css
    .replace(/--spacing\(([\d.]+)\)/g, "calc(var(--spacing) * $1)")
    .replace(
      /--alpha\((.+?) \/ (\d+)%\)/g,
      "color-mix(in oklab, $1 $2%, transparent)"
    )
    .replace(/@variant max-md/g, "@media (width < 50rem)")
    .replace(/@variant md/g, "@media (width >= 50rem)");

const themeVariables = () =>
  [...tokensCss.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)]
    .filter(([, name]) => !name!.includes("*"))
    .map(([, name, value]) => `${name}: ${value};`)
    .join("\n");

/** A CSS color as 0-255 channels, read the way a pixel would show it. */
function channels(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d")!;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  return [...context.getImageData(0, 0, 1, 1).data];
}
const expectColor = (actual: string, expected: string) => {
  const a = channels(actual);
  const e = channels(expected);
  a.forEach((value, i) =>
    expect(Math.abs(value - e[i]!)).toBeLessThanOrEqual(1)
  );
};

/** Alpha as 0-255, which differs by one between ways of rounding 30%. */
const alphaOf = (color: string) => channels(color)[3]!;

/** A real picture of the given size, so layout has something to fit. */
async function pictureUrl(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#4a6";
  context.fillRect(0, 0, width, height);
  const blob = await new Promise<Blob>(resolve =>
    canvas.toBlob(b => resolve(b!), "image/png")
  );
  return URL.createObjectURL(blob);
}

describe("with the real stylesheets", () => {
  let style: HTMLStyleElement;
  const urls: string[] = [];

  beforeAll(() => {
    style = document.createElement("style");
    style.textContent = `
      @layer theme, base, components, utilities;
      :root { ${themeVariables()} }
      @layer base { ${preflightCss} }
      ${unTailwind(baseCss)}
      ${unTailwind(typographyCss)}
      ${unTailwind(lightboxCss)}`;
    document.head.append(style);
  });
  afterAll(() => {
    style.remove();
    urls.forEach(url => URL.revokeObjectURL(url));
  });
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  /** Markup as the built page has it, in the note column's scope. */
  async function mountStyled(
    body: (src: string) => string,
    size: [number, number] = [515, 300]
  ) {
    const src = await pictureUrl(...size);
    urls.push(src);
    const wrapper = document.createElement("div");
    wrapper.className = "markdown-rendered";
    wrapper.style.width = "700px";
    wrapper.innerHTML = `<main class="content">${body(src)}</main>`;
    document.body.append(wrapper);
    root = wrapper;
    return { src, wrapper, image: () => wrapper.querySelector("img")! };
  }
  const rect = (element: Element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  };
  const img = (src: string, size = 'width="515" height="300"') =>
    `<img data-astro-image src="${src}" ${size} alt="A picture" loading="lazy">`;

  // Why: the design's rule is that the button changes nothing about the
  // picture. An image alone in a paragraph is centered by a typography rule
  // that matches `p > img:only-child`; once the button wraps the image that
  // selector no longer matches, so the wrapper has to carry the centering.
  // Compare the same markup before and after wrapping.
  it("keeps a lone, centered image where it was, at its size and radius", async () => {
    const { image, wrapper } = await mountStyled(
      src => `<p>${img(src, 'width="300" height="200"')}</p>`
    );
    const before = rect(image());
    const radius = getComputedStyle(image()).borderRadius;
    expect(radius).toBe("8px");
    const column = rect(wrapper);
    expect(before.x + before.width / 2).toBeCloseTo(
      column.x + column.width / 2,
      0
    );

    initializeImageLightbox();

    expect(root.querySelector("button")).not.toBeNull();
    expect(rect(image())).toEqual(before);
    expect(getComputedStyle(image()).borderRadius).toBe(radius);
    expect(getComputedStyle(root.querySelector("button")!).borderRadius).toBe(
      radius
    );
    expect(getComputedStyle(root.querySelector("button")!).cursor).toBe(
      "zoom-in"
    );
  });

  // Why: a wide image in a narrow column shrinks to the column (max-width
  // 100%, height auto); the button must not stop that or leave the picture
  // overflowing.
  it("lets a wide image shrink to the column inside the button", async () => {
    const { image, wrapper } = await mountStyled(
      src => `<p>${img(src, 'width="1000" height="500"')}</p>`,
      [1000, 500]
    );
    wrapper.style.width = "320px";
    const before = rect(image());
    expect(before.width).toBe(320);
    initializeImageLightbox();
    expect(rect(image())).toEqual(before);
  });

  // Why: Tailwind's Preflight makes every image a block, so an image that is
  // not alone in its paragraph still sits on its own line, and a list item or
  // table cell holding only an image is exactly as tall as the image. The
  // button must lay out as that bare block: an inline box would move the
  // image into the text line, put two images side by side, and add a line's
  // descender space under it. The page's real reset and base styles are
  // loaded here, so this fails if the button stops being a block. (In the
  // first case the second image is the only element of its paragraph, which
  // the typography rules treat as alone: they match `:only-child`, which
  // ignores text. It is a centered block, and the button has to follow.)
  const tiny = 'width="40" height="20"';
  const cases: [string, (src: string) => string][] = [
    [
      "inside a sentence",
      src =>
        `<p>Before ${img(src, tiny)} after <em>with</em> more text.</p>` +
        `<p>Only ${img(src, tiny)} here.</p>`,
    ],
    [
      "next to another on one line",
      src => `<p>${img(src, tiny)} ${img(src, tiny)}</p>`,
    ],
    [
      "above another after a line break",
      src => `<p>${img(src, tiny)}<br>\n${img(src, tiny)}</p>`,
    ],
    [
      "alone in a list item",
      src => `<ul><li>${img(src, tiny)}</li><li>Text</li></ul>`,
    ],
    [
      "alone in a table cell",
      src =>
        `<div class="table-wrapper"><table><tr><td>${img(src, tiny)}</td><td>Text</td></tr></table></div>`,
    ],
    [
      "followed by text in a callout",
      src =>
        `<div class="callout"><div class="callout-content"><p>${img(src, tiny)}</p><p>After</p></div></div>`,
    ],
  ];
  for (const [name, markup] of cases) {
    it(`leaves every box where it was for an image ${name}`, async () => {
      const { wrapper } = await mountStyled(markup);
      const boxes = () =>
        [...wrapper.querySelectorAll("img, p, li, td, table, .callout")].map(
          element => rect(element)
        );
      const before = boxes();
      initializeImageLightbox();
      expect(wrapper.querySelectorAll("button").length).toBeGreaterThan(0);
      const after = boxes();
      expect(after).toHaveLength(before.length);
      after.forEach((box, i) => {
        for (const key of ["x", "y", "width", "height"] as const) {
          expect(Math.abs(box[key] - before[i]![key])).toBeLessThanOrEqual(0.5);
        }
      });
    });
  }

  // Why: a badge that appears only on hover is invisible on a phone, where
  // there is no hover; and its place, size, and colors are the approved design.
  it("shows the badge at rest, 8px inside the corner, 28px, in the design colors", async () => {
    const { image } = await mountStyled(src => `<p>${img(src)}</p>`);
    initializeImageLightbox();
    const badge = root.querySelector<HTMLElement>(
      "button [aria-hidden='true']"
    )!;
    const style = getComputedStyle(badge);
    const box = rect(badge);
    const picture = rect(image());

    expect(style.display).not.toBe("none");
    expect(style.visibility).toBe("visible");
    expect(Number(style.opacity)).toBe(1);
    expect(box.width).toBe(28);
    expect(box.height).toBe(28);
    expect(picture.x + picture.width - (box.x + box.width)).toBe(8);
    expect(picture.y + picture.height - (box.y + box.height)).toBe(8);
    expect(style.borderTopWidth).toBe("1px");
    expect(style.borderTopLeftRadius).toBe("6px");
    expectColor(style.backgroundColor, "rgba(30, 30, 30, 0.75)");
    expectColor(style.borderTopColor, "rgba(255, 255, 255, 0.12)");
    const icon = badge.querySelector("svg")!.getBoundingClientRect();
    expect([icon.width, icon.height]).toEqual([14, 14]);
    expectColor(getComputedStyle(badge.querySelector("svg")!).color, "#dadada");
  });

  // Why: the badge brightens to say "this is the control", for the mouse and
  // for the keyboard alike.
  it("brightens the badge on hover and on keyboard focus", async () => {
    await mountStyled(src => `<p>${img(src)}</p>`);
    initializeImageLightbox();
    const button = root.querySelector<HTMLButtonElement>("button")!;
    const badge = root.querySelector<HTMLElement>(
      "button [aria-hidden='true']"
    )!;
    const bright = () => {
      const s = getComputedStyle(badge);
      return [s.borderTopColor, s.backgroundColor];
    };
    const rest = bright();

    await userEvent.hover(button);
    await expect.poll(() => bright()[0]).not.toBe(rest[0]);
    await expect.poll(() => alphaOf(bright()[0]!)).toBeCloseTo(77, -0.5);
    await expect.poll(() => alphaOf(bright()[1]!)).toBeCloseTo(230, -0.5);

    await userEvent.unhover(button);
    await expect.poll(() => bright()[0]).toBe(rest[0]);

    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    await expect.poll(() => alphaOf(bright()[0]!)).toBeCloseTo(77, -0.5);
  });

  // Why: the focus ring is drawn around the button, so it must have the
  // image's rounded corners rather than a square box around a round picture.
  it("rings a focused button with the image's radius", async () => {
    await mountStyled(src => `<p>${img(src)}</p>`);
    initializeImageLightbox();
    await userEvent.tab();
    const button = root.querySelector<HTMLButtonElement>("button")!;
    expect(document.activeElement).toBe(button);
    expect(getComputedStyle(button).borderRadius).toBe("8px");
  });

  describe("the open dialog", () => {
    const picture = async (width: number, height: number) => {
      await mountStyled(
        src =>
          `<p><img data-astro-image src="${src}" width="400" height="300" alt="Big"></p>`,
        [width, height]
      );
      initializeImageLightbox();
      root.querySelector("button")!.click();
      expect(isOpen()).toBe(true);
      const shown = dialogImage();
      await expect.poll(() => shown.complete && shown.naturalWidth).toBe(width);
      return shown;
    };

    // Why: the point of the lightbox is that the whole picture is visible:
    // whatever its shape, it must sit inside the viewport with the padding
    // the design gives each width (16px on a phone, 32px from md up).
    for (const [name, viewport, pad] of [
      ["a phone", [390, 844], 16],
      ["a desktop", [1280, 800], 32],
    ] as const) {
      for (const [shape, width, height] of [
        ["wide", 3000, 500],
        ["tall", 600, 3000],
        ["small", 120, 80],
      ] as const) {
        it(`fits a ${shape} image within the viewport on ${name}`, async () => {
          await page.viewport(...viewport);
          const shown = await picture(width, height);
          const box = rect(shown);
          expect(box.x).toBeGreaterThanOrEqual(pad - 0.5);
          expect(box.y).toBeGreaterThanOrEqual(pad - 0.5);
          expect(box.x + box.width).toBeLessThanOrEqual(
            viewport[0] - pad + 0.5
          );
          expect(box.y + box.height).toBeLessThanOrEqual(
            viewport[1] - pad + 0.5
          );
          // Centered, and in proportion.
          expect(box.x + box.width / 2).toBeCloseTo(viewport[0] / 2, 0);
          expect(box.y + box.height / 2).toBeCloseTo(viewport[1] / 2, 0);
          expect(box.width / box.height).toBeCloseTo(width / height, 1);
          expect(getComputedStyle(shown).borderRadius).toBe("8px");
        });
      }
    }

    // Why: the page must stay exactly where the reader left it. Locking
    // scroll by putting `overflow: hidden` on `html` hands the viewport's
    // scrolling to `body` (the page sets `html, body { height: 100% }` and
    // `body { overflow-x: hidden }`), which scrolls on its own and clamps the
    // page to the top: it jumped there and stayed there. Checking the
    // computed `overflow` cannot see that; the position can. The real reset
    // and base styles are loaded, which is what makes this fail on that rule.
    for (const [how, close] of [
      ["Escape", () => userEvent.keyboard("{Escape}")],
      ["the close button", () => userEvent.click(closeButton())],
    ] as const) {
      it(`keeps the page's scroll position while open and after ${how}`, async () => {
        await mountStyled(
          src =>
            `<div style="height:3000px"></div><p>${img(src)}</p><div style="height:3000px"></div>`
        );
        initializeImageLightbox();
        const trigger = root.querySelector("button")!;
        trigger.scrollIntoView({ block: "center" });
        const frame = () =>
          new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        await frame();
        const scrolled = window.scrollY;
        const at = rect(trigger);
        expect(scrolled).toBeGreaterThan(2000);

        trigger.click();
        await frame();
        expect(isOpen()).toBe(true);
        expect(window.scrollY).toBe(scrolled);
        expect(rect(trigger)).toEqual(at);

        await close();
        await frame();
        expect(isOpen()).toBe(false);
        expect(window.scrollY).toBe(scrolled);
        expect(rect(trigger)).toEqual(at);
      });
    }

    // Why: it is a lightbox only if the dialog covers the page and is dark
    // around the picture; the dialog itself is see-through so only the
    // backdrop darkens, and the page cannot scroll behind it.
    it("fills the viewport over a 90% black backdrop and locks page scroll", async () => {
      await picture(800, 600);
      const box = rect(dialog());
      expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, 390, 844]);
      expectColor(
        getComputedStyle(dialog()).backgroundColor,
        "rgba(0, 0, 0, 0)"
      );
      expectColor(
        getComputedStyle(dialog(), "::backdrop").backgroundColor,
        "rgba(0, 0, 0, 0.9)"
      );
      // On the body, whose overflow the page already hands to the viewport;
      // on `html` it would make the body its own scroller (see below).
      expect(getComputedStyle(document.body).overflowY).toBe("hidden");
      expect(getComputedStyle(document.documentElement).overflow).toBe(
        "visible"
      );

      await userEvent.keyboard("{Escape}");
      expect(getComputedStyle(document.body).overflowY).not.toBe("hidden");
    });

    // Why: the close button is the only way out on a phone; it must be a
    // comfortable 44px target in the top-right corner, 12px in on phones and
    // 24px in from md up.
    for (const [name, viewport, inset] of [
      ["a phone", [390, 844], 12],
      ["a desktop", [1280, 800], 24],
    ] as const) {
      it(`places a 44px close button ${inset}px from the corner on ${name}`, async () => {
        await page.viewport(...viewport);
        await picture(800, 600);
        const button = closeButton();
        // The pointer stays where an earlier test left it, which may be
        // over this button: check the resting colors.
        await userEvent.unhover(button);
        const box = rect(button);
        const style = getComputedStyle(button);
        expect([box.width, box.height]).toEqual([44, 44]);
        expect(box.y).toBe(inset);
        expect(viewport[0] - (box.x + box.width)).toBe(inset);
        expect(style.borderTopLeftRadius).toBe("8px");
        expectColor(style.borderTopColor, "#363636");
        expectColor(style.backgroundColor, "rgba(38, 38, 38, 0.85)");
        const icon = button.querySelector("svg")!.getBoundingClientRect();
        expect([icon.width, icon.height]).toEqual([20, 20]);
      });
    }

    // Why: the border turning light on hover is the only hover cue.
    it("lightens the close button's border on hover", async () => {
      await picture(800, 600);
      await userEvent.hover(closeButton());
      await expect
        .poll(() => channels(getComputedStyle(closeButton()).borderTopColor)[0])
        .toBe(0xb3);
    });

    // Why: the padding around the picture is a click target for closing, so
    // it has to belong to the dialog rather than to anything inert.
    it("closes when the padding beside the image is clicked", async () => {
      await picture(3000, 500);
      await page
        .elementLocator(dialog())
        .click({ position: { x: 200, y: 20 } });
      expect(isOpen()).toBe(false);
    });

    /** A note image (SRC in `attributes` is its blob URL), loaded. */
    const mountEnlargeable = async (
      size: [number, number],
      attributes: string
    ) => {
      await mountStyled(
        src =>
          `<p><img data-astro-image src="${src}" ${attributes.replaceAll("SRC", src)} width="400" height="300" alt="Big"></p>`,
        size
      );
      initializeImageLightbox();
      const note = root.querySelector("img")!;
      await expect.poll(() => note.complete && note.naturalWidth).toBeTruthy();
    };
    const enlarge = async (size: [number, number], attributes: string) => {
      await mountEnlargeable(size, attributes);
      root.querySelector("button")!.click();
      const shown = dialogImage();
      await expect.poll(() => shown.complete && shown.currentSrc).toBeTruthy();
      return rect(shown);
    };
    const fileWidth = () =>
      dialogImage().style.getPropertyValue("--lightbox-file-width");

    // Why: sizes="100vw" tells the browser to fetch a big file, but it also
    // makes the image's intrinsic width the whole viewport, which would
    // stretch a small file into a blur. "Full size" is the file's own width
    // (the largest srcset descriptor), never larger.
    it("renders an image no wider than its file in a large viewport", async () => {
      await page.viewport(1280, 800);
      const box = await enlarge(
        [300, 200],
        'srcset="SRC 150w, SRC 300w" sizes="515px"'
      );
      expect(fileWidth()).toBe("300px");
      expect([box.width, box.height]).toEqual([300, 200]);
    });

    // Why: the cap is a ceiling, not a size: a file wider than the viewport
    // still has to fit inside the padding.
    it("still fits a file wider than the viewport", async () => {
      await page.viewport(390, 844);
      const box = await enlarge(
        [3000, 500],
        'srcset="SRC 1500w, SRC 3000w" sizes="515px"'
      );
      expect(fileWidth()).toBe("3000px");
      expect(box.width).toBeCloseTo(390 - 32, 0);
    });

    // Why: with no srcset (a remote image, an SVG) the file's own width is
    // all there is, and a tiny image must not be stretched either.
    it("caps an image without a srcset at its natural width", async () => {
      await page.viewport(1280, 800);
      const box = await enlarge([300, 200], "");
      expect(fileWidth()).toBe("300px");
      expect(box.width).toBe(300);
    });

    // Why: the dialog is shared. A second image must get its own cap (or
    // none), not keep the first one's.
    it("replaces the cap on each open", async () => {
      await page.viewport(1280, 800);
      await enlarge([300, 200], 'srcset="SRC 300w" sizes="515px"');
      expect(fileWidth()).toBe("300px");
      await userEvent.keyboard("{Escape}");

      // Not loaded, so the srcset is all there is to go by.
      const second = document.createElement("p");
      second.innerHTML =
        '<img src="/a.png" srcset="/a.png 900w, /b.png 1800w" alt="Two">';
      root.querySelector("main")!.append(second);
      initializeImageLightbox();
      root.querySelectorAll("button")[1]!.click();
      expect(fileWidth()).toBe("1800px");
      await userEvent.keyboard("{Escape}");

      // No srcset and not loaded: nothing to cap by, so no cap at all.
      const third = document.createElement("p");
      third.innerHTML = '<img src="/missing.png" alt="Three">';
      root.querySelector("main")!.append(third);
      initializeImageLightbox();
      root.querySelectorAll("button")[2]!.click();
      expect(fileWidth()).toBe("");
    });
  });
});
