# Thunks & Thoughts

The source for [thunk.blog](https://thunk.blog) — a digital garden & blog built with [Eleventy 3.x](https://www.11ty.dev/) and the [Obsidian Digital Garden](https://github.com/oleeskild/Obsidian-Digital-Garden) plugin template.

Markdown notes from an Obsidian vault are compiled into a static site with wiki-links, callouts, graph visualization, and search.

## Setup

Requires **Node 24.x**.

```sh
npm install
```

## Development

```sh
npm start          # dev server at localhost:8080 (Sass watch + Eleventy live reload)
```

## Build

```sh
npm run build      # production build → dist/
```

## Testing

```sh
npm test                 # Node tests, then browser tests
npm run test:unit        # Node tests only
npm run test:browser     # Vitest Browser Mode in headless Chrome
npm run test:copy-code   # copy-button browser tests
```

Browser tests live in `test/browser/`. They use real DOM elements and browser
interactions; clipboard failure cases use mocks, and one case copies to the
real browser clipboard with permission granted by the test runner.

For an existing Chrome/Chromium installation, copy `.env.browser.example` to
`.env.browser.local` and set `AGENT_BROWSER_EXECUTABLE_PATH` to its absolute
executable path. Both browser tools read this ignored, machine-local file.
Otherwise, install the browser for each tool:

```sh
npx playwright install chromium
npm run browser -- install
```

### VS Code

Install the recommended **Vitest** extension (`vitest.explorer`). Workspace
settings select `vitest.browser.config.mts` and load `.env.browser.local`, so
the extension uses the same Chrome executable as the npm commands. Run the
browser tests from the Testing sidebar or the buttons beside each test.
The Node tests still run through `npm run test:unit`.

### Visual browser checks

The project includes agent-browser and its Codex skill in
`.agents/skills/agent-browser`. Start the Astro development server with
`npm run dev:astro`, then use a session name unique to your task:

```sh
npm run browser -- skills get core
npm run browser -- --session garden-review open http://localhost:4321
npm run browser -- --session garden-review snapshot -i
npm run browser -- --session garden-review screenshot --annotate
npm run browser -- --session garden-review close
```

Screenshots go in `.browser-artifacts/`; Vitest failure artifacts go in
`.vitest/`. Both directories are ignored. Add `--headed` when opening a browser
to see its window. These commands launch a separate browser session, not your
personal Chrome profile.

## Custom Callouts

Custom admonition types (colors + icons) are synced from the Obsidian vault. Run the `/sync-callouts` Claude Code skill to regenerate `src/site/styles/user/callouts.scss` from the vault's admonition plugin config.

Structural callout overrides (icon sizing, nested margins) live in `src/site/styles/user/callout-overrides.scss`.

## Deployment

Configured for both [Vercel](https://vercel.com) (`vercel.json`) and [Netlify](https://netlify.com) (`netlify.toml`). Output directory: `dist/`.

## Reference

See [INFO.md](./INFO.md) for CSS variable documentation and upstream template details.
