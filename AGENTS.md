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
