# Thunks & Thoughts

The source for [thunk.blog](https://thunk.blog), a digital garden and blog
built with [Astro](https://astro.build) from notes in an Obsidian vault.

Notes are published from Obsidian with the
[Digital Garden](https://github.com/oleeskild/Obsidian-Digital-Garden)
plugin, which commits them to `src/site/notes/` and their images to
`src/site/img/user/`. Astro renders them with wikilinks, callouts, math,
highlighted code, and search.

## Publishing a note

The vault's `Blogpost` template carries these properties; the content schema
([`src/content.config.ts`](src/content.config.ts)) enforces them, and the build
fails naming the note when one is missing, empty, or malformed.

| Property       | Holds                                                                   |
| -------------- | ----------------------------------------------------------------------- |
| `dg-publish`   | `true` to publish                                                       |
| `dg-permalink` | The URL, `/posts/<slug>` (always set; never left to the plugin)         |
| `title`        | The displayed title (file names avoid `?` and `#`)                      |
| `description`  | The summary for search engines and link previews                        |
| `tags`         | Tags; `gardenEntry` marks Home, which exactly one note has              |
| `published`    | Publication date and time, e.g. `2026-09-29T14:30`                      |
| `last_updated` | Last update, in the same form                                           |
| `dg-hide`      | Optional; `true` makes the post reachable only by a direct link (below) |

In the note:

- Embed (`![[Note]]`) only published notes: the plugin inlines an embedded
  note's text even when that note is unpublished. `![[Note|Title]]` heads
  the embed with that title; without one it reads "From _note title_".
- Links and embeds to a block (`^block-id`) and to a heading work.
- ` ```mermaid ` and ` ```plantuml ` blocks render through Kroki (below).
- A new custom callout type needs `npm run sync-callouts` (below).

A hidden post (`dg-hide: true`) is built at its URL but listed nowhere: not
in the file tree, Recent Posts, search, the feed, the sitemap, or
`/random/`. Its page carries `<meta name="robots" content="noindex">`.

## Setup

Requires **Node 24.x**.

```sh
npm install
```

## Commands

```sh
npm run dev       # dev server at localhost:4321
npm run build     # production build → dist/
npm run preview   # serve the build locally
npm test          # typecheck, lint, format check, then every test suite
npm run lint      # ESLint (typescript-eslint strict, eslint-plugin-astro)
npm run format    # Prettier: format code and config (not Markdown)
```

Mermaid and PlantUML fences render through [Kroki](https://kroki.io) during
the build ([ADR 0006](docs/adrs/0006-render-mermaid-and-plantuml-at-build-time-through-kroki.md)),
so a note with a new or changed diagram needs Kroki to be reachable; a
diagram Kroki can't render fails the build. `KROKI_URL` points at another
Kroki (default `https://kroki.io`), and `KROKI_CACHE_DIR` moves the cache
of rendered diagrams (default `node_modules/.cache/kroki`).

`dev` and `build` first apply the dependency patches in `patches/` and
regenerate the wikilink index (`src/generated/wikilink-index.ts`). `build`
re-renders every note (`--force`), because Astro's content cache does not
notice changes to the Markdown plugins.

Plugin changes during `npm run dev` need a restart with `npm run dev -- --force`.

## Layout

| Path                 | Holds                                                     |
| -------------------- | --------------------------------------------------------- |
| `src/site/notes/`    | Published notes (written by the Obsidian plugin)          |
| `src/site/img/user/` | Note images (written by the Obsidian plugin)              |
| `src/pages/`         | Routes: notes, Home, 404, `/random/`, feed, robots        |
| `src/components/`    | Page chrome: navigation, search, note header, footer      |
| `src/plugins/`       | Markdown plugins ([pipeline](docs/markdown-pipeline.md))  |
| `src/styles/`        | Design tokens and styles ([README](src/styles/README.md)) |
| `src/scripts/`       | Client scripts (search, file tree, copy buttons)          |
| `scripts/`           | Wikilink index and callout sync                           |
| `docs/`              | Architecture decisions and the design-change log          |

The dev server also serves a style guide at `/style-guide/`.

## Custom callouts

Custom callout types (color and icon) come from the Obsidian vault:

```sh
npm run sync-callouts
```

It reads the Admonition plugin's settings and the enabled CSS snippets and
writes `src/styles/content/callouts.css` and
`src/plugins/hast/callout-icons.ts`. If a type cannot be resolved, it writes
nothing and ends by listing the `--icon` or `--color` option that fixes it.

## Testing

```sh
npm run test:unit        # Node tests, including builds of the site
npm run test:components  # Astro components (Vitest)
npm run test:layout      # built pages in Chrome: layout, focus, axe
npm run test:browser     # client scripts in Vitest Browser Mode
```

For an existing Chrome/Chromium installation, copy `.env.browser.example` to
`.env.browser.local` and set `AGENT_BROWSER_EXECUTABLE_PATH` to its absolute
executable path. The browser tools read this ignored, machine-local file.
Otherwise, install the browser for each tool:

```sh
npx playwright install chromium
npm run browser -- install
```

### VS Code

Install the recommended **Vitest** extension (`vitest.explorer`). Workspace
settings select `vitest.browser.config.mts` and load `.env.browser.local`, so
the extension uses the same Chrome executable as the npm commands.

### Visual browser checks

The project includes agent-browser and its skill in
`.agents/skills/agent-browser`. Start `npm run dev`, then use a session name
unique to your task:

```sh
npm run browser -- skills get core
npm run browser -- --session garden-review open http://localhost:4321
npm run browser -- --session garden-review snapshot -i
npm run browser -- --session garden-review screenshot --annotate
npm run browser -- --session garden-review close
```

Screenshots go in `.browser-artifacts/`; Vitest failure artifacts go in
`.vitest/`. Both directories are ignored.

## Deployment

Vercel builds the site with `npm run build` and serves `dist/`
(`vercel.json`). Missing pages get `404.html`.

Do not merge the Digital Garden plugin's "Update template" pull requests:
they would restore the Eleventy site this repository replaced.
