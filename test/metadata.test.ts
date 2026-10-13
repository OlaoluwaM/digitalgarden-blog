/**
 * Unit tests for the page metadata helpers. They decide what search engines
 * and link previews see, so the rules are pinned where they are cheapest to
 * test: in pure functions, without building the site.
 */
import assert from "node:assert/strict";
import { it } from "node:test";
import { canonicalUrl, metaDescription } from "../src/lib/metadata.ts";

// Why: notes carry a real `description` property; it replaces the old
// behavior of repeating the title as the meta description.
it("uses a note's description as written", () => {
  assert.equal(metaDescription("Endian deez nuts"), "Endian deez nuts");
});

// Why: an empty `content` attribute gives search engines nothing to show
// and stops them from writing their own snippet.
it("omits empty and blank descriptions", () => {
  assert.equal(metaDescription(""), undefined);
  assert.equal(metaDescription("   "), undefined);
});

// Why: surrounding whitespace from frontmatter should not reach the meta tag.
it("trims surrounding whitespace", () => {
  assert.equal(
    metaDescription("  To Nix or not to Nix \n"),
    "To Nix or not to Nix"
  );
});

// Why: canonical URLs must be absolute and keep the trailing slash of the
// published routes, or search engines see two URLs for one page.
it("builds absolute canonical URLs on the site origin", () => {
  assert.equal(canonicalUrl("/"), "https://thunk.blog/");
  assert.equal(
    canonicalUrl("/posts/be-deliberate/"),
    "https://thunk.blog/posts/be-deliberate/"
  );
});

// Why: a route that is not root-relative indicates a bug in the caller; it
// must fail loudly instead of producing a wrong canonical URL.
it("rejects routes that are not root-relative", () => {
  assert.throws(
    () => canonicalUrl("posts/be-deliberate/"),
    /posts\/be-deliberate\//
  );
  assert.throws(() => canonicalUrl("https://example.com/"), /example\.com/);
});
