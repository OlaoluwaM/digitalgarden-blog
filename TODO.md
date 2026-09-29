# TODO

## At the merge

- [ ] Once the CI workflow has run on `main` and passed, make production wait for CI:
  1. In Vercel, open the `digitalgarden-blog` project's Settings > Build and Deployment > Deployment Checks and choose Add Check > GitHub Actions.
  2. Under "Send workflow updates to Vercel", enter the check name `CI`. The snippet should read `name: Vercel - digitalgarden-blog: CI`, the status the workflow already sets; skip adding the snippet.
  3. Choose Add.
  4. Check: push a commit to `main`. Its deployment should wait until the workflow's `Vercel - digitalgarden-blog: CI` status passes, then take thunk.blog.

  Not before the merge: `main` has no workflow until then, so production would wait for a status that never comes, and published notes would never go live.

- [ ] Publish from Obsidian and check the round trip: the build passes, and the only page changes are Home's description and the nested "package" list in NixOS part 1.
- [ ] Switch the Vercel project's Framework Preset from Eleventy to Astro. `vercel.json` already sets Astro for every deployment, so this only tidies the dashboard. Never before the merge: until then the preset builds the live Eleventy site.

## Site features

- [ ] Add a "collapse all folders" button to the file tree once the vault has more than one folder ([mockups](https://claude.ai/artifact/VnPJxBcZ2LEPgo6ZtNjpD8); leaning toward a square button beside the search button).

## Upstream

- [ ] Astro: drop the [local patch](patches/astro+7.3.5.patch) and the 7.3.5 pin once [withastro/astro#18064](https://github.com/withastro/astro/pull/18064) ships. It fixes [#18054](https://github.com/withastro/astro/issues/18054) the same way (a failed Markdown render fails the build), with its own regression test; it was open and awaiting review on 2026-09-29.
- [ ] Sätteri (open focused issues; offer PRs after maintainers confirm the direction):
  - Preserve wikilink provenance without source-position slicing.
  - Fix the trailing backslash in escaped aliases (`[[Note\|Alias]]`).
  - Discuss `ctx.sourceText(node)` if maintainers prefer a general source-access API.

## Deferred Items

- Local and global graph views
- Link previews
- Note icons.
- Eleventy Markdown behavior not ported, since no published note used it when the Eleventy site was removed. Port each when a note needs it:
  - Body hashtags (`taggify`): `#tag` in the text became a tag-search link.
  - Obsidian Bases
  - Dataview output
  - Obsidian canvases
  - `markdown-it-attrs` beyond block IDs (`{.class}` and other attributes).
- Hot-reload the wikilink index, if generating it before `astro dev` stops being enough.
- Revisit the publishing boundary.
