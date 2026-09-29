# TODO

## Before the merge

- [ ] Check that the CI workflow passes on the `astro-rewrite` pull request, its first run on GitHub.

## At the merge

- [ ] Once the CI workflow has run on `main` and passed, make production wait for CI:
  1. In Vercel, open the `digitalgarden-blog` project's Settings > Build and Deployment > Deployment Checks and choose Add Check > GitHub Actions.
  2. Under "Send workflow updates to Vercel", enter the check name `CI`. The snippet should read `name: Vercel - digitalgarden-blog: CI`, the status the workflow already sets; skip adding the snippet.
  3. Choose Add.
  4. Check: push a commit to `main`. Its deployment should wait until the workflow's `Vercel - digitalgarden-blog: CI` status passes, then take thunk.blog.

  Not before the merge: `main` has no workflow until then, so production would wait for a status that never comes, and published notes would never go live.

- [ ] Publish from Obsidian and check the round trip: the build passes, and the only page changes are Home's description and the nested "package" list in NixOS part 1.
- [ ] Optional: switch the Vercel project's Framework Preset from Eleventy to Astro. `vercel.json` already sets Astro for every deployment, so this only tidies the dashboard. Never before the merge: until then the preset builds the live Eleventy site.

## After sign-off

- [ ] Add visual snapshot tests of the overall UI and key features: pages at phone and desktop widths, the search dialog, the mobile file tree, callouts, code blocks.

## Site features

- [ ] Add a "collapse all folders" button to the file tree once the vault has more than one folder ([mockups](https://claude.ai/artifact/VnPJxBcZ2LEPgo6ZtNjpD8); leaning toward a square button beside the search button).
- [ ] Keep one `<h1>` per page: the navbar and sidebar site names are `<h1>`s too (inherited from live), so heading navigation meets the site name twice before the note title.

## Performance

- [ ] Find the layout shift on Home and on posts with an image (CLS 0.13–0.14 at 1440px, just after first paint). Not fonts or the client scripts; the file tree's scrolling list is among the shifted elements. Needs a DevTools layout-shift trace.
- [ ] Decide whether the search button's "Ctrl K" hint needs Commit Mono: it loads the 47 KB font on every page. Also find what makes the Maths note load the 500 and 600 weights.

## Upstream

- [ ] Astro: upstream the Markdown rendering error fix and regression tests from the [local patch](patches/astro+7.3.5.patch) ([#18054](https://github.com/withastro/astro/issues/18054)).
- [ ] Digital Garden plugin: add an option to sync content through a pull request instead of committing directly to `main`.
- [ ] Sätteri (open focused issues; offer PRs after maintainers confirm the direction):
  - Preserve wikilink provenance without source-position slicing.
  - Fix the trailing backslash in escaped aliases (`[[Note\|Alias]]`).
  - Discuss `ctx.sourceText(node)` if maintainers prefer a general source-access API.
