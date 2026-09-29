/**
 * The environment for an `astro build` the tests start: the test process's
 * own, without the names Vite and Astro reserve for `import.meta.env`.
 *
 * On the server, Astro reads `import.meta.env.X` from the process
 * environment, so a shell variable with a reserved name leaks into the
 * build. A `DEV` set in a developer's shell (a path, so truthy) made local
 * builds emit Astro's dev-only `data-image-component` attribute, and the
 * feed snapshot recorded locally then failed on CI, where `DEV` is unset.
 */
const RESERVED = [
  "MODE",
  "BASE_URL",
  "PROD",
  "DEV",
  "SSR",
  "SITE",
  "ASSETS_PREFIX",
];

export function buildEnv(
  extra: Record<string, string> = {}
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries({ ...process.env, ...extra }).filter(
      ([name]) => !RESERVED.includes(name)
    )
  );
}
