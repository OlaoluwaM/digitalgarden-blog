/**
 * Component tests for `PostFooter.astro`, the static social call-to-action
 * footer Eleventy renders identically on every post.
 *
 * Why this level: there are no props and no branching, so the component's
 * entire contract is its literal output; Astro's Container API renders it
 * without building the site.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";
import { beforeAll, describe, expect, it } from "vitest";
import PostFooter from "../../src/components/PostFooter.astro";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

describe("PostFooter", () => {
  // Why: pins the footer to the exact live markup (tag, class, and full copy)
  // so a rewording or a dropped sentence is caught immediately, not noticed
  // only on a visual diff against thunk.blog.
  it("renders the live footer markup exactly, whitespace normalized", async () => {
    const html = await container.renderToString(PostFooter, {});
    const normalized = html.replace(/\s+/g, " ").trim();
    expect(normalized).toBe(
      '<footer class="post-cta"><p>That\'s all folks. If you like what you see, ' +
        'feel free to connect with me on <a href="https://www.linkedin.com/in/olaoluwam/" ' +
        'target="_blank" rel="noopener noreferrer">LinkedIn</a> or follow me on ' +
        '<a href="https://x.com/ola_musta" target="_blank" rel="noopener noreferrer">X</a> or ' +
        '<a href="https://bsky.app/profile/olamusta.bsky.social" target="_blank" ' +
        'rel="noopener noreferrer">Bluesky</a>. I also stream sometimes @ola_musta on ' +
        '<a href="https://www.twitch.tv/ola_musta" target="_blank" rel="noopener noreferrer">Twitch</a> ' +
        'and <a href="https://www.youtube.com/@ola_musta" target="_blank" ' +
        'rel="noopener noreferrer">Youtube</a> too!</p></footer>'
    );
  });

  // Why: every outbound link must open in a new tab with `noopener noreferrer`
  // (the live site's leak/tab-nabbing protection); a per-link check catches a
  // single missed attribute that the whole-string check above could still
  // pass if two unrelated typos happened to cancel out in the join.
  it("opens every social link safely in a new tab", async () => {
    const html = await container.renderToString(PostFooter, {});
    const links = parse(html).querySelectorAll("footer.post-cta a");
    expect(links).toHaveLength(5);
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
    expect(links.map(a => a.getAttribute("href"))).toEqual([
      "https://www.linkedin.com/in/olaoluwam/",
      "https://x.com/ola_musta",
      "https://bsky.app/profile/olamusta.bsky.social",
      "https://www.twitch.tv/ola_musta",
      "https://www.youtube.com/@ola_musta",
    ]);
  });
});
