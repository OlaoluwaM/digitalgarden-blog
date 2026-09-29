import { z } from "astro/zod";
import { HOME_POST_TAG } from "./home.ts";

// The subset of a published post needed for route validation.
export interface PostWithPermalink {
  id: string;
  data: {
    pluginProps: {
      permalink: string;
      tags: readonly string[];
    };
  };
}

// Validate permalink paths without rewriting the supplied value.
export const permalinkSchema = z
  .string()
  .refine(isValidPermalink, { error: "Invalid permalink path" });

function isValidPermalink(value: string): boolean {
  // Accept / by itself, or paths such as /posts/version-2.0/.
  // Require / at the start and between nonempty parts; the final / is optional.
  // The first check rejects parts that are exactly . or .., as in /posts/../x.
  // Each part can contain dots, hyphens and these Unicode character groups:
  //   Ll: lowercase letters; Lm: letters that modify others, such as ʰ;
  //   Lo: other letters, such as 中; Nd: decimal digits.
  // The u flag lets the \p{...} checks recognize these Unicode groups.
  // (?![\s\S]) checks that nothing follows the path, even a newline.
  // Using $ alone would also allow a match just before a final newline.
  const PERMALINK_REGEX =
    /^(?!.*\/\.{1,2}(?:\/|$))\/(?:[\p{Ll}\p{Lm}\p{Lo}\p{Nd}.-]+(?:\/[\p{Ll}\p{Lm}\p{Lo}\p{Nd}.-]+)*\/?)?(?![\s\S])/u;

  return PERMALINK_REGEX.test(value);
}

// Routes the site's own pages claim, without the trailing slash: the files
// in src/pages (except Home and the note route), and the dev-only style
// guide and sitemap files that astro.config.ts adds. A note's URL comes from its
// permalink, not its title, so only a permalink can collide with them.
export const PAGE_ROUTES: readonly string[] = [
  "/404",
  "/feed.xml",
  "/random",
  "/robots.txt",
  "/searchIndex.json",
  "/sitemap-0.xml",
  "/sitemap-index.xml",
  "/style-guide",
];

// Call with published posts. A gardenEntry claims / regardless of its permalink.
// Paths differing only by a trailing slash claim the same route.
// Reject collisions with an error naming the route and both post IDs, and
// notes at a page's route with an error naming the route and the note.
export function assertUniquePermalinks(
  posts: readonly PostWithPermalink[]
): void {
  const postsByRoute = Map.groupBy(posts, post => {
    const { permalink, tags } = post.data.pluginProps;

    if (tags.includes(HOME_POST_TAG) || permalink === "/") {
      return "/";
    }

    return permalink.replace(/\/+$/, "");
  });

  const collisions: string[] = [];
  for (const [route, matchingPosts] of postsByRoute) {
    const postIds = matchingPosts.map(post => post.id).join(", ");

    if (PAGE_ROUTES.includes(route)) {
      collisions.push(`Route "${route}" belongs to a site page: ${postIds}`);
    } else if (matchingPosts.length > 1) {
      collisions.push(`Duplicate route "${route}": ${postIds}`);
    }
  }

  if (collisions.length > 0) {
    throw new Error(collisions.join("\n"));
  }
}
