// Site-wide values that Eleventy read from `.env` through `src/site/_data/meta.js`.
// Astro pages import them directly; the live values are recorded here so the
// build does not depend on local environment files.
export const site = {
  name: "Thunks & Thoughts",
  url: "https://thunk.blog",
  lang: "en",
  // The feed's channel description (Home's description is still the vault
  // placeholder).
  description:
    "Thunks & Thoughts on engineering, life, and all that good stuff",
  // Note dates are written without a zone, in the author's local time.
  timeZone: "America/Chicago",
} as const;
