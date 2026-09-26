# Design Changes

Intentional differences between the Astro site and the Eleventy site live at
thunk.blog. Parity is the default; list every visible or behavioral change
here with its reason and evidence. See
[ADR 0003](adrs/0003-build-a-tailwind-token-design-system-before-cutover.md).

Entry format:

```markdown
## YYYY-MM-DD: Short description

- **Change:** what differs from the live site.
- **Why:** the reason.
- **Evidence:** tests, screenshots, or checks that show the result.
```

Earlier Markdown-stage differences (link classes, math, search index fields,
callout collapsibility) are recorded in `AGENT_CONTEXT.md`.

## 2026-09-26: Phase 1 parity shell

Evidence for every entry: full-page and mid-page screenshot diffs against
thunk.blog at 1440x900 and 390x844 (posts within 0.01%), computed-style
comparisons, and the tests named per entry.

### Home has no empty header

- **Change:** Home renders no `<header>`. Live had an empty `<h1></h1>` that
  left a blank band above "Welcome" and gave the page two `h1` elements.
  Home's content starts about 100px higher.
- **Why:** the band had no content, and a page should have one heading.
- **Evidence:** `test/components/note-header.test.ts`; axe `empty-heading`
  no longer occurs.

### Tags are links

- **Change:** header tags are `<a class="tag" href="/?q=%23tag">` instead of
  `<button onclick="toggleTagSearch(this)">`. They look identical. Until the
  search port lands, a click loads Home without opening search.
- **Why:** links work without JavaScript; the search port will enhance them.
- **Evidence:** `test/components/note-header.test.ts`; tag geometry and
  computed styles match live.

### Dates render at build time

- **Change:** timestamps and Recent Posts dates are `<time datetime>`
  elements with text formatted at build time (`MMM dd, yyyy`) from the date
  written in the note. Live used Luxon in each reader's time zone, so a
  reader far west of the author could see a date one day earlier.
- **Why:** no client script or layout shift, and one date for every reader.
- **Evidence:** `test/dates.test.ts`, `test/components/note-header.test.ts`,
  `test/components/recent-posts.test.ts`.

### Metadata

- **Change:** every page has a canonical link and Open Graph and Twitter
  tags. Posts use their `description` property instead of repeating the
  title; Home omits its placeholder description.
- **Why:** search results and link previews.
- **Evidence:** `test/metadata.test.ts`, `test/head-metadata.test.ts`.

### 404 page

- **Change:** adds charset, viewport, favicons, and a `<main>` landmark, and
  loads the same stylesheets as other pages, so it uses the site's heading
  size, Instrument Sans, and gray link color. Live's 404 loaded fewer
  stylesheets and showed Inter and a purple link.
- **Why:** consistency and accessibility. Pending Olaolu's confirmation of
  the look.
- **Evidence:** `test/not-found-page.test.ts`, `test/layout/site-layout.test.ts`.

### Navigation without Alpine

- **Change:** folders are native `<details>` and open without JavaScript,
  but their open state is not remembered across pages yet. The desktop and
  mobile switch is a CSS media query at 1000px. Search and hamburger
  controls are real `<button>` elements and do nothing until the search and
  mobile-navigation tasks land.
- **Why:** ADR 0003 and the decision to replace Alpine with TypeScript.
- **Evidence:** `test/file-tree.test.ts`,
  `test/components/site-navigation.test.ts`, `test/layout/site-layout.test.ts`.

### Callouts

- **Change:** icons and the fold chevron render at build time. Every
  callout, including nested ones, is collapsible, so nested callouts gain a
  fold chevron and a 3px taller title row.
- **Why:** no client icon script; the collapse behavior was agreed.
- **Evidence:** `test/callout.test.ts`, `test/callout-icons.test.ts`.

### Scripts removed

- **Change:** no Alpine, Alpine Persist, force-graph, Luxon, Lucide, fetch
  polyfill, Mermaid, or Vercel scripts load. Analytics return in the REWRITE.md
  Analytics section.
- **Why:** unused or replaced at build time.
- **Evidence:** `test/site-build.test.ts` (no third-party scripts).

## 2026-09-26: Phase 2 design system

Evidence for every entry: computed-style diffs and screenshots against the
phase 1 build (identical to thunk.blog apart from the phase 1 entries above),
with the legacy CSS switched off (`LEGACY_CSS=off`), and the tests named per
entry.

### Muted text passes WCAG AA

- **Change:** muted text (Recent Posts descriptions and dates, the post
  footer) is #8c8c8c instead of #666. The "+" between the search key hints
  also uses it; on its lighter chip it is 3.9:1, better than live's 2.6:1
  but still below AA. List markers and the
  blockquote rule stay #666; contrast rules for text do not apply to them.
- **Why:** #666 on the page background is 2.9:1; #8c8c8c is 4.96:1 on the
  page and 4.5:1 on the sidebar.
- **Evidence:** `test/tokens.test.ts`; the axe `color-contrast` entries for
  these elements disappear.

### No overlap at exactly 1000px

- **Change:** at a viewport of exactly 1000px the note column sits beside the
  file tree. Live showed the file tree (its script switches at 1000px) but
  centered the column (its CSS switches below 1001px), so the two overlapped.
- **Why:** one breakpoint for both.
- **Evidence:** computed-style diff of `main.content` at 999, 1000, and
  1200px.

### Heading letter-spacing

- **Change:** note headings h1–h3 use the tighter letter-spacing that
  `custom.scss` specified (-0.02em, -0.015em, -0.01em). Live showed normal
  spacing on note pages because an Obsidian `!important` rule overrode it;
  only the 404 page had the tighter spacing.
- **Why:** the intended design, applied consistently; the override was a
  side effect of the Obsidian CSS.
- **Evidence:** computed `letter-spacing` on content and header headings with
  the legacy CSS off.

### Recent Posts align with their heading

- **Change:** Recent Posts items start at the heading's left edge instead of
  about 33px in.
- **Why:** the indent was Obsidian's list-bullet space, left behind when the
  bullets were removed.
- **Evidence:** screenshots of Home with the legacy CSS off.

### Task-list checkboxes

- **Change:** an open task shows an empty box and a done task a filled box
  with a check mark. Live masked the whole box into a check mark, so open
  tasks showed nothing. No published note has a task list yet.
- **Why:** a checkbox should show its state.
- **Evidence:** the style guide's Markdown sample with the legacy CSS off.

### Footnotes heading hidden

- **Change:** the "Footnotes" heading above a note's footnotes is visually
  hidden and still read by screen readers. Live showed it, because the
  pipeline's `sr-only` class was never defined.
- **Why:** the pipeline's intent; the footnote list is self-explanatory.
- **Evidence:** the style guide's Markdown sample with the legacy CSS off.

### Breakpoint edges

- **Change:** layouts switch at exactly 800px, 1000px, and 1400px one pixel
  earlier than live (for example, at exactly 800px the navbar shows the full
  search button). Every other width matches.
- **Why:** Tailwind's `max-*` breakpoints stop below the value; live's
  `max-width` queries included it, and its navigation script switched at
  1000px anyway.
- **Evidence:** navigation computed-style diffs at 799, 800, 801, 999, 1000,
  1399, 1400, and 1401px.

### Callout icons on every type

- **Change:** built-in callout types (note, info, tip, warning, and the rest)
  show their icon, like the vault's custom types. Quote and cite callouts get
  Lucide's `quote` icon, so their title text moves right to line up with the
  body.
- **Why:** Obsidian's CSS masked `.lucide-*` icons, which hid every built-in
  icon on live; quote's `quote-glyph` has no Lucide equivalent.
- **Evidence:** `test/callout-icons.test.ts`, `test/callout.test.ts`, element
  screenshots of every callout type.

### Code block labels and copy button in Commit Mono

- **Change:** the language label and copy button use Commit Mono like the
  code. Live used the browser's generic monospace (Courier on some systems).
- **Why:** consistent type in code blocks.
- **Evidence:** screenshots of code blocks with the legacy CSS off.

### Reduced motion

- **Change:** nothing animates when the reader asks for reduced motion. Live
  stopped only the tag and footer link transitions; link fades, the
  hamburger, the callout chevron, and the copy button still moved.
- **Why:** accessibility.
- **Evidence:** `test/layout/site-layout.test.ts` checks every element of
  Home and a post at 390px and 1440px.

### Sizes follow the reader's font size

- **Change:** text, code, callouts, math, and spacing scale with the
  browser's default font size. Live fixed many of them in pixels (callouts
  and math at 16px, code at 12.8px). At the default 16px nothing changes;
  at 20px, a post is about 18% longer than live at the same setting. Layout stays intact at 20px and 24px.
- **Why:** readers who enlarge the default text get larger text everywhere.
- **Evidence:** computed sizes with Chrome's default font size set to 20px.
