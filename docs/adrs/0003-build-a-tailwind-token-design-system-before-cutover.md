# ADR 0003: Build a Tailwind Token Design System Before Cutover

- **Status:** Accepted
- **Date:** 2026-09-26

## Context

The Astro rewrite must keep thunk.blog's current design. That design comes from
a cascade built for Eleventy and Obsidian:

- `obsidian-base.scss` (about 19,400 lines of Obsidian app CSS).
- The vendored theme, `src/styles/vendor/obsidian-theme.css` (628 KB). It
  includes base64-embedded Instrument Serif font faces.
- `digital-garden-base.scss` (about 1,860 lines of template chrome).
- A small set of intentional overrides in `src/site/styles/user/`. Most of
  the real design choices live in `custom.scss`: a gray accent scale, a Major
  Third heading scale, the content size and line height, and the fonts.

The site uses only a small part of this cascade. The styles are hard to
change safely because every rule competes with thousands of unrelated rules.

ADR 0001 vendored the theme and deferred distilling it into owned tokens
until after cutover. It rejected distilling during the migration because the
markup and the token sheet would change together, and drift could not be
attributed to either layer.

Olaolu wants the new markup to use a design system that scales, and wants
the Eleventy styles revised into modular, organized files, not ported as they
are. The options considered were:

- **Legacy CSS through cutover, distilled later (ADR 0001 as written).** Low
  risk, but it ships the monolithic cascade and postpones the design system.
- **Plain CSS custom properties and cascade layers.** No dependency, and the
  same tokens are possible, but it offers weaker scaling ergonomics.
- **Tailwind CSS v4.** Tokens are configured in CSS (`@theme`) as custom
  properties, and utilities are generated from them. Astro supports it through
  the official Vite plugin. Olaolu chose this for scaling.

The assumptions are that the design is small enough to express as tokens
(colors, three font families, a type scale, spacing, radii, and breakpoints),
and that live-site screenshots are an adequate parity check.

## Decision

The Astro site will be styled by a Tailwind CSS v4 design system, built before
cutover, in two phases.

**Phase 1, parity shell.** Rebuild Eleventy's markup as Astro components with
the same class names. Load the legacy stylesheets in the live cascade order
inside one low-priority cascade layer, including the ADR 0001 vendored theme.
Adapt only selectors that target Eleventy-specific markup. Verify with
screenshots against thunk.blog. Olaolu reviews the result before phase 2.

**Phase 2, design system.**

- Define tokens with Tailwind v4 `@theme` in a dedicated tokens file. Take
  the values from the live site's computed styles.
- Revise the legacy styles into modular, owned files:
  - chrome components use utilities in Astro components;
  - rendered Markdown uses a hand-written content stylesheet built on the same
    tokens (no `@tailwindcss/typography`);
  - small shared pieces go in component-scoped CSS.
- Declare the layer order explicitly, because unlayered CSS, including Astro's
  responsive image styles, overrides Tailwind's layered utilities.
- Verify each component against the phase 1 Astro screenshots. Only CSS
  changes between the two, so any drift is attributable to CSS.
- Remove the legacy CSS, including the vendored theme and its embedded fonts,
  once nothing depends on it. Enable Tailwind's Preflight only afterward.

This brings ADR 0001's phase-2 distillation before cutover. ADR 0001's
decision to vendor the theme stands; the vendored file is the phase 1
baseline. Fonts stay the same: Instrument Sans (text), Instrument Serif
(headings and site name), and Commit Mono (code), all self-hosted.

Every intentional visual or behavioral change is recorded in
`docs/design-changes.md` with the reason and the evidence.

## Consequences

**Positive**

- The design becomes a readable token set and a few focused stylesheets
  instead of about 22,000 lines of mostly unused CSS and a 628 KB theme.
- New UI (search and later features) is built from shared tokens and
  utilities instead of new overrides.
- Phase ordering keeps ADR 0001's attribution guarantee: phase 1 isolates
  markup changes, and phase 2 isolates CSS changes.
- Removing the legacy cascade and embedded fonts cuts page weight
  substantially.

**Negative / trade-offs**

- It adds a build dependency (`tailwindcss`, `@tailwindcss/vite`) and a
  utility-class vocabulary in templates.
- Phase 1 styling is temporary work that phase 2 replaces.
- Parity is judged by screenshots, which cannot prove equivalence. Subtle
  differences (font rendering, hover and focus states, rarely used Markdown
  elements) can slip through.
- Cascade layers change how precedence works. Mistakes in layer order show up
  as styles that silently lose.
- Dropping the theme's embedded Instrument Serif makes headings use the
  self-hosted face, which declares only weight 400. Headings request weight
  700, so the browser may fake bold. This must be checked and fixed
  deliberately.
- Cutover waits for the design system work, not just parity.

## Related

- ADR 0001: this ADR keeps the vendored theme as the phase 1 baseline and
  moves its phase-2 distillation before cutover.
- ADR 0002: a sibling migration decision; the feed endpoint consumes the same
  rendered HTML that the content stylesheet styles.
