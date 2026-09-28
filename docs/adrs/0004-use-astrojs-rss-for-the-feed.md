# ADR 0004: Use @astrojs/rss for the Feed

- **Status:** Accepted
- **Date:** 2026-09-28
- **Supersedes:** the feed half of [ADR 0002](0002-hand-roll-the-atom-feed-and-sitemap-as-custom-endpoints.md)

## Context

ADR 0002 hand-rolled `/feed.xml` as Atom to keep the live feed's format for
existing subscribers. Olaolu has since ruled out backwards compatibility as a
constraint for the rewrite and prefers Astro's standard tools. Feed readers
accept RSS 2.0 and Atom at the same URL, so subscribers keep their feed
either way.

The live Atom feed also has problems of its own: no author (Atom requires
one), a feed date that is the build time, entries in no particular order,
and note dates read as UTC although they are written in Central time.

## Decision

Build `/feed.xml` with `@astrojs/rss` (RSS 2.0) in `src/pages/feed.xml.ts`:

- One item per published note, without Home, newest first.
- Each item's `pubDate` is the note's `published` value in `America/Chicago`
  (`noteInstant` in `src/lib/dates.ts`); its description and categories
  come from the note's description and tags.
- The full note content is rendered through Astro's container API, because a
  collection entry's `rendered.html` still holds image placeholders. Every
  site-relative URL in it is made absolute.
- The channel names its own URL with an Atom self link.

## Consequences

**Positive**

- The package owns the XML structure and escaping, which was ADR 0002's main
  risk.
- Items are ordered and dated correctly.

**Negative / trade-offs**

- RSS has no per-item updated date, so an edited post does not resurface in
  readers.
- The container API is experimental and may change in minor Astro releases;
  `test/feed.test.ts` fails if the content stops rendering.
- The channel description lives in `src/lib/site.ts` until Home has a real
  description.
