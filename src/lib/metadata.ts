import { site } from "./site.ts";

const PLACEHOLDER = /^placeholder\b/i;

/**
 * The meta description to publish for a note, or undefined for none.
 *
 * Vault placeholders ("PLACEHOLDER: reword me") and blank values are
 * omitted, so a note starts publishing its description once it is written.
 */
export function metaDescription(description: string): string | undefined {
  const trimmed = description.trim();
  return trimmed === "" || PLACEHOLDER.test(trimmed) ? undefined : trimmed;
}

/** The absolute canonical URL for a root-relative route such as `/posts/x/`. */
export function canonicalUrl(route: string): string {
  if (!route.startsWith("/") || route.startsWith("//")) {
    throw new Error(`Cannot build a canonical URL for "${route}".`);
  }
  return new URL(route, site.url).href;
}
