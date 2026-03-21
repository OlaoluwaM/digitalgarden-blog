# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An Eleventy 3.x digital garden blog ("Thunks & Thoughts" at thunk.blog), built on the Obsidian Digital Garden plugin template. Markdown notes from an Obsidian vault are compiled into a static site with wiki-links, callouts, graph visualization, and search.

## Commands

- **Dev server:** `npm start` (fetches theme, compiles Sass, runs Eleventy with live reload)
- **Production build:** `npm run build` (fetches theme, compiles Sass compressed, builds Eleventy with 4GB memory limit)
- **Sass only:** `npm run build:sass` / `npm run watch:sass`
- **Eleventy only:** `npm run build:eleventy` / `npm run watch:eleventy`
- **Fetch theme CSS:** `npm run get-theme`

- **Tests:** `npm test` (Node's built-in test runner)

Node 24.x required.

## Architecture

### Content Pipeline

```
src/site/notes/*.md → gray-matter frontmatter → markdown-it (11 plugins) → Nunjucks layouts → 6 HTML transforms → dist/
```

1. **Markdown parsing** (`.eleventy.js`): markdown-it with plugins for anchors, footnotes, MathJax, PlantUML, Mermaid, task checkboxes, attrs, marks, hashtags, transclusions, and Obsidian-style `ad-*` callout fenced blocks
2. **Filters** (`.eleventy.js`): `link` (wiki-link `[[file|title]]` → HTML), `taggify` (hashtag → clickable tag), `searchableTags`, `hideDataview`, `xmlSafe`, `dateToZulu`, `jsonify`, `validJson`
3. **Transforms** (`.eleventy.js`): `dataview-js-links`, `callout-block` (blockquote → Obsidian callout), `picture` (responsive WebP/JPEG optimization), `table` (wrapper divs), `canvas-markdown` (base64-encoded canvas text → rendered HTML), `htmlMinifier` (production only)
4. **Layouts** (`src/site/_includes/layouts/`): `index.njk` (garden entry/home), `note.njk` (regular notes)

### Key Files

- **`.eleventy.js`** — Central config: markdown-it setup, all filters, all transforms, plugins, wiki-link resolution with dead-link detection
- **`.env`** — Site config and feature flags (`dgShowBacklinks`, `dgShowLocalGraph`, `dgShowFileTree`, `dgEnableSearch`, `dgShowToc`, `dgLinkPreview`, `dgShowTags`, etc.)
- **`src/site/_data/meta.js`** — Reads `.env` into global template data
- **`src/site/_data/eleventyComputed.js`** — Computed data: graph links, filetree structure
- **`src/site/notes/notes.11tydata.js`** — Per-note computed data: layout selection, permalink generation, per-note setting overrides
- **`src/helpers/userSetup.js`** — Extension points for custom markdown-it plugins and Eleventy config
- **`src/helpers/constants.js`** — `ALL_NOTE_SETTINGS` array (the 10 feature flags)

### Styling

SCSS compiled to `dist/styles/`. The core compiled bundle always includes:
- `digital-garden-base.scss` — Framework base
- `custom-style.scss` — User customization
- `user/custom.scss` — Site-specific overrides

Obsidian theme compatibility and the theme CSS are **conditional**:
- `obsidian-base.scss` and the generated `_theme.*.css` are only linked in `pageheader.njk` when `meta.themeStyle` is present.
- `meta.themeStyle` is set only when `THEME` is configured in `.env` and `npm run get-theme` (or the build scripts that invoke it) successfully fetch the remote theme CSS and write `src/site/styles/_theme.*.css`. The fetched theme defines 60+ CSS custom properties for theming.

Custom color overrides live in `user/custom.scss` inside a `.theme-dark { ... }` block — they use theme variables such as `var(--color-base-60)` / `var(--color-base-70)` for accent and link states (with `#999`/`#b3b3b3` as fallbacks), and `rgba(153,153,153,0.3)` for text selection, tuned for WCAG AA contrast on the dark background.

### Wiki-Link Resolution

The `link` filter and `getAnchorAttributes()` in `.eleventy.js` resolve `[[file|title]]` wiki-links by reading the target file's frontmatter to get its permalink. Unresolvable links get class `is-unresolved` and point to `/404`.

### Canvas Support

`.canvas` files (Obsidian's native diagram format) are registered as a custom Eleventy extension. They contain pre-compiled HTML; the `canvas-markdown` transform renders any embedded markdown text nodes at build time.

### Custom Callouts

Custom admonition types (colors + icons) are synced from the Obsidian vault via the `/sync-callouts` Claude Code skill, which regenerates `src/site/styles/user/callouts.scss`. Structural callout overrides (icon sizing, nested margins) live in `src/site/styles/user/callout-overrides.scss`.

### Deployment

Configured for both Vercel (`vercel.json`) and Netlify (`netlify.toml`). Output directory: `dist/`.
