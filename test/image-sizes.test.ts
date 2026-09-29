/**
 * Obsidian image sizes (`![[photo.png|300]]`, `![[photo.png|300x200]]`).
 * The Digital Garden publisher keeps the size in the alt text, as
 * `![photo.png\|300](/img/user/photo.png)`; the hast plugin moves it to the
 * image's `width` and `height`. The parser tests cover which suffixes count
 * as a size; the processor tests render through the site's configured
 * Markdown processor and read what Astro's image marker passes to
 * getImage(). test/images-build.test.ts checks the resized files.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateConfig } from "astro/config";
import { parse } from "node-html-parser";
import siteConfig from "../astro.config.ts";
import { parseImageSize } from "../src/plugins/hast/imageSizes.ts";

const { markdown } = await validateConfig(
  siteConfig,
  fileURLToPath(new URL("../", import.meta.url)),
  "build"
);
const renderer = await markdown.processor.createRenderer(markdown);

async function render(source: string) {
  const { code } = await renderer.render(source);
  return parse(code);
}

// The options Astro's image marker collected for the page's one local image.
async function imageOptions(source: string) {
  const images = (await render(source)).querySelectorAll("img");
  assert.equal(images.length, 1, source);
  const marker = images[0]!.getAttribute("__ASTRO_IMAGE_");
  assert.ok(marker, `Expected a local image marker for ${source}`);
  return JSON.parse(marker) as {
    alt: string;
    width?: number;
    height?: number;
  };
}

describe("parseImageSize", () => {
  // Why: these are the suffixes Obsidian sizes an image from, in the form
  // the publisher writes them. The size comes off the alt text, which then
  // names the image as it would without one.
  for (const [alt, expected] of [
    ["photo.png|300", { alt: "photo.png", width: 300 }],
    ["photo.png|300x200", { alt: "photo.png", width: 300, height: 200 }],
    ["A photo|300", { alt: "A photo", width: 300 }],
    ["|300", { alt: "", width: 300 }],
  ] as const) {
    it(`reads ${JSON.stringify(alt)} as a size`, () => {
      assert.deepEqual(parseImageSize(alt), expected);
    });
  }

  // Why: the publisher joins the middle segments of
  // `![[photo.png|a|b|300]]` into one, so only the last segment can be a
  // size. The segments before it stay in the alt text.
  it("takes only the last segment as the size", () => {
    assert.deepEqual(parseImageSize("photo.png|a b|300"), {
      alt: "photo.png|a b",
      width: 300,
    });
  });

  // Why: Eleventy read the width with `Number()`, which ignores the spaces
  // around a number, so a note written `![[photo.png| 300 ]]` kept its size.
  it("allows spaces around the size", () => {
    assert.deepEqual(parseImageSize("photo.png| 300x200 "), {
      alt: "photo.png",
      width: 300,
      height: 200,
    });
  });

  // Why: alt text that only looks like a size must stay whole. The
  // publisher calls any segment that `parseInt()` accepts a size
  // ("300px", "2024 trip"), and an image with a zero dimension is hidden,
  // so the plugin accepts only whole, positive numbers.
  for (const alt of [
    "photo.png",
    "300",
    "",
    "photo.png|caption",
    "photo.png|300|caption",
    "photo.png|300px",
    "photo.png|2024 trip",
    "photo.png|300x",
    "photo.png|x200",
    "photo.png|300X200",
    "photo.png|3.5",
    "photo.png|-300",
    "photo.png|0",
    "photo.png|300x0",
    "photo.png|99999999999999999999",
  ]) {
    it(`leaves ${JSON.stringify(alt)} without a size`, () => {
      assert.equal(parseImageSize(alt), undefined);
    });
  }
});

describe("image sizes plugin", () => {
  // Why: `![[photo.png|300]]` is published as `![photo.png\|300](…)`. The
  // width must reach getImage(), which then resizes the image and infers
  // its height, and the size must leave the alt text.
  it("gives getImage() the width from the publisher's embed", async () => {
    assert.deepEqual(await imageOptions("![photo.png\\|300](./photo.png)"), {
      alt: "photo.png",
      width: 300,
      src: "./photo.png",
      index: 0,
    });
  });

  // Why: `![[photo.png|300x200]]` sets both dimensions.
  it("gives getImage() the width and height of a WxH size", async () => {
    const options = await imageOptions("![photo.png\\|300x200](./photo.png)");
    assert.equal(options.alt, "photo.png");
    assert.equal(options.width, 300);
    assert.equal(options.height, 200);
  });

  // Why: the publisher copies a Markdown image's label as written, so
  // Obsidian's `![A photo|300](photo.png)` arrives with an unescaped pipe.
  it("sizes a Markdown-syntax image", async () => {
    const options = await imageOptions("![A photo|300](./photo.png)");
    assert.equal(options.alt, "A photo");
    assert.equal(options.width, 300);
  });

  // Why: an embed in a table cell is where the publisher's `\|` escape
  // matters: it keeps the pipe from splitting the cell, and the image
  // must still be sized.
  it("sizes an image inside a table", async () => {
    const options = await imageOptions(
      "| Photo |\n| --- |\n| ![photo.png\\|300](./photo.png) |"
    );
    assert.equal(options.alt, "photo.png");
    assert.equal(options.width, 300);
  });

  // Why: a remote image is not processed by Astro, so the size must stay
  // on the `<img>` for the browser, as Eleventy's `width` did.
  it("puts the size on a remote image's attributes", async () => {
    const image = (
      await render("![A photo|300x200](https://example.com/photo.png)")
    ).querySelector("img");
    assert.equal(image?.getAttribute("alt"), "A photo");
    assert.equal(image?.getAttribute("width"), "300");
    assert.equal(image?.getAttribute("height"), "200");
  });

  // Why: an image without a size must reach getImage() unchanged, so
  // Astro keeps its intrinsic size and the alt text is not trimmed.
  it("leaves an image without a size unchanged", async () => {
    assert.deepEqual(
      await imageOptions("![photo.png\\|caption](./photo.png)"),
      { alt: "photo.png|caption", src: "./photo.png", index: 0 }
    );
  });
});
