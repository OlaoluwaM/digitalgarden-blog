# Dependency patches

`npm install` and `npm ci` run `patch-package --error-on-fail` through
`postinstall`. Install development dependencies for this build project; they
include `patch-package`. An unapplicable patch must fail the install.

## Astro 7.2.9: propagate Markdown rendering errors

`astro+7.2.9.patch` removes the catch around eager Markdown rendering in
`dist/content/loaders/glob.js`. Errors now reject content sync before the failed
entry is stored. The existing watcher handler still catches reload errors.
Successful renders keep Astro's default caching; `deferRender` is not needed.

Astro is pinned to 7.2.9 while this patch is required. After applying the patch
to an existing installation, force one build to discard any entries cached
before the fix:

```sh
npm run test:images-build
npm run build:astro -- --force
```

For the upstream PR, apply the same change to
`packages/astro/src/content/loaders/glob.ts` and add a regression test in Astro's
test suite. The local build test proves that valid content builds and that a
missing image fails with the image URL and note path in the diagnostic.

Once an Astro release contains the fix, upgrade Astro and remove this patch.
If no other patches remain, also remove `patch-package` and `postinstall`.
