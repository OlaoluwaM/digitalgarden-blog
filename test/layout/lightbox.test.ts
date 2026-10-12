/**
 * The image lightbox on a built note, in real Chrome at a phone and a
 * desktop width: the trigger wraps the image without moving it, the dialog
 * shows the whole picture inside the viewport with no sideways page scroll,
 * the page passes axe closed and open, and the badge and dialog stay out of
 * print.
 *
 * Why this level and this fixture: the script's behavior is covered on
 * fixture markup (test/browser/imageLightbox.test.ts), but whether the
 * rules in lightbox.css and typography.css produce the right layout depends
 * on Tailwind's output and the full cascade, and whether a wrapped image
 * looks like an unwrapped one can only be compared on a real page, with and
 * without JavaScript. The real note with an image is a published post; this
 * test builds a throwaway copy of the site (test/support/fixture-site.ts)
 * with a generated image so it does not depend on that post.
 */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
import {
  buildFixture,
  createFixtureProject,
  type FixtureProject,
} from "../support/fixture-site.ts";
import { serveStatic, type StaticServer } from "../support/static-server.ts";

let fixture: FixtureProject;
let server: StaticServer;
let browser: Browser;
let origin: string;
let axeSource: string;

const NOTE = "/posts/lightbox/";
const CASES = "/posts/lightbox-cases/";
const SCROLL = "/posts/lightbox-scroll/";
const SIZED = "/posts/lightbox-sized/";
const IMAGE = "/img/user/Extras/Assets/harbour.png";
const SMALL = "/img/user/Extras/Assets/buoy.png";
const VIEWPORTS = [
  { width: 390, height: 844, inset: 12, padding: 16 },
  { width: 1440, height: 900, inset: 24, padding: 32 },
] as const;

before(async () => {
  fixture = await createFixtureProject("lightbox-test");
  await fixture.writeNote("Home.md", {
    title: "Home",
    permalink: "/",
    home: true,
    body: "Welcome.",
  });
  // A tall picture, so that the enlarged one is limited by the viewport's
  // height on a desktop and by its width on a phone.
  const directory = join(fixture.project, "src/site/img/user/Extras/Assets");
  await mkdir(directory, { recursive: true });
  await sharp({
    create: {
      width: 1200,
      height: 1500,
      channels: 3,
      background: { r: 74, g: 102, b: 85 },
    },
  })
    .png()
    .toFile(join(directory, "harbour.png"));
  // A small one: narrower than the note column, so it is centered, which a
  // picture as wide as the column would not show.
  await sharp({
    create: {
      width: 240,
      height: 160,
      channels: 3,
      background: { r: 180, g: 90, b: 60 },
    },
  })
    .png()
    .toFile(join(directory, "buoy.png"));
  await fixture.writeNote("Posts/Lightbox.md", {
    title: "Lightbox",
    permalink: NOTE,
    body: [
      `![A harbour at dusk](${IMAGE})`,
      "A paragraph between the pictures.",
      `![A buoy](${SMALL})`,
      `[![A linked harbour](${IMAGE})](https://example.com/)`,
    ].join("\n\n"),
  });
  // Every way an image can sit in a note, to compare with and without the
  // script: in a sentence, two on a line, two apart by a soft break, alone
  // in a list item and in a table cell, in a callout above text, and in a
  // task item (which is a label, so it gets no button).
  await fixture.writeNote("Posts/Lightbox cases.md", {
    title: "Lightbox cases",
    permalink: CASES,
    body: [
      `Before ![An inline one](${SMALL}) after *with* more text around it.`,
      `![First of two](${SMALL}) ![Second of two](${SMALL})`,
      `![Soft one](${SMALL})\n![Soft two](${SMALL})`,
      `- ![In a list](${SMALL})\n- A second item`,
      `| Picture | Text |\n| --- | --- |\n| ![In a cell](${SMALL}) | Beside it |`,
      `- [ ] A task ![In a task](${SMALL})`,
      `![Alone and small](${SMALL})`,
      `![Alone and wide](${IMAGE})`,
      // Last: a callout's title is taller with JavaScript (its fold control),
      // which moves everything after it and is not about images.
      `> [!note] A callout\n> ![In a callout](${SMALL})\n> Text after the picture.`,
      // A folded callout with a picture in its title (a role=button).
      `> [!tip]- A folded callout ![In a title](${SMALL})\n> Hidden text.`,
    ].join("\n\n"),
  });
  // A long page with a picture far down, to scroll to.
  const filler = (count: number) =>
    Array.from(
      { length: count },
      (_, i) =>
        `Filler paragraph ${i + 1}. It only gives the page height, so the picture below is well past the first screen.`
    );
  await fixture.writeNote("Posts/Lightbox scroll.md", {
    title: "Lightbox scroll",
    permalink: SCROLL,
    body: [
      ...filler(60),
      `![A harbour far down](${IMAGE})`,
      ...filler(60),
    ].join("\n\n"),
  });
  // An Obsidian size (`![[harbour.png|200]]`) on the 1200px harbour.
  await fixture.writeNote("Posts/Lightbox sized.md", {
    title: "Lightbox sized",
    permalink: SIZED,
    body: `![A sized harbour.png\\|200](${IMAGE})`,
  });
  const { status, output } = await buildFixture(fixture.project);
  assert.equal(status, 0, output);

  server = await serveStatic(join(fixture.project, "dist"));
  origin = server.origin;
  browser = await chromium.launch({
    executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH || undefined,
  });
  axeSource = await readFile("node_modules/axe-core/axe.min.js", "utf8");
});

after(async () => {
  await browser?.close();
  await server?.close();
  await fixture?.cleanup();
});

async function withPage<T>(
  viewport: { width: number; height: number },
  run: (page: Page) => Promise<T>,
  {
    path = NOTE,
    ...options
  }: { javaScriptEnabled?: boolean; path?: string; hasTouch?: boolean } = {}
): Promise<T> {
  const context = await browser.newContext({ viewport, ...options });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}${path}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return await run(page);
  } finally {
    await context.close();
  }
}

const TRIGGER = "main.content p > button[aria-haspopup='dialog']";

async function open(page: Page, index = 0) {
  await page.locator(TRIGGER).nth(index).click();
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>(
      "dialog.image-lightbox[open] img"
    );
    return image?.complete && image.naturalWidth > 0;
  });
}

async function axeViolations(page: Page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (context: Document) => Promise<{
            violations: { id: string; nodes: { target: string[] }[] }[];
          }>;
        };
      }
    ).axe;
    const result = await axe.run(document);
    return result.violations.flatMap(violation =>
      violation.nodes.map(node => `${violation.id}: ${node.target.join(" ")}`)
    );
  });
}

/** The box of every note image, in page order. */
const imageBoxes = (page: Page) =>
  page
    .locator("main.content img")
    .evaluateAll(images =>
      images.map(image => image.getBoundingClientRect().toJSON() as object)
    );

describe("image lightbox", () => {
  // Why: the owner's rule is every note image gets a button, except a linked
  // image, which keeps its link. Built markup, not fixture markup, is what
  // readers get.
  it("wraps the note images and leaves the linked one alone", async () => {
    await withPage(VIEWPORTS[0], async page => {
      const labels = await page
        .locator("main.content button[aria-haspopup='dialog']")
        .evaluateAll(buttons => buttons.map(b => b.getAttribute("aria-label")));
      assert.deepEqual(labels, [
        "Enlarge image: A harbour at dusk",
        "Enlarge image: A buoy",
      ]);
      assert.equal(await page.locator("main.content a > img").count(), 1);
      assert.equal(await page.locator("main.content a button").count(), 0);
    });
  });

  // Why: progressive enhancement means the page without JavaScript is the
  // reference, and the wrapper may not move or resize a picture (the design's
  // rule). Compare the same images with and without the script, at both widths.
  for (const viewport of VIEWPORTS) {
    it(`leaves every image where it was at ${viewport.width}px`, async () => {
      const plain = await withPage(viewport, imageBoxes, {
        javaScriptEnabled: false,
      });
      const wrapped = await withPage(viewport, async page => {
        assert.equal(await page.locator(TRIGGER).count(), 2);
        return imageBoxes(page);
      });
      assert.ok(plain && wrapped);
      assert.deepEqual(wrapped, plain);
    });
  }

  // Why: the page without JavaScript must be unchanged: no button, no dialog.
  it("adds nothing without JavaScript", async () => {
    await withPage(
      VIEWPORTS[0],
      async page => {
        assert.equal(await page.locator(TRIGGER).count(), 0);
        assert.equal(await page.locator("dialog.image-lightbox").count(), 0);
      },
      { javaScriptEnabled: false }
    );
  });

  // Why: the point of the dialog is seeing the whole picture. On the real
  // cascade the enlarged image has to sit inside the viewport with the
  // design's padding, nothing may scroll sideways, and the controls have to
  // be where the design puts them.
  for (const viewport of VIEWPORTS) {
    it(`shows the whole image in the viewport at ${viewport.width}px`, async () => {
      await withPage(viewport, async page => {
        await open(page);
        const box = await page
          .locator("dialog.image-lightbox img")
          .boundingBox();
        assert.ok(box);
        const pad = viewport.padding;
        assert.ok(box.x >= pad - 0.5, `left ${box.x}`);
        assert.ok(box.y >= pad - 0.5, `top ${box.y}`);
        assert.ok(box.x + box.width <= viewport.width - pad + 0.5);
        assert.ok(box.y + box.height <= viewport.height - pad + 0.5);

        const close = await page
          .locator("dialog.image-lightbox button[aria-label='Close']")
          .boundingBox();
        assert.ok(close);
        assert.deepEqual([close.width, close.height], [44, 44]);
        assert.equal(close.y, viewport.inset);
        assert.equal(viewport.width - (close.x + close.width), viewport.inset);

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth
        );
        assert.ok(overflow <= 0, `The page scrolls sideways by ${overflow}px`);
        assert.equal(
          await page.evaluate(() => getComputedStyle(document.body).overflowY),
          "hidden"
        );
      });
    });

    // Why: "full size" means up to the file's own width. The dialog asks the
    // browser for the whole viewport (sizes="100vw"), which would stretch a
    // small file past what it holds; the 240px buoy is the case where the
    // viewport is far wider than the file, at both widths.
    it(`never renders an image wider than its file at ${viewport.width}px`, async () => {
      for (const index of [0, 1]) {
        await withPage(viewport, async page => {
          await open(page, index);
          const { width, fileWidth } = await page
            .locator("dialog.image-lightbox img")
            .evaluate(image => {
              const img = image as HTMLImageElement;
              const widths = [
                ...(img.getAttribute("srcset") ?? "").matchAll(/(\d+)w\b/g),
              ].map(match => Number(match[1]));
              return {
                width: img.getBoundingClientRect().width,
                // The built srcset lists the files; without one, the file.
                fileWidth: widths.length
                  ? Math.max(...widths)
                  : img.naturalWidth,
              };
            });
          assert.ok(fileWidth > 0, "The file's width must be known");
          assert.ok(
            width <= fileWidth + 0.5,
            `Image ${index} renders ${width}px from a ${fileWidth}px file`
          );
        });
      }
    });

    // Why: an Obsidian size shows a big file small in the note; the
    // lightbox is where a reader looks at it whole. A `|200` size once
    // capped the srcset at 400px, so the enlarged 1200px harbour stopped
    // there. It must grow to fit the viewport (its height is the limit
    // here), as if it had no size. Only a desktop is wider than the old
    // 400px cap; on a phone the viewport is the limit either way.
    it(
      `enlarges a sized image past twice its size at ${viewport.width}px`,
      {
        skip: viewport.width - 2 * viewport.padding <= 400,
      },
      async () => {
        await withPage(
          viewport,
          async page => {
            await open(page);
            const width = await page
              .locator("dialog.image-lightbox img")
              .evaluate(image => image.getBoundingClientRect().width);
            const fit = Math.min(
              1200,
              viewport.width - 2 * viewport.padding,
              ((viewport.height - 2 * viewport.padding) * 1200) / 1500
            );
            assert.ok(
              Math.abs(width - fit) <= 1,
              `Expected ${fit}px, got ${width}px`
            );
          },
          { path: SIZED }
        );
      }
    );

    // Why: axe sees the page differently with a modal open (everything
    // behind it is inert, and the dialog must be named), so both states need
    // a run.
    it(`passes axe closed and open at ${viewport.width}px`, async () => {
      await withPage(viewport, async page => {
        assert.deepEqual(await axeViolations(page), []);
        await open(page);
        assert.deepEqual(await axeViolations(page), []);
      });
    });
  }

  // Why: Escape and the close button both have to give the page back and put
  // focus on the picture's button, in the built page as in the fixture.
  it("closes and returns focus to the trigger", async () => {
    await withPage(VIEWPORTS[1], async page => {
      await open(page);
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator("dialog.image-lightbox[open]").count(),
        0
      );
      assert.ok(
        await page
          .locator(TRIGGER)
          .first()
          .evaluate(b => b === document.activeElement)
      );

      await open(page);
      await page
        .locator("dialog.image-lightbox button[aria-label='Close']")
        .click();
      assert.equal(
        await page.locator("dialog.image-lightbox[open]").count(),
        0
      );
      assert.ok(
        await page
          .locator(TRIGGER)
          .first()
          .evaluate(b => b === document.activeElement)
      );
    });
  });

  // Why: Enter opens the lightbox on its first keydown and moves focus to
  // Close, so a held key's auto-repeat pressed Close, then the trigger, and
  // the lightbox flickered open and shut. Repeats must do nothing. Only a
  // real key press (not a synthetic event) activates a button, so this needs
  // the built page and Playwright's keyboard: each extra down() is a repeat.
  it("stays open while Enter is held down", async () => {
    await withPage(VIEWPORTS[1], async page => {
      await page.locator(TRIGGER).first().focus();
      const states: number[] = [];
      for (let press = 0; press < 4; press++) {
        await page.keyboard.down("Enter");
        states.push(await page.locator("dialog.image-lightbox[open]").count());
      }
      await page.keyboard.up("Enter");
      assert.deepEqual(states, [1, 1, 1, 1]);
      assert.equal(
        await page.locator("dialog.image-lightbox[open]").count(),
        1
      );
    });
  });

  // Why: the mirror case. Enter on Close closes the dialog and puts focus
  // back on the image's button, where the held key's auto-repeat would open
  // it again. Repeats on the button do nothing either.
  it("stays closed while Enter is held down on Close", async () => {
    await withPage(VIEWPORTS[1], async page => {
      await open(page);
      await page
        .locator("dialog.image-lightbox button[aria-label='Close']")
        .focus();
      const states: number[] = [];
      for (let press = 0; press < 4; press++) {
        await page.keyboard.down("Enter");
        states.push(await page.locator("dialog.image-lightbox[open]").count());
      }
      await page.keyboard.up("Enter");
      assert.deepEqual(states, [0, 0, 0, 0]);
    });
  });

  // Why: print shows the note's pictures, not UI for enlarging them. The
  // badge and an open dialog are hidden, and the image prints at the size it
  // has without the wrapper.
  it("prints the image as without the lightbox, with no badge", async () => {
    const viewport = VIEWPORTS[1];
    const plain = await withPage(
      viewport,
      async page => {
        await page.emulateMedia({ media: "print" });
        return imageBoxes(page);
      },
      { javaScriptEnabled: false }
    );
    await withPage(viewport, async page => {
      await page.emulateMedia({ media: "print" });
      assert.deepEqual(await imageBoxes(page), plain);
      assert.equal(
        await page
          .locator("main.content button [aria-hidden='true']")
          .first()
          .evaluate(badge => getComputedStyle(badge).display),
        "none"
      );

      await page.emulateMedia({ media: "screen" });
      await open(page);
      await page.emulateMedia({ media: "print" });
      assert.equal(
        await page
          .locator("dialog.image-lightbox")
          .evaluate(dialog => getComputedStyle(dialog).display),
        "none"
      );
    });
  });

  // Why: "the button changes nothing about the image" is the design's rule,
  // and the images that are not alone in a paragraph are where a wrapper
  // goes wrong: Tailwind's reset makes every image a block, so an inline
  // button moves one into the text line, puts two side by side, and grows a
  // list item or table cell. Compare the box of everything that could move
  // (every img, p, li, td, and callout), on the built page, two ways:
  // - the page with JavaScript off and on, for everything before the callout
  //   (a callout's title gains its fold control with JavaScript, which is
  //   4px taller, and has nothing to do with images);
  // - the same page with JavaScript on, before and after the buttons are
  //   taken off again, which isolates the buttons and covers the callout.
  type Box = {
    what: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  const measure = (page: Page, inCallouts: boolean): Promise<Box[]> =>
    page.evaluate(withCallouts => {
      return [...document.querySelectorAll("main.content *")]
        .filter(element => element.matches("img, p, li, td, .callout"))
        .filter(element => {
          // Without callouts: only what comes before the first one, since
          // what comes after it moves with the callout's title.
          const callout = document.querySelector(".callout");
          return (
            withCallouts ||
            !callout ||
            !!(
              callout.compareDocumentPosition(element) &
              Node.DOCUMENT_POSITION_PRECEDING
            )
          );
        })
        .map(element => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return {
            what: `${element.tagName.toLowerCase()} ${(element.getAttribute("alt") ?? element.textContent).slice(0, 24)}`,
            x,
            y,
            width,
            height,
          };
        });
    }, inCallouts);
  const moved = (was: Box[], now: Box[]) =>
    was.flatMap((box, i) =>
      (["x", "y", "width", "height"] as const)
        .filter(key => Math.abs(box[key] - now[i]![key]) > 0.5)
        .map(key => `${box.what}: ${key} was ${box[key]}, is ${now[i]![key]}`)
    );
  for (const viewport of VIEWPORTS) {
    it(`leaves every box in place for images in every position at ${viewport.width}px`, async () => {
      const plain = await withPage(viewport, page => measure(page, false), {
        path: CASES,
        javaScriptEnabled: false,
      });
      const wrapped = await withPage(viewport, page => measure(page, false), {
        path: CASES,
      });
      assert.ok(plain.length >= 15, `Only ${plain.length} boxes measured`);
      assert.equal(wrapped.length, plain.length);
      assert.deepEqual(moved(plain, wrapped), []);
    });

    it(`leaves every box in place, callout included, when the buttons come off at ${viewport.width}px`, async () => {
      await withPage(
        viewport,
        async page => {
          const wrapped = await measure(page, true);
          assert.ok(wrapped.some(box => box.what.startsWith("div")));
          await page.evaluate(() =>
            document
              .querySelectorAll("main.content button.lightbox-trigger")
              .forEach(button =>
                button.replaceWith(button.querySelector("img")!)
              )
          );
          assert.equal(
            await page.locator("main.content button.lightbox-trigger").count(),
            0
          );
          assert.deepEqual(moved(await measure(page, true), wrapped), []);
        },
        { path: CASES }
      );
    });
  }

  // Why: the cases note must really hold the cases: a button for each
  // picture that is not in a task item's label (nested interactive content).
  it("wraps every image in the cases note except the one in a task item", async () => {
    await withPage(
      VIEWPORTS[1],
      async page => {
        const labels = await page
          .locator("main.content button.lightbox-trigger")
          .evaluateAll(buttons =>
            buttons.map(b => b.getAttribute("aria-label"))
          );
        assert.ok(labels.includes("Enlarge image: An inline one"));
        assert.ok(labels.includes("Enlarge image: In a cell"));
        assert.ok(labels.includes("Enlarge image: In a callout"));
        assert.ok(!labels.some(label => label?.includes("In a task")));
        assert.ok(!labels.some(label => label?.includes("In a title")));
        assert.equal(await page.locator("main.content img").count(), 12);
        assert.equal(labels.length, 10);
        assert.equal(
          await page.locator("main.content label button").count(),
          0
        );
      },
      { path: CASES }
    );
  });

  // Why: the reader must stay where they were. Opening used to put
  // `overflow: hidden` on `html`, which hands the viewport's scrolling to
  // `body` and clamps the page to the top, and closing left it there. The
  // scroll position and the trigger's place on screen must not change while
  // the dialog is open or after it closes, however it is closed.
  const closers: [string, (page: Page) => Promise<unknown>][] = [
    ["Escape", page => page.keyboard.press("Escape")],
    [
      "the close button",
      page =>
        page
          .locator("dialog.image-lightbox button[aria-label='Close']")
          .click(),
    ],
    ["a click on the backdrop", page => page.mouse.click(4, 4)],
  ];
  for (const viewport of VIEWPORTS) {
    for (const [how, close] of closers) {
      it(`keeps the scroll position while open and after ${how} at ${viewport.width}px`, async () => {
        await withPage(
          viewport,
          async page => {
            await page
              .locator(TRIGGER)
              .evaluate(trigger => trigger.scrollIntoView({ block: "center" }));
            await page.evaluate(
              () => new Promise(resolve => requestAnimationFrame(resolve))
            );
            const state = () =>
              page.evaluate(() => {
                const trigger = document.querySelector(
                  "main.content button.lightbox-trigger"
                )!;
                const { x, y, width, height } = trigger.getBoundingClientRect();
                return { scrollY: window.scrollY, x, y, width, height };
              });
            const before = await state();
            assert.ok(
              before.scrollY > 1000,
              `Only scrolled to ${before.scrollY}`
            );

            await open(page);
            assert.deepEqual(await state(), before);
            await close(page);
            await page.waitForFunction(
              () => !document.querySelector("dialog.image-lightbox[open]")
            );
            assert.deepEqual(await state(), before);
          },
          { path: SCROLL }
        );
      });
    }
  }

  // Why: printing a page while the lightbox is open should print the page.
  // The same rule that jumped the scroll made Chrome lay out only the first
  // page when printing, so compare the page counts of the PDF.
  it("prints as many pages with the dialog open as closed", async () => {
    const pages = (pdf: Buffer) =>
      (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
    await withPage(
      VIEWPORTS[1],
      async page => {
        const closed = pages(await page.pdf());
        assert.ok(closed > 2, `Only ${closed} pages to compare`);
        await open(page);
        assert.equal(pages(await page.pdf()), closed);
      },
      { path: SCROLL }
    );
  });

  // Why: a double-click on the picture is two clicks; the second lands on
  // the backdrop where the trigger was, and must not undo the first.
  it("stays open after a double-click on the trigger", async () => {
    await withPage(VIEWPORTS[1], async page => {
      await page
        .locator(TRIGGER)
        .first()
        .dblclick({ position: { x: 2, y: 2 } });
      await page.waitForTimeout(300);
      assert.equal(
        await page.locator("dialog.image-lightbox[open]").count(),
        1
      );
    });
  });

  // Why: with a real pointer, a press that starts on the backdrop and ends
  // on the image (or the reverse) is not a click on the backdrop.
  it("stays open when a press crosses between the backdrop and the image", async () => {
    await withPage(VIEWPORTS[1], async page => {
      await open(page);
      const box = await page.locator("dialog.image-lightbox img").boundingBox();
      assert.ok(box);
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.mouse.move(4, 4);
      await page.mouse.down();
      await page.mouse.move(centre.x, centre.y, { steps: 4 });
      await page.mouse.up();
      assert.equal(
        await page.locator("dialog.image-lightbox[open]").count(),
        1
      );

      await page.mouse.move(centre.x, centre.y);
      await page.mouse.down();
      await page.mouse.move(4, 4, { steps: 4 });
      await page.mouse.up();
      assert.equal(
        await page.locator("dialog.image-lightbox[open]").count(),
        1
      );
    });
  });

  // Why: a collapsible callout's title is a role=button that callouts.ts
  // makes at startup, and the lightbox leaves images inside such elements
  // alone. That only works if the callout script has run first (BaseLayout
  // orders them), so check it on the built page rather than on fixtures.
  it("leaves an image in a collapsible callout's title unwrapped", async () => {
    await withPage(
      VIEWPORTS[1],
      async page => {
        const title = page.locator(
          ".callout-title[role='button']:has(img[alt='In a title'])"
        );
        assert.equal(await title.count(), 1);
        assert.equal(await title.locator("button").count(), 0);
      },
      { path: CASES }
    );
  });

  // Why: after the lightbox closes from a click, the rest of a double-click
  // must not reach the page. A double-click on Close closed it on the first
  // click and pressed whatever lies under Close with the second (the mobile
  // navbar's search button, which opened search); a double-click on the
  // backdrop over a link followed the link. The same for two quick taps.
  it("swallows the second click of a double-click on Close", async () => {
    await withPage(VIEWPORTS[0], async page => {
      await open(page);
      await page
        .locator("dialog.image-lightbox button[aria-label='Close']")
        .dblclick();
      await page.waitForTimeout(400);
      assert.equal(await page.locator("dialog[open]").count(), 0);
    });
  });

  it("swallows the second tap of a double-tap on Close", async () => {
    await withPage(
      VIEWPORTS[0],
      async page => {
        await open(page);
        const box = await page
          .locator("dialog.image-lightbox button[aria-label='Close']")
          .boundingBox();
        assert.ok(box);
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.touchscreen.tap(x, y);
        await page.waitForTimeout(60);
        await page.touchscreen.tap(x, y);
        await page.waitForTimeout(400);
        assert.equal(await page.locator("dialog[open]").count(), 0);
      },
      { hasTouch: true }
    );
  });

  it("swallows the second click of a double-click on the backdrop over a link", async () => {
    await withPage(VIEWPORTS[1], async page => {
      await open(page);
      const box = await page
        .locator("nav[aria-label='Notes'] a.filename[href='/']")
        .boundingBox();
      assert.ok(box);
      await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(600);
      assert.equal(new URL(page.url()).pathname, NOTE);
      assert.equal(await page.locator("dialog[open]").count(), 0);
    });
  });

  // Why: the lightbox is a modal, and so is search. Opening search from the
  // keyboard (the page behind the lightbox is inert, so this is the only
  // way) must not stack the two: the lightbox closes, search opens alone,
  // and closing search puts focus back on the picture's button.
  it("closes the lightbox when search opens, and returns focus to its trigger", async () => {
    await withPage(VIEWPORTS[1], async page => {
      await open(page);
      await page.keyboard.press("Control+k");
      await page.waitForFunction(
        () => document.querySelector("#globalsearch[open]") !== null
      );
      assert.deepEqual(
        await page.evaluate(() =>
          [...document.querySelectorAll("dialog[open]")].map(d => d.id)
        ),
        ["globalsearch"]
      );
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.ok(
        await page
          .locator(TRIGGER)
          .first()
          .evaluate(b => b === document.activeElement)
      );
    });
  });

  // Why: with classic scrollbars (Windows, Linux, a mouse on macOS) the
  // lock removes the page's scrollbar, which makes the page wider and shifts
  // it sideways, and the changed wrapping changes the page's height, so the
  // scroll position moves too. Headless Chrome hides scrollbars by default,
  // so this test launches its own browser with them on.
  it("keeps the page's width and scroll position with classic scrollbars", async () => {
    const classic = await chromium.launch({
      executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH || undefined,
      ignoreDefaultArgs: ["--hide-scrollbars"],
    });
    try {
      const context = await classic.newContext({
        viewport: { width: 1024, height: 768 },
      });
      const page = await context.newPage();
      await page.goto(`${origin}${SCROLL}`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page
        .locator(TRIGGER)
        .evaluate(trigger => trigger.scrollIntoView({ block: "center" }));
      // What the reader sees: where the note sits, how wide the page's box
      // is, and how far it is scrolled (the viewport's own width is
      // expected to change, since its scrollbar goes).
      const state = () =>
        page.evaluate(() => {
          const main = document
            .querySelector("main.content")!
            .getBoundingClientRect();
          return {
            scrollY: window.scrollY,
            left: main.left,
            width: main.width,
            bodyWidth: document.body.getBoundingClientRect().width,
          };
        });
      const scrollbar = await page.evaluate(
        () => innerWidth - document.documentElement.clientWidth
      );
      assert.ok(scrollbar > 0, "The page's scrollbar must take space here");
      const before = await state();

      await open(page);
      assert.deepEqual(await state(), before);
      await page.keyboard.press("Escape");
      assert.deepEqual(await state(), before);
    } finally {
      await classic.close();
    }
  });
});
