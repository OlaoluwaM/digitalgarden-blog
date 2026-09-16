# Astro Rewrite Checklist

## Completed

- [x] Add Astro 7 with strict TypeScript.
- [x] Build Astro separately into `dist-astro`.
- [x] Keep Sätteri as the Markdown processor.
- [x] Load and validate all 14 published notes.
- [x] Render the home note at `/`.
- [x] Render posts from publisher-generated permalinks.
- [x] Generate the wikilink index before Astro development and builds.
- [x] Resolve published, missing, aliased, and escaped wikilinks.
- [x] Leave regular links, inline code, and code fences unchanged.
- [x] Implement and unit-test Markdown and wikilinks inside `ad-*` fences.
- [x] Record the theme and machine-route decisions.

## Content Foundation

- [x] Implement `src/content/posts.ts` and use it in the page routes.
- [x] Centralize home-note selection and recent-article date handling.
- [x] Sort recent articles by `published`, newest first; default to three entries.
- [x] Fail on duplicate or malformed permalinks.
- [x] Fail unless exactly one published `gardenEntry` exists.
- [x] Fail on duplicate or malformed wikilink-index entries.

## Markdown and Assets

- [x] Register the admonition plugin in Astro.
- [x] Render callout markup for Obsidian blockquotes and converted `ad-*` fences.
- [ ] Verify nested callouts, titles, collapse states, and wikilinks in built pages.
- [ ] Resolve publisher image paths through Astro's image pipeline.
- [ ] Keep original `/img/user/*` URLs available.
- [ ] Generate image dimensions and responsive sources.
- [ ] Fail clearly on missing publisher images.
- [ ] Test local, remote, SVG, encoded, and missing images.
- [ ] Preserve image alt text.
- [ ] Match code highlighting.
- [ ] Restore copy-code behavior.
- [ ] Preserve heading IDs and wikilink heading fragments.
- [ ] Inventory the Markdown features used by published notes.
- [ ] Implement the missing Markdown features in use.
- [ ] Remove unexplained Markdown and Shiki warnings.

## Routes and Data

- [ ] Rebuild `/404`.
- [ ] Rebuild `/~random/`.
- [ ] Rebuild `/feed.xml`.
- [ ] Rebuild `/sitemap.xml`.
- [ ] Rebuild `/searchIndex.json` from published entries.

## Client Behavior

- [ ] Port search and tag filtering.
- [ ] Port mobile navigation logic.
- [ ] Keep usable fallbacks where JavaScript is not essential.

## Markup and CSS

- [ ] Build the shared page layout.
- [ ] Add metadata, canonical URLs, and social metadata.
- [ ] Add fonts, icons, favicons, and static assets.
- [ ] Vendor the Obsidian theme CSS.
- [ ] Load the Sass layers in the existing order.
- [ ] Match titles, tags, dates, footer, and links.
- [ ] Rebuild the Recent Posts list.
- [ ] Port the navbar and home link.
- [ ] Port the file tree.
- [ ] Build the search and tag-filtering interface.
- [ ] Match the responsive layout.
- [ ] Preserve accessibility and keyboard behavior.

## Cutover

- [ ] Compare Eleventy and Astro route inventories.
- [ ] Crawl for broken links and missing assets.
- [ ] Compare desktop and mobile pages.
- [ ] Run the tests and a warning-free build.
- [ ] Complete the vault tasks in [TODO.md](TODO.md), then test a publisher round trip.
- [ ] Test a Vercel preview.
- [ ] Switch Vercel to Astro and restore working default build/start scripts.
- [ ] Update the README and publishing instructions.
- [ ] Remove Eleventy and migration-only code.
