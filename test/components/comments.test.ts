/**
 * Component tests for `Comments.astro`, the "Comments & Discussion" section
 * at the end of a note (ADR 0008).
 *
 * Why this level: the section's contract is its markup in two states,
 * production (the giscus widget) and anywhere else (a note that comments
 * are off), and the Container API renders both without a build.
 * test/layout/comments.test.ts checks where it sits on built pages and what
 * readers see with and without JavaScript.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse, type HTMLElement } from "node-html-parser";
import { beforeAll, describe, expect, it } from "vitest";
import Comments from "../../src/components/Comments.astro";
import { giscus, giscusAttributes } from "../../src/lib/giscus.ts";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

async function render(enabled: boolean): Promise<HTMLElement> {
  return parse(
    await container.renderToString(Comments, {
      props: { enabled, term: "/posts/commented/" },
    })
  );
}

describe("Comments", () => {
  // Why: the section is a landmark readers and screen readers can jump to,
  // named by its visible heading.
  it("is a section named by its 'Comments & Discussion' heading", async () => {
    for (const enabled of [true, false]) {
      const section = (await render(enabled)).querySelector("section")!;
      const headingId = section.getAttribute("aria-labelledby");
      expect(headingId).toBeTruthy();
      const heading = section.querySelector(`#${headingId}`)!;
      expect(heading.tagName).toBe("H2");
      expect(heading.text.trim()).toBe("Comments & Discussion");
    }
  });

  // Why: in production the section loads giscus's script with the ADR's
  // settings; the script puts its iframe in the `.giscus` element.
  it("loads the giscus widget in production", async () => {
    const root = await render(true);
    const script = root.querySelector("script")!;
    expect(script.getAttribute("src")).toBe("https://giscus.app/client.js");
    expect(script.getAttribute("crossorigin")).toBe("anonymous");
    expect(script.hasAttribute("async")).toBe(true);
    // The thread is keyed on the note's permalink, passed in by the page.
    for (const [name, value] of Object.entries(
      giscusAttributes("/posts/commented/")
    )) {
      expect(script.getAttribute(name), name).toBe(value);
    }
    expect(root.querySelector(".giscus")).not.toBeNull();
  });

  // Why: without JavaScript there is no widget, but the section stays and
  // says so, with a way to the discussions. The message is hidden while
  // scripts run (`noscript:`), so readers with JavaScript never see it.
  it("tells readers without JavaScript how to take part", async () => {
    const message = (await render(true)).querySelector(
      "[data-comments-noscript]"
    )!;
    expect(message.text).toContain("Enable JavaScript to comment and react.");
    expect(message.querySelector("a")?.getAttribute("href")).toBe(
      giscus.categoryUrl
    );
    const classes = message.getAttribute("class")!.split(/\s+/);
    expect(classes).toContain("hidden");
    expect(classes.some(name => name.startsWith("noscript:"))).toBe(true);
  });

  // Why: outside production (previews, localhost) a comment would land in
  // the real thread, so there is no widget and no script at all, only a
  // note that comments load on thunk.blog.
  it("loads nothing outside production", async () => {
    const root = await render(false);
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector(".giscus")).toBeNull();
    expect(root.querySelector("[data-comments-noscript]")).toBeNull();
    expect(root.querySelector("[data-comments-off]")?.text.trim()).toBe(
      "Comments only load on thunk.blog."
    );
  });
});
