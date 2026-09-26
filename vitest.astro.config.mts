import { getViteConfig } from "astro/config";

// Component tests render `.astro` files with Astro's Container API. That
// needs Astro's Vite pipeline, which plain `node --test` does not provide.
export default getViteConfig({
  test: {
    include: ["test/components/**/*.test.ts"],
    environment: "node",
  },
});
