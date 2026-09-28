import { getCollection, type CollectionEntry } from "astro:content";
import { assertUniquePermalinks } from "./permalinks.ts";
import { isHomePost } from "./home.ts";

export type Post = CollectionEntry<"posts">;

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
  const [homePost, ...otherHomePosts] = posts.filter(isHomePost);
  const multipleHomePosts = otherHomePosts.length > 0;

  if (multipleHomePosts) {
    throw new Error(
      "There should only be one post with a top-level tag including 'gardenEntry'"
    );
  }

  if (!homePost) {
    throw new Error(
      "No post with a top-level tag including 'gardenEntry'. This should be fixed "
    );
  }

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
