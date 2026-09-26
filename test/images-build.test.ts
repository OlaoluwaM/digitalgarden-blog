import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { it, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

const repository = fileURLToPath(new URL("../", import.meta.url));

async function build(project: string) {
  // Capture subprocess output to a file, as in the generator tests. This keeps
  // build diagnostics available when subprocess pipes lose output in the sandbox.
  const logPath = join(project, "build.log");
  const log = await open(logPath, "w");
  try {
    const child = spawn(
      join(project, "node_modules/.bin/astro"),
      ["build", "--force"],
      {
        cwd: project,
        env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", NO_COLOR: "1" },
        stdio: ["ignore", log.fd, log.fd],
        timeout: 30_000,
      }
    );
    const [status, signal] = await once(child, "close");
    const output = await readFile(logPath, "utf8");
    assert.equal(
      signal,
      null,
      `Build must finish without a signal:\n${output}`
    );
    assert.equal(typeof status, "number", output);
    return { status, output };
  } finally {
    await log.close();
  }
}

async function fixture(t: TestContext) {
  const project = await mkdtemp(join(tmpdir(), "images-build-test-"));
  t.after(() => rm(project, { recursive: true, force: true }));

  // Copy application code, never the real notes or image assets. Share installed
  // dependencies while keeping generated output and caches inside the fixture.
  await mkdir(join(project, "src"));
  for (const directory of [
    "content",
    "pages",
    "plugins",
    "generated",
    "scripts",
    "layouts",
    "components",
    "lib",
    "styles",
  ]) {
    await cp(
      join(repository, "src", directory),
      join(project, "src", directory),
      {
        recursive: true,
      }
    );
  }
  for (const file of [
    "package.json",
    "tsconfig.json",
    "src/content.config.ts",
  ]) {
    await copyFile(join(repository, file), join(project, file));
  }
  await symlink(
    join(repository, "node_modules"),
    join(project, "node_modules")
  );
  await copyFile(
    join(repository, "astro.config.ts"),
    join(project, "site.config.ts")
  );
  await writeFile(
    join(project, "astro.config.ts"),
    `import siteConfig from "./site.config.ts";
export default {
  ...siteConfig,
  cacheDir: "./.astro-cache",
  vite: { ...siteConfig.vite, cacheDir: "./.vite-cache" },
};
`
  );

  const notePath = join(project, "src/site/notes/Test note.md");
  await mkdir(dirname(notePath), { recursive: true });
  await mkdir(join(project, "src/site/img/user/Extras/Assets"), {
    recursive: true,
  });
  const frontmatter = {
    "dg-publish": true,
    tags: ["gardenEntry"],
    "dg-path": "Test note.md",
    "dg-permalink": "/",
    permalink: "/",
    "dg-note-properties": {
      title: "Test note",
      description: "Image build fixture.",
      tags: [],
      published: "2026-01-01",
      last_updated: "2026-01-01",
    },
  };
  const note = (body: string) =>
    `---\n${JSON.stringify(frontmatter)}\n---\n${body}\n`;

  return {
    project,
    notePath,
    imageDirectory: join(project, "src/site/img/user"),
    writeNote: (body: string) => writeFile(notePath, note(body)),
  };
}

async function emittedImage(project: string, alt: string, page = "index.html") {
  const html = await readFile(join(project, "dist-astro", page), "utf8");
  const images = parse(html).querySelectorAll("img");
  assert.equal(images.length, 1, html);
  const image = images[0]!;
  assert.equal(image.getAttribute("alt"), alt, html);
  assert.equal(image.getAttribute("__ASTRO_IMAGE_"), undefined);
  const source = image.getAttribute("src");
  assert.ok(source, html);

  const readAsset = async (url: string) => {
    assert.ok(url.startsWith("/_astro/"), `Expected emitted asset: ${url}`);
    const pathname = new URL(url, "https://fixture.test").pathname;
    // Decode the browser URL once to locate the emitted file on disk.
    const bytes = await readFile(
      join(project, "dist-astro", decodeURIComponent(pathname).slice(1))
    );
    assert.ok(bytes.length > 0, `Empty image asset: ${url}`);
    return bytes;
  };

  const bytes = await readAsset(source);
  for (const candidate of (image.getAttribute("srcset") ?? "").split(",")) {
    if (candidate.trim()) await readAsset(candidate.trim().split(/\s+/)[0]!);
  }
  return { image, source, bytes };
}

it("preserves remote images without fetching them during the build", async t => {
  const { project, writeNote } = await fixture(t);
  let imageRequests = 0;
  // A local HTTP server stands in for the remote host so unexpected downloads
  // are counted without depending on an external service or network failure.
  const server = createServer((_request, response) => {
    imageRequests += 1;
    response.writeHead(200, { "Content-Type": "image/svg+xml" });
    response.end(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"/>'
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const imageUrl = `http://127.0.0.1:${address.port}/diagram.svg?theme=light&version=1`;
  const markdown = `![Remote diagram](${imageUrl} "Remote title")`;
  await writeNote(markdown);
  await writeFile(join(project, "src/pages/direct.md"), markdown);

  const result = await build(project);
  assert.equal(result.status, 0, result.output);
  assert.equal(imageRequests, 0, "The build must not download remote images");
  for (const page of ["index.html", "direct/index.html"]) {
    const html = await readFile(join(project, "dist-astro", page), "utf8");
    const images = parse(html).querySelectorAll("img");
    assert.equal(images.length, 1, html);
    const image = images[0]!;
    assert.equal(image.getAttribute("src"), imageUrl, html);
    assert.equal(image.getAttribute("alt"), "Remote diagram");
    assert.equal(image.getAttribute("title"), "Remote title");
    assert.equal(image.getAttribute("srcset"), undefined);
  }
});

it("builds a local SVG with an emitted asset and dimensions", async t => {
  const { project, imageDirectory, writeNote } = await fixture(t);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16" viewBox="0 0 32 16"><rect width="32" height="16" fill="red"/></svg>';
  await writeFile(join(imageDirectory, "diagram.svg"), svg);
  await writeNote('![Diagram](/img/user/diagram.svg "Diagram title")');

  const result = await build(project);
  assert.equal(result.status, 0, result.output);
  const { image, source, bytes } = await emittedImage(project, "Diagram");
  assert.match(source, /\.svg$/);
  assert.equal(image.getAttribute("width"), "32");
  assert.equal(image.getAttribute("height"), "16");
  assert.equal(image.getAttribute("title"), "Diagram title");
  const emittedSvg = parse(bytes.toString()).querySelector("svg");
  assert.ok(emittedSvg, "Expected an SVG file, not an HTML fallback");
  assert.equal(emittedSvg.getAttribute("viewBox"), "0 0 32 16");
  assert.equal(emittedSvg.querySelector("rect")?.getAttribute("fill"), "red");
});

it("preserves image attribute characters in collection and Markdown pages", async t => {
  const { project, imageDirectory, writeNote } = await fixture(t);
  await writeFile(
    join(imageDirectory, "diagram.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><rect width="32" height="16"/></svg>'
  );
  const markdown =
    '![A & B <tag> &quot;quoted&quot; Tom&apos;s &amp;quot; &amp;#x22;](/img/user/diagram.svg "A & B &quot;quoted&quot; &lt;tag&gt; &amp;quot; &amp;#x22;")';
  await writeNote(markdown);
  // Markdown pages use Vite's image transform; collections use the content
  // runtime. Exercise both decoders with the same attribute values.
  await writeFile(join(project, "src/pages/direct.md"), markdown);
  const result = await build(project);
  assert.equal(result.status, 0, result.output);
  for (const page of ["index.html", "direct/index.html"]) {
    const { image } = await emittedImage(
      project,
      'A & B <tag> "quoted" Tom\'s &quot; &#x22;',
      page
    );
    assert.equal(
      image.getAttribute("title"),
      'A & B "quoted" <tag> &quot; &#x22;'
    );
  }
});

for (const [name, filename, imageUrl] of [
  [
    "spaces in directories and filenames",
    "My Assets/My Photo.png",
    "/img/user/My%20Assets/My%20Photo.png",
  ],
  ["Unicode filenames", "café.png", "/img/user/caf%C3%A9.png"],
  [
    "literal percent-encoded text in filenames",
    "literal%20name.png",
    "/img/user/literal%2520name.png",
  ],
] as const) {
  it(`builds an encoded image URL with ${name}`, async t => {
    const { project, imageDirectory, writeNote } = await fixture(t);
    const imagePath = join(imageDirectory, filename);
    await mkdir(dirname(imagePath), { recursive: true });
    // A real 1 x 1 PNG exercises Astro's image service, not only path resolution.
    await writeFile(
      imagePath,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1cAAAAASUVORK5CYII=",
        "base64"
      )
    );
    await writeNote(`![Encoded image](${imageUrl} "Image title")`);

    const result = await build(project);
    assert.equal(result.status, 0, result.output);
    const { image, source, bytes } = await emittedImage(
      project,
      "Encoded image"
    );
    assert.equal(image.getAttribute("width"), "1");
    assert.equal(image.getAttribute("height"), "1");
    assert.equal(image.getAttribute("title"), "Image title");
    assert.match(source, /\.webp$/);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  });
}

it("fails an Astro build when a note references a missing image", async t => {
  const { project, notePath, writeNote } = await fixture(t);
  await writeNote("A note without an image.");
  const baseline = await build(project);
  assert.equal(baseline.status, 0, baseline.output);
  assert.match(
    await readFile(join(project, "dist-astro/index.html"), "utf8"),
    /A note without an image\./
  );

  const missingImageUrl = "/img/user/Extras/Assets/does-not-exist.png";
  await writeNote(`![Missing image](${missingImageUrl})`);
  const result = await build(project);
  for (const detail of ["Cannot resolve image", missingImageUrl, notePath]) {
    assert.ok(
      result.output.includes(detail),
      `Expected ${JSON.stringify(detail)}:\n${result.output}`
    );
  }
  assert.notEqual(result.status, 0, result.output);
});
