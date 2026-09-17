import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import { wikilinkIndex } from "./src/generated/wikilink-index.ts";
import { mkmdastWikilinksPlugin } from "./src/plugins/mdast/wikilinks.ts";
import { mkmdastAdmonitionCalloutPlugin } from "./src/plugins/mdast/admonitions.ts";
import { hastAdmonitionCalloutPlugin } from "./src/plugins/hast/callout.ts";
import { mkmdastDigitalGardenImagesPlugin } from "./src/plugins/mdast/images.ts";

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
      },
      mdastPlugins: [
        mdastWikilinksPlugin,
        mdastAdmonitionCalloutPlugin,
        mdastDigitalGardenImagesPlugin,
      ],
      hastPlugins: [hastAdmonitionCalloutPlugin],
    }),
  },
});
