# Dependency patches

`npm install` and `npm ci` run `patch-package --error-on-fail` through
`postinstall`. Install development dependencies for this build project; they
include `patch-package`. An unapplicable patch must fail the install.

`npm run dev` and `npm run build` reapply the patches first (`patch-dependencies`),
because npm 11 can skip `postinstall` scripts and silently drop a patch.
Reapplying an applied patch is a no-op.

## Astro 7.3.5

### Propagate Markdown rendering errors

`astro+7.3.5.patch` removes the catch around eager Markdown rendering in
`dist/content/loaders/glob.js`. Errors now reject content sync before the failed
entry is stored. The existing watcher handler still catches reload errors.
Successful renders keep Astro's default caching; `deferRender` is not needed.
Upstream: [#18054](https://github.com/withastro/astro/issues/18054).

The image-attribute decoding fix this patch used to carry shipped in Astro
7.3.x ([#18070](https://github.com/withastro/astro/issues/18070)). The build
regression in `test/images-build.test.ts` still covers alt and title text with
ampersands, quotes, apostrophes, angle brackets, and literal character
references.

### Maintenance

Astro is pinned to 7.3.5 while this patch is required. After applying the patch
to an existing installation, force one build to discard any entries cached
before the fix:

```sh
npm run test:images-build
npm run build
```

For an upstream PR, port the fix to
`packages/astro/src/content/loaders/glob.ts` and its test suite.

Once an Astro release contains the fix, upgrade Astro and remove this patch.
If no other patches remain, also remove `patch-package` and `postinstall`.
