# Astro Rewrite Agent Context

Verified against `astro-rewrite` at `9c6e2e3` on 2026-09-10.
Recheck source before relying on this snapshot.

## Scope and document ownership

Olaolu is implementing in Learn / Guide mode. Preserve published content,
public URLs, and the existing desktop/mobile design. The Eleventy code was
removed on 2026-09-28; the live site (still the Eleventy build on `main`)
is the parity reference until cutover. Astro builds into `dist`.
Exception agreed on 2026-09-17: original `/img/user/*` URLs need not remain available.
Vault publishing waits for the merge: the plugin commits to `main`
([TODO.md](TODO.md)).

- [AGENTS.md](AGENTS.md): session requirements and working conventions.
- [TODO.md](TODO.md): open work: the steps at and after the merge,
  deferred site features, performance, and upstream follow-ups.
- `docs/adrs/`: accepted decisions; proposals below do not supersede them.

## Current implementation

- Astro `7.3.5` (upgraded 2026-09-28), strict TypeScript, static output; 14 generated pages.
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
- `==highlights==` render as `<mark>` through `src/plugins/mdast/highlights.ts`
  (added 2026-09-28; Sätteri has no highlight syntax). It runs last among
  the mdast plugins and pairs markers within one paragraph, heading, or
  table cell, like markdown-it-mark.
- `npm run sync-callouts` (`scripts/sync-callouts.ts`, rules in
  `scripts/callout-sync.ts`; it replaced the `/sync-callouts` skill) copies the
  vault's custom callout types: colors between markers in
  `src/styles/content/callouts.css`, icons between markers in
  `src/plugins/hast/callout-icons.ts`, and Eleventy's `callouts.scss` until
  cutover. It reads the Admonition plugin and the enabled snippets only, and
  writes nothing if a type needs an `--icon` or `--color` override; the
  run ends by listing those types and the option that fixes each.

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
  The publisher writes it as top-level `hide: true`; the schema key is
  `hide` (it was `dg-hide`, which the publisher never writes, so the flag
  was silently dropped). Olaolu: a hidden post is reachable only by a
  direct link. `isHiddenPost` (src/content/hidden.ts) drives
  `buildFileTree` and `getListedPosts` (posts.ts), which Recent Posts, the
  search index, the feed, and `/random/` use; the sitemap filter reads
  `hiddenUrls` from the generated wikilink index; hidden pages get
  `noindex` via BaseLayout. `getPublishedPosts()` still returns hidden
  posts, so their pages build. Fixture tests that need the index to match
  their notes call `generateFixtureIndex` (item 11).
- `src/site/feed.njk` reverses the note collection and excludes `/`.
  `src/site/_includes/layouts/random.njk` includes the published home note;
  the Astro `/random/` (`src/pages/random.astro`, no tilde, old URL not
  kept) picks from `getPublishedArticles()`, without Home (Olaolu,
  2026-09-28). The shared head tags live in `src/components/SiteHead.astro`
  (BaseLayout, 404, random). `assertUniquePermalinks` also fails the build
  when a note's permalink takes a page's route (`PAGE_ROUTES` in
  `src/content/permalinks.ts`; a test keeps it in step with `src/pages`).
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
- `/feed.xml` is RSS 2.0 from `@astrojs/rss` with full content ([ADR 0004](docs/adrs/0004-use-astrojs-rss-for-the-feed.md),
  2026-09-28). Notes render through the experimental container API because
  `rendered.html` holds image placeholders; URLs are made absolute. Dates
  are Central time (`site.timeZone`, `noteInstant`). The channel
  description is `site.description` in `src/lib/site.ts`.
- The sitemap comes from `@astrojs/sitemap` ([ADR 0005](docs/adrs/0005-use-astrojs-sitemap.md),
  2026-09-28): `/sitemap-index.xml` and `/sitemap-0.xml`, without `/random/`,
  and no `lastmod`. `src/pages/robots.txt.ts` names the index. `/sitemap.xml`
  is gone.

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

The image plugin is now registered after admonition conversion in `astro.config.ts`.
Its absolute image directory is resolved from the config's `import.meta.url`.
Publisher notes and source images remain unchanged. The Redis post's
`/img/user/Extras/Assets/redis-info-server-got-hands-meme.jpg` reference now
produces an optimized asset under `/_astro/`.

Responsive sources use Astro's defaults. Olaolu dropped preservation of original
`/img/user/*` URLs on 2026-09-17; do not add copying or redirects for those URLs.
Remote image URLs stay unchanged, without build-time downloads or optimization.
Build tests cover remote images, SVGs, and encoded filenames. A local Astro patch
fixes the missing-image failure-propagation gap.

### Digital Garden image resolver TDD (2026-09-16)

- `src/content/digital-garden-images.ts` implements `resolveDigitalGardenImagePath()`.
  It strips the URL prefix, decodes the path once, checks for a regular file,
  and returns an encoded relative URL. Errors include the image URL and note
  path, with the original error retained as the cause.
- `npm run test:images` passes all 10 tests: note-relative
  paths, SVGs, spaces, encoding, and useful errors for missing
  files, directories, and malformed encoding. Fixtures use temporary files.
- The return value is an encoded relative URL. Inputs include the absolute
  note path and publisher image directory. The synchronous resolver requires
  a /img/user/ URL; the visitor owns URL filtering and passthrough tests.
- Source TypeScript and focused image tests pass.

### Image plugin TDD

- `src/plugins/mdast/images.ts` implements
  `mkmdastDigitalGardenImagesPlugin(imageDirectory)` using the resolver and
  the containing note's `ctx.fileURL`. It filters the prefix before requiring
  a note URL, then updates only the image URL.
- `npm run test:images-plugin` passes all 19 tests through Astro's Satteri processor.
  They cover URL passthrough without a note URL, asset
  collection, alt/title preservation, encoding, SVGs, per-note paths, native
  and nested converted callouts, missing files, and missing note URLs.
- Tests and the site config place the image plugin after admonition conversion.
- These tests check image import metadata and Astro's HTML image markers.
  They do not verify optimized files or responsive output.

### Image site integration verification

- `npm run build:astro -- --force` builds all 14 pages and generates the Redis
  image as a 515 x 500 WebP: 16,588 bytes versus the 46,903-byte source JPEG.
- The generated HTML preserves the exact alt text and includes width/height.
  Decoding the generated image confirms those dimensions.
- A local Astro preview served the Redis page and its optimized image with
  HTTP 200. The image response was `image/webp` with the expected byte count.
  The temporary preview was stopped. Browser layout was not inspected.
- All 11 test files, TypeScript, and config formatting checks pass.

### Responsive image defaults (2026-09-17)

- `astro.config.ts` sets `image.layout: "constrained"` and enables
  `image.responsiveStyles`. Breakpoints and generated sizes use Astro's defaults.
- A forced build produces `sizes="(min-width: 515px) 515px, 100vw"` and one
  515w source for the Redis image. Its source width is below the default
  breakpoints, so Astro does not generate additional widths for this image.
- Verified the source candidate decodes to 515 x 500 and retains the alt text.
  The build, TypeScript, and config formatting checks pass.
- The built Redis page currently emits no stylesheet or inline styles despite
  enabling responsiveStyles. Verify CSS delivery and small-screen sizing when
  adding the shared layout; responsive markup alone does not prove layout behavior.

### Missing image build test (2026-09-17)

- `npm run test:images-build` copies the real site config, schema, pages, and
  plugins into a temporary project. Its only note builds successfully without
  an image, then references a nonexistent /img/user/ asset on a forced rebuild.
  Notes, assets, build output, and caches are isolated from the real project.
- The test checks the image URL, absolute note path, and nonzero exit status.
  It failed against unpatched Astro 7.2.9, which logged the error but exited 0.
- `patches/astro+7.2.9.patch` removes the rendering catch in the glob loader.
  Sync now rejects before storing a failed render. Default rendering caches
  remain enabled; the site does not use `deferRender`.
- Astro is pinned to 7.2.9. npm's `postinstall` reapplies the patch and fails
  if it cannot apply. Reversing the patch and running an offline `npm install`
  verified reapplication. See `patches/README.md` for upkeep and upstream steps.
- With the patch, all 12 test files and source TypeScript pass. A forced site
  build produces all 14 pages. A separate loader probe with a stub watcher/store
  verified error identity, no failed entry caching, preservation of the valid
  entry on a watched failure, and recovery on a corrected edit. This probe was
  not a live dev-server test or an addition to the committed test suite.
- The upstream issue form was prepared for Olaolu to submit. No issue or PR
  has been created by the agent; the upstream source change and tests remain.

### SVG and encoded-filename build tests (2026-09-17)

- `test/images-build.test.ts` now shares the isolated project setup across cases.
  The SVG test checks dimensions, alt/title, the emitted SVG's geometry, and
  that `src` and any `srcset` candidates point to nonempty files in `dist-astro`.
- Real PNG fixtures cover encoded spaces in directories and filenames, Unicode,
  and literal `%20` in a filename referenced as `%2520`. Builds emit WebP files;
  tests check their file signatures, dimensions, alt/title, and output references.
- The extra test found `![A & B diagram](...)` became
  `alt="A &amp;amp; B diagram"` in built HTML. The Astro patch now fixes both
  image-marker decoders (content runtime and Vite's Markdown transform).
  They previously decoded only quotes before JSON parsing; `html-escaper` now
  decodes attribute values once, with hexadecimal quote normalization first.
- The TODO flag is removed. The regression checks both collection and ordinary
  Markdown pages, including alt/title ampersands, quotes, apostrophes, angle
  brackets, and literal character references that must not be decoded twice.
- All six build tests pass with no TODO cases. All 12 test files, source and
  test TypeScript checks, and the forced 14-page site build pass. The combined
  Astro patch was reversed and successfully reapplied through `postinstall`.
- The resolver's 10 tests, plugin's 19 tests, and build test TypeScript check pass.
  Application code is unchanged.

### Remote image build coverage (2026-09-18)

- Remote images keep their original URLs. No application or configuration
  changes were needed.
- A build test checks collection and ordinary Markdown pages. It verifies the
  remote URL (including query parameters), alt, and title survive, with no
  generated `srcset`. A temporary localhost HTTP server records zero requests.
- This test needs permission to bind a local port in restricted sandboxes.
- All seven image build tests and all 257 tests in the full suite pass.
  The build test's TypeScript and formatting checks also pass.

### Code highlighting TDD (2026-09-18)

- `npm run test:highlighting` renders Markdown using the validated site config.
  These are processor tests, not full builds or browser styling checks.
- Seven cases cover dark-plus colors, language labels, blank-line numbering,
  numbering reset, the `hs` alias, unlabelled code escaping, and inline code.
- All seven pass. The config uses dark-plus, the `hs` alias, and a line-number
  transformer. Astro supplies the language label; the duplicate `pre()`
  transformer and unused language list were removed.
- All 264 tests, source and test TypeScript checks, and formatting checks pass.
  A forced Astro build produces 14 pages. An output check verified the theme and
  sequential line numbers on all 12 highlighted blocks, with no duplicate
  language attributes.
- Browser checks confirm the shared styles are not loaded. CSS and the legacy copy-code script
  target `pre.shiki`; Astro emits `pre.astro-code`. Adapt the CSS when integrating
  the shared layout and styles.

### Copy-code tests (2026-09-18)

- `src/scripts/copyCode.ts` ports the Eleventy behavior to `pre.astro-code`,
  with a fallback for clipboard errors, duplicate-button prevention, pending
  copy protection, and replacement of earlier feedback timers.
- `npm run test:copy-code` now runs 15 Vitest Browser Mode tests in Chrome.
  `test/browser/copyCode.test.ts` replaces the former Node mock-DOM suite.
  It uses real elements, focus, selection, and browser clicks, with mocked
  clipboard failures and fake feedback timers. One case uses the real clipboard.
- All 264 Node tests and 15 browser tests pass. Page integration was checked
  separately below.

### Copy-code page integration (2026-09-18)

- Both `index.astro` and `[...slug].astro` call the initializer from a processed
  `<script>`. Move that inclusion into the shared layout when it exists.
  Image build fixtures now also copy `src/scripts` to resolve those imports.
- A forced build produces 14 pages. Headless Chrome, using an isolated profile
  and a localhost server with clipboard permission granted, verified that the
  home page loads its module without errors or stray buttons. The Stack
  executables article gets eight buttons; copying preserves the exact code text,
  shows `Copied!`, re-enables the button, and resets to `Copy` after two seconds.
  Neither page raised a runtime exception.
- Clipboard failure paths remain covered by mocked tests. Styling remains
  deferred until shared layout and CSS integration.

### Project-local browser tooling (2026-09-18)

- `agent-browser` 0.38.1, Vitest 5.0.1, and its Playwright provider are local dev
  dependencies. The upstream agent-browser skill is in `.agents/skills`.
- `npm run browser -- ...` loads `.env.browser.local`, which points to the
  installed Nix Chrome. The ignored local file is shared with `test:browser`;
  `.env.browser.example` documents the override for other machines.
- Use a task-specific `--session` for agent-browser and close it when finished.
  `agent-browser.json` keeps screenshots under ignored `.browser-artifacts`.
  No personal Chrome profile or global package installation is used.
- `npm test` runs the Node suite followed by the browser suite. Browser tests
  use their own config and directory; `test:unit` limits Node discovery to the
  existing top-level tests. Vitest artifacts under `.vitest` are ignored.
- VS Code recommends `vitest.explorer`. Workspace settings select the browser
  config and load `.env.browser.local` through Node arguments. All 15 browser
  tests pass with those arguments; the extension UI has not been verified.
- Agent-browser was verified against the local Astro preview, including
  interactive snapshots and inspected desktop/mobile screenshots. The pages
  still lack the shared layout and CSS. Chrome reports `windows-1252` and shows
  garbled punctuation; add UTF-8 metadata with the shared layout.
  The homepage and three articles were checked, including internal navigation
  and copy feedback/reset. No browser errors were observed. At a 390px viewport,
  the Redis image loads but remains 515px wide and overflows; the page has no
  stylesheets. Callout titles do not collapse their content. Page titles and
  viewport metadata are also absent. Resolve these during layout, stylesheet,
  and client behavior integration; passing browser tests do not cover them.
  The local Vitest/Vite combination emits
  a `vitest:mocks:interceptor` configureServer warning, but all tests pass.

### Heading fragments (verified 2026-09-25)

- Comparison found one Markdown heading across the 14 published notes:
  `Welcome`, with `id="welcome"` in both renderers. None of the seven body
  wikilinks has a heading fragment. Keep Astro's default heading IDs rather
  than reproducing Eleventy's HTML-based slug generation.
- `npm run test:heading-links` exercises the site's configured Astro processor.
  The 15 tests cover cross-note and same-page fragments, normal/escaped aliases,
  punctuation, Unicode, formatted headings, duplicate heading suffixes, repeated
  links, document isolation, admonitions, and unchanged non-wikilink behavior.
- `resolveWikilinkTarget` separates the note target from the fragment, resolves
  same-page links without an index lookup, and uses the stateless `slug` export
  from the direct `github-slugger` dependency. Missing notes retain `/404` and
  `is-unresolved`; heading existence is not validated.
- TDD complete: all 15 heading-link tests pass. Full verification passes with
  279 Node tests, 15 Chrome tests, source/test TypeScript checks, formatting,
  and a forced Astro build producing 14 pages. The existing Vitest interceptor
  warning remains. Fragment cases are processor tests; no dedicated full-build
  fixture or browser navigation check was added for synthetic heading links.

### Markdown feature inventory (2026-09-25)

Compared a dev Eleventy build (`dist/`) with a forced Astro build, page by page,
after tokenizing published note bodies (including `ad-*` bodies) with
Eleventy's markdown-it options. Olaolu put all resulting items in scope.

- Match: headings, emphasis, inline code, fences, blockquotes/callouts, lists,
  images, the email autolink, and inline `<br/>` HTML.
- Unused, so do not port: footnotes, tables, task lists, `==mark==`, `{attrs}`,
  strikethrough, body hashtags (`taggify`), Dataview fields, embeds,
  mermaid/plantuml/gist/transclusion fences, Bases, and image `|width`.
- Smart punctuation: Sätteri's `smartPunctuation` follows Astro's
  `markdown.smartypants` (default on); Eleventy has typographer off. Astro
  converts about 270 quotes/ellipses. Scope: disable it.
- Link classes: Eleventy's `link_open` rule gives any href with a scheme
  (including `mailto:`) `class="external-link" target="_blank"`, and other
  hrefs `internal-link`. Astro adds neither to ordinary links (63 external
  links across 13 pages). Wikilinks already carry `internal-link`; do not
  duplicate it. The CSS icon targets `.external-link`. Scope: a HAST plugin.
- Math: the Maths note has 51 inline `$…$` expressions. Eleventy renders
  MathJax SVG at build time (`mjx-container jax="SVG"`). Astro emits raw `$`,
  and four spans between expressions become `<em>`. Sätteri's `math: true`
  emits `<code class="language-math math-inline">`, which stops the
  corruption but still needs a renderer. `mathjax-full` 3.2.1 is present only
  through `markdown-it-mathjax3`. No other note contains `$`.
- Soft breaks: Eleventy uses `breaks: true`; Sätteri has no equivalent. The
  only content difference is a tab-indented sub-list in NixOS part 1, which
  neither renderer parses as a list. Fix it in the vault ([TODO.md](TODO.md)).
- Callout titles: Astro emits `<p class="callout-title-content">`; Eleventy
  emits text plus a stray `<br>`. Defer to the layout/CSS stage.
- Eleventy leaves `[[Polynomials]]` as raw text; Astro's `/404` link follows
  the agreed unresolved-link behavior.
- The forced Astro build emitted no Shiki warnings, only the known
  `MODULE_TYPELESS_PACKAGE_JSON` warning and the forced data-store notice.

### Smart punctuation and link classes (2026-09-25)

- `astro.config.ts` sets Sätteri's `features.smartPunctuation: false`; user
  features override the adapter's `smartypants` default.
  `npm run test:smart-punctuation` covers prose and callouts (2 tests, which
  fail when the flag is `true`).
- `src/plugins/hast/linkClasses.ts` (Olaolu's implementation) filters `a`
  elements with an `href`, applies Eleventy's scheme rule, and appends
  `external-link` plus `target="_blank"` or `internal-link` to existing
  classes. It is registered after the callout plugin. Raw HTML anchors are
  untouched, as in Eleventy's `link_open`; no note uses them.
- `npm run test:link-classes`: 23 processor tests covering schemes, autolinks,
  `mailto:`/`tel:`, relative forms, wikilink class preservation, callouts,
  converted `ad-*` fences, mixed paragraphs, and code.
- Verified: 304 Node tests and 15 Chrome tests, source/test TypeScript,
  Prettier, and a forced 14-page build. A page-by-page comparison with the
  Eleventy build shows no remaining link-class, target, or prose-punctuation
  differences. The only curly characters left are MathJax's `\ldots` output.

### Build-time math (2026-09-25)

- Sätteri's `math` feature is on in the site config and in the `ad-*` reparse
  (`src/plugins/mdast/admonitions.ts`); the Maths note has math inside an
  `ad-note`. The reparse still omits GFM, so bare-URL autolinks inside `ad-*`
  fences would not link; no note does this.
- `src/plugins/mdast/math.ts` replaces `inlineMath`/`math` nodes with HTML
  from `renderMath(tex, "inline" | "full")`, which mirrors
  markdown-it-mathjax3: TeX with `AllPackages`, SVG with `fontCache: "none"`,
  assistive MathML, and styles inlined by `juice`. The adaptor and handler are
  registered once per module. It is registered after the admonition plugin.
- Why MDAST: Astro's Satteri highlight plugin reads `code.data.lang`, which
  Sätteri does not set for `$$` blocks, so the default `math` exclusion never
  matches and display math becomes a `plaintext` Shiki block before user HAST
  plugins run. Candidate upstream issue.
- `mathjax-full` 3.2.1 (Eleventy's version) and `juice` 12.2.0 are pinned
  direct dependencies; both ship types. Eleventy uses juice 8.1.0 internally.
- `npm run test:math`: 12 processor tests, with assertions checked against
  markdown-it-mathjax3 output (container attributes, SVG, assistive MathML,
  inline styles, no `<use>`/`<defs>`, error markers, display math, callouts,
  literal code dollars).
- Verified: 316 Node tests and 15 Chrome tests, TypeScript, Prettier, and a
  forced 14-page build. All 51 Maths-page `mjx-container` elements are
  byte-identical to Eleventy's.
- Known deviations: Sätteri treats `$5 and $6` as math, unlike
  markdown-it-mathjax3's delimiter rules (no note has prose dollars). TeX
  errors render as MathJax error output, as in Eleventy, without failing the
  build.

### Remaining Node warning (deferred 2026-09-25)

- The Markdown and Shiki warnings are gone. Builds and `npm test` still emit
  `MODULE_TYPELESS_PACKAGE_JSON` when Node runs ESM `.ts` files directly
  (the wikilink-index generator, tests, and imported `src` modules).
- A `.mts` rename only moves the warning to imported `.ts` modules such as
  `src/content/permalinks.ts`. `"type": "module"` would fix it but breaks the
  CommonJS Eleventy config, helpers, and data files.
- Olaolu deferred the fix until Eleventy is removed (cutover checklist). Do not
  suppress it with flags or nested `package.json` files in the meantime.
- Before removing Eleventy, document each Markdown plugin against the Eleventy
  behavior it replaces (cutover checklist), while the reference still exists.

### Client behavior decisions (2026-09-26)

- Search: port Eleventy's FlexSearch search (`searchScript.njk`: previews,
  keyboard navigation, highlighting, tag search via `toggleTagSearch`) over a
  rebuilt `/searchIndex.json`. This supersedes the earlier Pagefind idea.
- Alpine.js (mobile hamburger/overlay, per-path persisted folder state in
  `filetree.njk`) is replaced with tested vanilla TypeScript modules; no
  Alpine or CDN scripts.
- Pattern: write behavior as TS modules bound to Eleventy's DOM contract, test
  them in Chrome with Vitest (like `copyCode.ts`), and wire them in at the
  layout stage when the markup does not exist yet.
- Callouts first: Astro already emits callout markup. Eleventy's
  `calloutScript.njk` gives `.callout.is-collapsible` titles `tabindex="0"`,
  `role="button"`, and `aria-expanded`, and toggles `is-collapsed` on click,
  Enter, or Space. Hiding the content is CSS. Icons read the theme's
  `--callout-icon` and use Lucide, so they wait for the CSS stage.
- Eleventy makes only top-level callouts collapsible (nested ones need
  `+`/`-`); the Astro HAST plugin makes every callout collapsible. Olaolu kept
  the Astro behavior on 2026-09-26.

### Callout toggles (2026-09-26)

- `src/scripts/callouts.ts` (Olaolu's implementation) exports
  `initializeCalloutToggles()`. For each `.callout.is-collapsible`, its direct
  `:scope > .callout-title` gets `tabindex="0"`, `role="button"`, and
  `aria-expanded`; click, Enter, and Space toggle `is-collapsed` on the
  callout and `aria-expanded` on the title. A `has-callout-toggle` marker
  prevents duplicate listeners. Both page routes call it beside
  `initializeCopyButtons()`. Eleventy's runtime icon and auto-collapsible code
  is not ported: the HAST plugin marks every callout at build time, and icons
  wait for the CSS stage.
- Not written test-first. `npm run test:callouts-browser` runs 13 Chrome tests;
  they were then checked against seven broken module variants (state on the
  wrong element, missing guard, no `preventDefault`, Enter only, all callouts,
  fixed initial ARIA), and each variant fails at least one test.
- Verified: 316 Node tests and 28 Chrome tests, TypeScript, Prettier, and a
  forced 14-page build. On `astro preview`, agent-browser saw both Maths
  callout titles as expanded buttons; clicking the nested aside, then Enter
  and Space on the outer note, toggled only the targeted callout, with no page
  errors on the Maths page or home. Collapse is not visible until the CSS stage.

### Search index (2026-09-26)

- `src/pages/searchIndex.json.ts` is a static endpoint: Astro calls `GET` at
  build time and writes `dist-astro/searchIndex.json`. It serializes
  `buildSearchIndex(await getPublishedPosts())` from
  `src/content/search-index.ts` (Olaolu's implementation).
- Entries are `{ title, url, content, tags }` for all 14 published posts in
  collection order. Agreed changes from Eleventy: `date` dropped (unused by
  the search script and identical for every note); tags are
  `rawNoteProps.tags` only (no `note`/`gardenEntry`); content is the text of
  `rendered.html` (`node-html-parser` `structuredText` with `<pre>` parsed,
  whitespace collapsed), so callout markers and raw wikilinks are gone.
  Titles come from the `title` property, so `?` titles differ from Eleventy's
  filename-based ones by design. Missing rendered HTML fails with the post id.
- `HOME_POST_TAG` and `isHomePost()` moved to `src/content/home.ts`, which has
  no Astro runtime imports. `permalinks.ts` is loaded by the Node wikilink
  generator, so it must never import `posts.ts` (`astro:content`).
- `node-html-parser` is now a dependency at `^9.0.4`. v9 keeps the
  `__ASTRO_IMAGE_` attribute name that v7 truncated, so the image tests now
  read the real name (the build test's absence check was vacuous under v9).
- `npm run test:search-index`: 19 tests (some render through the site
  processor); checked against a throwaway reference implementation first.
- Verified: 335 Node tests and 28 Chrome tests, TypeScript, Prettier, and a
  forced build. The built index has 14 entries whose URLs match Eleventy's,
  tags match after removing `note`/`gardenEntry`, and no content contains
  callout markers or HTML.

### Search port requirements and layout-first order (2026-09-26)

- Olaolu moved Markup and CSS ahead of the remaining search work: the search
  box, button, and preview (`.content`/`main` extraction) depend on the layout.
- Search port (`searchScript.njk`): FlexSearch `0.7.43` pinned and bundled (0.7
  API; 0.8 changed encoders). Split into pure search logic (Node tests against
  real index entries), UI behavior (Chrome tests on `searchContainer.njk`
  markup), then preview and wiring after the layout exists.
- Fix, with regression tests, three Eleventy defects instead of porting them:
  1. Unescaped `innerHTML`: titles, excerpts, tags, and the no-results query.
     The new index stores decoded text (for example
     `<options-to-pass-to-executable>` in the Stack post), and `?q=` is
     attacker-controlled. Test that such text renders as text, not elements.
  2. `highlightTerms` re-scans its own `<span class="search-highlight">`
     markup, so queries like `span` or `class` corrupt it. Test those queries.
  3. Search runs on `keydown`, so mouse paste and the search field's clear
     button never search. Listen for `input` and test both.
- Visual reference: the live site loads `obsidian-base.css`, then
  `_theme.b9d91f25.css`, `digital-garden-base.css`, `custom-style.css`, and
  `user/{callout-overrides,callouts,code-blocks,custom}.css`. A local
  `npx eleventy` run without `get-theme` falls back to `style.css`, so use the
  live site or a full `npm run build:eleventy` for visual comparison.

### Vendored theme (2026-09-26)

- `src/styles/vendor/obsidian-theme.css` is the live
  `/styles/_theme.b9d91f25.css`, committed verbatim (SHA-256
  `b9d91f255feb4505…`, matching the Eleventy name; upstream HEAD hashes the
  same). Provenance is in `src/styles/vendor/README.md`; `.prettierignore`
  excludes the directory. Not loaded by Astro yet.
- Eleventy still runs `get-theme` as the parity reference; deleting it and
  the `THEME` settings is a cutover item.

### Markup and CSS stage (2026-09-26)

- Claude implements this stage (Olaolu's handover); every other stage stays
  in Learn / Guide mode. Every test Claude writes explains in a comment why
  it exists and why that level of test fits.
- [ADR 0003](docs/adrs/0003-build-a-tailwind-token-design-system-before-cutover.md):
  Tailwind v4 design system before cutover, in two phases. Phase 1 is a
  parity shell: Eleventy class names with the legacy cascade in one low
  cascade layer. Phase 2 revises the Eleventy styles into tokens,
  utility-based components, and a content stylesheet, then removes the
  legacy CSS.
- Log intentional changes in `docs/design-changes.md`. The working plan is
  the uncommitted `MARKUP_CSS_PLAN.md` at the repository root.
- Fonts stay: Instrument Sans (text), Instrument Serif (headings, weight 700),
  and Commit Mono (code). Headings currently render from the vendored
  theme's base64 Instrument Serif; the self-hosted face declares weight 400
  only, so removing the theme risks synthesized bold.
- Analytics are deferred until after markup (their own checklist section).
  The live site has them, so they must land before cutover.

### Phase 1 parity shell (2026-09-26)

- Integrated: `BaseLayout.astro` (head, metadata, legacy CSS, scripts);
  `NoteHeader`, `PostFooter`, `RecentPosts`; `SiteNavigation` (thin data
  wrapper) → `NavShell`, `FileTreeEntry`, `NavSearchButton`;
  `src/content/file-tree.ts` (Eleventy `sortTree` port); `src/pages/404.astro`;
  callout titles with build-time icons (`src/plugins/hast/callout-icons.ts`,
  `lucide-icon.ts`); `src/lib/{site,dates,metadata}.ts`.
- Selector adaptations live in `src/styles/legacy/adaptations/_*.scss`, one
  per area. Links and real buttons do not match legacy `button` rules, so the
  header and navigation adaptations copy the relevant `button` properties
  (height, shadow, transition, weight). Code blocks keep Eleventy's `shiki`
  and `language-*` classes and label unlabelled fences "text" (Shiki
  transformers in `astro.config.ts`). Markdown images get `height: auto`
  because Astro emits no responsive-image CSS for them.
- Parity evidence: pixel diffs against thunk.blog at 1440x900 and 390x844
  (posts within 0.01%; Home differs by the removed empty header) plus
  computed-style comparisons of tags, search buttons, code blocks, callouts,
  and Recent Posts. Intentional changes: `docs/design-changes.md`.
- Tests: unit (`dates`, `metadata`, `file-tree`), component
  (`test/components/*`, Container API), build (`site-build`,
  `head-metadata` with plain-text snapshots, `not-found-page`), and
  `test/layout/site-layout.test.ts` (Playwright + axe-core on every page;
  `npm run test:layout`). Known live-site accessibility issues are listed in
  that file and must still occur.
- Component tests cannot use real content collections (Container API sees
  an empty collection), so data-fetching components stay thin wrappers.
- Adversarial review (Sonnet): no confirmed defects; its two notes were
  applied (Recent Posts filters placeholder descriptions; axe runs on all
  pages).
- npm 11 skipped the root `postinstall` (`patch-package`) after dependency
  installs in this session, silently dropping `patches/astro+7.2.9.patch`;
  `test:images-build` caught it. `dev:astro` and `build:astro` now reapply
  patches first (`patch-dependencies`); test builds call `astro build`
  directly and rely on the installed state.
- Worktree-isolated subagents cannot run agent-browser `eval`; verify
  computed styles from the lead session.
- Type checking: `npm run typecheck` (`astro check`, first step of
  `npm test`) checks `.astro` and `.ts` files in the tsconfig project.
  `typescript` 6.0.3 and `@astrojs/check` 0.9.10 are pinned; TypeScript 7
  is outside `@astrojs/check`'s peer range. `test/` is not in the tsconfig
  `include`, so test files are not type-checked; `astro.config.ts` is.

### Phase 2 design system (2026-09-26)

- Done: the legacy Eleventy/Obsidian cascade (`src/styles/legacy/`, the
  vendored theme) is deleted; Tailwind 4.3.3 tokens, utilities, and
  hand-written content CSS style the site, with Preflight. Page CSS went from
  about 1.1 MB to about 36 KB. Structure and conventions:
  `src/styles/README.md`. Every visible change from live:
  `docs/design-changes.md`.
- Olaolu's decisions: muted text raised to AA (#8c8c8c); 404 site-consistent;
  quote/cite get Lucide `quote`; built-in callout icons shown; fix inherited
  Obsidian defects like a regular website (checkboxes, footnotes heading,
  heading letter-spacing, Recent Posts indent) and log each.
- `global.css` declares `theme < base < components < utilities`; Lightning
  CSS rewrites the order statement, so tests check the effective order.
  Utility scanning is limited to components, layouts, pages, and scripts
  (`source(none)`): the default scan turned note words into `.table`,
  `.hidden`, `.collapse` utilities.
- `tokens.css` (`@theme static`) clears Tailwind's default namespaces.
  Since 2026-09-27 it follows Tailwind's structure (see "Tokens on
  Tailwind's scales" below).
- Removed dead Obsidian hooks: body `theme-dark`, `markdown-preview-view`,
  `markdown-preview-section`; main `cm-s-obsidian`, `print`. Kept
  `markdown-rendered` (content stylesheet scope) and other class names
  scripts and tests use.
- Preflight side effects handled: inline MathJax SVGs (`display: inline`),
  `ol` numbering, `pre` and 404 paragraph margins.
- Style guide: `src/style-guide/StyleGuide.astro`, injected at
  `/style-guide/` by `astro dev` only (Olaolu chose dev-only over public on
  2026-09-27). It documents the design system: principles, each token's
  value and purpose, contrast, components, and a Markdown sample. The
  sentence per token lives in `src/style-guide/tokens.ts`, and
  `test/style-guide.test.ts` requires one for every token. The tag markup
  moved to `src/components/Tag.astro` so the page can show it.
- Process: four worktree agents (navigation; header/footer/Recent Posts/404;
  typography; code and callouts), then an adversarial review (10 findings,
  all fixed: print, tests, axe allowlist, reduced motion, copy button hover,
  synthesized bold, rem sizing, overlay, hygiene).
- Links in note text have a faint underline, and overflowing callout bodies
  get a tab stop (`src/scripts/scrollRegions.ts`). The only axe allowlist
  entry left is the vault's `aside` callout color (#7f849c, 3.98:1), which
  comes from `npm run sync-callouts`.
- `.fullpage-overlay` is styled by the search and mobile file tree work below.

### Tokens on Tailwind's scales (2026-09-27)

- Olaolu's direction: follow Tailwind's structure and scales; keep the
  values that define the site, take Tailwind's where ours were incidental.
  Decisions (all as recommended): Tailwind's paired line heights, with
  `leading-relaxed` for the file tree (`sm` later became live's 0.85rem,
  which puts the tree within half a pixel of live's line); the site name
  kept live's 2rem / 1.1 as a listed exception; palette-only color names
  (`gray-50`…`950`, no `text-muted`); key caps at 0.8em of their hint
  (`Key.astro`, the one listed arbitrary size); one focus ring (2px gray,
  4px offset); snap every off-grid value; enforce with a test.
- `test/design-system.test.ts` reads the source: token names in
  Tailwind's namespaces and step names, adopted steps equal to Tailwind's,
  no color/length literals in CSS (except 1px/2px borders and the note
  text's 1.03rem), half-step spacing, Tailwind durations, no `var()` of a
  missing token, and no arbitrary values in templates beyond its list.
- The 700px column stays `--container-content`: `max-w-prose` is a
  Tailwind built-in (65ch).
- Opacity modifiers compute to `oklab(...)`; layout tests compare colors
  through the `rgba()` helper in `test/layout/site-layout.test.ts`.
- Tailwind drops an unknown class silently, and the test only catches
  stale `var()`s, so check renamed utilities with Tailwind's
  `__unstable__loadDesignSystem` (`candidatesToCss` returns null).
- Every visible change: `docs/design-changes.md` (2026-09-27, Tokens on
  Tailwind's scales; then Consistency fixes).
- Consistency fixes (Olaolu approved all recommendations,
  https://claude.ai/artifact/1bJhVxwWsrefSNJ2ojZvaq): the search field is
  `type="text"` (a search field ate the first Escape); links in sentences
  share the `link-underline` utility (`src/styles/utilities.css`, which
  typography.css `@apply`s); astro.config.ts swaps Shiki's block background
  for `var(--color-gray-900)`. Extra `<h1>`s per page are a TODO.
- Astro's content store (`node_modules/.astro/data-store.json`) clears only
  when the Astro version, content config, or a JSON digest of the Astro
  config changes; the digest drops functions, so edits to remark/rehype
  plugins or Shiki transformers leave unchanged notes with stale HTML
  (reproduced with the code-block background). Vercel restores
  `node_modules/**` between builds, so `npm run build` is
  `astro build --force` (`test/build-scripts.test.ts`). Locally, run
  `npm run dev -- --force` after changing a plugin.

### Analytics (2026-09-26)

- `@vercel/analytics` 2.0.1 and `@vercel/speed-insights` 2.0.0 (pinned)
  render custom elements at the end of `BaseLayout`'s body; their scripts
  load from `/_vercel/insights/script.js` and
  `/_vercel/speed-insights/script.js`, which Vercel serves only when Web
  Analytics and Speed Insights are enabled for the project. Enabling them is
  a Vercel project setting (not done; needs Olaolu). Locally those requests
  404 harmlessly.
- The images-build fixture symlinks `node_modules`; it sets
  `vite.resolve.preserveSymlinks` so dependency `.astro` components compile.

### Search dialog and mobile file tree markup (2026-09-26)

- Olaolu split the search work: Claude built the markup and styles of the
  search dialog and the open mobile file tree (test-first); Olaolu writes the
  FlexSearch port, the dialog and navigation scripts, and their tests, in
  Learn / Guide mode.
- `src/components/SearchDialog.astro` (rendered once by `NavShell`) is a
  native `<dialog id="globalsearch">`, and its header comment is the
  contract with the search script: open with `showModal()`, close with
  `close()` (a click whose target is the dialog itself is outside the box);
  `#term` is a combobox (script keeps `aria-expanded`,
  `aria-activedescendant`); `#search-layout[data-state]` is `idle`,
  `results`, or `empty`; results are `a.searchresult[role=option]
[aria-selected]` appended to `#search-results` (listbox); matches are
  `mark.search-highlight`; the query goes into `.no-results-query` as text;
  the placeholder shows while `#preview-content` is empty. Script-built
  markup is styled by class in `src/styles/components/search.css`.
- After filling the preview, the script must call `initializeScrollRegions()`:
  callouts with wide math overflow the narrow panel (axe
  `scrollable-region-focusable`).
- The preview body is a content root: `content/typography.css` scopes to
  `:is(main.content, .preview-body)` and `content/code.css` to
  `:is(.content, .preview-body)`. `search.css` hides the note's header and
  footer and compacts text, headings, and inline code as live did.
- Search buttons carry `aria-haspopup="dialog"` and
  `aria-controls="globalsearch"`; the Ctrl key has `.search-key-modifier`
  for the Mac ⌘ swap (set its text, not innerHTML).
- Mobile file tree: the hamburger's `aria-expanded` is the only state
  (`aria-controls="filetree"`). The `nav-open` custom variant in
  `global.css` (`:root:has(.hamburger-btn[aria-expanded="true"]) &`) shows
  `#filetree` and the fixed `.fullpage-overlay` below lg. The navbar and file
  tree `<nav>`s are named "Site" and "Notes" (axe `landmark-unique` when both
  show).
- Live hid the browser's search clear button (Obsidian CSS); it stays
  hidden. Searching on `input` still matters for paste.
- Tests: `test/components/search-dialog.test.ts` (markup contract), new
  NavShell cases, and `test/layout/site-layout.test.ts` (closed/open
  geometry, each state, selection, highlight, preview placeholder and
  styling, drawer and overlay, axe with the dialog and drawer open). The
  layout tests fill the dialog themselves per the contract. Mutation check:
  9 of 10 CSS/markup mutations fail a test; the survivor (removing one nav
  label) is equivalent.
- Design changes logged in `docs/design-changes.md` ("Search dialog and
  mobile file tree").

### FlexSearch port (2026-09-26)

- Olaolu handed this item to Claude ("handle the flex search impl TDD
  style"); the dialog wiring stays with him unless he hands it over.
- `src/scripts/searchEngine.ts`: `createSearchEngine(entries)` wraps a
  FlexSearch 0.7.43 (pinned) `Document` index with live's settings (encoder,
  `latin:extra`, reverse content / forward title and tags, limits 5 + 10);
  `search(query)` returns entries, title matches first, each once; `#tag`
  searches tags only. The package's types declare named exports but both
  builds export one default object, bridged in one commented line.
- `src/scripts/searchText.ts`: `searchTerms`, `excerpt` (live's 50/120
  window, keeps `<...>` text), `highlightSegments` (ranges on the text,
  overlaps merged; no HTML strings).
- `src/scripts/search.ts`: `initializeSearch(loadDocuments?)`, called from
  `BaseLayout`. On `input` it searches after a 150ms pause (live: 200ms;
  clearing shows the hint at once) and writes the dialog per the
  SearchDialog contract (options with the first selected,
  `aria-activedescendant`, `data-state`, the no-results query as text);
  results are built with `createElement` and text nodes. The index and the
  engine module load together on first focus or input (dynamic import, so
  FlexSearch is its own chunk), retry after a failure, and a query number
  drops stale searches.
- Dialog wiring (also handed over, 2026-09-26):
  `src/scripts/searchDialog.ts` opens the dialog from the search buttons
  (`aria-controls="globalsearch"`), Ctrl/⌘+K (toggles), `?q=`, and tags
  (header `a.tag` links search their `?q=` in place unless modified-clicked;
  preview `button.tag`s search their text); a click whose target is the
  dialog closes it; arrows move `aria-selected`/`aria-activedescendant`
  (wrapping), hover selects, Enter clicks the selected link; Apple
  platforms show ⌘. `src/scripts/searchPreview.ts` watches the field's
  `aria-activedescendant` (MutationObserver) and fills `#preview-content`
  with the result's title and tags plus the fetched note's `main.content`
  (ids dropped, matches marked on text nodes, `initializeScrollRegions()`
  after), caches pages per visit, drops stale previews, and fetches
  nothing while the panel is hidden (phones). `BaseLayout` initializes the
  dialog last so `?q=` searches at once.
- Tests: `test/search-engine.test.ts` (16, Node), `test/browser/search.test.ts`
  (13, Chrome), `test/browser/searchDialog.test.ts` (14, Chrome), seven
  built-site tests in `test/layout/site-layout.test.ts`, and a
  `page scripts` build test. The wiring's 11 mutations each fail a test. 11 mutations (the three live defects
  reintroduced, the race guard, retry, idempotence, excerpt stripping,
  overlap merge, tag search) each fail a test.

### Mobile navigation and folder state (2026-09-27)

- Handed over to Claude (TDD); Olaolu reviews before commit.
- `src/scripts/mobileNavigation.ts` (revised for the no-JavaScript
  fallback, 2026-09-27): `#filetree` is `popover="auto"` and the hamburger
  has `popovertarget="filetree"`, so the browser opens and closes the tree
  (tap outside, Escape, focus back to the hamburger), dims with
  `::backdrop` (`.fullpage-overlay` and the `nav-open` variant are gone),
  and exposes the hamburger's expanded state; it works without
  JavaScript. The script only focuses the tree's first link on `toggle`
  (open) and hides the popover when widening to lg. From lg up the same
  element shows in place (`flex` beats the UA's closed-popover
  `display: none`); `text-inherit`/`overflow-visible` undo other UA
  popover styles.
- `src/scripts/folderState.ts`: folders carry `data-folder-path`
  (FileTreeEntry builds live's `menuItem` path: root name, then
  `/child`). State is read and written under live's Alpine `$persist` keys
  (`_x_` + path, JSON booleans), so visitors keep their folders. Saved from
  a MutationObserver on `open`: the `toggle` event arrives in a later task
  and was lost when a test (or a quick reader) navigated right after
  opening a folder. Storage errors are swallowed.
- Tests: a NavShell component test for the paths, 7 + 5 Chrome tests, two
  built-site tests. 10 mutations each fail a test.

### Fallbacks without JavaScript (2026-09-27)

- Handed over to Claude (TDD). The mobile tree is a popover (above);
  `NavSearchButton` has `noscript:hidden` (Tailwind's `@media (scripting:
none)` variant); `content/callouts.css` shows collapsed callouts' content
  and hides their fold control under `scripting: none`. Folders
  (`<details>`), links, and tag links (`/?q=#tag`) already worked. Not
  covered: overflowing callouts get their keyboard tab stop from a script.
- Tests: layout tests run the drawer with JavaScript on and off, check the
  search buttons both ways, and a collapsed callout rendered with the
  site's stylesheet (no note has one). Screenshots of all 30 page views and
  the open drawer match the previous build. 7 of 8 mutations fail a test;
  `text-inherit` is a guard with no visible effect today.

### Test builds run in parallel safely (2026-09-27)

- `test/support/site-build.ts` gives every `buildSite()` its own Astro and
  Vite cache folders through a generated config that wraps
  `astro.config.ts` (`--config` is joined onto the project root, so it is
  passed relative). With the shared `node_modules/.astro`, one test file's
  `--force` build cleared the content store while another's was using it:
  ENOENT on `data-store.json.tmp` or "No post with a top-level tag
  including 'gardenEntry'", and that file's tests were cancelled. A failed
  build now removes its work folder.
- `test/site-build-concurrency.test.ts` starts four builds 700ms apart; it
  failed 3 of 3 runs before the fix and passes after. Builds started at the
  same instant did not reproduce it.
- Considered and declined: one shared build from a Node global test setup
  (`--test-global-setup`). Only three unit files and the layout tests
  build; builds take seconds; sharing would couple the files and the
  single-file `test:*` scripts to a setup file. Revisit if more files need
  the built site or builds get slow (reasoning also in
  `test/support/site-build.ts`).

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

Since 2026-09-28 `vercel.json` sets the framework to Astro, builds with
`npm run build`, and serves `dist`; it has no routes (Vercel serves
`404.html`). The Vercel project's own framework preset still says Eleventy
(read, not changed). Before this, previews of `astro-rewrite` failed on the
missing `build` script.

## Deferred work

Keep these outside the migration checklist:

- Table of contents (wanted; design first), backlinks, local graph, and
  link previews.
- Wikilink-index hot reload if pre-dev generation becomes insufficient.
- Distill the vendored theme into owned styles after cutover (ADR 0001).
- Revisit the publishing boundary. (Math moved into Markdown scope on
  2026-09-25; Speed Insights is done.)
- Upstream Sätteri issues in [TODO.md](TODO.md), then removal of superseded
  local workarounds.

## Eleventy removed (2026-09-28)

- Deleted `.eleventy.js`, `src/site/_includes`, `_data`, `styles`, `fonts`,
  the `.njk` routes, `get-theme.js`, `src/helpers/`, their three `.js`
  tests, `plugin-info.json`, `.env`, the Eleventy npm scripts, and 28
  Eleventy-only dependencies. `package.json` is `"type": "module"`.
- Kept `src/site/notes/**/*.md` and `src/site/img/user/`: the Digital
  Garden plugin publishes there (hard-coded paths) and Astro reads them.
- Scripts are Astro's standard `dev`, `build` (`--force`), and `preview`,
  with `predev`/`prebuild` applying patches and the wikilink index.
- `test/callout-icons.test.ts` holds Obsidian's built-in icons as a fixed
  table; `npm run sync-callouts` no longer writes Eleventy's Sass.
- Never merge the Digital Garden plugin's "Update template" pull request:
  it restores the Eleventy files.
- Inventory of parity, deliberate changes, and what was left out:
  https://claude.ai/artifact/6qEa9Jzk4T2mVvd3fjKyeG.

## Cutover checks and typography (2026-09-28)

- Crawl of a fresh build: 0 broken internal links, anchors, or assets
  (476 references); the only unresolved wikilink (`[[Polynomials]]`) goes
  to `/404`. External: all 200 except two StackOverflow 403s (bot block).
- Preview `dpl_8X5zndPDmuxqRft4BEYaeGoPdTxa` (`a1e3af1`) READY; a missing
  URL returns the site's 404 page with status 404. Other preview URLs sit
  behind Vercel Authentication (the MCP fetch hits SSO); Olaolu checked
  them in a browser.
- Agreed typography refinements, not yet built:
  [docs/typography-refinements.md](docs/typography-refinements.md). The
  column widens to 931px at 1280 (120 cpl); the cap plus 18px text gives
  82 cpl at 1100–1440px.
- A 5+ column table is clipped on phones today (no way to scroll to it);
  the wrapper stays a TODO until a note has one.
- Diagrams (agreed): `mermaid` and `plantuml` fences render to inline SVG
  at build time through kroki.io; the build fails when Kroki fails. Needs
  an ADR. Digital Garden 2.94.1 does not touch these fences.
- Transclusions: the plugin inlines `![[embeds]]` at publish time as
  `div.transclusion > a.markdown-embed-link + div.markdown-embed` with a
  `#` title in `.markdown-embed-title`, even for unpublished notes (it only
  omits the link). Designs: https://claude.ai/artifact/6Uq4RNhfRueyUJSmAB2r8P
  Olaolu chose B, the source card; built as item 9 below.

## Remaining work handed over (2026-09-28)

Olaolu handed Claude the remaining rewrite items (then a checklist, since
folded into TODO.md), in
the listed order. After each item: stop, show the result, and wait for his
approval before committing and starting the next.
- Item 1 (Astro upgrade): Astro 7.3.5 and `@astrojs/markdown-satteri`
  0.4.2 (matches Astro's own dependency). 7.3.x ships the image-attribute
  decoding fix, so `patches/astro+7.3.5.patch` keeps only the `glob.js`
  rendering-error hunk (#18054), which still applies unchanged. Astro 7.3
  annotates elements with `data-astro-source-*` under Vite's dev server;
  `vitest.astro.config.mts` turns the dev toolbar off so component tests see
  build markup. Evidence: `npm test` (476 unit, 53 component, 59 layout,
  75 browser, typecheck clean), `test:images-build` 7/7, build 16 pages,
  and a forced build of the pre-upgrade commit is byte-identical (`diff -rq`
  over all of `dist`).
- Item 2 (linting): ESLint 10 flat config (`eslint.config.ts`):
  typescript-eslint `strictTypeChecked`, eslint-plugin-astro recommended
  plus jsx-a11y-recommended (via `eslint-plugin-jsx-a11y-x`, which supports
  ESLint 10), and eslint-config-prettier. Each rule change carries its reason
  in the config. `.astro` files and component tests skip `no-unsafe-*`
  (TypeScript alone can't type `.astro` modules; astro check covers them).
  `tsconfig.json` now sets `noUncheckedIndexedAccess`; root config files are
  included; `test/tsconfig.json` types the tests for linting. Prettier is
  enforced by `format:check`; `.prettierignore` skips build output, the
  plugin-owned `src/site/`, and all Markdown. `npm test` runs typecheck,
  lint, format check, then the suites. Evidence: `npm test` green (476
  unit, 53 component, 59 layout, 75 browser); a forced build differs from
  the pre-lint build only in the client bundle's hash and the reformatted
  manifest (same JSON); the bundle diff is the intended copy-code, clipboard,
  search JSON, and tag-click changes.
- Item 2 also: note dates are validated when notes load.
  `src/content/note-dates.ts` (`noteDateSchema`) holds `published` and
  `last_updated` to `YYYY-MM-DDTHH:MM[:SS]` as a real date and time, so a bad
  value fails the build with Astro naming the note file, the property, the
  expected form, and the value. `src/lib/dates.ts` shares one parser
  (`readWallClock`) between the schema and `noteInstant`, and now also
  rejects rolled-over minutes and seconds (`10:00:75`). Its non-null
  assertions were replaced with checks; `Number()` results are checked for
  NaN. `npm test`: 488 unit tests.
- Item 3 (no-non-null-assertion): on for `src`, `scripts`, and config;
  off for tests (a test asserting on the element it just queried fails
  either way). The 32 assertions (28 lines) became checks: attribute and
  dataset reads skip or return when absent, array reads narrow with a
  guard or `flatMap(... ?? [])`, the style guide reads tokens through
  `tokenValue` (throws "tokens.css has no --x"), and the callout sync only
  records a callout once color and icon are both set. Evidence: `npm test`
  green; a forced build differs from HEAD only in the two client bundles'
  hashes, and their readable diffs match the source edits one for one.
- Item 4 (typography): built per docs/typography-refinements.md. Note text
  `--text-lg` on `--leading-relaxed` from `md`; the `lg`–`xl` column capped
  at `--container-content`; callout leading relaxed from `md`; `p, li`
  `text-wrap: pretty`; h6 `--tracking-wider` (new token, Tailwind's 0.05em).
  Layout tests measure 82 characters a line at 1100/1280/1440 (≤ 90
  asserted) and the computed sizes. h1–h3 tracking is unchanged pending
  Olaolu's call. Screenshots:
  https://claude.ai/artifact/JKREUvtR8Vyk8AdmwBC8qE.
- Item 5 (table of contents): `contentsEntries` (src/content/
  table-of-contents.ts) keeps h2/h3 from Astro's `headings`, drops
  `footnote-label`, and needs three. `TableOfContents.astro` renders in the
  note header (so the content @scope and the search preview skip it):
  `.toc-rail` (xl+, sticky, beside main.content), `details.toc-inline`
  (md–xl), `button.toc-button` + popover `#toc-sheet` (below md);
  `scripts/tableOfContents.ts` sets `aria-current="location"` and closes
  the sheet on a link. Headings got `scroll-margin-top`. Tests build a
  fixture site (`test/support/fixture-site.ts`, shared with images-build;
  `test/support/static-server.ts`, shared with site-layout).
- Item 6 (table wrapper): `hastTableWrapperPlugin` wraps every `table`
  (`ctx.wrapNode`), registered last in astro.config.ts. Table margins moved
  to `.table-wrapper`; tables are `width: max-content; min-width: 100%`,
  cells `max-width: 30ch` with `overflow-wrap: anywhere` (no ellipsis), and
  code in cells wraps. Keyboard access reuses `scrollRegions.ts` (tab stop,
  `role="group"`, "Table, scrollable" only while overflowing) instead of the
  static `tabindex`/`role="region"` the checklist first described. Edge
  shadows (Lea Verou's local/scroll backgrounds, gray-950 covers; none in
  callouts); the layout test samples pixels with the table hidden. Not
  built: a sticky first column.
- Item 7 (task-list labels): `hastTaskListLabelsPlugin` (registered last)
  visits `li` and `p`; when the first child is the checkbox, it wraps the
  checkbox and the children before any nested `ul`/`ol` in a `<label>`.
  Tests: processor cases (tight, nested, loose, ordered, disabled state)
  and a fixture-site layout test (names, read-only, axe).
- Item 8 (diagrams, ADR 0006): `mkmdastDiagramsPlugin` (after the callout
  plugin) → `renderWithKroki` (src/lib/kroki.ts: POST `/{type}/svg`,
  options in the query string, cache keyed by URL+type+options+source in
  `KROKI_CACHE_DIR` or node_modules/.cache/kroki, errors quote Kroki's text
  without its stack) → `prepareDiagramSvg` (src/lib/diagram-svg.ts:
  strips scripts/on*/javascript:, prefixes ids and their references,
  role=img + name, drops PlantUML's fixed size). Figures carry
  `--diagram-width`; CSS shrinks to ≥70% then scrolls; scrollRegions covers
  `.diagram`. Scrolling diagrams get an edge-fade mask moved by a
  scroll-driven animation (`@property --fade-start/--fade-end`, keyframes
  `diagram-edge-fade`), off on `:focus-visible`. Write its animation as
  longhands: Lightning CSS folds `animation` + `animation-timeline` into a
  shorthand browsers reject. The content @scope stops at `.diagram` (Mermaid labels are
  HTML `<p>`). Tests use test/support/fake-kroki.ts with real Kroki SVGs in
  test/fixtures/kroki; nothing in `npm test` calls kroki.io.
- Item 9 (transclusions): `mkmdastTransclusionsPlugin(wikilinkIndex)`
  (after the wikilinks plugin) works on the publisher's flat mdast: html
  `<div class="transclusion …"><a …><div class="markdown-embed">`, then
  optionally html `<div class="markdown-embed-title">` + heading + html
  `</div>`, then the embedded Markdown, then html `</div></div>`. The
  publisher writes a title only for `![[Note|Title]]` (`{{title}}` gives
  the file name) at any heading level; the heading becomes a paragraph
  (dropped from `headings`); Olaolu wants such titles shown as written,
  without "From". Untitled published embeds get
  `<p><span class="markdown-embed-from">From </span>Title</p>`; the title is
  the note's frontmatter title (`dg-note-properties.title`, Olaolu's call,
  not the file name), found by the link's URL through the wikilink index
  and `noteTitles`, which the index generator now also writes. The link's
  `aria-label` becomes "Open Title", its svg
  `aria-hidden`, and a fragment is re-slugged (github-slugger) from the
  embed's first heading, since the publisher uses `slugify` (`#My-Heading`).
  Styles: src/styles/content/transclusions.css. Headings inside embeds keep
  unique IDs (the processor dedupes) and do appear in the host's table of
  contents unless filtered: `mdastEmbeddedHeadingsPlugin` (registered
  after every plugin that adds or removes headings, before highlights)
  counts mdast headings in document order, tracking embed depth by the
  publisher's opening block and `</div></div>`, and records the embedded
  ones' positions in `ctx.data.astro.frontmatter.embeddedHeadings`; the
  note page reads them from `remarkPluginFrontmatter`
  (`embeddedHeadingPositions`), and `contentsEntries` drops them before
  the three-section minimum. Positions, not tags or text markers: Astro's
  headings carry only depth/slug/text, its heading-ID step runs after all
  user plugins, and a text marker would reach the page and the slug. Block IDs:
  `mdastBlockIdsPlugin` turns the publisher's `{ #id}` markers (a
  paragraph's last line `text\n{ #id}`, or a paragraph of its own after
  the block) into `hProperties.id` on the paragraph, the list item (tight
  lists render no `<p>`), or the previous block; headings keep their own
  ID. A marker in a callout's first paragraph (shared with the title) loses
  its ID. `[id]` gets the headings' scroll margin. Tests:
  test/transclusions.test.ts, test/block-ids.test.ts,
  test/layout/transclusions.test.ts, markup from
  test/support/publisher-embed.ts.
- Item 10 (CI, written, not yet run on GitHub): `.github/workflows/ci.yml`
  runs on pull requests and pushes to `main` (Olaolu's choice), cancelling
  a superseded run on either; ubuntu-24.04, Node from `.nvmrc`, `npm ci`,
  `npx playwright install --with-deps chromium`, `npm test`, `npm run
  build`; read-only permissions; actions pinned by SHA. Dependabot groups
  npm minor+patch into one weekly PR and now updates actions too; it reads
  its config from `main` only, so none of this applies before the merge.
  Unit tests pass with `TZ=UTC`. Olaolu had item 10 ticked on commit; the
  first GitHub run is still pending (needs the branch pushed and a PR into
  `main`, not yet approved).
- Item 11 (publishing instructions): they live in the vault template
  `Extras/Templates/Blogpost.md` (Olaolu's reminders, inside the
  `%% :::hidden … ::: %%` block the publisher's custom filter strips).
  With his approval: properties now `dg-publish`, `dg-permalink`, `title`,
  `description`, `tags`, `published`, `last_updated`, `dg-hide`
  (`dg-metatags` dropped: the site reads `description`); two `[!ai-text]`
  callouts correct his bullets and add the site's rules (embeds, block
  links, Kroki, sync-callouts). The README's "Publishing a note" section
  is the repo-side list the template links to (the link resolves once the
  README is on `main`). He chose to build `dg-hide` rather than drop it.
- Item 13a/13b (cutover): docs/markdown-pipeline.md documents the parser
  features, each mdast/hast plugin in order with the Eleventy behavior it
  replaces and its tests, Astro's own steps, and what was not ported
  (checked against `.eleventy.js` at ee0c949; Eleventy also had the
  `table-wrapper` transform). `npm run build`: 16 pages, one warning,
  `[WARN] [content] data store cleared (force)`, which Olaolu accepted as
  expected (keep `--force`; don't swap it for deleting
  node_modules/.astro/data-store.json).
- Item 13c, vault half (2026-09-29, Olaolu reviewed the plan first; Obsidian
  closed so `update-time-on-edit` couldn't restamp `last_updated`): the 13
  posts and Home under `Outbox/Digital Garden & Blog/` now carry
  `dg-publish`, `dg-permalink`, `title`, `description`, `tags`, `published`
  (from `created`), `last_updated` (from `updated`), in the template's
  order; `dg-metatags`, empty `dg-hide`, `created`, and `updated` removed.
  Every value matches the live repo copies except Home's description,
  now "Home" (was the placeholder). Home has no `tags`: the schema's
  `tagsSchema` reads a missing or null tags property as `[]`
  (test/note-tags.test.ts). Renamed `Endianness, WOOT!?` and `Numbers?
  Numerals? Oh Boy` (no vault links pointed at them); NixOS part 1's
  "package" sub-list lost one tab per line and now nests. Drafts and
  `On Creating Content.md` untouched. Backup of the prior Outbox in the
  session scratchpad. Still to do: a publisher round trip.
- Item 12 (performance review, one Sonnet 5 subagent, read-only; report
  checked against the repo): LCP is always a paragraph (0.7–1.0 s on a
  throttled phone, local), TBT 0 except the Maths note, one shared
  stylesheet (9 KB br) and one bundle (4 KB br); search loads lazily.
  Olaolu had two fixes made: `vercel.json` caches `/_astro/*` as
  `public, max-age=31536000, immutable` (not `/fonts/*`: unhashed names),
  and MathJax uses `fontCache: "local"` (314 KB → 256 KB, screenshots
  identical at 390/1440; glyph IDs `MJX-<n>-…` come from one renderer's
  counter, so they're unique per build; `local` doesn't share glyphs
  across expressions). Deferred to TODO.md: CLS 0.13–0.14 on Home and the
  image post (root cause unknown), the Commit Mono weight for the Ctrl K
  hint, and the Maths note's 500/600 weights.
- Production gating (2026-09-29, Olaolu chose Vercel Deployment Checks,
  which his plan has, over deploying from CI with a token): Vercel still
  builds every push; previews are unaffected. The CI job's first step,
  `vercel/repository-dispatch/actions/status@v1` (pinned to 30f760c), sets
  the commit status `Vercel - digitalgarden-blog: CI` (the name Vercel's Deployment
  Checks dialog generates for a check named `CI`; they must match) to
  pending, then success or failure in its post
  step from the job's step results; it works on push and pull_request
  events (uses `context.sha`), needs `statuses: write` and `actions: read`.
  Olaolu adds the Deployment Check only after the merge
  (TODO.md, "At the merge"): until then main has no workflow and production would
  wait forever. A superseded run cancelled by concurrency leaves its
  commit pending, so only the newest commit on main goes live.
- Snapshot tests (2026-09-29, Olaolu chose output snapshots over visual
  ones, which he dropped): test/markdown-snapshot.test.ts renders a note
  with every Markdown feature through the site's processor (fake Kroki,
  publisher-form wikilinks to Home and Dotfiles Reorg) and snapshots the
  HTML plus headings/embeddedHeadings; test/feed-snapshot.test.ts builds a
  fixture site and snapshots feed.xml one element per line. Both stable
  across runs and under TZ=UTC (MathJax IDs are deterministic within one
  test process). Fixture notes now take `tags` and `published`. Update
  with `node --test --test-update-snapshots <file>` after reading the diff.

