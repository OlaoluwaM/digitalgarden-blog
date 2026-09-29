// Kept free of Astro runtime imports so Node scripts and tests can load it.

// The subset of a post needed to tell whether it is hidden.
export interface PostWithHideFlag {
  data: { pluginProps: { hide?: boolean | undefined } };
}

/**
 * Whether the vault note sets `dg-hide: true` (published as `hide`). A
 * hidden post is published but reachable only by a direct link: the file
 * tree, Recent Posts, search, the feed, the sitemap, and `/random/` leave
 * it out, and its page asks search engines not to index it.
 */
export function isHiddenPost(post: PostWithHideFlag): boolean {
  return post.data.pluginProps.hide === true;
}
