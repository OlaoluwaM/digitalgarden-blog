# Astro Rewrite Agent Context

Verified against `astro-rewrite` at `9c6e2e3` on 2026-09-10.
Recheck source before relying on this snapshot.

## Scope and document ownership

Olaolu is implementing in Learn / Guide mode. Preserve published content,
public URLs, and the existing desktop/mobile design. Eleventy remains the
reference until parity and cutover; Astro builds separately into `dist-astro`.
Vault publishing remains paused pending the tasks in [TODO.md](TODO.md).

- [AGENTS.md](AGENTS.md): session requirements and working conventions.
- [REWRITE.md](REWRITE.md): human implementation checklist. Keep markup/CSS
  penultimate, cutover last, and agent discussion here.
- [TODO.md](TODO.md): vault tasks and upstream follow-ups.
- `docs/adrs/`: accepted decisions; proposals below do not supersede them.

## Current implementation

- Astro `7.2.9`, strict TypeScript, static output; 14 generated pages.
- `src/content.config.ts` loads `src/site/notes` and transforms frontmatter
  into `pluginProps` (publisher fields) and `rawNoteProps` (vault fields).
- `src/pages/index.astro` selects the `gardenEntry`; `[...slug].astro` filters
  published articles and derives routes from processed `permalink` values.
  Both use `src/content/posts.ts` and still render only note content.
- `src/content/posts.ts` implements published-post filtering, home/article
  selection, and recent sorting. Home and article routes use its helpers;
  the Recent Posts interface remains to be built.
- `astro.config.ts` registers the wikilink, admonition, and HAST callout plugins. The generated index
  is rebuilt before Astro dev/build by `scripts/generate-wikilink-index.ts`.
  Do not edit `src/generated/wikilink-index.ts` manually.
- `src/plugins/mdast/admonitions.ts` converts legacy `ad-*` fences to blockquote
  Markdown and resolves nested wikilinks. It is registered in Astro; tests
  assert plain blockquotes containing `[!note]`, not finished callout markup
  or collapse behavior.
- Astro does not yet load the shared layout, styles, or client behavior.
  `.claude/skills/sync-callouts/SKILL.md` still targets the Eleventy Sass and
  `calloutScript.njk`; those remain the reference during the visual port.

## Posts helpers and remaining content work

The initial helper set is implemented and integrated. Compare future consumers
with Eleventy; there is no single filtering or ordering rule for every route.

- `getHomePost()` rejects zero or multiple homes. The home route supplies
  published posts, so this enforces exactly one published `gardenEntry`.
- `getRecentArticles()` defaults to three and sorts by
  `rawNoteProps.published`, newest first, for recently published articles.
  This differs from Eleventy's `getRecentNotes()` in
  `src/site/_data/eleventyComputed.js`, which excludes home and undated notes, sorts
  by `created` descending, and defaults to three. The publication-date
  interpretation was discussed with Olaolu; do not describe it as date parity.
- `getPublishedPosts()` currently filters only `dg-publish`. Preserve that
  behavior: `dg-hide` is file-tree metadata, not a global exclusion rule.
- `src/site/feed.njk` reverses the note collection and excludes `/`.
  `src/site/_includes/layouts/random.njk` includes the published home note.
  `src/site/search-index.njk` has no `dg-hide` filter.
- The collection schema validates permalink format; `getPublishedPosts()`
  rejects duplicate effective routes after filtering published posts.
- `getRandomInt()` is unused; there is no exported random-post helper.
- Minor cleanup: the home route's comment still refers to a removed non-null
  assertion. Neither cleanup item blocks the initial helper integration.
- Duplicate/malformed wikilink-index validation is integrated and tested.

## Posts helper tests

- `npm run test:posts` runs 34 tests against the real `src/content/posts.ts`.
  The test setup substitutes only Astro's virtual `getCollection()` import.
- Coverage includes publication filtering, hidden posts, route validation after
  filtering, home selection, recent ordering, limits, dates, and input preservation.
- All 34 tests pass. Dates are parsed and validated before sorting, including
  when there is only one article. Sorting reuses those timestamps and preserves
  the original post objects. Source and test TypeScript checks pass.
- These are helper tests, not route builds.

## Permalink TDD exercise (2026-09-13)

Olaolu implemented `permalinkSchema` and `assertUniquePermalinks` in
`src/content/permalinks.ts`. The requested refinement uses `Map.groupBy()`
and reports every conflicting route with all involved post IDs.

- Approved format: `/` or nonempty segments of Unicode letters, digits,
  hyphens and dots, separated by `/`, with an optional trailing slash.
  Reject uppercase, underscores, standalone `.`/`..`, and percent encoding.
  Do not normalize invalid inputs.
- Uniqueness applies to published posts' effective routes. `gardenEntry`
  claims `/`; collision errors must identify the route and both post IDs.
  Paths differing only by a trailing slash count as duplicates. Preserve
  original values when validating; route comparison must not mutate posts.
- Run `npm run test:permalinks`. The focused command disables test isolation
  to show individual assertions in this environment.
- All 53 focused tests pass, including reporting multiple collision groups.
  `npm test` passes all six test files.
- Wired `permalinkSchema` into `src/content.config.ts` and
  `assertUniquePermalinks()` into `getPublishedPosts()` after filtering.
- Production build: 14 pages. Rebuilding content emitted Shiki warnings for
  unregistered `ad-*` languages; the callout integration remains separate work.
- Builds in a temporary project copy rejected malformed paths, trailing-slash
  duplicates, and home-route collisions, with useful diagnostics. An
  unpublished duplicate did not block the build. These were manual integration
  checks, not persisted tests. Source notes were left untouched.

## Wikilink index generator (2026-09-13)

- Replaced the Bash generator with TypeScript. The
  `npm run generate:wikilink-index` command and Astro pre-dev/pre-build hooks
  remain in place; no dependencies were added.
- Uses native filesystem globbing, installed `gray-matter` for frontmatter,
  `permalinkSchema` for paths, and the installed Prettier API for formatting.
  Missing tags default to an empty array; supplied tags must be strings in an
  array. Metadata-like text in the Markdown body is ignored.
- Duplicate extensionless targets fail with both source filenames. Different
  target names may share a destination. All ingress notes remain indexed,
  regardless of `dg-publish`, matching the previous generator's scope.
- Validate stored permalinks before mapping a `gardenEntry` to `/`. Fail with
  source diagnostics for missing or malformed metadata.
- Preserve the previous byte ordering of targets. JSON serialization and
  `Object.fromEntries()` protect escaped filenames and keys such as `__proto__`.
- Finish validation and formatting before writing a temporary file beside the
  output, then rename it into place. Failures preserve the previous index.
- TDD: the new CLI tests exposed 15 failures in the Bash version; all 19 now
  pass. Run `npm run test:wikilink-index`. Tests use isolated temporary note
  directories and capture subprocess output to files for sandbox compatibility.
- Verified all 14 mappings and their order match the old generated index.
  `npm test` passes seven test files; `npm run build:astro` builds 14 pages.
- Node emits `MODULE_TYPELESS_PACKAGE_JSON` for the TypeScript entry point in
  this mixed CommonJS/ESM project. No package-wide module-mode change was made.

## HAST callout integration (2026-09-16)

- The visitor in `src/plugins/hast/callout.ts` returns the transformed node;
  the plugin is registered in Astro's `hastPlugins`.
- All 79 tests pass with `npm run test:callouts`; the admonition suite adds
  nine tests, for 88 across both files. Coverage includes header
  boundaries, malformed markers, nested formatting, whitespace preservation,
  title defaults, metadata, attributes, nested/sibling callouts, and MDAST composition.
- Every callout is collapsible; only `-` starts closed. Default titles are
  supplied by the HAST plugin for both native callouts and converted admonitions.
- `transformAdmonitionCodeBlock()` recursively converts direct nested `ad-*`
  code children and preserves ordinary code. Each conversion resolves wikilinks
  against its own generated Markdown. Traversal through lists is outside the
  agreed scope. Tests cover three levels and nested link/title/collapse behavior.
- `npm test` passes all eight test files; TypeScript passes. Astro builds
  14 pages. Verified 13 callouts in generated HTML, including the Maths nested
  aside, its default title, the outer wikilink, and preserved algorithm code.
- After Markdown plugin implementation changes, use
  `npm run build:astro -- --force` for verification. A normal build reused
  stale rendered content; the forced build cleared the content store and
  rendered the nested aside correctly.
- Browser styles and icons/toggling remain separate. Rendered HTML and plugin
  tests do not prove browser behavior.

## Accepted decisions

- Route from processed `permalink`, not filenames or raw `dg-permalink`.
- Keep Sätteri and adapt publisher Markdown at the Astro boundary.
- Vendor the existing theme before cutover, preserving cascade order;
  remove remote theme fetching. See [ADR 0001](docs/adrs/0001-vendor-the-obsidian-theme-css-and-sever-the-remote-fetch.md).
- Use custom `/feed.xml` and `/sitemap.xml` endpoints to preserve Atom with
  full rendered content and the exact sitemap route. See [ADR 0002](docs/adrs/0002-hand-roll-the-atom-feed-and-sitemap-as-custom-endpoints.md).

## Markdown and image gaps

`src/plugins/mdast/wikilinks.ts` uses source positions to distinguish wikilinks
from ordinary links, resolves the generated index, and marks missing targets
with `/404` and `is-unresolved`. Admonitions resolve links while reparsed
fragment positions still match their source. Preserve literal inline and
ordinary fenced code. The learning note at
[docs/satteri-markdown-pipeline.md](docs/satteri-markdown-pipeline.md) provides
background; check the current implementation when using it.

The admonition converter and callout renderer are registered. A forced build
on 2026-09-16 verified the converted TLDR/Horner's Method callouts and the
Maths note's nested `ad-aside`. Browser styling/collapse behavior remains
unfinished.

The Redis post references
`/img/user/Extras/Assets/redis-info-server-got-hands-meme.jpg`, but the build
does not copy that asset. The source exists under `src/site/img/user/`.
Image handling is still open. The prior proposal, not an approved design:

1. Keep `src/site/img` as publisher ingress; rewrite `/img/user/...` references
   to local assets at the Markdown boundary for Astro optimization.
2. Generate intrinsic dimensions and responsive sources; preserve alt text.
3. Also serve original `/img/user/...` URLs for URL parity.

Copying images to `public/img` is simpler but does not meet the checklist's
optimization requirement by itself. Check Astro's current APIs before choosing
the approach. Verify missing assets, spaces/encoding, remote images, and SVGs.

### Digital Garden image resolver TDD (2026-09-16)

- `src/content/digital-garden-images.ts` implements `resolveDigitalGardenImagePath()`.
  It strips the URL prefix, decodes the path once, checks for a regular file,
  and returns an encoded relative URL. Errors include the image URL and note
  path, with the original error retained as the cause.
- `npm run test:images` passes all 18 tests: note-relative
  paths, SVGs, spaces, encoding, URL passthrough, and useful errors for missing
  files, directories, and malformed encoding. Fixtures use temporary files.
- The return value is an encoded relative URL. Inputs include the absolute
  note path and publisher image directory; remote URLs pass through unchanged.
- This is an isolated resolver exercise. Plugin registration, alt text,
  responsive images, original URL serving, and images inside callouts still
  need integration tests. Remote optimization policy remains open.
- TypeScript and formatting checks pass. `npm test` passes all nine test files.

## Verification and deployment

```sh
npm test
npm run build:astro
git diff --check
```

Results on 2026-09-09:

- `npm test`: five test files passed, zero failed.
- `npm run build:astro`: 14 pages, no warnings in this run.
- Built Redis HTML still references the missing image above.
- Astro Docs MCP and Vercel MCP both answered documentation queries.

A successful build is not parity. The posts helper is not exercised by the
Recent Posts UI yet. Plugin tests do not prove registration or UI behavior,
and desktop, mobile, route/asset parity, and Vercel preview checks remain
outstanding.

Posts integration checks on 2026-09-10:

- `npm test`: five test files passed, zero failed.
- `npm run build:astro`: 14 pages, no warnings; regenerated the wikilink index
  without changing its tracked contents.
- Standalone probes of the actual helper source (Astro import omitted) passed
  zero/one/multiple homes, publication order, home exclusion, default/explicit
  limits, empty input, and input preservation. These are not persisted tests.
- `git diff --check`: passed. No separate TypeScript check was run.

`vercel.json` still targets `dist` and invokes `npm run build` / `npm run start`.
Neither script exists in `package.json`; explicit `build:eleventy`,
`start:eleventy`, `build:astro`, and `dev:astro` scripts do. Reconcile defaults
at cutover. Live Vercel settings were not inspected or changed.

## Deferred work

Keep these outside the migration checklist:

- Table of contents, backlinks, local graph, and link previews.
- Wikilink-index hot reload if pre-dev generation becomes insufficient.
- Distill the vendored theme into owned styles after cutover (ADR 0001).
- Vercel Speed Insights; revisit math support and the publishing boundary.
- Upstream Sätteri issues in [TODO.md](TODO.md), then removal of superseded
  local workarounds.
