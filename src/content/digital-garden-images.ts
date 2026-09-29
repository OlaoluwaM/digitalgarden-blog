import path from "node:path";
import { lstatSync } from "node:fs";

export interface DigitalGardenImageContext {
  /** Absolute path to the Markdown note that contains the image. */
  notePath: string;
  /** Absolute path to the publisher's image folder, usually src/site/img/user. */
  imageDirectory: string;
}

/**
 * Resolve a /img/user/... URL to an existing file under imageDirectory.
 * Return a URL relative to the note's directory, with forward slashes and URL
 * encoding. Decode the input path once when locating the file.
 *
 * The caller must supply a URL starting with /img/user/. The Markdown visitor
 * leaves other image URLs unchanged before calling this function.
 * Reject missing files, directories, and malformed encoding. Errors must name
 * both the original image URL and the note that contains it.
 *
 * This helper only resolves paths. The Markdown pipeline handles image
 * optimization and alt text.
 */
export function resolveDigitalGardenImagePath(
  imageUrl: string,
  context: DigitalGardenImageContext
): string {
  const digitalGardenImagePrefix = "/img/user/";

  try {
    const imagePathWithinDirectory = decodeURI(
      imageUrl.slice(digitalGardenImagePrefix.length)
    );
    const absoluteImagePath = path.join(
      context.imageDirectory,
      imagePathWithinDirectory
    );

    if (!lstatSync(absoluteImagePath).isFile()) {
      throw new Error("The image path does not point to a regular file");
    }

    const noteDirectory = path.dirname(context.notePath);
    const relativeImagePath = path.relative(noteDirectory, absoluteImagePath);
    // URLs use forward slashes on every platform.
    return encodeURI(relativeImagePath.split(path.sep).join("/"));
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `Cannot resolve image "${imageUrl}" in note "${context.notePath}": ${reason}`,
      { cause }
    );
  }
}
