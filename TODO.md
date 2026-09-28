# TODO

Astro implementation: [REWRITE.md](REWRITE.md).

## Before the next Obsidian publish

- [ ] Rename `Endianness, WOOT!?` to `Endianness, WOOT!` in the vault.
- [ ] Rename `Numbers? Numerals? Oh Boy` to `Numbers Numerals Oh Boy` in the vault.
- [ ] Fix the tab-indented sub-list in `NixOS, the start of something new (part 1)` (the "package may refer to" items) so it parses as a nested list.
- [ ] Keep the original titles in each note's `title` property. Avoid `?` and `#` in publishable filenames.
- [ ] Align vault properties with [the content schema](src/content.config.ts): explicit `dg-permalink`; `title`, `description`, `tags`, `published`, and `last_updated` under `dg-note-properties` in publisher output.

## Deferred site features

- [ ] Add a table of contents for notes with at least three headings ([designs](https://claude.ai/artifact/GrmM5QYkynByeushqTNvy4)): a right rail at 1400px and wider (A), an inline Contents box from 800px to 1399px (B, collapsed by default), and a Contents button with a bottom sheet below 800px (D).
- [ ] Add linting: choose between Biome and ESLint (with Astro and TypeScript support), then add a `lint` script and run it in `npm test`.
- [ ] Add a "collapse all folders" button to the file tree once the vault has more than one folder ([mockups](https://claude.ai/artifact/VnPJxBcZ2LEPgo6ZtNjpD8); leaning toward a square button beside the search button).
- [ ] Label task-list checkboxes (`- [x]`) in the Markdown pipeline, e.g. wrap each item's text in a `<label>`; axe flags them in the dev style guide's Markdown sample. No note has a task list yet.
- [ ] Keep one `<h1>` per page: the navbar and sidebar site names are `<h1>`s too (inherited from live), so heading navigation meets the site name twice before the note title.

## Deferred upstream PRs

- [ ] Astro: upstream the Markdown rendering error fix and regression tests from the [local patch](patches/astro+7.2.9.patch).
- [ ] Astro: upstream the image-attribute decoding fix and regression tests from the same patch.
- [ ] Digital Garden plugin: add an option to sync content through a pull request instead of committing directly to `main`.

## After pull-request publishing

Requires the Digital Garden plugin's pull-request option above.

- [ ] Add a CI/CD workflow that runs all tests and the Astro build on each publish pull request, and deploys only after they pass.

## Upstream Sätteri

Open focused issues; offer PRs after maintainers confirm the direction.

- [ ] Preserve wikilink provenance without source-position slicing.
- [ ] Fix the trailing backslash in escaped aliases (`[[Note\|Alias]]`).
- [ ] Discuss `ctx.sourceText(node)` if maintainers prefer a general source-access API.
