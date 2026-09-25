# TODO

Astro implementation: [REWRITE.md](REWRITE.md).

## Before the next Obsidian publish

- [ ] Rename `Endianness, WOOT!?` to `Endianness, WOOT!` in the vault.
- [ ] Rename `Numbers? Numerals? Oh Boy` to `Numbers Numerals Oh Boy` in the vault.
- [ ] Fix the tab-indented sub-list in `NixOS, the start of something new (part 1)` (the "package may refer to" items) so it parses as a nested list.
- [ ] Keep the original titles in each note's `title` property. Avoid `?` and `#` in publishable filenames.
- [ ] Align vault properties with [the content schema](src/content.config.ts): explicit `dg-permalink`; `title`, `description`, `tags`, `published`, and `last_updated` under `dg-note-properties` in publisher output.

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
