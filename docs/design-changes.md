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

### Superscripts keep the line spacing

- **Change:** footnote references and other superscripts no longer push
  their line apart (Tailwind's Preflight sets their line height to 0). No
  published note has one yet.
- **Why:** even line spacing, the usual web default.
- **Evidence:** the style guide's Markdown sample with and without Preflight.

### Links in text are underlined

- **Change:** links in note text (paragraphs, lists, tables, callouts,
  footnotes) carry a faint 1px underline in their own gray at 40%, which
  turns solid on hover. Navigation, tags, and Recent Posts titles are
  unchanged.
- **Why:** links were told apart from body text by color alone, and the link
  gray is only 2:1 against the text (WCAG 1.4.1; axe `link-in-text-block`).
- **Evidence:** the axe check in `test/layout/site-layout.test.ts` no longer
  allows `link-in-text-block`.

### Scrollable callouts are keyboard reachable

- **Change:** a callout body that scrolls sideways (wide math on phones)
  gets a tab stop and a name ("Horner's Method, scrollable"), so the arrow
  keys scroll it. Boxes that fit get no tab stop; the check follows resizing
  and collapsing.
- **Why:** keyboard users could not scroll it (WCAG 2.1.1; axe
  `scrollable-region-focusable`).
- **Evidence:** `test/browser/scrollRegions.test.ts`; the axe check no longer
  allows `scrollable-region-focusable`.

## 2026-09-26: Analytics

### Web Analytics and Speed Insights from the site's origin

- **Change:** note pages load Vercel Web Analytics and Speed Insights through
  their official Astro components. The scripts come from `/_vercel/...` on
  thunk.blog instead of `cdn.vercel-insights.com`, and pages request nothing
  from other origins. Live loaded both: Web Analytics from the CDN and
  Speed Insights from `/_vercel/` (since 2026-03-20).
  (Corrected 2026-09-28: this entry first said Speed Insights was new.)
  The 404 page has neither, as on live.
- **Why:** the REWRITE.md Analytics items; same-origin scripts are not
  blocked as third-party trackers and keep visitors' requests on one host.
- **Evidence:** `test/site-build.test.ts` (both components on every note
  page) and `test/layout/site-layout.test.ts` (no request leaves the origin;
  both scripts requested).

## 2026-09-26: Search dialog and mobile file tree

Markup and styles only; the search and navigation scripts are separate
Client Behavior work. Evidence for every entry: screenshots and a
computed-style comparison of each dialog state against thunk.blog at
1440x900 and 390x900, and the tests named per entry.

### Search opens in a modal dialog

- **Change:** the search box is a native `<dialog>` opened as a modal.
  Focus stays inside it, the page behind is inert, and Escape closes it.
  Live toggled a `div`, so Tab could leave the box for the page behind it.
  It looks the same.
- **Why:** a dialog should keep keyboard and screen reader users inside it
  until it closes (WCAG 2.4.3).
- **Evidence:** `test/components/search-dialog.test.ts`; the dialog tests in
  `test/layout/site-layout.test.ts` (position, backdrop, focus on open).

### Highlighted matches use the body text color

- **Change:** a highlighted match in search results and the preview is
  drawn in the body text color (#dadada) on the same translucent gray. Live
  kept the surrounding link or muted gray.
- **Why:** live's highlighted text had 2.9:1 contrast in titles and 4:1 in
  excerpts, below WCAG AA's 4.5:1; it is now about 6:1.
- **Evidence:** the highlight test and the axe check with the dialog open.

### The preview shows the note once

- **Change:** the preview shows the note's text without its header (title
  and tags) and post footer. Live repeated the title and tags under the
  preview's own.
- **Why:** the preview's header already shows them.
- **Evidence:** the preview styling test.

### The preview hides below 800px

- **Change:** the preview panel hides below the site's `md` breakpoint
  (800px). Live hid it below 768px.
- **Why:** the site uses one set of breakpoints.
- **Evidence:** the search-state tests at 390px and 1440px.

### The mobile file tree's overlay stays on screen

- **Change:** the overlay that dims the page behind the open mobile file
  tree is fixed to the viewport. Live positioned it `absolute`, so if the
  file tree was opened after scrolling, the overlay was off screen and
  tapping the page could not close the tree.
- **Why:** the overlay must cover what the reader sees.
- **Evidence:** the mobile file tree test (opened after scrolling to the
  bottom).

### Smaller changes

- The no-results message uses curly quotes (“query”), as note text does.
- Keyboard hints use `<kbd>`, and the two navigation landmarks are named
  "Site" (the mobile navbar) and "Notes" (the file tree), so they stay
  distinct when both show. Neither changes the look.

## 2026-09-26: Search

### The search index loads on first use

- **Change:** the search index (`/searchIndex.json`) and FlexSearch load
  when the search field is first focused or typed in, from the site's own
  origin. Live loaded FlexSearch from a CDN and downloaded the index on every
  page load.
- **Why:** most visits never search, and first-party scripts are not
  blocked as third-party.
- **Evidence:** `test/site-build.test.ts` (FlexSearch is in a chunk no page
  loads up front) and `test/layout/site-layout.test.ts` (no index request
  until the dialog opens, then one).

### Search fixes

- **Change:** pasting, the clear button, and dictation now search (live
  searched on `keydown`). Search waits for a 150ms pause in typing (live:
  200ms), and clearing the field shows the hint at once. Titles, tags, excerpts, and the no-results query
  show as text, so an entry such as `<options-to-pass-to-executable>` reads
  as written (live parsed it as HTML, and stripped it from excerpts).
  Queries such as `span` or `class` highlight correctly (live matched its
  own highlight markup).
- **Why:** the three defects REWRITE.md lists for the port.
- **Evidence:** `test/browser/search.test.ts` and `test/search-engine.test.ts`.

### Search results and tags

- **Change:** results are links, so they open in a new tab like any link
  (live used click handlers). A note's header tags search in place with
  JavaScript and open `/?q=#tag` without it. The preview drops the note's
  element ids and loads only where the panel shows (not on phones).
  Opening, closing, the arrow keys, Enter, hover, and Ctrl/⌘+K work as on
  live.
- **Why:** links are what results are; ids in the preview duplicated the
  page's own and captured its `#` links; phones never see the preview.
- **Evidence:** `test/browser/searchDialog.test.ts` and the "search dialog
  wiring" tests in `test/layout/site-layout.test.ts`.

## 2026-09-27: Mobile navigation

### The mobile file tree takes focus and closes from the keyboard

- **Change:** opening the file tree from the hamburger moves focus to its
  first link; Escape closes it and returns focus to the hamburger; widening
  the window to the desktop layout closes it. Live left focus on the
  hamburger and had no Escape. Tapping the dimmed page closes it, and
  folders remember their state across pages under live's storage keys, as
  on live.
- **Why:** the tree opens over the page, so keyboard users should start in
  it and be able to leave it; a tree left open at desktop width would
  reopen by itself when the window narrowed.
- **Evidence:** `test/browser/mobileNavigation.test.ts`,
  `test/browser/folderState.test.ts`, and the "mobile file tree" tests in
  `test/layout/site-layout.test.ts`.

## 2026-09-27: Without JavaScript

### The mobile file tree opens without JavaScript

- **Change:** below 1000px the file tree is a popover the hamburger opens,
  so it opens, closes on a tap outside or Escape, and dims the page even
  with JavaScript off. Live's needed Alpine, so without JavaScript phones
  and tablets could not reach the tree at all. With JavaScript it looks and
  behaves as before.
- **Why:** navigation is not a feature that needs a script.
- **Evidence:** the "mobile file tree" tests in
  `test/layout/site-layout.test.ts`, run with JavaScript on and off;
  screenshots of every page and of the open tree match the previous build.

### The mobile file tree is wider

- **Change:** the file tree opened from the hamburger is 280px wide, the
  desktop sidebar's widest, capped at 85% of the screen (272px on a 320px
  phone). Live's was 250px.
- **Why:** long note titles wrapped more than they needed to; the dimmed
  page beside the tree still shows, to tap closed.
- **Evidence:** the "opens wide, but never over the whole width" test in
  `test/layout/site-layout.test.ts`.

### The note list keeps clear of the search button

- **Change:** the file tree's note list starts 8px lower, and its top edge
  fades over those 8px, so rows scrolled up fade out instead of being cut
  off right under the search button. On phones the search button keeps
  its 10px bottom margin (live: 2px), so the list starts 16px lower there.
- **Why:** scrolled, half-hidden titles crowded the search button,
  especially on phones.
- **Evidence:** the "leaves room between the search button and the note
  list" tests in `test/layout/site-layout.test.ts`.

### Search buttons hide without JavaScript

- **Change:** with JavaScript off, the search buttons are hidden. Live showed
  them, and they did nothing.
- **Why:** search needs JavaScript.
- **Evidence:** the "without JavaScript" tests.

### Collapsed callouts show expanded without JavaScript

- **Change:** with JavaScript off, a callout written collapsed
  (`[!note]-`) shows its content, without the fold control. No published
  note uses one yet.
- **Why:** only the callout script can expand it, so its text would be
  unreachable.
- **Evidence:** the "without JavaScript" tests.

## 2026-09-27: Tokens on Tailwind's scales

The tokens moved onto Tailwind's structure: its namespaces, its step names,
one spacing unit. Values that define the site stayed (grays, fonts, heading
sizes, note text, layout widths, breakpoints); incidental ones became
Tailwind's. One-off values snapped to the nearest step. Every change below
is 2.2px or less unless it says otherwise.

### Interface text

- **Change:**
  - Interface text takes Tailwind's steps and their line heights: `xs`
    0.75rem, `sm` 0.875rem, `base` 1rem, `lg` 1.125rem. The page's default
    line height is 1.5 (was 1.6); note text keeps 1.03rem / 1.5.
  - File tree rows and the search button: 0.85rem → 0.875rem. Tree rows
    use 1.625 line height (was 1.6), and folder rows 4px padding (was 3px).
  - Dates (note header, Recent Posts), Recent Posts descriptions, and the
    post footer: 0.8rem, 0.8em, and 0.9rem → 0.875rem.
  - h6: 1.07rem → 1.125rem. The site name: 2rem → 1.92rem (the h3 step,
    with its −0.01em tracking); in the sidebar its two lines sit closer
    (line height 1.1 → 1), 6px shorter. On phones: 1.5rem → 1.536rem.
  - Line heights on Tailwind's leading: code blocks 1.6 → 1.625, tables and
    callout titles 1.3 → 1.25.
- **Why:** 35 font sizes and 9 line heights, most used once, become 9
  steps; the interface reads as one system.
- **Evidence:** `test/design-system.test.ts`; screenshots of every page at
  1440px and 390px, and of each search and navigation state, against the
  previous build.

### Search

- **Change:**
  - The dialog is 1152px wide (the `6xl` step; was 1100px).
  - Field text 0.9rem → 0.875rem; hints 0.8rem → 0.75rem; result titles
    1.1rem → 1.125rem; excerpts 0.85rem → 0.875rem; the "select a result"
    placeholder 0.9rem → 0.875rem.
  - The preview's text is 1rem (was 0.95rem), its title 1.536rem (was
    1.4rem), and its note headings 1.229rem for h1 and h2 (were 1.3rem and
    1.2rem) and 1.125rem for h3 (was 1.1rem).
  - Inline code in the preview looks as it does in notes (was smaller,
    with less padding, on the sidebar gray).
  - Hovered and selected results lighten by the same white/5 as file tree
    rows. They used #242424, which is darker than the card.
- **Why:** one set of steps across the site; the preview shows a note, so
  its code should look like the note's; the hover was barely visible.
- **Evidence:** the "search dialog" tests in
  `test/layout/site-layout.test.ts`; state screenshots.

### One tag style

- **Change:** tags in the note header, search results, and the preview
  share one look: 8px corners, a 10% gray fill, a 1px inset border,
  medium weight, #b3b3b3 text (was #999 in the header). Header tags are
  14px (were 0.875em, 14.4px); result and preview tags 12px (were 11.2px
  and 12px, with 3px and 4px corners and different fills). Clickable tags
  brighten on hover.
- **Why:** three tag designs for one idea. #999 on a result card's fill
  fell below 4.5:1 at 12px.
- **Evidence:** axe in `test/layout/site-layout.test.ts` (search results
  included); state screenshots.

### One key style

- **Change:** the search button's Ctrl + K and the dialog's hints draw keys
  with one component, as `<kbd>` (the button used `<code>`), at 0.8em of
  their hint: 9.6px (were 8.96px in the button, 10.24px in the dialog).
  The button's hint is 0.75rem (was 0.7rem), with 4px padding (was 3px,
  and 3.5px below 1000px).
- **Why:** keys to press are keyboard input; the two hints looked slightly
  different.
- **Evidence:** "marks the shortcut's keys as keyboard input" in
  `test/components/site-navigation.test.ts`; "fits the shortcut keys
  inside their hint" in `test/layout/site-layout.test.ts`.

### One focus ring

- **Change:** every focused control shows the same 2px gray outline, 4px
  away (was 4.8px). The search field shows it instead of its lighter
  border and 2px glow; the code copy button drops its extra 3px shadow.
- **Why:** three focus treatments for one purpose.
- **Evidence:** "shows a focus ring on every control reached with Tab" in
  `test/layout/site-layout.test.ts`.

### Spacing, radii, and motion snapped to the scales

- **Change:**
  - Navbar: padding 6.4px → 6px, the gap after the hamburger 32.8px →
    32px, the hamburger icon 23.2px → 24px wide, its animation 320ms →
    300ms. The navbar's search button is 184px wide between 800px and
    1000px (was 182–189px) and 36px tall everywhere (was 36.8px).
  - Note column top padding 90px → 88px (76px on phones, was 75px);
    Recent Posts heading margin 67.2px → 68px; nested callouts that open
    their parent 19.2px → 20px; note header date icons 3px → 4px apart;
    smaller one-off gaps and paddings to the nearest 2px.
  - Radii on Tailwind's steps: header tags 7.2px → 8px.
  - Transitions use Tailwind's easing, `cubic-bezier(0.4, 0, 0.2, 1)` (was
    `ease`); links fade in 150ms (was 160ms).
  - Breakpoints are in rem (50rem, 62.5rem, 87.5rem): the same 800, 1000,
    and 1400px at the default font size, and they follow the reader's
    browser font size.
- **Why:** one grid; no values that exist once.
- **Evidence:** `test/design-system.test.ts`; screenshots.

## 2026-09-27: Consistency fixes

Found reviewing the dev site after the move onto Tailwind's scales.

### Escape closes search the first time

- **Change:** the search field is a text field (it still asks phones for
  a search keyboard). As a search field, it cleared the query on the first
  Escape, and only the second closed the dialog.
- **Why:** the footer says Escape closes search, and live closed on the
  first press.
- **Evidence:** "closes on the first Escape with a query typed" in
  `test/layout/site-layout.test.ts`.

### One style for search messages

- **Change:** the messages before a search, with no results, and before a
  result is previewed share one look: centered, with a 48px icon, in 14px
  muted gray. The first was italic, left-aligned, and brighter, with no
  icon, and now reads "Type to search the notes" (was "Enter your search
  text in the box above"). The no-results message was 16px.
- **Why:** one kind of message, three styles.
- **Evidence:** "shows every search message in one style".

### Keyboard hints hide on phones

- **Change:** below 800px the search dialog's footer (Enter, arrows, Esc)
  is hidden, as the search button's Ctrl + K already was.
- **Why:** phones have none of those keys.
- **Evidence:** "shows/hides the keyboard hints" tests.

### The preview's title is set in the serif

- **Change:** the search preview's title is Instrument Serif at 30.7px in
  the body color (was Instrument Sans semibold, 24.6px, link gray).
- **Why:** every other note title is set in the serif.
- **Evidence:** "styles the preview like a note".

### One underline for links in sentences

- **Change:** links in the post footer and the 404 page's "Go back home"
  get the faint underline links in notes have (the `link-underline`
  utility). The footer's underline was solid; the 404 link had none.
- **Why:** a link in a sentence should look the same everywhere, and not
  rely on color alone.
- **Evidence:** "underlines links in sentences the same way".

### Recent Posts has more room

- **Change:** entries are 28px apart (were 20px, with 2px padding), each
  description sits 4px under its title (was touching), and dates are 12px
  (were 14px, the same as the descriptions).
- **Why:** the list read as one block, and the date no longer read as
  secondary.
- **Evidence:** the "Recent Posts" tests.

### Code blocks sit on the raised gray

- **Change:** code blocks use #242424, like inline code and quotes (was
  the theme's #1e1e1e, the page's color); the syntax colors are
  unchanged. The copy button's fill is white at 5% (10% on hover) with
  muted text; it was 5% of the code's text color.
- **Why:** code looked different inline and in blocks; the copy button was
  the one control off the shared hover fill.
- **Evidence:** "sit on the raised gray, with the shared fill on the copy
  button"; `test/highlighting.test.ts`; axe (comments, the dimmest syntax
  color, still pass AA).

### Tags in the regular weight

- **Change:** tags are set in the regular weight (was medium), in the note
  header, search results, and the preview; their color stays #b3b3b3.
- **Why:** tags should sit quieter under the title. The next gray down
  (#999) falls to 3.9:1 on a hovered or selected search result, below AA
  at 12px, so the weight carries the change.
- **Evidence:** "look the same everywhere, in the regular weight" in
  `test/layout/site-layout.test.ts`; axe.

### The site name and file tree as on live

- **Change:** the site name is back to live's 2rem with a 1.1 line height
  in the sidebar and no tracking (the 3xl step made it 30.7px, set solid
  and tracked in). The file tree matches live's density: see the next
  entry.
- **Why:** Olaolu preferred live's larger site name and denser tree. The
  site name is the brand mark, kept between steps as a listed exception.
- **Evidence:** the "site name and file tree" tests in
  `test/layout/site-layout.test.ts`; screenshots against live.

### Small interface text at live's size

- **Change:** the `sm` step is 0.85rem (13.6px, live's size), not
  Tailwind's 0.875rem, on the same 20px line. The file tree, search
  button, dates, post footer, Recent Posts descriptions, search field,
  excerpts, and search messages all use it (0.4px smaller). The file
  tree's rows sit on a 22.1px line (`leading-relaxed`), within half a
  pixel of live's 21.76px; at 14px they were 22.75px.
- **Why:** 14px read a size too big in the sidebar next to live. Live
  set most of this text between 0.8rem and 0.9rem.
- **Evidence:** "keeps live's size for the sm step" in
  `test/design-system.test.ts`; "keeps the file tree at live's size and
  spacing" in `test/layout/site-layout.test.ts`; screenshots against live.

### A smaller shortcut hint

- **Change:** the search button's Ctrl + K hint is 15% smaller: its text
  is 0.75em of the button's label (10.2px, was 12px; live 11.2px), with
  2px by 4px padding (was 4px by 6px), about 70 by 21px (was 80 by 25px).
  Its keys stay 0.8em of the hint (8.2px). Keys everywhere, the search
  dialog's hints included, have 2px top and bottom padding (was 4px).
- **Why:** the hint read nearly as large as the label beside it.
- **Evidence:** "sets the shortcut hint smaller than the button's label"
  and "fits the shortcut keys inside their hint" in
  `test/layout/site-layout.test.ts`.

## 2026-09-28: `/random/`

- **Change:** the random page moves from `/~random/` to `/random/`, with no
  redirect from the old URL. It picks from published notes without Home
  (live included it). It replaces itself in the history
  (`location.replace`), so Back from the note returns to the page before;
  live's Back landed on `/~random/`, which redirected again. It loads no
  analytics (live loaded Vercel's scripts), since it leaves before they
  could report.
- **Why:** Olaolu asked for the plain URL (the tilde came from the Digital
  Garden template) and to leave Home out; a random note should be a note.
  The Back loop trapped readers.
- **Evidence:** `test/random-page.test.ts`; the "random page" tests in
  `test/layout/site-layout.test.ts`.

## 2026-09-28: The feed is RSS

- **Change:** `/feed.xml` is RSS 2.0 (was Atom), built with `@astrojs/rss`.
  Items are newest first (live's order was arbitrary) and dated by each
  note's `published` time in Central time (live used `updated`, read as
  UTC). Items gain the note's description and tags; the channel gains a
  description, a language, and a self link. Content is still the full
  note, with absolute URLs and the site's optimized images.
- **Why:** Olaolu chose Astro's standard feed package over hand-rolled Atom
  (ADR 0004) and Central time for note dates.
- **Evidence:** `test/feed.test.ts`; `noteInstant` in `test/dates.test.ts`.

## 2026-09-28: The sitemap moves, and robots.txt names it

- **Change:** the sitemap is `/sitemap-index.xml` (with `/sitemap-0.xml`),
  from `@astrojs/sitemap`; `/sitemap.xml` is gone. It lists Home and every
  note, without `/random/` or the 404 page (live listed `/404/`), and has
  no `lastmod` (live's were mostly a bulk-update date). A new `/robots.txt`
  allows every crawler and names the sitemap index; live had none.
- **Why:** Olaolu chose Astro's standard sitemap over a hand-rolled
  `/sitemap.xml` (ADR 0005).
- **Evidence:** `test/sitemap.test.ts`.

## 2026-09-28: Recorded late

Changes from live found by the Eleventy inventory that had no entry here.
Each was intended or follows from an entry above; evidence is a comparison
of the Eleventy build (`dist/`) with the Astro build (`dist-astro/`).

### Titles come from the title property

- **Change:** pages, the file tree, and search use each note's `title`
  property. Two titles differ from live: "Endianness, WOOT!" is now
  "Endianness, WOOT!?" and "Numbers Numerals Oh Boy" is now "Numbers?
  Numerals? Oh Boy". Live used the filename, which cannot hold `?`.
- **Why:** the property keeps the real title (TODO.md vault renames).
- **Evidence:** the two posts' `<h1>` in both builds.

### A bare unresolved wikilink becomes a link

- **Change:** `[[Polynomials]]` in "On maths and engineering" links to
  `/404` as an unresolved link. Live printed it as plain text, because its
  link filter only handled `[[target|alias]]`.
- **Why:** every wikilink is treated the same way.
- **Evidence:** `test/wikilinks.test.ts`; the maths post in both builds.

### Images are one optimized img

- **Change:** a note image is one lazy `<img>` with a WebP `srcset`, width,
  and height. Live used `<picture>` with WebP and JPEG sources and the
  original file as a fallback.
- **Why:** Astro's image pipeline (REWRITE.md "Markdown and Assets"); every
  current browser shows WebP. Affects the Redis post.
- **Evidence:** `test/images-build.test.ts`; the Redis post in both builds.

### No graph data

- **Change:** `/graph.json` is gone.
- **Why:** only the local graph read it, and the graph is off on live.
- **Evidence:** the route inventory; `src/pages/` has no graph route.

### No loading spinner in search

- **Change:** search results and the preview show no spinner while the
  index or a note loads.
- **Why:** not ported with the search dialog. The index is small and loads
  on first use, so the wait is short.
- **Evidence:** `src/scripts/search.ts`, `src/scripts/searchPreview.ts`.

### No hash-target outline or heading copy

- **Change:** the element named in the URL's `#fragment` gets no dashed
  outline, and double-clicking an element with an id no longer copies its
  link (live's `references.njk`).
- **Why:** posts have no heading ids, so it only ever applied to Home's
  "Welcome".
- **Evidence:** no equivalent in `src/scripts/`.

### Headings are not focusable

- **Change:** headings with ids have no `tabindex="-1"` (live's
  markdown-it-anchor added it, so a skip to the heading moved focus).
- **Why:** Astro's heading ids come from github-slugger without it; only
  Home's "Welcome" has an id.
- **Evidence:** `dist/index.html` and `dist-astro/index.html`.
