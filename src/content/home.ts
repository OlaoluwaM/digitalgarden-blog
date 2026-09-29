// Kept free of Astro runtime imports so Node scripts and tests can load it.
export const HOME_POST_TAG = "gardenEntry";

// The subset of a post needed to identify the garden entry.
export interface PostWithTopLevelTags {
  data: { pluginProps: { tags: string[] } };
}

export function isHomePost(post: PostWithTopLevelTags): boolean {
  return post.data.pluginProps.tags.includes(HOME_POST_TAG);
}
