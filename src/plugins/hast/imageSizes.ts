import { defineHastPlugin } from "satteri";

export interface ImageSize {
  /** The alt text without the size suffix. */
  alt: string;
  width: number;
  height?: number;
}

// Obsidian sizes an image from a last `|` segment: `|300` sets the width and
// `|300x200` the width and height. The Digital Garden publisher keeps that
// segment in the alt text: `![[photo.png|300]]` is published as
// `![photo.png\|300](/img/user/photo.png)`, and a Markdown image such as
// `![Photo|300](photo.png)` keeps its label as written. Surrounding spaces are
// allowed because Eleventy's `Number()` check allowed them.
const SIZE_SUFFIX = /\|\s*(\d+)(?:x(\d+))?\s*$/;

// Split a size suffix off an image's alt text. Anything else, such as a last
// segment that is not a size or a zero dimension, is not a size, so the alt
// text stays as it is.
export function parseImageSize(alt: string): ImageSize | undefined {
  const match = SIZE_SUFFIX.exec(alt);
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = match[2] === undefined ? undefined : Number(match[2]);
  if (!isDimension(width)) return undefined;
  if (height !== undefined && !isDimension(height)) return undefined;
  return {
    alt: alt.slice(0, match.index),
    width,
    ...(height === undefined ? {} : { height }),
  };
}

function isDimension(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

// Move an image's size from its alt text to `width` and `height`. Astro's
// image marker copies these properties into its `getImage()` options, so a
// local image is resized to them; with only a width, the height follows the
// image's aspect ratio. The alt text then describes the image without the
// size, which Eleventy left in it.
export const hastImageSizesPlugin = defineHastPlugin({
  name: "hast-image-sizes",
  element: {
    filter: ["img"],
    visit(node, ctx) {
      const { alt } = node.properties;
      if (typeof alt !== "string") return;
      const size = parseImageSize(alt);
      if (!size) return;

      ctx.setProperty(node, "alt", size.alt);
      ctx.setProperty(node, "width", size.width);
      if (size.height !== undefined) {
        ctx.setProperty(node, "height", size.height);
      }
    },
  },
});
