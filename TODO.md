# TODO

## Vault (do before the next publish from Obsidian)

- [ ] Mirror the note renames in the vault — Astro's content layer silently drops files whose names contain `?` or `#` (URL query/fragment characters), so these were renamed in this repo and the vault notes must match or the next publish re-pushes the broken names:
  - `Endianness, WOOT!?` → `Endianness, WOOT!`
  - `Numbers? Numerals? Oh Boy` → `Numbers Numerals Oh Boy`

  Set a `title` property on both notes to keep the original punctuated titles for display. Going forward: no `?` or `#` in publishable note or image filenames.

- [ ] Update the note properties in the vault to align with this schema (defined in ./src/content.config.ts) before this is merged into main

## Upstream Sätteri

- [ ] Open focused Sätteri issues, then offer PRs after the maintainers confirm the API direction:
  - Preserve wikilink provenance so plugins can distinguish `[[Example]]` from `[Example](Example)` without enabling position tracking and slicing `ctx.source`.
  - Fix escaped aliases such as `[[Folder/Note\|Alias]]`, which currently leave a trailing backslash in `node.url`.
  - If the maintainers prefer a general solution, propose `ctx.sourceText(node)` as the exact-source counterpart to `ctx.textContent(node)`.
