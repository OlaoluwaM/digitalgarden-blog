# Astro Rewrite Agent Context

Verified against `astro-rewrite` at `9c6e2e3` on 2026-09-10.
Recheck source before relying on this snapshot.

## Scope and document ownership

Olaolu is implementing in Learn / Guide mode. Preserve published content,
public URLs, and the existing desktop/mobile design. Eleventy remains the
reference until parity and cutover; Astro builds separately into `dist-astro`.
Exception agreed on 2026-09-17: original `/img/user/*` URLs need not remain available.
Vault publishing remains paused pending the tasks in [TODO.md](TODO.md).

- [AGENTS.md](AGENTS.md): session requirements and working conventions.
- [REWRITE.md](REWRITE.md): human implementation checklist. Markup/CSS comes
  before search and the remaining client behavior; cutover is last. Keep
  agent discussion here.
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
- Analytics are deferred until after markup (their own REWRITE.md section).
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
  `test:images-build` caught it. Reapplied with `npx patch-package`. Fresh
  installs (including Vercel) may drop it too; decision pending.
- Worktree-isolated subagents cannot run agent-browser `eval`; verify
  computed styles from the lead session.
- Type checking: `npm run typecheck` (`astro check`, first step of
  `npm test`) checks `.astro` and `.ts` files in the tsconfig project.
  `typescript` 6.0.3 and `@astrojs/check` 0.9.10 are pinned; TypeScript 7
  is outside `@astrojs/check`'s peer range. `test/` is not in the tsconfig
  `include`, so test files are not type-checked.

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
- Vercel Speed Insights; revisit the publishing boundary. (Math moved into
  Markdown scope on 2026-09-25.)
- Upstream Sätteri issues in [TODO.md](TODO.md), then removal of superseded
  local workarounds.
