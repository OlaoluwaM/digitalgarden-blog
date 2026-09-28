import { getViteConfig } from "astro/config";

// Component tests render `.astro` files with Astro's Container API. That
// needs Astro's Vite pipeline, which plain `node --test` does not provide.
export default getViteConfig(
  {
    test: {
      include: ["test/components/**/*.test.ts"],
      environment: "node",
    },
  },
  // Vitest runs Vite as a dev server, so since Astro 7.3 the compiler
  // annotates every element with `data-astro-source-*` for the dev
  // toolbar. Tests compare markup as the build renders it, without them.
  { devToolbar: { enabled: false } }
);
