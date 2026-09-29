# Project Agent Requirements

## Required MCP servers

Before working in this repository, every agent must install or configure its
MCP client to use both of these remote servers:

- [Astro Docs MCP](https://mcp.docs.astro.build/mcp), for current Astro
  documentation. Follow the
  [official Astro setup guide](https://docs.astro.build/en/guides/build-with-ai/).
- [Vercel MCP](https://mcp.vercel.com), for current Vercel documentation and
  project operations. Follow the
  [official Vercel setup guide](https://vercel.com/docs/ai-tooling/vercel-mcp)
  and complete OAuth when project access is necessary.

At the start of a session, verify that both servers are configured and
available. If either server is unavailable, tell the user before you make an
Astro-specific or Vercel-specific decision. Access to the Vercel MCP does not
authorize changes to Vercel resources. Get the authorization that the action
requires before you change external state.

## Astro rewrite context

Before working on the Astro rewrite, read the documents below. Then inspect
the working tree and relevant implementation; context can drift.

- [TODO.md](TODO.md): open work: the steps at and after the merge,
  deferred site features, performance, and upstream follow-ups.
- [docs/design-changes.md](docs/design-changes.md): every intended
  difference from the live site, with its reason and evidence.
- [docs/markdown-pipeline.md](docs/markdown-pipeline.md): each Markdown
  plugin and the Eleventy behavior it replaces.
- `docs/adrs/`: accepted architecture decisions.

Keep human checklists lean: short actions, no handoffs or design discussion.
Mark work complete only when it is integrated and verified; label isolated
plugin tests separately from site behavior.

Olaolu is implementing the rewrite in Learn / Guide mode. Guide and review
unless he asks for implementation. Documentation maintenance does not change
that mode. Preserve his unfinished code and names when updating context.

The Eleventy code is gone; the live site, thunk.blog, is the parity reference
until cutover. Check the actual consumer
before sharing filtering, sorting, or date logic across routes. Preserve public
URLs, publisher output, and the existing design unless a change is agreed.
