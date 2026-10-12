# TODO

## Site features

- [ ] After the Giscus comments deploy (ADR 0008), check the widget on a note in light and dark mode.
- [ ] After the reaction icons deploy, check the reaction bar and picker in Firefox and Safari: Lucide icons in gray, ❤️ included.

## Upstream

- [ ] Astro: drop the [local patch](patches/astro+7.3.5.patch) and the 7.3.5 pin once [withastro/astro#18064](https://github.com/withastro/astro/pull/18064) ships. It fixes [#18054](https://github.com/withastro/astro/issues/18054) the same way (a failed Markdown render fails the build), with its own regression test; it was open and awaiting review on 2026-09-29.
- [ ] Sätteri (open focused issues; offer PRs after maintainers confirm the direction):
  - Preserve wikilink provenance without source-position slicing.
  - Fix the trailing backslash in escaped aliases (`[[Note\|Alias]]`).
  - Discuss `ctx.sourceText(node)` if maintainers prefer a general source-access API.

## Deferred Items

- Enable auto-merging of dependabot PRs (patch & minor updates only)
  - <https://carlosbecker.com/posts/dependabot-automerge/>
  - <https://lethain.com/dependabot-auto-merge/>
- Local and global graph views
- Link previews
- Note icons.
- Webmentions through webmention.io. First add the endpoint and `rel="me"` links, and see whether mentions arrive.
- Add a "collapse all folders" button to the file tree once the vault has more than one folder ([mockups](https://claude.ai/artifact/VnPJxBcZ2LEPgo6ZtNjpD8); leaning toward a square button beside the search button).
- Heading folding (client-side using Javascript, with `hidden="until-found"`).
- Related notes, once the link graph is dense enough.
- Lightbox and raw HTML images: the lightbox's button wrapper re-lays out a hand-written `<img>` that sizes or floats itself (`style="width:50%"` shrinks to the image's natural width; `align="right"` stops floating). Fix it when a note uses raw `<img>`.
- Eleventy Markdown behavior not ported, since no published note used it when the Eleventy site was removed. Port each when a note needs it:
  - Body hashtags (`taggify`): `#tag` in the text became a tag-search link.
  - Obsidian Bases
  - Dataview output
  - Obsidian canvases
  - `markdown-it-attrs` beyond block IDs (`{.class}` and other attributes).
- Hot-reload the wikilink index, if generating it before `astro dev` stops being enough.
- Revisit the publishing boundary.
