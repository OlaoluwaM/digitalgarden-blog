# Styles

The Astro site's styles ([ADR 0003](../../docs/adrs/0003-build-a-tailwind-token-design-system-before-cutover.md)).
A Tailwind v4 token system, which replaced the Eleventy/Obsidian cascade in
phase 2.

## Files

| File            | Layer        | Holds                                                                         |
| --------------- | ------------ | ----------------------------------------------------------------------------- |
| `global.css`    | —            | Entry: layer order, imports, Tailwind sources.                                |
| `tokens.css`    | `theme`      | Design tokens (`@theme`). The only colors, fonts, sizes, radii, breakpoints.  |
| `fonts.css`     | —            | Self-hosted `@font-face` rules.                                               |
| `base.css`      | `base`       | Element defaults, after Tailwind's Preflight reset.                           |
| `layout.css`    | `components` | The page frame: where the note column sits beside the file tree.              |
| `content/`      | `components` | Rendered Markdown. Markdown output carries no utility classes.                |
| `components/`   | `components` | Chrome rules that utilities cannot express (pseudo-elements, calc, `[open]`). |
| `style-guide/`¹ | —            | Dev-only page at `/style-guide/` listing the tokens.                          |

¹ `src/style-guide/`.

Layer order, lowest first: `theme`, `base`, `components`, `utilities`.
Unlayered CSS beats every layer, so component `<style>` blocks must wrap their
rules in `@layer components { … }`.

## Conventions

- Use tokens, never raw values: `bg-surface`, `text-faint`, `rounded-box`, or
  `var(--color-link)` in CSS. Add a token (with its source) before using a new
  value.
- Chrome components (header, footer, Recent Posts, navigation, 404) use
  utility classes in their templates. Put a rule in `components/<name>.css`
  only when utilities cannot express it, and say why in a comment.
- Keep the markup's class names (many come from Eleventy): scripts, tests,
  and rendered Markdown depend on them. Add utilities beside them.
- Markup that a script builds (search results, the search preview) is styled
  by class in `components/<name>.css`, so the script carries no styling.
- Scripts set state, and CSS reads it: `aria-expanded` on the hamburger (the
  `nav-open` variant in `global.css`), `aria-selected` on a search result,
  `data-state` on the search layout. A component rule that shows or hides an
  element loses to a utility on the same property, so such elements carry
  no `display` utilities.
- Breakpoints: `md` 800px, `lg` 1000px (desktop navigation), `xl` 1400px. In
  CSS, use `@variant max-lg { … }`; media queries cannot read custom
  properties.
- Headings use Instrument Serif at weight 400. The self-hosted face has one
  weight, so 700 would synthesize a fake bold; live rendered the regular
  glyphs.

## Changing the design

Every visible difference from the live Eleventy site must be intended and
recorded in [docs/design-changes.md](../../docs/design-changes.md).
