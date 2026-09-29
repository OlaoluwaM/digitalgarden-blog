/**
 * Exercise the plugin through Astro's Satteri processor, including its local
 * image collector and HTML markers. This does not build optimized image files.
 * Fixture contents are placeholders because this step only resolves paths.
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";
import { parse } from "node-html-parser";

import { mkmdastDigitalGardenImagesPlugin } from "../src/plugins/mdast/images.ts";
import { mkmdastAdmonitionCalloutPlugin } from "../src/plugins/mdast/admonitions.ts";
import { hastAdmonitionCalloutPlugin } from "../src/plugins/hast/callout.ts";

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "images-plugin-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const imageDirectory = join(root, "src/site/img/user");
  const notePath = join(root, "src/site/notes/Outbox/Post.md");
  await mkdir(imageDirectory, { recursive: true });
  await mkdir(dirname(notePath), { recursive: true });
  for (const name of ["photo.png", "My Photo.png", "diagram.svg"]) {
    await writeFile(join(imageDirectory, name), "Image placeholder.\n");
  }
  const processor = await createSatteriMarkdownProcessor({
    syntaxHighlight: false,
    mdastPlugins: [
      mkmdastAdmonitionCalloutPlugin({}),
      mkmdastDigitalGardenImagesPlugin(imageDirectory),
    ],
    hastPlugins: [hastAdmonitionCalloutPlugin],
  });

  return {
    processor,
    notePath,
    render: (markdown: string, filePath = notePath) =>
      processor.render(markdown, { fileURL: pathToFileURL(filePath) }),
  };
}

function imageMarker(html: string, selector = "img") {
  const image = parse(html).querySelector(selector);
  assert.ok(image, `Expected ${selector} in ${html}`);
  const marker = image.getAttribute("__ASTRO_IMAGE_");
  assert.ok(marker, "Expected Astro to mark the image for asset processing");
  return JSON.parse(marker) as { src: string; alt: string; title?: string };
}

describe("mkmdastDigitalGardenImagesPlugin", () => {
  it("registers a local asset and preserves alt text and title", async t => {
    const { render } = await fixture(t);
    const result = await render(
      '![A & B](/img/user/photo.png "An image title")'
    );
    assert.deepEqual(result.metadata.localImagePaths, [
      "../../img/user/photo.png",
    ]);
    const marker = imageMarker(result.code);
    assert.equal(marker.src, "../../img/user/photo.png");
    assert.equal(marker.alt, "A & B");
    assert.equal(marker.title, "An image title");
  });

  it("preserves an empty alt attribute", async t => {
    const { render } = await fixture(t);
    const result = await render("![](/img/user/photo.png)");
    assert.equal(imageMarker(result.code).alt, "");
  });

  it("passes encoded filenames through Astro's decoding step", async t => {
    const { render } = await fixture(t);
    const result = await render("![Photo](/img/user/My%20Photo.png)");
    assert.deepEqual(result.metadata.localImagePaths, [
      "../../img/user/My Photo.png",
    ]);
    assert.equal(imageMarker(result.code).src, "../../img/user/My Photo.png");
  });

  it("collects local SVG images", async t => {
    const { render } = await fixture(t);
    const result = await render("![Diagram](/img/user/diagram.svg)");
    assert.deepEqual(result.metadata.localImagePaths, [
      "../../img/user/diagram.svg",
    ]);
    assert.equal(imageMarker(result.code).alt, "Diagram");
  });

  it("uses each note's file URL when a processor is reused", async t => {
    const { render, notePath } = await fixture(t);
    const markdown = "![Photo](/img/user/photo.png)";
    const first = await render(markdown);
    const second = await render(
      markdown,
      join(dirname(notePath), "Deep/Post.md")
    );
    assert.deepEqual(first.metadata.localImagePaths, [
      "../../img/user/photo.png",
    ]);
    assert.deepEqual(second.metadata.localImagePaths, [
      "../../../img/user/photo.png",
    ]);
  });

  for (const [name, markdown, selector] of [
    [
      "native callouts",
      "> [!note]\n>\n> ![Photo](/img/user/photo.png)",
      ".callout-content img",
    ],
    [
      "admonition fences",
      "```ad-note\n![Photo](/img/user/photo.png)\n```",
      ".callout-content img",
    ],
    [
      "nested admonitions",
      "`````ad-note\n```ad-aside\n![Photo](/img/user/photo.png)\n```\n`````",
      ".callout .callout img",
    ],
  ]) {
    it(`resolves images inside ${name}`, async t => {
      const { render } = await fixture(t);
      const result = await render(markdown);
      assert.deepEqual(result.metadata.localImagePaths, [
        "../../img/user/photo.png",
      ]);
      const marker = imageMarker(result.code, selector);
      assert.equal(marker.src, "../../img/user/photo.png");
      assert.equal(marker.alt, "Photo");
    });
  }

  it("reports a missing image with the original URL and containing note", async t => {
    const { render, notePath } = await fixture(t);
    await assert.rejects(render("![Missing](/img/user/missing.png)"), error => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes("/img/user/missing.png"));
      assert.ok(error.message.includes(notePath));
      return true;
    });
  });

  it("reports a missing note URL instead of resolving against cwd", async t => {
    const { processor } = await fixture(t);
    await assert.rejects(
      processor.render("![Photo](/img/user/photo.png)"),
      error => {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes("/img/user/photo.png"));
        assert.match(error.message, /fileURL|note|document/i);
        return true;
      }
    );
  });

  for (const url of [
    "https://example.com/img/user/photo.jpg",
    "http://example.com/photo.jpg",
    "//example.com/photo.jpg",
    "/img/tree-1.svg",
    "/img/users/photo.jpg",
    "data:image/png;base64,aGVsbG8=",
    "",
  ]) {
    it(`leaves ${url} unchanged without requiring a note URL`, async t => {
      const { processor } = await fixture(t);
      const result = await processor.render(`![Photo](${url})`);
      assert.deepEqual(result.metadata.localImagePaths, []);
      assert.equal(
        parse(result.code).querySelector("img")?.getAttribute("src"),
        url
      );
    });
  }

  it("keeps ordinary relative images in Astro's existing pipeline", async t => {
    const { processor } = await fixture(t);
    const result = await processor.render("![Photo](../photo.png)");
    assert.deepEqual(result.metadata.localImagePaths, ["../photo.png"]);
    assert.equal(imageMarker(result.code).src, "../photo.png");
  });

  it("leaves ordinary links and image syntax inside code untouched", async t => {
    const { render } = await fixture(t);
    const markdown =
      "[Download](/img/user/missing.png)\n\n`![Inline](/img/user/missing.png)`\n\n```text\n![Fenced](/img/user/missing.png)\n```";
    const result = await render(markdown);
    const html = parse(result.code);
    assert.deepEqual(result.metadata.localImagePaths, []);
    assert.equal(
      html.querySelector("a")?.getAttribute("href"),
      "/img/user/missing.png"
    );
    assert.equal(
      html.querySelector("p code")?.textContent,
      "![Inline](/img/user/missing.png)"
    );
    assert.ok(
      html
        .querySelector("pre")
        ?.textContent.includes("![Fenced](/img/user/missing.png)")
    );
    assert.equal(html.querySelector("img"), null);
  });
});
