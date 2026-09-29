# Markdown Pipeline

How a published note becomes HTML, and which Eleventy behavior each step
replaces. The pipeline is configured in [`astro.config.ts`](../astro.config.ts)
(`markdown.processor`): Astro's Sätteri processor parses the Markdown into an
mdast tree, runs the mdast plugins in order, converts the tree to hast, and
runs the hast plugins in order. The Eleventy site used markdown-it with
plugins, custom renderer rules, and HTML transforms over each built page.

Order matters where a plugin reads what an earlier one produced; each such
dependency is noted beside the plugin in `astro.config.ts`.

## Parser features

Sätteri options in `astro.config.ts`, replacing markdown-it options and
plugins.

| Feature                                                      | Setting                   | Replaces (Eleventy)                                                                                  |
| ------------------------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| GFM: tables, task lists, strikethrough, footnotes, autolinks | on (Astro's default)      | markdown-it tables and strikethrough, `markdown-it-footnote`, `markdown-it-task-checkbox`, `linkify` |
| Wikilinks (`[[Note]]`, `![[Note]]`) parsed as links          | `wikilinks: true`         | the `link` filter's `[[…\|…]]` regex over rendered HTML                                              |
| Math (`$…$`, `$$…$$`) parsed as math nodes                   | `math: true`              | `markdown-it-mathjax3`'s parsing                                                                     |
| Smart punctuation                                            | `smartPunctuation: false` | markdown-it's `typographer` (off)                                                                    |
| Raw HTML                                                     | passed through (default)  | `html: true`                                                                                         |

## mdast plugins

In the order they run (`src/plugins/mdast/`).

| Plugin                                             | Does                                                                                                                                                                                                                                                              | Replaces (Eleventy)                                                                                                                       | Tests                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `wikilinks.ts`                                     | Resolves `[[Note#Heading\|Alias]]` through the generated wikilink index (`scripts/generate-wikilink-index.ts`) to the note's permalink and a github-slugger heading fragment; marks links `internal-link`, and a missing note `is-unresolved` pointing at `/404`. | The `link` filter and `getAnchorAttributes`, which read each target note's frontmatter from disk per link.                                | `wikilinks.test.ts`, `heading-links.test.ts`, `wikilink-index.test.ts`                |
| `transclusions.ts` (`mkmdastTransclusionsPlugin`)  | Adjusts the publisher's inlined `![[embeds]]`: the `![[Note\|Title]]` heading becomes a label; an untitled published embed gets "From _note title_"; the link is named "Open _title_" and its heading fragment re-slugged.                                        | The Digital Garden theme's embed styles, over the same publisher markup (Eleventy left the title a second `h1` and the link "Open link"). | `transclusions.test.ts`, `layout/transclusions.test.ts`                               |
| `blockIds.ts`                                      | Turns the publisher's `{ #block-id}` markers (its rewrite of `^block-id`) into the `id` of the paragraph, list item, list, quote, or table they mark.                                                                                                             | `markdown-it-attrs`, which read the same `{ #id}` syntax.                                                                                 | `block-ids.test.ts`                                                                   |
| `admonitions.ts`                                   | Converts Admonition-plugin fences (` ```ad-note `, with `title:`/`collapse:` lines) into callout blockquotes, resolving wikilinks inside them.                                                                                                                    | The `fence` renderer rule's `ad-` branch.                                                                                                 | `admonitions.test.ts`                                                                 |
| `math.ts`                                          | Renders math nodes to MathJax SVG with assistive MathML at build time.                                                                                                                                                                                            | `markdown-it-mathjax3` (same TeX packages and SVG output).                                                                                | `math.test.ts`                                                                        |
| `images.ts`                                        | Resolves the publisher's `/img/user/…` URLs to files in `src/site/img/user/`, so Astro's image pipeline sizes and optimizes them (a missing image fails the build).                                                                                               | The `picture` transform (`@11ty/eleventy-img`, which ignored failures).                                                                   | `images-plugin.test.ts`, `images-build.test.ts`, `digital-garden-images.test.ts`      |
| `diagrams.ts`                                      | Renders ` ```mermaid ` and ` ```plantuml ` fences to inline SVG through Kroki at build time; a failure fails the build ([ADR 0006](adrs/0006-render-mermaid-and-plantuml-at-build-time-through-kroki.md)).                                                        | Mermaid rendered in the browser (`<pre class="mermaid">` plus Mermaid's script) and `markdown-it-plantuml` (an image from plantuml.com).  | `diagrams.test.ts`, `kroki.test.ts`, `diagram-svg.test.ts`, `layout/diagrams.test.ts` |
| `excalidraw.ts` | Turns the publisher's inlined Excalidraw drawing (`div.excalidraw-svg`) into the figure a diagram gets: sized by the stylesheet, scrolling past 70% with the edge fade, ids prefixed, named "Excalidraw drawing". An embed size sets the drawn width. | Nothing: the publisher's markup passed through, and the drawing shrank to fit without limit. | `excalidraw.test.ts`, `layout/excalidraw.test.ts` |
| `transclusions.ts` (`mdastEmbeddedHeadingsPlugin`) | Records which headings sit inside embeds, by position, so the table of contents leaves them out. Runs after every plugin that adds or removes headings.                                                                                                           | Nothing: Eleventy's table of contents (`eleventy-plugin-nesting-toc`) was off.                                                            | `transclusions.test.ts`, `table-of-contents.test.ts`                                  |
| `highlights.ts`                                    | Renders `==text==` as `<mark>`. After the plugins above, because it rewrites paragraph text they read.                                                                                                                                                                  | `markdown-it-mark`.                                                                                                                       | `highlights.test.ts`                                                                  |
| `softBreaks.ts` | Turns each single newline in a paragraph into a `<br>`, as Obsidian shows it; a callout's opening paragraph keeps the newline after its title, where the callout plugin splits it. Last, because it splits paragraph text the plugins above match across lines. | markdown-it's `breaks: true`. | `soft-breaks.test.ts` |

## hast plugins

In the order they run (`src/plugins/hast/`).

| Plugin              | Does                                                                                                                                  | Replaces (Eleventy)                                                 | Tests                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `callout.ts`        | Turns `> [!type] Title` blockquotes into callouts: title, Lucide icon (`callout-icons.ts`, from `npm run sync-callouts`), fold state. | The `callout-block` HTML transform (`transformCalloutBlockquotes`). | `callout.test.ts`, `callout-icons.test.ts`, `sync-callouts.test.ts` |
| `linkClasses.ts`    | Gives links with a scheme (`https:`, `mailto:`) `external-link` and `target="_blank"`, and other links `internal-link`.               | The `link_open` renderer rule.                                      | `link-classes.test.ts`                                              |
| `imageSizes.ts`     | Moves an Obsidian size (`\|300`, `\|300x200`) from the end of an image's alt text to `width` and `height`; Astro resizes the image.   | The `image` renderer rule, which set only `width="300px"`.          | `image-sizes.test.ts`, `images-build.test.ts`                       |
| `tableWrapper.ts`   | Wraps each table in `div.table-wrapper`, which scrolls a wide table sideways.                                                         | The `table` HTML transform, which added the same wrapper.           | `table-wrapper.test.ts`, `layout/tables.test.ts`                    |
| `taskListLabels.ts` | Wraps each task-list checkbox and its text in a `<label>`, so the checkbox has a name.                                                | Nothing: `markdown-it-task-checkbox` left the boxes unnamed.        | `task-list-labels.test.ts`, `layout/task-lists.test.ts`             |

## Astro's own steps

These run inside the processor, around the plugins above.

- **Syntax highlighting.** Shiki with the `dark-plus` theme, before the hast
  plugins. The transformer in `astro.config.ts` keeps Eleventy's classes and
  attributes: `shiki` on `<pre>`, `language-<name>` on `<code>`, `text` for
  unlabelled fences, `data-line` for the line-number counters, and the site's
  raised gray instead of the theme's background. Replaces
  `@shikijs/markdown-it` with the same theme. Tests: `highlighting.test.ts`.
- **Heading IDs.** github-slugger IDs on every heading, collected into
  `headings`, after all the hast plugins. Replaces `markdown-it-anchor` with
  `headerToId`; the IDs match for the published notes. Tests:
  `heading-links.test.ts`.
- **Image collection.** Local images become Astro image components.
  [`patches/`](../patches/README.md) holds one fix to Astro's Markdown
  rendering errors.

## Eleventy behavior not ported

No published note used these when the Eleventy site was removed.

- Body hashtags (`taggify`): `#tag` in the text became a tag-search link.
- ` ```transclusion ` fences.
- Obsidian Base support
- Dataview output support
- Obsidian canvases support.
- `markdown-it-attrs` beyond block IDs (`{.class}` and other attributes).
