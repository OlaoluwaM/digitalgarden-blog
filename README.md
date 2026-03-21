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
npm test           # runs tests via Node's built-in test runner
```

## Custom Callouts

Custom admonition types (colors + icons) are synced from the Obsidian vault. Run the `/sync-callouts` Claude Code skill to regenerate `src/site/styles/user/callouts.scss` from the vault's admonition plugin config.

Structural callout overrides (icon sizing, nested margins) live in `src/site/styles/user/callout-overrides.scss`.

## Deployment

Configured for both [Vercel](https://vercel.com) (`vercel.json`) and [Netlify](https://netlify.com) (`netlify.toml`). Output directory: `dist/`.

## Reference

See [INFO.md](./INFO.md) for CSS variable documentation and upstream template details.
