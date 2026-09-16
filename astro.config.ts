import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import { wikilinkIndex } from "./src/generated/wikilink-index.ts";
import { mkmdastWikilinksPlugin } from "./src/plugins/mdast/wikilinks.ts";
import { mkmdastAdmonitionCalloutPlugin } from "./src/plugins/mdast/admonitions.ts";
import { hastAdmonitionCalloutPlugin } from "./src/plugins/hast/callout.ts";

const mdastWikilinksPlugin = mkmdastWikilinksPlugin(wikilinkIndex);
const mdastAdmonitionCalloutPlugin =
  mkmdastAdmonitionCalloutPlugin(wikilinkIndex);

export default defineConfig({
  site: "https://thunk.blog",
  outDir: "dist-astro",
  markdown: {
    processor: satteri({
      features: {
        wikilinks: true,
      },
      mdastPlugins: [mdastWikilinksPlugin, mdastAdmonitionCalloutPlugin],
      hastPlugins: [hastAdmonitionCalloutPlugin],
    }),
  },
});
