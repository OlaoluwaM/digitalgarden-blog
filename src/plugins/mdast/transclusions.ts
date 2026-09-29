import { slug } from "github-slugger";
import type { Html, Nodes, RootContent } from "mdast";
import { defineMdastPlugin } from "satteri";
import { EMBEDDED_HEADINGS } from "../../content/table-of-contents.ts";
import type {
  NoteTitles,
  WikilinkIndex,
} from "../../generated/wikilink-index.ts";

// The Digital Garden plugin inlines each `![[embed]]` when it publishes, as
// Markdown between raw HTML blocks (Digital Garden 2.94.1):
//
//   <div class="transclusion internal-embed is-loaded"><a class="markdown-embed-link" href="/note/#Heading" aria-label="Open link">svg</a><div class="markdown-embed">
//
//   <div class="markdown-embed-title">      only for ![[Note|Title]]
//
//   # Title
//
//   </div>
//
//   …the embedded Markdown…
//
//   </div></div>
//
// The link is there only when the embedded note is published. This plugin
// turns that into the source card the stylesheet draws: the title becomes a
// label, not a second h1 in the page's outline; an embed without a title is
// labelled "From <note title>"; the link is named for its note instead of "Open
// link"; and a heading fragment is re-slugged to match the embedded
// heading's ID.

const EMBED_OPENING = '<div class="transclusion internal-embed is-loaded">';
const TITLE_OPENING = '<div class="markdown-embed-title">';
const TITLE_CLOSING = "</div>";
const EMBED_CLOSING = "</div></div>";
const EMBED_LINK =
  /<a class="markdown-embed-link" href="([^"#]*)(#[^"]*)?" aria-label="Open link"><svg /;

export const mkmdastTransclusionsPlugin = (
  wikilinkIndex: WikilinkIndex,
  noteTitles: NoteTitles
) => {
  const titles = titlesByUrl(wikilinkIndex, noteTitles);

  return defineMdastPlugin({
    name: "mdast-transclusions",

    html(node, ctx) {
      if (!node.value.startsWith(EMBED_OPENING)) return;

      const siblings = ctx.parent(node).children;
      const index = ctx.indexOf(node) ?? 0;
      const hasTitle = isTitleOpening(siblings[index + 1]);
      // The embedded Markdown starts after the title's three nodes.
      const firstContent = siblings[index + (hasTitle ? 4 : 1)];

      const link = EMBED_LINK.exec(node.value);
      if (!link) return;
      const [, path = "", fragment] = link;
      const title = titles.get(path);

      // The publisher slugs `#Heading` its own way (`#My-Heading`); the site
      // gives the heading github-slugger's ID (`my-heading`). A section embed
      // starts with that heading, so its text gives the ID the note uses.
      const href =
        fragment && firstContent?.type === "heading"
          ? `${path}#${slug(ctx.textContent(firstContent))}`
          : `${path}${fragment ?? ""}`;
      const label = title ? `Open ${title}` : "Open the embedded note";
      let value = node.value.replace(
        link[0],
        `<a class="markdown-embed-link" href="${href}" aria-label="${escapeHtml(label)}"><svg aria-hidden="true" `
      );

      if (!hasTitle && title) {
        value += `<div class="markdown-embed-title"><p><span class="markdown-embed-from">From </span>${escapeHtml(title)}</p></div>`;
      }
      return { ...node, value };
    },

    heading(node, ctx) {
      const siblings = ctx.parent(node).children;
      const index = ctx.indexOf(node) ?? 0;
      if (
        !isTitleOpening(siblings[index - 1]) ||
        !isHtml(siblings[index + 1], TITLE_CLOSING)
      ) {
        return;
      }
      // A label, not a heading: the page keeps one h1, and the title stays
      // out of the note's outline and table of contents.
      return { type: "paragraph", children: node.children };
    },
  });
};

/**
 * Record which headings belong to embedded notes, by their position in the
 * note's headings, for the table of contents to leave out (Astro's
 * `headings` hold only a heading's level, ID, and text). Positions, because
 * a heading's text can repeat and its ID is assigned later. Register it
 * after every plugin that adds or removes headings (the transclusion
 * plugin turns embed titles into labels; admonitions can hold headings),
 * so its count matches the headings Astro collects.
 */
export const mdastEmbeddedHeadingsPlugin = defineMdastPlugin({
  name: "mdast-embedded-headings",

  before(root, ctx) {
    const astro = (
      ctx.data as { astro?: { frontmatter: Record<string, unknown> } }
    ).astro;
    if (!astro) return;

    const positions: number[] = [];
    let headingCount = 0;
    // How many embeds enclose the current node: the publisher writes an
    // embed's start and end as separate HTML blocks around its Markdown.
    let embedDepth = 0;
    const visit = (node: Nodes) => {
      if (node.type === "html") {
        if (node.value.startsWith(EMBED_OPENING)) embedDepth += 1;
        else if (embedDepth > 0 && node.value.trim() === EMBED_CLOSING) {
          embedDepth -= 1;
        }
      } else if (node.type === "heading") {
        if (embedDepth > 0) positions.push(headingCount);
        headingCount += 1;
      }
      if ("children" in node) node.children.forEach(visit);
    };
    visit(root);

    if (positions.length > 0) astro.frontmatter[EMBEDDED_HEADINGS] = positions;
  },
});

/**
 * Each published page's note title (its frontmatter title, as the page
 * header shows it), by URL.
 */
function titlesByUrl(
  wikilinkIndex: WikilinkIndex,
  noteTitles: NoteTitles
): Map<string, string> {
  const titles = new Map<string, string>();
  for (const [target, url] of Object.entries(wikilinkIndex)) {
    const title = noteTitles[target];
    if (url === undefined || title === undefined || titles.has(url)) continue;
    titles.set(url, title);
  }
  return titles;
}

function isTitleOpening(node: RootContent | undefined): boolean {
  return isHtml(node, TITLE_OPENING);
}

function isHtml(node: RootContent | undefined, value: string): node is Html {
  return node?.type === "html" && node.value.trim() === value;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
