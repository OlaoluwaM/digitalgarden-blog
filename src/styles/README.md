# Styles

The Astro site's styles ([ADR 0003](../../docs/adrs/0003-build-a-tailwind-token-design-system-before-cutover.md)).
A Tailwind v4 token system, which replaced the Eleventy/Obsidian cascade in
phase 2.

## Files

| File            | Layer        | Holds                                                                         |
| --------------- | ------------ | ----------------------------------------------------------------------------- |
| `global.css`    | —            | Entry: layer order, imports, Tailwind sources.                                |
| `tokens.css`    | `theme`      | Design tokens (`@theme`) on Tailwind's scales. The whole vocabulary.          |
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

## The scales

The tokens follow Tailwind's structure: its theme namespaces, its step names
in its order, one spacing unit. `test/design-system.test.ts` enforces it.

| Scale      | Steps                                                              | Values                                                     |
| ---------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Color      | `gray-50` (text) … `gray-950` (page); `slate-300`, `yellow-400`    | Ours (Obsidian's grays); roles listed in `tokens.css`      |
| Text       | `xs`, `sm`, `base`, `lg`                                           | Tailwind's, with its paired line heights                   |
| Text       | `xl` … `5xl` (h5 … h1)                                             | Ours: a Major Third from 3rem, own line heights, tracking  |
| Leading    | `tight`, `snug`, `normal`, `relaxed` (`none` is built in)          | Tailwind's                                                 |
| Radius     | `xs` 2px, `sm` 4px, `md` 6px, `lg` 8px, `xl` 12px (`full`)         | Tailwind's                                                 |
| Spacing    | `--spacing` 0.25rem; whole or half steps                           | Tailwind's                                                 |
| Container  | `content` 700px, `sidebar`, `sidebar-min`, `site-name`, `6xl`      | Ours (layout), `6xl` Tailwind's                            |
| Breakpoint | `md` 50rem (800px), `lg` 62.5rem (1000px), `xl` 87.5rem (1400px)   | Ours, in rem                                               |
| Shadow     | `2xl`                                                              | Tailwind's shape at twice the strength                     |
| Motion     | default 150ms, `cubic-bezier(0.4, 0, 0.2, 1)`; `ease-overshoot`    | Tailwind's; the hamburger keeps Obsidian's                 |

Note text (1.03rem / 1.5) sits between steps and lives in `layout.css`.

## Conventions

- Use the scales, never raw values: `bg-gray-800`, `text-sm`, `rounded-lg`,
  `p-4`, or `var(--color-gray-200)`, `--spacing(4)`, and
  `--alpha(var(--color-gray-200) / 35%)` in CSS. Tints, hovers, and overlays
  are a color at an opacity (`bg-white/5`, `bg-black/50`). Name no token
  after a component; if no step fits, use the nearest one.
- Rendered Markdown (`content/`) keeps sizes relative to the text in em, as
  Tailwind Typography does, with their Obsidian source named beside them.
- Arbitrary values (`max-h-[60vh]`) only where no scale or utility fits; each
  is listed, with its reason, in `test/design-system.test.ts`.
- One style per element: tags, keys (`Key.astro`), inline code, the hover
  fill (`white/5`), and the focus ring look the same wherever they appear.
- Chrome components (header, footer, Recent Posts, navigation, 404) use
  utility classes in their templates. Put a rule in `components/<name>.css`
  only when utilities cannot express it, and say why in a comment.
- Keep the markup's class names (many come from Eleventy): scripts, tests,
  and rendered Markdown depend on them. Add utilities beside them.
- Markup that a script builds (search results, the search preview) is styled
  by class in `components/<name>.css`, so the script carries no styling.
- State lives in markup the browser or a script sets, and CSS reads it: the
  mobile file tree's popover state (`open:`), `aria-selected` on a search
  result, `data-state` on the search layout. Behavior that needs no
  script uses the platform (popovers, `<details>`, `<dialog>`), so it works
  without JavaScript; `noscript:` hides controls that need it. A component rule that shows or hides an
  element loses to a utility on the same property, so such elements carry
  no `display` utilities.
- Breakpoints: `md` 800px, `lg` 1000px (desktop navigation), `xl` 1400px. In
  CSS, use `@variant max-lg { … }`; media queries cannot read custom
  properties. Scripts match the rem value (`(min-width: 62.5rem)`).
- Headings use Instrument Serif at weight 400. The self-hosted face has one
  weight, so 700 would synthesize a fake bold; live rendered the regular
  glyphs.

## Changing the design

Every visible difference from the live Eleventy site must be intended and
recorded in [docs/design-changes.md](../../docs/design-changes.md).
