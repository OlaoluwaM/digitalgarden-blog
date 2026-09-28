# Dependency patches

`npm install` and `npm ci` run `patch-package --error-on-fail` through
`postinstall`. Install development dependencies for this build project; they
include `patch-package`. An unapplicable patch must fail the install.

`npm run dev` and `npm run build` reapply the patches first (`patch-dependencies`),
because npm 11 can skip `postinstall` scripts and silently drop a patch.
Reapplying an applied patch is a no-op.

## Astro 7.2.9

### Propagate Markdown rendering errors

`astro+7.2.9.patch` removes the catch around eager Markdown rendering in
`dist/content/loaders/glob.js`. Errors now reject content sync before the failed
entry is stored. The existing watcher handler still catches reload errors.
Successful renders keep Astro's default caching; `deferRender` is not needed.

### Decode image attributes once

The patch also fixes image-marker decoding in `dist/content/runtime.js` and
`dist/vite-plugin-markdown/images.js`. Astro previously decoded only quotes
before parsing the marker's JSON, leaving `&amp;` in attribute values. Rendering
escaped that ampersand again, producing `&amp;amp;` in the final HTML.

Both paths now use Astro's existing `html-escaper` decoder after normalizing
hexadecimal quotes. Decoding happens once, so intended literal text such as
`&quot;` stays literal. Final attribute escaping remains in place.

The build regression covers alt and title text on both collection pages and
ordinary Markdown pages, including ampersands, quotes, apostrophes, angle
brackets, and literal character references.

### Maintenance

Astro is pinned to 7.2.9 while this patch is required. After applying the patch
to an existing installation, force one build to discard any entries cached
before the fix:

```sh
npm run test:images-build
npm run build
```

For upstream PRs, port these fixes separately to Astro's source and test suite:

- Rendering errors: `packages/astro/src/content/loaders/glob.ts`.
- Image attributes: `packages/astro/src/content/runtime.ts` and
  `packages/astro/src/vite-plugin-markdown/images.ts`.

Once an Astro release contains both fixes, upgrade Astro and remove this patch.
If no other patches remain, also remove `patch-package` and `postinstall`.
