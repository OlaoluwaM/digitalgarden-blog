import { site } from "./site.ts";

/**
 * The meta description to publish for a note, or undefined for none.
 *
 * Blank values are omitted.
 */
export function metaDescription(description: string): string | undefined {
  const trimmed = description.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** The absolute canonical URL for a root-relative route such as `/posts/x/`. */
export function canonicalUrl(route: string): string {
  if (!route.startsWith("/") || route.startsWith("//")) {
    throw new Error(`Cannot build a canonical URL for "${route}".`);
  }
  return new URL(route, site.url).href;
}
