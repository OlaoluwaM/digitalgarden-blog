import { getCollection, type CollectionEntry } from "astro:content";
import { assertUniquePermalinks } from "./permalinks.ts";

type Post = CollectionEntry<"posts">;

const DEFAULT_LIMIT = 3;

export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection("posts");
  const publishedPosts = posts.filter(p => {
    const shouldBePublished = p.data.pluginProps["dg-publish"];
    return shouldBePublished;
  });

  assertUniquePermalinks(publishedPosts);
  return publishedPosts;
}

export function getHomePost(posts: Post[]): Post {
  const homePosts = posts.filter(isHomePost);
  const multipleHomePosts = homePosts.length > 1;

  if (multipleHomePosts) {
    throw new Error(
      "There should only be one post with a top-level tag including 'gardenEntry'"
    );
  }

  if (homePosts.length === 0) {
    throw new Error(
      "No post with a top-level tag including 'gardenEntry'. This should be fixed "
    );
  }

  const [homePost] = homePosts;

  return homePost;
}

// Articles are posts excluding the home post
export function getPublishedArticles(posts: Post[]): Post[] {
  return posts.filter(p => !isHomePost(p));
}

export function getRecentArticles(
  posts: Post[],
  limit: number = DEFAULT_LIMIT
): Post[] {
  const articles = getPublishedArticles(posts);
  // Validate every article, even when there are too few entries to sort.
  const datedArticles = articles.map(article => ({
    article,
    publishedAt: toEpochTimestamp(article.data.rawNoteProps.published),
  }));
  const articlesSortedByRecency = datedArticles.toSorted(
    (a, b) => b.publishedAt - a.publishedAt
  );
  return take(articlesSortedByRecency, limit).map(({ article }) => article);
}

/* -------------------------------------------------------------------------- */
/*                                 // Helpers                                 */
/* -------------------------------------------------------------------------- */

function isHomePost(post: Post): boolean {
  return post.data.pluginProps.tags.includes("gardenEntry");
}

/* -------------------------------------------------------------------------- */
/*                                  // Utils                                  */
/* -------------------------------------------------------------------------- */
function toEpochTimestamp(date: string): number {
  const timestamp = Date.parse(date);

  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid date: ${date}`);
  }

  return timestamp;
}

function take<A>(arr: A[], limit: number): A[] {
  return arr.slice(0, Math.max(0, limit));
}

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values
function getRandomInt(min: number, max: number): number {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}
