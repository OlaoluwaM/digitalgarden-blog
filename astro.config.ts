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
          // Keep Eleventy's `shiki` class so the legacy code-block styles
          // (line numbers, language label, copy button) still match
          // (ADR 0003 phase 1).
          pre(node) {
            this.addClassToHast(node, "shiki");
            // Astro's own transformer runs first and labels unlabelled fences
            // "plaintext"; Eleventy labelled them "text".
            if (node.properties.dataLanguage === "plaintext") {
              node.properties.dataLanguage = "text";
            }
          },
          // Eleventy's `<code>` carried `language-<name>`; custom.scss bolds
          // `code[class*="language-"]`. Unlabelled fences were "text".
          code(node) {
            const language =
              this.options.lang === "plaintext" ? "text" : this.options.lang;
            this.addClassToHast(node, `language-${language}`);
          },
          // Add line number data attributes for CSS counter styling
          line(node, line) {
            node.properties["data-line"] = line;
          },
        },
      ],
    },
  },
});
