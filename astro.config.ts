import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import { wikilinkIndex } from "./src/generated/wikilink-index.ts";
import { mkmdastWikilinksPlugin } from "./src/plugins/mdast/wikilinks.ts";
import { mkmdastAdmonitionCalloutPlugin } from "./src/plugins/mdast/admonitions.ts";
import { hastAdmonitionCalloutPlugin } from "./src/plugins/hast/callout.ts";
import { hastLinkClassesPlugin } from "./src/plugins/hast/linkClasses.ts";
import { mkmdastDigitalGardenImagesPlugin } from "./src/plugins/mdast/images.ts";
import { mdastMathRenderPlugin } from "./src/plugins/mdast/math.ts";

const mdastWikilinksPlugin = mkmdastWikilinksPlugin(wikilinkIndex);
const mdastAdmonitionCalloutPlugin =
  mkmdastAdmonitionCalloutPlugin(wikilinkIndex);
const mdastDigitalGardenImagesPlugin = mkmdastDigitalGardenImagesPlugin(
  fileURLToPath(new URL("./src/site/img/user/", import.meta.url))
);

export default defineConfig({
  site: "https://thunk.blog",
  outDir: "dist-astro",
  image: {
    layout: "constrained",
    responsiveStyles: true,
  },
  markdown: {
    processor: satteri({
      features: {
        wikilinks: true,
        math: true,
        smartPunctuation: false,
      },
      mdastPlugins: [
        mdastWikilinksPlugin,
        mdastAdmonitionCalloutPlugin,
        mdastMathRenderPlugin,
        mdastDigitalGardenImagesPlugin,
      ],
      hastPlugins: [hastAdmonitionCalloutPlugin, hastLinkClassesPlugin],
    }),
    shikiConfig: {
      theme: "dark-plus",
      langAlias: {
        hs: "haskell",
      },
      transformers: [
        {
          // Add line number data attributes for CSS counter styling
          line(node, line) {
            node.properties["data-line"] = line;
          },
        },
      ],
    },
  },
});
