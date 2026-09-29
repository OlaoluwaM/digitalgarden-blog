# TODO

Astro implementation: [REWRITE.md](REWRITE.md).

## Before the next Obsidian publish

- [x] Rename `Endianness, WOOT!?` to `Endianness, WOOT!` in the vault.
- [x] Rename `Numbers? Numerals? Oh Boy` to `Numbers Numerals Oh Boy` in the vault.
- [x] Fix the tab-indented sub-list in `NixOS, the start of something new (part 1)` (the "package may refer to" items) so it parses as a nested list.
- [x] Keep the original titles in each note's `title` property. Avoid `?` and `#` in publishable filenames.
- [x] Align vault properties with [the content schema](src/content.config.ts): explicit `dg-permalink`; `title`, `description`, `tags`, `published`, and `last_updated` under `dg-note-properties` in publisher output.

## At the cutover

- [ ] Close Dependabot PRs #33–37 on `main` without merging: they bump Eleventy-era packages (`npm-run-all2`, `cross-env`, `@11ty/eleventy-plugin-rss`, `dotenv`) this branch removed, and `node-html-parser`, which this branch already has at 9.x.
- [ ] After the merge, once the CI workflow has run on `main` and passed, make production wait for CI:
  1. In Vercel, open the `digitalgarden-blog` project's Settings > Build and Deployment > Deployment Checks and choose Add Check > GitHub Actions.
  2. Under "Send workflow updates to Vercel", enter the check name `CI`. The snippet should read `name: Vercel - digitalgarden-blog: CI`, the status the workflow already sets; skip adding the snippet.
  3. Choose Add.
  4. Check: push a commit to `main`. Its deployment should wait until the workflow's `Vercel - digitalgarden-blog: CI` status passes, then take thunk.blog.

  Not before the merge: `main` has no workflow until then, so production would wait for a status that never comes, and published notes would never go live.

## Deferred site features

- [ ] Add a "collapse all folders" button to the file tree once the vault has more than one folder ([mockups](https://claude.ai/artifact/VnPJxBcZ2LEPgo6ZtNjpD8); leaning toward a square button beside the search button).
- [ ] Keep one `<h1>` per page: the navbar and sidebar site names are `<h1>`s too (inherited from live), so heading navigation meets the site name twice before the note title.

## Performance (from the 2026-09-29 review)

- [ ] Find the layout shift on Home and on posts with an image (CLS 0.13–0.14 at 1440px, just after first paint). Not fonts or the client scripts; the file tree's scrolling list is among the shifted elements. Needs a DevTools layout-shift trace.
- [ ] Decide whether the search button's "Ctrl K" hint needs Commit Mono: it loads the 47 KB font on every page. Also find what makes the Maths note load the 500 and 600 weights.

## Deferred upstream PRs

- [ ] Astro: upstream the Markdown rendering error fix and regression tests from the [local patch](patches/astro+7.3.5.patch) ([#18054](https://github.com/withastro/astro/issues/18054)).
- [ ] Digital Garden plugin: add an option to sync content through a pull request instead of committing directly to `main`.

## After pull-request publishing

Requires the Digital Garden plugin's pull-request option above.

- [ ] Deploy only after the CI workflow ([REWRITE.md](REWRITE.md)) passes on each publish pull request.

## Upstream Sätteri

Open focused issues; offer PRs after maintainers confirm the direction.

- [ ] Preserve wikilink provenance without source-position slicing.
- [ ] Fix the trailing backslash in escaped aliases (`[[Note\|Alias]]`).
- [ ] Discuss `ctx.sourceText(node)` if maintainers prefer a general source-access API.
