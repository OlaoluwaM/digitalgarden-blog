# ADR 0008: Add Giscus Comments and Reactions to Notes

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Readers can't respond to a note: the site has no comments, no reactions,
and no webmentions (webmentions are deferred in `TODO.md`). Upvotes were
asked for alongside comments.

- **The site is static.** `astro.config.ts` has no adapter, and Vercel
  serves prebuilt files. Storing comments or votes ourselves would mean a
  server route, a data store, and abuse protection.
- **The audience is developers.** Most readers have a GitHub account, and
  the site's source and notes are already public on GitHub.
- **The site is dark only.** `body` sets `color-scheme: dark`
  (`styles/base.css`), whatever the reader's system setting.
- **URLs are stable.** Preserving public URLs is a standing rule, so a
  note's permalink can identify its thread.
- **No Content-Security-Policy header is sent**, so a third-party iframe
  needs no policy change.

Options considered:

| Option                                                 | Where comments live            | Reader needs              | Server we run              | Why not chosen                                                           |
| ------------------------------------------------------ | ------------------------------ | ------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| [Giscus](https://giscus.app)                           | GitHub Discussions in this repo | GitHub account            | None                       | Chosen                                                                   |
| utterances                                             | GitHub Issues in this repo     | GitHub account            | None                       | Issues have no threaded replies, and comments would mix with real issues |
| Bluesky or Mastodon replies                            | A social post per note         | An account on that network | None                       | Each note needs a post made by hand; readers off that network can't reply |
| Self-hosted (Remark42, Isso, Cusdis)                   | Our own database               | Nothing, or an email      | Server and database        | Hosting, backups, spam, and moderation become ours                       |
| Own Vercel function for votes                          | Redis via the Vercel Marketplace | Nothing                 | Serverless route and store | An adapter on a static site, plus abuse protection, for votes alone      |
| Disqus                                                 | Disqus                         | Disqus account, or guest  | None                       | Ads and third-party tracking                                             |

## Decision

Every published article ends with a "Comments & Discussion" section: a
Giscus reaction bar for upvotes, then the comments. It comes last, after
"Mentioned in" and the sign-off, so a long thread never pushes the note's
own ending down. A `Comments.astro` component renders it:

| Setting                  | Value                                                    | Why                                                                                                                         |
| ------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Repository               | `OlaoluwaM/digitalgarden-blog` (`R_kgDORsRDnA`)          | Public, and already holds the notes                                                                                         |
| Category                 | "Comments", Announcement format                          | Only the maintainer and the giscus bot can start a discussion, so readers can't open threads that belong to no note        |
| `data-mapping`, `data-term` | `specific`, the note's permalink without a trailing slash | Public URLs are stable, so a note keeps its thread. The live site answers a note at `/x`, `/x/`, and `/x/index.html`; `pathname` mapping would give each its own thread and upvote count |
| `data-strict`            | `1`                                                      | GitHub's search is fuzzy (part 1's permalink could match part 2's thread); strict matching compares a SHA-1 hash instead     |
| `data-reactions-enabled` | `1`                                                      | The reaction bar is the upvote                                                                                              |
| `data-input-position`    | `top`                                                    | The comment box is visible without scrolling past every comment                                                             |
| `data-theme`             | A custom theme: a stylesheet on thunk.blog from `tokens.css` | The widget matches the site. `preferred_color_scheme` would show a white widget to readers in light mode on a dark page |
| Comment order            | Oldest first (`defaultCommentOrder` in `giscus.json`)    | giscus offers only oldest or newest, no "popular" order; oldest first reads as a conversation. It is giscus's default, stated so an upstream change can't flip it |
| `data-loading`           | `lazy`                                                   | The iframe loads only when the reader nears the end of the note                                                             |
| `data-lang`              | `en`                                                     | The site's language                                                                                                         |
| `data-emit-metadata`     | `0`                                                      | Nothing on the page reads it                                                                                                |
| `giscus.json` origins    | `https://thunk.blog` only (www redirects to it)          | Other sites, previews, and localhost can't load this repo's discussions                                                     |

- **Which pages:** published articles only. Home, hidden notes, the 404
  page, and `/random/` get no section.
- **Only in production:** the widget renders only in a production build on
  Vercel (`VERCEL_ENV` is `production`). On localhost and preview
  deployments the section says "Comments only load on thunk.blog." instead, so
  no test comment lands in a real discussion: the thread is named by the
  permalink, which previews share. `giscus.json` backs this up once it is
  on the default branch, where giscus reads it; if giscus can't read it, it
  allows every origin, so the build-time switch is the main guard. The
  production deployment's `*.vercel.app` addresses also get the widget, and
  giscus refuses them once `giscus.json` is live.
- **Without JavaScript:** the section still shows, with "Enable JavaScript
  to comment and react" and a link to the Comments category on GitHub. A
  note's discussion exists only after its first comment, so there is no
  per-note link to give.
- **Script and theme:** the widget loads giscus.app's hosted `client.js`.
  Every deployment points `data-theme` at thunk.blog's copy of the theme
  stylesheet, so a theme change shows only after a release. The page keeps
  giscus's iframe dark (`styles/components/comments.css`): giscus's own page
  stylesheet sets it to follow the reader's system, and an iframe whose
  color scheme differs from its document's is painted opaque.

## Consequences

**Positive**

- Comments and upvotes with no server, database, or adapter: the site stays
  static.
- The data lives in this repo's Discussions, where it can be moderated,
  exported, or moved with GitHub's own tools.
- Threaded replies, Markdown, reactions on each comment, and GitHub
  notifications for new comments.
- The giscus bot creates each note's discussion on its first comment or
  reaction, so nothing is set up per note.

**Negative / trade-offs**

- **GitHub sign-in:** commenting or reacting needs a GitHub account and
  authorizing the giscus app. Readers without GitHub can only read.
- **Third-party script:** `https://giscus.app/client.js` runs in the note's
  page, unversioned, so subresource integrity can't pin it. A compromised
  giscus.app could run code on thunk.blog. Accepted; self-hosting giscus is
  the fallback.
- **Third-party requests:** every article view with JavaScript requests
  giscus.app's `client.js` and `default.css` as the page loads; the iframe,
  and with it GitHub's avatars, loads when the reader nears the end. Those
  servers see the reader's IP address. giscus states it has no tracking or
  ads.
- **No fallback if the script is blocked:** a content blocker or a network
  error leaves the heading over an empty space; the no-JavaScript message
  shows only when scripting is off.
- **Outside dependency:** giscus is one project on GitHub's Discussions API;
  either changing can break the widget.
- **Untestable inside:** the iframe's contents are out of reach of our
  tests, which cover our side only: which pages get the section, the
  widget's attributes, placement, the production-only switch, the
  no-JavaScript message, and axe on the page.
- **Custom theme upkeep:** the theme is a stylesheet served from thunk.blog,
  with its Instrument Sans files, and `vercel.json` allows giscus.app to read
  both (Vercel sends `Access-Control-Allow-Origin: *` on static files today;
  the rules make it explicit). It restyles giscus's own classes and variables, so a
  giscus update can break it. Its colors are read from `tokens.css` at build
  time (`src/pages/giscus-theme.css.ts`), so they cannot drift. It also
  carries a font that draws the reactions as Lucide icons, built from
  `lucide-static` (`src/lib/reaction-icons.ts`; design-changes.md,
  2026-10-12): that package must stay on `lucide`'s version, and a Lucide
  rename of one of the eight icons fails the build.
- **No preview check:** the widget can't be seen before a release, and a
  theme change shows only once it is live.

**Operational**

- Turning on Discussions, creating the category, and installing the giscus
  app are manual GitHub steps, done once.
- The production-only switch reads `VERCEL_ENV` at build time, which Vercel
  provides when the project exposes System Environment Variables (the
  default). If that setting were turned off, production would show "Comments
  only load on thunk.blog." A promoted preview is rebuilt for production,
  so it gets comments.
- A note's URL change orphans its thread; the old discussion stays on
  GitHub, unlinked.

## Related

- ADR 0003: the custom theme reads the same tokens as the rest of the site.
