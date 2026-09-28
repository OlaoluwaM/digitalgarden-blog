# Typography Refinements

Agreed and built 2026-09-28. These changes make long-form notes easier to
read. The main problem is line length. Line height and letter-spacing
matter less. The visible changes are logged in
[design-changes.md](design-changes.md), and the tests are in
`test/layout/site-layout.test.ts` ("note typography").

Before and after screenshots: https://claude.ai/artifact/JKREUvtR8Vyk8AdmwBC8qE

Preview (current and proposed rules on a real post, with a live
characters-per-line count): https://claude.ai/artifact/AezzrntfR1ZLK4WXrF4x9n

## Measurements

These are the median characters per line (cpl) in note paragraphs. We
measured them in headless Chrome on the built site, with full lines only.

| Viewport | Column | Now | Proposed |
| --- | --- | --- | --- |
| 1440px | 700px | 91–93 | 82 |
| 1280px | 931px | 120 | 82 |
| 1100px | 751px | 98 | 82 |
| 390px | ~311px | 42 | 42 (unchanged) |

Targets: Bringhurst gives 45–75 cpl with 66 as the ideal, Butterick gives
45–90, and WCAG 1.4.8 (AAA) sets 80 as the maximum. From 1000px to 1399px,
the column is 100vw − 300px wide, not 700px (`layout.css`, `max-xl`). This
is inherited from live and produces the longest lines.

Font facts (from `public/fonts/*.woff2`):

- **Instrument Sans:** x-height 0.51em. An average prose character is
  0.447em wide. The "0" is 0.666em wide, so `ch` overstates the measure;
  don't size the column in `ch`. The font has no `opsz` axis.
- **Instrument Serif:** the median gap between letters is 0.032em. At
  −0.02em, pairs such as "in", "mi", and "nt" nearly touch at h1 size.

## Changes

| Where | Now | Change | File |
| --- | --- | --- | --- |
| Note text, `md` (800px) and up | 1.03rem, `--leading-normal` (1.5) | `--text-lg` (1.125rem), `--leading-relaxed` (1.625) | `layout.css` |
| Note column, `lg` to `xl` (1000–1399px) | `calc(100vw - 300px)` | no wider than `--container-content` (700px) | `layout.css` |
| Callout text, `md` and up | 1rem, 1.5 | 1rem, `--leading-relaxed` | `callouts.css` |
| Paragraphs and list items | normal wrapping | `text-wrap: pretty` | `typography.css` |
| h6 (uppercase) | no tracking | 0.05em (Tailwind's `--tracking-wider`, a new token) | `tokens.css`, `typography.css` |

Notes:

- **Phones keep 1.03rem and a line height of 1.5.** At 18px, lines at
  390px wide would drop to 38 cpl.
- **Lists, blockquotes, and footnotes** inherit the new line height from
  `main.content`. Code blocks already use 1.625.
- **Callouts and blockquotes** set their own size (1rem), so they stay
  16px. Beside 18px body text they read as asides. Check that this looks
  right in the preview before you change it.
- **`text-wrap: pretty`** works in Chrome, Edge, and Safari 26+. Firefox
  falls back to normal wrapping.
- **Body letter-spacing stays at 0.** Butterick advises against tracking
  lowercase text at text sizes. Instrument Sans is already spaced like a
  text face. No evidence supports tracking to reduce halation on dark
  pages. The body text (#dadada on #1e1e1e) is already off-white.

## Open

- **h1–h3 letter-spacing:** loosen to −0.01em / 0 / 0? The measurement
  supports it, but judge it by eye in the preview's heading section.
- **Table line height:** move 1.25 to `--leading-snug` (1.375) if wrapped
  cells look cramped. This is a matter of taste.
- **Tabular numerals in tables:** `font-variant-numeric: tabular-nums`. The
  font has `tnum`. Low priority; no table has numeric columns yet.

## Not doing

- **Hyphenation:** it breaks identifiers, and ragged-right text at about
  80 cpl doesn't need it.
- **`hanging-punctuation`:** only Safari supports it.
- **`font-optical-sizing`:** Instrument Sans has no `opsz` axis.
- **Lighter weight or lower contrast:** 400 is the lightest weight, and the
  contrast is already fine.
- **Narrower phone gutters (32px to ~20px):** they would gain about 3 cpl,
  but that is a layout change.

## Tests to update

Each changed test needs a `// Why:` comment.

- **`test/design-system.test.ts`:** lists `1.03rem` as an allowed literal
  in `layout.css`.
- **`test/tokens.test.ts`:** clears the `--tracking-*` namespace, and the
  new token must pass it.
- **`test/layout/site-layout.test.ts`:** asserts heading tracking. Add
  computed-style checks for note text size and line height at 1440px,
  1280px, and 390px. Also check that the column is 700px at 1280px.

## Sources

- Bringhurst, *The Elements of Typographic Style*, §2.1.2 (measure) and
  §2.2.1 (leading): http://webtypography.net/2.1.2
- Butterick, *Practical Typography*:
  - https://practicaltypography.com/line-length.html
  - https://practicaltypography.com/line-spacing.html
  - https://practicaltypography.com/letterspacing.html
- WCAG 2.2, Understanding 1.4.8:
  https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html
- WCAG 2.2, Understanding 1.4.12:
  https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
- Rello et al., CHI 2016, on font size and readability:
  https://pielot.org/pubs/Rello2016-Fontsize.pdf
- Material Design, dark theme: https://m2.material.io/design/color/dark-theme.html
- `text-wrap: pretty`:
  - https://caniuse.com/wf-text-wrap-pretty
  - https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/
- Instrument Sans axes:
  https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentsans/METADATA.pb

## Related: wide tables

Separate from this change. It is in [TODO.md](../TODO.md) until a note has
a table wider than the column. Demo:
https://claude.ai/artifact/UeSoSyzgiyiULm27QqsCGg. The wrapper is a
scrolling `div` added by a hast plugin. Inside it, the table is set to
`width: max-content` and `word-break: normal`, and cells are capped at
`max-width: 30ch`.
