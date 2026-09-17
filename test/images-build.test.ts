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
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

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

it("fails an Astro build when a note references a missing image", async t => {
  const project = await mkdtemp(join(tmpdir(), "images-build-test-"));
  t.after(() => rm(project, { recursive: true, force: true }));

  // Copy application code, never the real notes or image assets. Share installed
  // dependencies while keeping generated output and caches inside the fixture.
  await mkdir(join(project, "src"));
  for (const directory of ["content", "pages", "plugins", "generated"]) {
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
      description: "Missing image build fixture.",
      tags: [],
      published: "2026-01-01",
      last_updated: "2026-01-01",
    },
  };
  const note = (body: string) =>
    `---\n${JSON.stringify(frontmatter)}\n---\n${body}\n`;

  await writeFile(notePath, note("A note without an image."));
  const baseline = await build(project);
  assert.equal(baseline.status, 0, baseline.output);
  assert.match(
    await readFile(join(project, "dist-astro/index.html"), "utf8"),
    /A note without an image\./
  );

  const missingImageUrl = "/img/user/Extras/Assets/does-not-exist.png";
  await writeFile(notePath, note(`![Missing image](${missingImageUrl})`));
  const result = await build(project);
  for (const detail of ["Cannot resolve image", missingImageUrl, notePath]) {
    assert.ok(
      result.output.includes(detail),
      `Expected ${JSON.stringify(detail)}:\n${result.output}`
    );
  }
  assert.notEqual(result.status, 0, result.output);
});
