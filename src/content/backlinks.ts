import { parse } from "node-html-parser";
import { isHiddenPost } from "./hidden.ts";
import { isHomePost } from "./home.ts";
import type { Post } from "./posts.ts";

// The notes that link to a note, for its "Mentioned in" list. They come
// from each note's rendered HTML, where every wikilink, Markdown link, and
// embed has already resolved to a permalink, so this agrees with what the
// reader can click.
//
// Which links count:
//   - links on the site (`href` starting with `/`) to the note's permalink,
//     with or without a heading fragment;
//   - an embed's link to its source note (`a.markdown-embed-link`), since
//     the embedding note shows that note;
//   - not links inside an embed's content, which belong to the embedded
//     note, not the one embedding it.
// Which notes list:
//   - not the note itself, Home (it links to what it lists), or a hidden
//     post (`dg-hide`), which only a direct link should reach.

/** Map each permalink to the notes that link to it, newest first. */
export function buildBacklinks(posts: readonly Post[]): Map<string, Post[]> {
  const byPermalink = new Map(
    posts.map(post => [post.data.pluginProps.permalink, post])
  );
  const backlinks = new Map<string, Post[]>();

  const sources = posts
    .filter(post => !isHomePost(post) && !isHiddenPost(post))
    .toSorted((a, b) => publishedAt(b) - publishedAt(a));

  for (const source of sources) {
    const own = source.data.pluginProps.permalink;
    for (const target of linkedPermalinks(source)) {
      if (target === own || !byPermalink.has(target)) continue;
      const list = backlinks.get(target) ?? [];
      list.push(source);
      backlinks.set(target, list);
    }
  }
  return backlinks;
}

/** The permalinks a note links to, each once. */
function linkedPermalinks(post: Post): Set<string> {
  const html = post.rendered?.html;
  if (html === undefined) {
    throw new Error(
      `Cannot find the links in "${post.id}": the post has no rendered HTML.`
    );
  }
  const permalinks = new Set<string>();
  for (const link of parse(html).querySelectorAll("a[href]")) {
    if (link.closest(".markdown-embed")) continue;
    const href = link.getAttribute("href") ?? "";
    if (!href.startsWith("/")) continue;
    const path = href.replace(/[?#].*$/, "");
    permalinks.add(path.endsWith("/") ? path : `${path}/`);
  }
  return permalinks;
}

function publishedAt(post: Post): number {
  const time = Date.parse(post.data.rawNoteProps.published);
  if (Number.isNaN(time)) {
    throw new Error(
      `Invalid date: ${post.data.rawNoteProps.published} in "${post.id}"`
    );
  }
  return time;
}
