import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { wikilinkIndex } from "./src/generated/wikilink-index.ts";
import { mkmdastWikilinksPlugin } from "./src/plugins/mdast/wikilinks.ts";
import { mkmdastAdmonitionCalloutPlugin } from "./src/plugins/mdast/admonitions.ts";
import { hastAdmonitionCalloutPlugin } from "./src/plugins/hast/callout.ts";
import { hastLinkClassesPlugin } from "./src/plugins/hast/linkClasses.ts";
import { hastTableWrapperPlugin } from "./src/plugins/hast/tableWrapper.ts";
import { hastTaskListLabelsPlugin } from "./src/plugins/hast/taskListLabels.ts";
import { mkmdastDigitalGardenImagesPlugin } from "./src/plugins/mdast/images.ts";
import { mdastMathRenderPlugin } from "./src/plugins/mdast/math.ts";
import { mdastHighlightsPlugin } from "./src/plugins/mdast/highlights.ts";
import { mkmdastDiagramsPlugin } from "./src/plugins/mdast/diagrams.ts";

const mdastWikilinksPlugin = mkmdastWikilinksPlugin(wikilinkIndex);
const mdastAdmonitionCalloutPlugin =
  mkmdastAdmonitionCalloutPlugin(wikilinkIndex);
const mdastDigitalGardenImagesPlugin = mkmdastDigitalGardenImagesPlugin(
  fileURLToPath(new URL("./src/site/img/user/", import.meta.url))
);

// The style guide (ADR 0003 phase 2) is a development tool: serve it from
// `astro dev` only, so it never ships with the site.
const styleGuide: AstroIntegration = {
  name: "style-guide",
  hooks: {
    "astro:config:setup": ({ command, injectRoute }) => {
      if (command !== "dev") return;
      injectRoute({
        pattern: "/style-guide",
        entrypoint: "./src/style-guide/StyleGuide.astro",
      });
    },
  },
};

export default defineConfig({
  site: "https://thunk.blog",
  integrations: [
    styleGuide,
    // /sitemap-index.xml and /sitemap-0.xml; robots.txt names the index.
    // /random/ only redirects, so it is left out. The site has no news,
    // images, video, or translations to annotate.
    sitemap({
      filter: page => new URL(page).pathname !== "/random/",
      namespaces: { news: false, xhtml: false, image: false, video: false },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
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
        // After the callout plugin, so diagrams inside callouts render.
        mkmdastDiagramsPlugin(),
        // Last: it rewrites paragraph text the plugins above read.
        mdastHighlightsPlugin,
      ],
      hastPlugins: [
        hastAdmonitionCalloutPlugin,
        hastLinkClassesPlugin,
        hastTableWrapperPlugin,
        hastTaskListLabelsPlugin,
      ],
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
            // Blocks keep the theme's syntax colors but sit on the site's
            // raised gray, like inline code, instead of the theme's
            // #1e1e1e (the page's own color).
            const style = node.properties.style ?? "";
            node.properties.style = style.replace(
              /background-color:[^;]*/i,
              "background-color:var(--color-gray-900)"
            );
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
