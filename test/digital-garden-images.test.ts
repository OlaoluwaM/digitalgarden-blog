/**
 * Test path resolution with temporary files. Their contents are placeholders:
 * decoding image bytes and generating responsive markup are separate work.
 * Run with `npm run test:images` to see each case.
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it, type TestContext } from "node:test";

import {
  resolveDigitalGardenImagePath,
  type DigitalGardenImageContext,
} from "../src/content/digital-garden-images.ts";

async function fixture(t: TestContext, files: string[] = []) {
  const root = await mkdtemp(join(tmpdir(), "digital-garden-images-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const context: DigitalGardenImageContext = {
    notePath: join(root, "src/site/notes/Outbox/Post.md"),
    imageDirectory: join(root, "src/site/img/user"),
  };
  await mkdir(dirname(context.notePath), { recursive: true });
  await writeFile(context.notePath, "A note.\n");
  await mkdir(context.imageDirectory, { recursive: true });
  for (const file of files) {
    const path = join(context.imageDirectory, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "Image placeholder.\n");
  }
  return context;
}

async function expectResolutionError(
  source: string,
  context: DigitalGardenImageContext
) {
  await assert.rejects(
    resolveDigitalGardenImagePath(source, context),
    error => {
      assert.ok(error instanceof Error);
      for (const detail of [source, context.notePath]) {
        assert.ok(
          error.message.includes(detail),
          `Expected error to identify ${JSON.stringify(detail)}; got ${error.message}`
        );
      }
      return true;
    }
  );
}

describe("resolveDigitalGardenImagePath", () => {
  for (const [name, file, source, expected] of [
    [
      "maps a publisher image to a note-relative URL",
      "Extras/Assets/photo.jpg",
      "/img/user/Extras/Assets/photo.jpg",
      "../../img/user/Extras/Assets/photo.jpg",
    ],
    [
      "resolves SVG files too",
      "Extras/diagram.svg",
      "/img/user/Extras/diagram.svg",
      "../../img/user/Extras/diagram.svg",
    ],
    [
      "encodes spaces in the returned URL",
      "My Assets/My Photo.PNG",
      "/img/user/My Assets/My Photo.PNG",
      "../../img/user/My%20Assets/My%20Photo.PNG",
    ],
    [
      "locates files named by percent-encoded URLs",
      "My Assets/My Photo.PNG",
      "/img/user/My%20Assets/My%20Photo.PNG",
      "../../img/user/My%20Assets/My%20Photo.PNG",
    ],
    [
      "preserves Unicode filenames",
      "café.png",
      "/img/user/caf%C3%A9.png",
      "../../img/user/caf%C3%A9.png",
    ],
    [
      "decodes percent encoding only once",
      "literal%20name.png",
      "/img/user/literal%2520name.png",
      "../../img/user/literal%2520name.png",
    ],
  ]) {
    it(name, async t => {
      const context = await fixture(t, [file]);
      assert.equal(
        await resolveDigitalGardenImagePath(source, context),
        expected
      );
    });
  }

  it("calculates the path from the containing note's directory", async t => {
    const context = await fixture(t, ["photo.jpg"]);
    context.notePath = join(dirname(context.notePath), "Articles/Deep/Post.md");
    await mkdir(dirname(context.notePath), { recursive: true });
    await writeFile(context.notePath, "A nested note.\n");

    assert.equal(
      await resolveDigitalGardenImagePath("/img/user/photo.jpg", context),
      "../../../../img/user/photo.jpg"
    );
  });

  for (const source of [
    "https://example.com/img/user/photo.jpg",
    "http://example.com/photo.jpg",
    "//example.com/photo.jpg",
    "../assets/photo.jpg",
    "/img/tree-1.svg",
    "/img/users/photo.jpg",
    "data:image/png;base64,aGVsbG8=",
    "",
  ]) {
    it(`leaves ${JSON.stringify(source)} unchanged`, async t => {
      const context = await fixture(t);
      assert.equal(
        await resolveDigitalGardenImagePath(source, context),
        source
      );
    });
  }

  it("reports the image URL and note path when a file is missing", async t => {
    const context = await fixture(t);
    await expectResolutionError("/img/user/missing.png", context);
  });

  it("rejects a directory even though it exists", async t => {
    const context = await fixture(t);
    await mkdir(join(context.imageDirectory, "folder.png"));
    await expectResolutionError("/img/user/folder.png", context);
  });

  it("reports the note and URL when percent encoding is malformed", async t => {
    const context = await fixture(t);
    await expectResolutionError("/img/user/broken%2.png", context);
  });
});
