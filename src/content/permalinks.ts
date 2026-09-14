import { z } from "astro/zod";

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

// Call with published posts. A gardenEntry claims / regardless of its permalink.
// Paths differing only by a trailing slash claim the same route.
// Reject collisions with an error naming the route and both post IDs.
export function assertUniquePermalinks(
  posts: readonly PostWithPermalink[]
): void {
  const postsByRoute = Map.groupBy(posts, post => {
    const { permalink, tags } = post.data.pluginProps;

    if (tags.includes("gardenEntry") || permalink === "/") {
      return "/";
    }

    return permalink.replace(/\/+$/, "");
  });

  const collisions: string[] = [];
  for (const [route, matchingPosts] of postsByRoute) {
    if (matchingPosts.length < 2) continue;

    const postIds = matchingPosts.map(post => post.id).join(", ");
    collisions.push(`Duplicate route "${route}": ${postIds}`);
  }

  if (collisions.length > 0) {
    throw new Error(collisions.join("\n"));
  }
}
