# Astro Rewrite Checklist

## Remaining Work

In this order.

1. [x] Upgrade Astro to 7.3.4+ ([#18070](https://github.com/withastro/astro/issues/18070) fixed); shrink the patch to the `glob.js` fix ([#18054](https://github.com/withastro/astro/issues/18054)).
2. [x] Add linting: choose between Biome and ESLint (with Astro and TypeScript support), then add a `lint` script and run it in `npm test`.
3. [x] Turn on `@typescript-eslint/no-non-null-assertion` for `src` and `scripts` (tests keep `!` on DOM queries) and replace the remaining `!` assertions (32 on 28 lines) with checks that fail with a clear error.
4. [x] Apply the long-form typography refinements ([notes](docs/typography-refinements.md)).
5. [x] Add a table of contents for notes with at least three headings ([designs](https://claude.ai/artifact/GrmM5QYkynByeushqTNvy4)): a right rail at 1400px and wider (A), an inline Contents box from 800px to 1399px (B, collapsed by default), and a Contents button with a bottom sheet below 800px (D).
6. [x] Wrap each Markdown table in a scroll container ([demo](https://claude.ai/artifact/UeSoSyzgiyiULm27QqsCGg)): a hast plugin adds `div.table-wrapper` with `tabindex="0"`, `role="region"`, and a label; inside it the table is `width: max-content` with `word-break: normal` and cells capped at `max-width: 30ch`. Today a 5+ column table is clipped on phones.
7. [x] Label task-list checkboxes, e.g. wrap each item's text in a `<label>`; axe flags them in the dev style guide's Markdown sample.
8. [x] Render `mermaid` and `plantuml` fences as inline SVG at build time through Kroki (kroki.io): exclude both from Shiki, cache by content hash, and fail the build when Kroki fails. Record the decision in an ADR.
9. [x] Style the publisher's transclusions as source cards (design B in the [designs](https://claude.ai/artifact/6Uq4RNhfRueyUJSmAB2r8P): a bordered card with a "From *note title*" header and the link icon on the right); turn the embed title into a label so each page keeps one `h1`; test wikilinks and heading IDs inside embeds.
10. [x] Add a GitHub Actions workflow that runs `npm test` and the build on pull requests and on pushes to `main`. First GitHub run pending: it needs the branch pushed and a pull request into `main`.
11. [x] Update the publishing instructions. Include: embed only published notes (the publisher inlines an unpublished note's text).
12. [x] Perf review with subagent. Done: immutable caching for `/_astro/*`, MathJax glyph reuse. Deferred in [TODO.md](TODO.md): layout shift on Home, the keyboard-hint font.
13. [ ] The rest of the cutover, in this order:
    - [x] Document each Markdown plugin and the Eleventy behavior it replaces ([pipeline](docs/markdown-pipeline.md)).
    - [x] Run the tests and a warning-free build. The one warning left, `data store cleared (force)`, is expected: `build` passes `--force` on purpose.
    - [ ] Complete the vault tasks in [TODO.md](TODO.md), then test a publisher round trip.
    - [ ] When `astro-rewrite` merges into `main`, switch the Vercel project's framework preset from Eleventy to Astro. Not before: `main`'s `vercel.json` names no framework, so the preset governs production's Eleventy builds until then (this branch's `vercel.json` already says Astro).
    - [ ] Once the CI workflow has run on `main`, add the check `CI` in the Vercel project's Settings > Deployment Checks (GitHub Actions; its status is `Vercel - digitalgarden-blog: CI`), so production waits for it. Not before: `main` has no workflow until the merge, so production would wait for a status that never comes.

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
- [x] Fail the build when a note's permalink takes a page route (`PAGE_ROUTES`).

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
- [x] Render `==highlights==` as `<mark>`.
- [x] Remove unexplained Markdown and Shiki warnings.

## Routes and Data

- [x] Rebuild `/404`.
- [x] Rebuild `/~random/` (now `/random/`).
- [x] Rebuild `/feed.xml` (RSS, ADR 0004).
- [x] Rebuild the sitemap (`/sitemap-index.xml` and `/robots.txt`, ADR 0005).
- [x] Rebuild `/searchIndex.json` from published entries.
- [x] Replace the `/sync-callouts` skill with `npm run sync-callouts`, which writes the callout colors and icon map.

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
- [x] Define tokens from the live site and add a dev-only style guide that documents the design system.
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

- [x] Compare Eleventy and Astro route inventories ([inventory](https://claude.ai/artifact/6qEa9Jzk4T2mVvd3fjKyeG)).
- [x] Crawl for broken links and missing assets.
- [x] Test a Vercel preview.
- [x] Restore default `dev`/`build`/`preview` scripts and point `vercel.json` at the Astro build (`astro build --force` into `dist`).
- [x] Update the README.
- [x] Remove Eleventy and migration-only code.
- [x] Make `sharp` a direct dependency (Astro's image code imports it from the project root).
- [x] Delete `get-theme` and the `THEME` settings (ADR 0001).
- [x] Stop `sync-callouts` writing `callouts.scss`; check `test/callout-icons.test.ts` against a fixed table of Obsidian's built-in icons instead of the Eleventy Sass.
- [x] Add `"type": "module"` to `package.json` to remove `MODULE_TYPELESS_PACKAGE_JSON` warnings.

## After Cutover

- [ ] Work through the deferred site features in [TODO.md](TODO.md).
- [ ] After Olaolu signs off on the site, add visual snapshot tests of the overall UI and key features (pages at phone and desktop widths, the search dialog, the mobile file tree, callouts, code blocks).
