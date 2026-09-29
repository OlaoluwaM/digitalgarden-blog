/**
 * An `![[embed]]` as the Digital Garden plugin (2.94.1) publishes it: the
 * embedded note's Markdown between raw HTML blocks, byte for byte what its
 * `createTranscludedText` writes. No published note has one yet.
 */
export interface PublisherEmbed {
  /** The source note's URL (and `#fragment`); omitted for an unpublished note. */
  href?: string;
  /** The header line from `![[Note|Title]]`, e.g. "# Title"; omitted without one. */
  title?: string;
  /** The embedded Markdown. */
  body: string;
}

const LINK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';

export function publisherEmbed({ href, title, body }: PublisherEmbed): string {
  const link =
    href === undefined
      ? ""
      : `<a class="markdown-embed-link" href="${href}" aria-label="Open link">${LINK_ICON}</a>`;
  const header =
    title === undefined
      ? ""
      : `<div class="markdown-embed-title">\n\n${title}\n\n</div>\n`;
  return `\n<div class="transclusion internal-embed is-loaded">${link}<div class="markdown-embed">\n\n${header}\n\n${body}\n\n</div></div>\n`;
}
