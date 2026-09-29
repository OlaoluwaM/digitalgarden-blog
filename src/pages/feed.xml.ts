// /feed.xml: the RSS 2.0 feed (@astrojs/rss, ADR 0004) with each note's
// full content. Notes render through Astro's container so their optimized
// images resolve (a collection entry's `rendered.html` holds placeholders),
// and every site-relative URL becomes absolute: a feed reader is not on
// thunk.blog.
import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { render } from "astro:content";
import { parse } from "node-html-parser";
import {
  getListedPosts,
  getPublishedArticles,
  getPublishedPosts,
} from "../content/posts";
import { noteInstant } from "../lib/dates";
import { metaDescription } from "../lib/metadata";
import { site } from "../lib/site";

export const GET = (async () => {
  const container = await AstroContainer.create();
  const articles = getPublishedArticles(
    getListedPosts(await getPublishedPosts())
  );
  const items = await Promise.all(
    articles.map(async post => {
      const { title, description, tags, published } = post.data.rawNoteProps;
      const link = new URL(post.data.pluginProps.permalink, site.url);
      const { Content } = await render(post);
      return {
        title,
        link: link.href,
        pubDate: noteInstant(published, site.timeZone),
        description: metaDescription(description),
        categories: tags,
        content: withAbsoluteUrls(
          await container.renderToString(Content),
          link
        ),
      };
    })
  );

  return rss({
    title: site.name,
    description: site.description,
    site: site.url,
    items: items.toSorted((a, b) => b.pubDate.getTime() - a.pubDate.getTime()),
    xmlns: { atom: "http://www.w3.org/2005/Atom" },
    customData: [
      `<language>${site.lang}</language>`,
      `<atom:link href="${new URL("/feed.xml", site.url).href}" rel="self" type="application/rss+xml"/>`,
    ].join(""),
  });
}) satisfies APIRoute;

/** Resolve every link and image URL in `html` against the note's URL. */
function withAbsoluteUrls(html: string, base: URL): string {
  const root = parse(html);
  const resolve = (url: string) =>
    url.startsWith("#") ? url : new URL(url, base).href;
  for (const attribute of ["href", "src"]) {
    for (const element of root.querySelectorAll(`[${attribute}]`)) {
      const url = element.getAttribute(attribute);
      if (url !== undefined) element.setAttribute(attribute, resolve(url));
    }
  }
  for (const element of root.querySelectorAll("[srcset]")) {
    const srcset = element.getAttribute("srcset");
    if (srcset === undefined) continue;
    const candidates = srcset.split(",").map(candidate => {
      const [url = "", ...descriptor] = candidate.trim().split(/\s+/);
      return [resolve(url), ...descriptor].join(" ");
    });
    element.setAttribute("srcset", candidates.join(", "));
  }
  return root.toString();
}
