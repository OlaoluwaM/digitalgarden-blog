import { isHomePost } from "./home.ts";
import type { Post } from "./posts.ts";
import { parse } from "node-html-parser";

interface SearchIndexResult {
  title: string;
  url: string;
  tags: string[];
  content: string;
}

export function buildSearchIndex(posts: Post[]): SearchIndexResult[] {
  return posts.map(p => {
    const homePost = isHomePost(p);

    if (p.rendered?.html === undefined) {
      throw new Error(
        `Cannot index "${p.id}" for search: the post has no rendered HTML.`
      );
    }

    return {
      title: p.data.rawNoteProps.title,
      url: homePost ? "/" : p.data.pluginProps.permalink,
      tags: [...p.data.rawNoteProps.tags],
      content: parse(p.rendered.html, {
        blockTextElements: { script: true, style: true },
      })
        .structuredText.replace(/\s+/g, " ")
        .trim(),
    };
  });
}
