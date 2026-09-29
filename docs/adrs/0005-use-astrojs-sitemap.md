# ADR 0005: Use @astrojs/sitemap

- **Status:** Accepted
- **Date:** 2026-09-28
- **Supersedes:** the sitemap half of [ADR 0002](0002-hand-roll-the-atom-feed-and-sitemap-as-custom-endpoints.md)

## Context

ADR 0002 hand-rolled `/sitemap.xml` because `@astrojs/sitemap` cannot
produce that exact path: it writes `/sitemap-index.xml` and numbered
`/sitemap-N.xml` files. Olaolu has since ruled out backwards compatibility
as a constraint and prefers Astro's standard tools (as with the feed,
[ADR 0004](0004-use-astrojs-rss-for-the-feed.md)). Crawlers find a sitemap
through `robots.txt` or a search console, not by its path. Live has no
`robots.txt`, and its sitemap lists the 404 page with `lastmod` dates that
are mostly the date of a bulk vault update.

## Decision

- Add `@astrojs/sitemap` in `astro.config.ts`. It lists every built page
  except `/random/` (a redirect); Astro leaves out the 404 page. The unused
  news, image, video, and hreflang namespaces are off.
- Serve `/robots.txt` from `src/pages/robots.txt.ts`: allow everything and
  name `https://thunk.blog/sitemap-index.xml`.
- `/sitemap.xml` is not kept.

## Consequences

**Positive**

- No sitemap code to maintain, and new routes are listed without edits.
- Crawlers can discover the sitemap, which they could not do on live.

**Negative / trade-offs**

- The sitemap URL changes; resubmit it in any search console that had
  `/sitemap.xml`.
- No `lastmod`. The integration runs in the config, outside the content
  collection, so note dates are not at hand; live's values were not
  accurate anyway.
