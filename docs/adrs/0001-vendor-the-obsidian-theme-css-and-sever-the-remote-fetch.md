# ADR 0001: Vendor the Obsidian Theme CSS and Sever the Remote Fetch

- **Status:** Accepted
- **Date:** 2026-08-29

## Context

The Eleventy site's visual design rests on a remotely fetched Obsidian theme: every build runs `get-theme`, which downloads `obsidian-baseline`'s `theme.css` from GitHub **HEAD** and writes it as `_theme.*.css`. The fetched file supplies 60+ CSS custom properties that `custom.scss` and the rest of the styling layer override and build upon.

The Astro rewrite's mandate is to keep the current design as-is, which makes this dependency the largest single parity threat:

- **Nondeterminism.** Fetching HEAD means the upstream author can push a change and the next deploy silently ships a different design, with no change in this repo.
- **Build fragility.** No network (or no GitHub) means no build.
- **Poor fit.** It is an Obsidian *application* theme; most of its rules target app chrome the website never renders. The site effectively uses it as a design-token sheet.

Options considered: keep the fetch as-is; pin the fetch to a commit SHA (fixes determinism, keeps the network dependency and the downstream-of-an-app-theme posture); vendor the fetched output verbatim; distill the needed tokens immediately during the migration. Immediate distillation was rejected because it changes the markup and the token sheet simultaneously — if something looks off during parity checking, there is no way to tell which layer drifted. The site is also dark-only with no ambition to track the Obsidian vault's theme, so there is no ongoing reason to stay coupled to upstream.

## Decision

Run the theme fetch one final time, commit the resulting CSS file into the repository verbatim, and delete the `get-theme` step and its `THEME` env plumbing. The Astro build loads the vendored file in the same cascade order the Eleventy build did. Today's exact rendered design becomes the frozen parity baseline.

Post-cutover (phase 2), distill the vendored file into a first-class, owned tokens file: extract only the custom properties and rules the site actually consumes, drop the light-theme half entirely, and verify the result with screenshot comparison against the vendored baseline.

## Consequences

**Positive**

- Builds are deterministic and work offline; upstream can no longer change the site's design silently.
- The parity baseline for the whole Astro migration is frozen in-repo, so HTML/screenshot diffs measure only our own changes.
- The `THEME` fetch plumbing (`get-theme` script, conditional `themeStyle` linking) can be deleted, simplifying the build.

**Negative / trade-offs**

- The repo carries dead weight — Obsidian app-chrome CSS the site never uses — until the phase-2 distillation lands.
- Upstream fixes and improvements to `obsidian-baseline` never arrive automatically; the design is permanently forked from the vault's theme (accepted explicitly: the site need not match the vault).
- The phase-2 distillation is now a required cleanup with real verification cost (screenshot comparison), not optional hygiene.

## Related

- ADR 0002 — sibling Astro-migration decision; both trade official/upstream machinery for owned, frozen artifacts to protect design and URL parity.
