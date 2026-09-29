import { fileURLToPath } from "node:url";
import { defineMdastPlugin } from "satteri";

import { resolveDigitalGardenImagePath } from "../../content/digital-garden-images.ts";

/**
 * Adapt Digital Garden image URLs before Astro collects local image imports.
 * imageDirectory is the absolute path to src/site/img/user.
 * Register this after the admonition plugin so converted images are visited.
 */
export const mkmdastDigitalGardenImagesPlugin = (imageDirectory: string) =>
  defineMdastPlugin({
    name: "mdast-digital-garden-images",

    image(node, ctx) {
      // Other image URLs do not need the containing note's filesystem path.
      if (!node.url.startsWith("/img/user/")) return;

      if (!ctx.fileURL) {
        throw new Error(`Missing note fileURL for image "${node.url}"`);
      }

      const resolvedImageUrl = resolveDigitalGardenImagePath(node.url, {
        imageDirectory,
        notePath: fileURLToPath(ctx.fileURL),
      });

      ctx.setProperty(node, "url", resolvedImageUrl);
    },
  });
