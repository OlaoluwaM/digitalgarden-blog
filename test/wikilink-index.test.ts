/**
 * Exercise the real generator command against small, temporary note collections.
 * Check its exit status, error messages, and generated module. Each test gets
 * its own project folder, so it can't overwrite the repository's real index.
 * Run with `npm run test:wikilink-index` to see the individual test results.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  copyFile,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const generator = join(repository, "scripts/generate-wikilink-index.ts");
// Give failure tests recognizable old contents. Comparing the whole file after
// a failed run catches both accidental replacement and partial writes.
const previousOutput = "// Previous valid index must survive a failed build.\n";

// Most cases use the publisher's JSON-shaped frontmatter. Tests for YAML write
// their metadata explicitly so they also exercise that input format.
function note(data: object, body = "Body"): string {
  return `---\n${JSON.stringify(data)}\n---\n${body}\n`;
}

// A fixture is a small project created for one test. Recreate the paths the
// generator expects, copy the formatting configuration, and share the installed
// dependencies through a symlink. Register cleanup before writing test files.
async function fixture(t: TestContext, files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "wikilink-index-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const notesDirectory = join(root, "src/site/notes");
  const outputFile = join(root, "src/generated/wikilink-index.ts");
  await mkdir(notesDirectory, { recursive: true });
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, previousOutput);
  await copyFile(join(repository, ".prettierrc"), join(root, ".prettierrc"));
  await symlink(join(repository, "node_modules"), join(root, "node_modules"));
  for (const [name, content] of Object.entries(files)) {
    const path = join(notesDirectory, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  return {
    root,
    notesDirectory,
    outputFile,
    async run() {
      // Run the actual entry point with this fixture as its working directory.
      // Capture both output streams to a file: sandboxed Node subprocesses can
      // lose piped output in this environment. Keep diagnostics for assertions.
      const logFile = join(root, "generator.log");
      const log = await open(logFile, "w");
      try {
        const child = spawn(process.execPath, [generator], {
          cwd: root,
          stdio: ["ignore", log.fd, log.fd],
          timeout: 15_000,
        });
        // Wait for the child and its output streams to close before reading.
        // A timeout or other signal is a test failure, even in a case where the
        // generator is expected to exit with a nonzero status.
        const [status, signal] = (await once(child, "close")) as [
          number | null,
          NodeJS.Signals | null,
        ];
        const output = await readFile(logFile, "utf8");
        assert.equal(signal, null, output);
        return { status, output };
      } finally {
        await log.close();
      }
    },
  };
}

// Remove TypeScript types and import the generated source as JavaScript. This
// checks that the output can actually load and exposes the expected mapping.
// Encoding the source in the import URL also avoids reusing a cached file import
// when a test regenerates different contents at the same path.
async function readIndex(outputFile: string): Promise<Record<string, string>> {
  const source = await readFile(outputFile, "utf8");
  const javascript = stripTypeScriptTypes(source);
  const module = (await import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
  )) as { wikilinkIndex: Record<string, string> };
  return module.wikilinkIndex;
}

// Like readIndex, for the exports beside the index.
async function readGenerated(outputFile: string) {
  const source = await readFile(outputFile, "utf8");
  const javascript = stripTypeScriptTypes(source);
  return (await import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
  )) as { noteTitles: Record<string, string>; hiddenUrls: string[] };
}

async function readTitles(outputFile: string) {
  return (await readGenerated(outputFile)).noteTitles;
}

describe("wikilink index generator", () => {
  // Why: the sitemap leaves out hidden notes (`dg-hide`, published as
  // `hide: true`) and reads which they are from this list at config time.
  it("lists hidden notes' URLs", async t => {
    const project = await fixture(t, {
      "Hidden.md": note({ permalink: "/posts/hidden/", hide: true }),
      "Shown.md": note({ permalink: "/posts/shown/" }),
      "Not hidden.md": note({ permalink: "/posts/not-hidden/", hide: false }),
    });
    const result = await project.run();
    assert.equal(result.status, 0, result.output);
    assert.deepEqual((await readGenerated(project.outputFile)).hiddenUrls, [
      "/posts/hidden/",
    ]);
  });
  // Why: the transclusion plugin names an embed's source note by its title,
  // which the publisher writes under dg-note-properties. A note without one
  // is still indexed, with no title entry.
  it("maps targets to their notes' titles", async t => {
    const project = await fixture(t, {
      "Guides/My Note.md": note({
        permalink: "/posts/my-note/",
        "dg-note-properties": { title: "My note, retitled" },
      }),
      "Untitled.md": note({ permalink: "/posts/untitled/" }),
    });
    const result = await project.run();
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(await readTitles(project.outputFile), {
      "Guides/My Note": "My note, retitled",
    });
    assert.equal(
      (await readIndex(project.outputFile))["Untitled"],
      "/posts/untitled/"
    );
  });

  it("parses JSON and YAML frontmatter in nested Markdown and MDX files", async t => {
    const project = await fixture(t, {
      "Folder/JSON.md": note({ permalink: "/posts/json/", tags: [] }),
      "YAML.mdx": "---\npermalink: /posts/yaml\ntags: []\n---\nBody\n",
      "ignore.txt": "Not a note",
    });
    const result = await project.run();
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(await readIndex(project.outputFile), {
      "Folder/JSON": "/posts/json/",
      YAML: "/posts/yaml",
    });
  });

  it("uses frontmatter only, ignoring metadata-like text in the body", async t => {
    const project = await fixture(t, {
      "Article.md": note(
        { permalink: "/posts/article/" },
        '{"permalink":"/posts/decoy/","tags":["gardenEntry"]}'
      ),
    });
    const result = await project.run();
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(await readIndex(project.outputFile), {
      Article: "/posts/article/",
    });
  });

  it("maps the exact gardenEntry tag to /", async t => {
    const project = await fixture(t, {
      "Home.md":
        "---\npermalink: /welcome/\ntags:\n  - other\n  - gardenEntry\n---\n",
      "Article.md": note({
        permalink: "/posts/article/",
        tags: ["not-gardenEntry"],
      }),
    });
    const result = await project.run();
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(await readIndex(project.outputFile), {
      Article: "/posts/article/",
      Home: "/",
    });
  });

  it("allows distinct targets to share a destination", async t => {
    const project = await fixture(t, {
      "First.md": note({ permalink: "/posts/shared/" }),
      "Second.md": note({ permalink: "/posts/shared/" }),
    });
    const result = await project.run();
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(await readIndex(project.outputFile), {
      First: "/posts/shared/",
      Second: "/posts/shared/",
    });
  });

  it("preserves indexing of ingress notes regardless of dg-publish", async t => {
    const project = await fixture(t, {
      "Note.md": note({ permalink: "/posts/note/", "dg-publish": false }),
    });
    const result = await project.run();
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(await readIndex(project.outputFile), {
      Note: "/posts/note/",
    });
  });

  it("rejects duplicate extensionless targets and names both sources", async t => {
    const project = await fixture(t, {
      "Folder/Note.md": note({ permalink: "/posts/first/" }),
      "Folder/Note.mdx": note({ permalink: "/posts/second/" }),
    });
    const result = await project.run();
    assert.notEqual(result.status, 0);
    for (const detail of ["Folder/Note", "Folder/Note.md", "Folder/Note.mdx"]) {
      assert.ok(result.output.includes(detail), result.output);
    }
    assert.equal(await readFile(project.outputFile, "utf8"), previousOutput);
  });

  for (const [name, source, field] of [
    ["missing frontmatter", "Body only", "permalink"],
    ["missing permalink", note({ tags: [] }), "permalink"],
    ["invalid permalink type", note({ permalink: 42 }), "permalink"],
    ["invalid permalink path", note({ permalink: "/Posts/bad/" }), "permalink"],
    ["query string", note({ permalink: "/posts/bad/?q=1" }), "permalink"],
    [
      "invalid home path",
      note({ permalink: "bad", tags: ["gardenEntry"] }),
      "permalink",
    ],
    ["malformed YAML", "---\npermalink: [\n---\nBody", ""],
    [
      "invalid tags",
      note({ permalink: "/posts/valid/", tags: "gardenEntry" }),
      "tags",
    ],
  ]) {
    it(`rejects ${name} with a source diagnostic and preserves output`, async t => {
      const project = await fixture(t, {
        "A Valid.md": note({ permalink: "/posts/valid/" }),
        "Broken.md": source,
      });
      const result = await project.run();
      assert.notEqual(result.status, 0);
      assert.ok(result.output.includes("Broken.md"), result.output);
      assert.ok(result.output.includes(field), result.output);
      assert.equal(await readFile(project.outputFile, "utf8"), previousOutput);
    });
  }

  it("escapes target names and preserves special object keys", async t => {
    const target = 'A "quoted" \\ note';
    const project = await fixture(t, {
      [`${target}.md`]: note({ permalink: "/posts/quoted/" }),
      "__proto__.md": note({ permalink: "/posts/prototype/" }),
      "constructor.md": note({ permalink: "/posts/constructor/" }),
    });
    const result = await project.run();
    assert.equal(result.status, 0, result.output);
    const index = await readIndex(project.outputFile);
    assert.equal(index[target], "/posts/quoted/");
    assert.ok(Object.hasOwn(index, "__proto__"));
    assert.equal(index["__proto__"], "/posts/prototype/");
    assert.equal(index.constructor, "/posts/constructor/");
  });

  it("sorts targets deterministically and generates identical output on reruns", async t => {
    const project = await fixture(t, {
      "z.md": note({ permalink: "/posts/z/" }),
      "a-b.md": note({ permalink: "/posts/a-b/" }),
      "a.md": note({ permalink: "/posts/a/" }),
    });
    const result = await project.run();
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(Object.keys(await readIndex(project.outputFile)), [
      "a",
      "a-b",
      "z",
    ]);
    const original = await readFile(project.outputFile, "utf8");
    const rerun = await project.run();
    assert.equal(rerun.status, 0, rerun.output);
    assert.equal(await readFile(project.outputFile, "utf8"), original);
    assert.deepEqual(await readdir(dirname(project.outputFile)), [
      "wikilink-index.ts",
    ]);
  });

  it("creates a valid empty index when the notes directory is empty", async t => {
    const project = await fixture(t, {});
    await rm(dirname(project.outputFile), { recursive: true });
    const result = await project.run();
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(await readIndex(project.outputFile), {});
  });

  it("fails rather than erasing the index when the notes directory is missing", async t => {
    const project = await fixture(t, {});
    await rm(project.notesDirectory, { recursive: true });
    const result = await project.run();
    assert.notEqual(result.status, 0);
    assert.ok(result.output.includes("notes"), result.output);
    assert.equal(await readFile(project.outputFile, "utf8"), previousOutput);
  });

  it("preserves the previous index if formatting fails", async t => {
    const project = await fixture(t, {
      "Note.md": note({ permalink: "/posts/note/" }),
    });
    await writeFile(join(project.root, ".prettierrc"), "{invalid json");
    const result = await project.run();
    assert.notEqual(result.status, 0);
    assert.equal(await readFile(project.outputFile, "utf8"), previousOutput);
  });
});
