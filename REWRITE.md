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
- [x] Verify nested callouts, titles, collapse states, and wikilinks in built pages.
- [x] Resolve publisher image paths through Astro's image pipeline.
- [x] Generate image dimensions and responsive sources.
- [x] Fail clearly on missing publisher images (local Astro patch).
- [x] Test local, SVG, encoded, and missing images in full builds.
- [x] Keep remote image URLs unchanged; verify builds do not fetch them.
- [x] Preserve image alt text (local Astro patch for escaped characters).
- [x] Match code highlighting, language labels, and line numbers.
- [x] Restore copy-code behavior.
- [x] Keep Astro heading IDs and resolve wikilink heading fragments.
- [x] Inventory the Markdown features used by published notes.
- [x] Turn off smart punctuation to match Eleventy.
- [x] Add `external-link`/`internal-link` classes and `target="_blank"` to links.
- [x] Render inline math at build time.
- [x] Remove unexplained Markdown and Shiki warnings.

## Routes and Data

- [x] Rebuild `/404`.
- [x] Rebuild `/~random/` (now `/random/`).
- [x] Rebuild `/feed.xml` (RSS, ADR 0004).
- [ ] Rebuild `/sitemap.xml`.
- [x] Rebuild `/searchIndex.json` from published entries.
- [ ] Make `/sync-callouts` generate the callout icon map in `src/plugins/hast/callout-icons.ts`, and decide where its `--callout-color` output lives once phase 2 removes the legacy Sass.

## Markup and CSS

Phase 1: parity shell ([ADR 0003](docs/adrs/0003-build-a-tailwind-token-design-system-before-cutover.md)).

- [x] Build the shared page layout.
- [x] Add metadata, canonical URLs, and social metadata.
- [x] Add fonts, icons, favicons, and static assets.
- [x] Vendor the Obsidian theme CSS.
- [x] Load the Sass layers in the existing order.
- [x] Match titles, tags, dates, footer, and links.
- [x] Match callout title markup and styles.
- [x] Add callout icons from the theme's `--callout-icon` with Lucide.
- [x] Rebuild the Recent Posts list.
- [x] Port the navbar and home link.
- [x] Port the file tree.
- [x] Match the responsive layout.
- [x] Preserve accessibility and keyboard behavior.
- [x] Review phase 1 against the live site.

Phase 2: design system.

- [x] Add Tailwind v4 with the cascade layer order.
- [x] Define tokens from the live site and add a style guide page.
- [x] Revise the chrome styles into token-based components.
- [x] Revise the Markdown content styles into a token-based stylesheet.
- [x] Remove the legacy stylesheets and vendored theme; add Preflight.

## Analytics

- [x] Add Vercel Web Analytics.
- [x] Add Vercel Speed Insights.

## Client Behavior

- [x] Port callout collapsing and keyboard toggling.
- [x] Port FlexSearch search and tag filtering, escaping inserted text, highlighting safely, and searching on `input`.
- [x] Build the search dialog's markup and styles (`SearchDialog.astro`).
- [x] Wire the search dialog: open and close, results, keyboard selection, preview, and tag search.
- [x] Style the open mobile file tree and its `.fullpage-overlay` (shown while the hamburger's `aria-expanded` is `true`).
- [x] Port mobile navigation and file-tree folder state to TypeScript (no Alpine).
- [x] Keep usable fallbacks where JavaScript is not essential.

## Cutover

- [ ] Compare Eleventy and Astro route inventories.
- [ ] Crawl for broken links and missing assets.
- [ ] Compare desktop and mobile pages.
- [ ] Upgrade Astro to 7.3.4+ ([#18070](https://github.com/withastro/astro/issues/18070) fixed); shrink the patch to the `glob.js` fix ([#18054](https://github.com/withastro/astro/issues/18054)).
- [ ] Run the tests and a warning-free build.
- [ ] Complete the vault tasks in [TODO.md](TODO.md), then test a publisher round trip.
- [ ] Test a Vercel preview.
- [ ] Switch Vercel to Astro and restore working default build/start scripts; deploys build with `build:astro:prod` (`--force`, so plugin changes re-render every note).
- [ ] Update the README and publishing instructions.
- [ ] Document each Markdown plugin and the Eleventy behavior it replaces.
- [ ] Remove Eleventy and migration-only code.
- [ ] Delete `get-theme` and the `THEME` settings (ADR 0001).
- [ ] Add `"type": "module"` to `package.json` to remove `MODULE_TYPELESS_PACKAGE_JSON` warnings.

## After Cutover

- [ ] After Olaolu signs off on the site, add visual snapshot tests of the overall UI and key features (pages at phone and desktop widths, the search dialog, the mobile file tree, callouts, code blocks).
