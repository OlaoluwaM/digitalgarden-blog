# ADR 0002: Hand-Roll the Atom Feed and Sitemap as Custom Endpoints

- **Status:** Superseded by [ADR 0004](0004-use-astrojs-rss-for-the-feed.md) (feed) and [ADR 0005](0005-use-astrojs-sitemap.md) (sitemap)
- **Date:** 2026-08-29

## Context

The migration's URL-parity contract preserves two non-note routes exactly: `/feed.xml` and `/sitemap.xml`. The official Astro integrations cannot reproduce either:

- The existing feed (`src/site/feed.njk`) is an **Atom** feed (`http://www.w3.org/2005/Atom`) that embeds each note's **full rendered HTML content** inline. `@astrojs/rss` generates RSS 2.0 only — adopting it would change both the feed format and the payload shape under the same URL, breaking or degrading existing subscribers.
- `@astrojs/sitemap` structurally emits `sitemap-index.xml` plus numbered `sitemap-N.xml` files; its `filenameBase` option changes only the name prefix. A bare `/sitemap.xml` is not producible (verified against the integration's configuration reference, v3.7.x).

Options considered: adopt the integrations and change the URLs (adding 301s in `vercel.json`); adopt `@astrojs/rss` and accept the format change under the old URL; hand-roll both routes as Astro static file endpoints. Changing feed URLs or formats punishes existing subscribers for an internal replatform, and redirect rules are exactly the kind of quiet cutover risk the migration is trying to avoid. The site is ~15 pages, so the integrations' scale features (entry limits, chunking, i18n) buy nothing.

## Decision

Implement both routes as custom static file endpoints in the Astro project:

- `src/pages/feed.xml.ts` — reproduces the current Atom structure: site-level `<feed>` metadata, one `<entry>` per published note (excluding the `gardenEntry` home note), `<updated>` from the note's `updated`/`created` frontmatter, and the note's full rendered HTML as `<content type="html">` with XML-escaped markup and absolute URLs.
- `src/pages/sitemap.xml.ts` — enumerates the published notes' permalinks plus the non-note routes, at the exact `/sitemap.xml` path.

Neither `@astrojs/rss` nor `@astrojs/sitemap` is installed. Both endpoints follow the same `APIRoute`/`GET` pattern, sourcing entries from the same content collection the pages use.

## Consequences

**Positive**

- Exact URL and format parity: subscribers and crawlers see no change at cutover; no redirect rules to write or maintain.
- Full control over content: excluding the home note, choosing timestamp fields, and embedding full rendered HTML are all explicit code instead of integration configuration limits.
- One endpoint pattern serves both routes (and later `robots.txt` or similar), keeping the learning surface small.

**Negative / trade-offs**

- XML correctness (escaping, namespaces, RFC 3339 dates) is now owned in-repo; a bug ships broken XML with no upstream to blame or patch.
- Integration niceties — automatic route discovery, chunking, i18n annotations — are foregone; if new routes are added later, the sitemap endpoint must be updated by hand or it silently omits them.
- The feed endpoint needs each note's rendered HTML outside a page context, coupling it to the content collection's `rendered.html` output; a future change to how notes render must keep the feed path working.

## Related

- ADR 0001 — sibling Astro-migration decision; both trade official/upstream machinery for owned, frozen artifacts to protect design and URL parity.
