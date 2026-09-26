# Vendored styles

`obsidian-theme.css` is the Obsidian theme CSS that thunk.blog served as
`/styles/_theme.b9d91f25.css`, committed verbatim per
[ADR 0001](../../../docs/adrs/0001-vendor-the-obsidian-theme-css-and-sever-the-remote-fetch.md).

- Source: `https://thunk.blog/styles/_theme.b9d91f25.css`, downloaded on
  2026-09-26 (`last-modified: Mon, 21 Sep 2026 10:04:44 GMT`).
- SHA-256: `b9d91f255feb45052230543b1cb02229922fda4284bba50492b26da41a556c58`.
  The first eight characters match the name Eleventy's `get-theme` gave it.
  The configured `THEME` URL at upstream HEAD hashed to the same value.

Do not edit or reformat this file; `.prettierignore` excludes it. Replace it
only through a new decision, and distill it into owned tokens after cutover.
Eleventy still fetches its own copy through `get-theme` until cutover.
