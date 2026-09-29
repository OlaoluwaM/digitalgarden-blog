/**
 * Component tests for `Icon.astro`, which renders Lucide icons at build time
 * instead of calling `lucide.createIcons()` in the browser as Eleventy did.
 *
 * Why this level: the component's output is its whole contract, and Astro's
 * Container API renders it in isolation without building the site.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";
import { beforeAll, describe, expect, it } from "vitest";
import Icon from "../../src/components/Icon.astro";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

async function renderIcon(props: Record<string, unknown>) {
  const html = await container.renderToString(Icon, { props });
  const svg = parse(html).querySelector("svg");
  expect(svg).not.toBeNull();
  return svg!;
}

describe("Icon", () => {
  // Why: the legacy CSS targets `.svg-icon`, `.lucide`, and
  // `.lucide-<name>` (for example `.callout-fold .lucide-chevron-down`), and
  // the live SVGs carry these exact presentation attributes. Matching them
  // keeps icon sizing and stroke identical to the live site.
  it("renders the same element Lucide's createIcons produced on the live site", async () => {
    const svg = await renderIcon({ name: "calendar-plus" });
    expect(svg.attributes).toMatchObject({
      xmlns: "http://www.w3.org/2000/svg",
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "data-lucide": "calendar-plus",
      "aria-hidden": "true",
    });
    expect(svg.classList.value).toEqual([
      "lucide",
      "lucide-calendar-plus",
      "svg-icon",
    ]);
  });

  // Why: the pinned `lucide` package must draw the same shape the live site
  // shows. These are the first paths of `calendar-plus` as served live today.
  it("draws the icon's paths from the pinned Lucide package", async () => {
    const svg = await renderIcon({ name: "calendar-plus" });
    const paths = svg.querySelectorAll("path").map(p => p.getAttribute("d"));
    expect(paths.slice(0, 3)).toEqual(["M16 18h6", "M16 2v3", "M19 15v6"]);
  });

  // Why: callers add their own classes (for example a fold chevron); these
  // must add to the Lucide classes, not replace them.
  it("appends extra classes after the Lucide classes", async () => {
    const svg = await renderIcon({ name: "search", class: "search-icon" });
    expect(svg.classList.value).toEqual([
      "lucide",
      "lucide-search",
      "svg-icon",
      "search-icon",
    ]);
  });

  // Why: kebab-case names with several words must map to Lucide's PascalCase
  // exports. A wrong mapping would throw or render the wrong icon.
  it("maps multi-word kebab-case names to Lucide exports", async () => {
    const svg = await renderIcon({ name: "chevron-down" });
    expect(svg.getAttribute("data-lucide")).toBe("chevron-down");
    expect(svg.querySelectorAll("path, polyline").length).toBeGreaterThan(0);
  });

  // Why: an icon name typo should fail the build with the name in the
  // message, not ship an empty or missing icon.
  it("fails on unknown icon names", async () => {
    await expect(renderIcon({ name: "not-a-real-icon" })).rejects.toThrow(
      /not-a-real-icon/
    );
  });
});
