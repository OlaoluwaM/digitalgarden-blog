// Site-wide values that Eleventy read from `.env` through `src/site/_data/meta.js`.
// Astro pages import them directly; the live values are recorded here so the
// build does not depend on local environment files.
export const site = {
  name: "Thunks & Thoughts",
  url: "https://thunk.blog",
  lang: "en",
} as const;
