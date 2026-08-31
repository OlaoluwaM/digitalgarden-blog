import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import { wikilinkIndex } from "./src/generated/wikilink-index.ts";
import { mkmdastWikilinksPlugin } from "./src/plugins/wikilinks.ts";

const mdastWikilinksPlugin = mkmdastWikilinksPlugin(wikilinkIndex);

export default defineConfig({
  site: "https://thunk.blog",
  outDir: "dist-astro",
  markdown: {
    processor: satteri({
      features: {
        wikilinks: true,
      },
      mdastPlugins: [mdastWikilinksPlugin],
    }),
  },
});
