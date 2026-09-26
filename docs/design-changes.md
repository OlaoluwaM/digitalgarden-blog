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
