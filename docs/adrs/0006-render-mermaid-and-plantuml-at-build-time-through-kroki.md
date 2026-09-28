# ADR 0006: Render Mermaid and PlantUML at Build Time Through Kroki

- **Status:** Accepted
- **Date:** 2026-09-28

## Context

Olaolu wants Mermaid and PlantUML diagrams in notes. The Digital Garden
plugin (2.94.1) publishes ` ```mermaid ` and ` ```plantuml ` fences
unchanged, so the site must render them. The Eleventy template rendered
Mermaid in the browser with Mermaid's script and PlantUML as an `<img>`
from plantuml.com; the Astro site dropped both because no note used them,
and it loads no third-party scripts (docs/design-changes.md, "Scripts
removed").

Three options were considered:

- **Kroki at build time.** One HTTP request per diagram to
  [Kroki](https://kroki.io), which renders both formats (and many others)
  to SVG. No client JavaScript, and it matches how math is already
  rendered: to SVG during the build.
- **Mermaid in the browser, PlantUML as a remote image.** Mermaid's script
  is large, readers without JavaScript see the source, and every reader's
  browser would request images from a third party.
- **Local renderers at build time.** `mermaid-cli` needs a headless
  Chromium and PlantUML needs Java; Vercel's build image has neither.

Olaolu chose Kroki, and chose to fail the build when Kroki fails rather
than fall back to showing the source.

## Decision

- An mdast plugin replaces each ` ```mermaid ` and ` ```plantuml ` fence
  with its diagram before syntax highlighting, so Shiki never sees them.
- The plugin POSTs the fence's source to `{KROKI_URL}/{type}/svg`.
  `KROKI_URL` defaults to `https://kroki.io`; setting it points the build
  at a self-hosted Kroki without code changes.
- Diagrams use dark themes through Kroki's diagram options, sent in the
  query string: Mermaid's `dark` (with the site's gray-800 behind edge
  labels, which its default left at 3.9:1 contrast) and PlantUML's
  `cyborg`, which also drops its embedded source metadata.
- The SVG is inlined in a `<figure class="diagram">`, sanitized (no
  scripts, event-handler attributes, or `javascript:` links) and with its
  element ids prefixed so two diagrams on a page cannot collide. It is
  named for assistive technology by the diagram's own title where the
  format has one, else "Mermaid diagram" or "PlantUML diagram". It shrinks
  to fit the note column, but not below 70% of its drawn width; past that
  the figure scrolls sideways, with a tab stop while it does, and fades
  out at the edge with more to scroll to.
- Responses are cached by a hash of Kroki's URL, the type, options, and
  source in `node_modules/.cache/kroki/` (`KROKI_CACHE_DIR` overrides it),
  so an unchanged diagram is not requested again while that directory
  survives (locally, and in Vercel's build cache, which keeps
  `node_modules`).
- A network error, a timeout, or a non-2xx response fails the build with
  an error naming the note, the diagram's line, and Kroki's message.
- Tests run against a local fake Kroki (through `KROKI_URL`); they never
  call kroki.io.

## Consequences

**Positive**

- Diagrams need no client JavaScript and no third-party requests from
  readers' browsers; the page carries plain SVG.
- One mechanism covers both formats, and adding another Kroki format is a
  small change.
- A broken diagram fails the build with its location instead of shipping
  as an error image or raw source.

**Negative / trade-offs**

- The build depends on kroki.io being up whenever a new or changed diagram
  is built. A Kroki outage blocks publishing such a note; cached diagrams
  still build.
- Diagram sources are sent to a third party. They are published content,
  so nothing private leaves, but it is still an outside dependency.
- Rendering follows Kroki's Mermaid and PlantUML versions, which may
  differ from what Obsidian previews.
- Inline SVG adds to page weight, and the diagrams' colors come from
  Mermaid's and PlantUML's dark themes, not the site's tokens.

## Related

- ADR 0003 — the token design system; diagram colors are the renderers'
  own, outside it.
