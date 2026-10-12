import { closeSync, openSync, readSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { imageSize } from "image-size";
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

// The srcset widths for an image sized `width` from a file `fileWidth` wide:
// the size and twice it, as Astro offers, plus the file's own width, never
// past the file and each once. They must be exact: satteri passes the list to
// getImage() as strings, and Astro, finding one wider than the file, would
// add the file's width as a number beside an equal string, so the srcset
// would offer that width twice, from two emitted files.
export function srcsetWidths(width: number, fileWidth: number): number[] {
  return [...new Set([width, width * 2, fileWidth])]
    .filter(candidate => candidate <= fileWidth)
    .sort((a, b) => a - b);
}

// A URL with a scheme and host (`https://…`) or protocol-relative (`//…`).
const REMOTE_URL = /^(?:[a-z][a-z\d+.-]*:)?\/\//i;

// The width of a local image's file as Astro sizes it, read from its header.
// `src` is relative to the note (plugins/mdast/images.ts resolves the
// publisher's URLs so). A photo stored on its side with an EXIF orientation
// of 5 or more is shown, and sized by Astro, upright: its width is the stored
// height, as in Astro's own imageMetadata.
function localFileWidth(
  src: unknown,
  noteUrl: URL | undefined
): number | undefined {
  if (typeof src !== "string" || REMOTE_URL.test(src) || !noteUrl) return;
  try {
    const { width, height, orientation } = imageSize(
      readHeader(fileURLToPath(new URL(src, noteUrl)))
    );
    const upright = (orientation ?? 0) >= 5 ? height : width;
    return isDimension(upright) ? upright : undefined;
  } catch {
    return undefined;
  }
}

// The start of a file, as much as image-size's own fromFile reads (512 KiB),
// without reading a large image whole on every render. It holds the
// dimensions of all but files with very large metadata (a JPEG with an
// embedded depth map, say); image-size throws on those, and they keep
// Astro's widths, so the lightbox stops at twice the size.
const HEADER_BYTES = 512 * 1024;
function readHeader(path: string): Uint8Array {
  const fd = openSync(path, "r");
  try {
    const buffer = new Uint8Array(HEADER_BYTES);
    return buffer.subarray(0, readSync(fd, buffer, 0, HEADER_BYTES, 0));
  } finally {
    closeSync(fd);
  }
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

      // A size makes Astro's srcset stop at twice that width, so the image
      // lightbox (scripts/imageLightbox.ts), which enlarges up to the widest
      // candidate, could never show the full file. Offer the size, twice it,
      // and the file's own width, none past the file. Without the file (a
      // remote image, which never reaches the image service, or one that
      // can't be read) the widths are left to Astro.
      const fileWidth = localFileWidth(node.properties.src, ctx.fileURL);
      if (fileWidth !== undefined) {
        ctx.setProperty(node, "widths", srcsetWidths(size.width, fileWidth));
      }
    },
  },
});
