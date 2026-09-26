import type { APIRoute } from "astro";
import { getPublishedPosts } from "../content/posts";
import { buildSearchIndex } from "../content/search-index";

export const GET = (async () => {
  const posts = await getPublishedPosts();
  return new Response(JSON.stringify(buildSearchIndex(posts)));
}) satisfies APIRoute;
