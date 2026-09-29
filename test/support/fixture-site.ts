/**
 * A throwaway copy of the site with its own notes, for tests that need
 * content no published note has (a missing image, a note with sections).
 *
 * The project copies the application code and the site's static files
 * (`public/`), never the real notes or their images, and shares the
 * installed dependencies through a symlink. Its build output and caches
 * stay inside the project, which lives in the system's temporary directory.
 */
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
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../", import.meta.url));

export interface FixtureProject {
  project: string;
  /** Where published notes go; the Digital Garden plugin's directory. */
  notesDirectory: string;
  /** Write a published note: its plugin frontmatter and Markdown body. */
  writeNote: (relativePath: string, note: FixtureNote) => Promise<void>;
  cleanup: () => Promise<void>;
}

export interface FixtureNote {
  title: string;
  permalink: string;
  body: string;
  /** Marks Home, which every build needs exactly one of. */
  home?: boolean;
  /** `dg-hide: true` in the vault, which the publisher writes as `hide`. */
  hide?: boolean;
  /**
   * A note with no tags: its tags property left out ("omitted") or left
   * empty, which YAML reads as null ("empty"). Home keeps the top-level
   * `gardenEntry` tag the publisher adds for `dg-home`.
   */
  untagged?: "omitted" | "empty";
}

export async function createFixtureProject(
  prefix: string
): Promise<FixtureProject> {
  const project = await mkdtemp(join(tmpdir(), `${prefix}-`));

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
      { recursive: true }
    );
  }
  // Fonts, icons, and images the pages load from the site root, so fixture
  // pages render as the real site's do.
  await cp(join(repository, "public"), join(project, "public"), {
    recursive: true,
  });
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
  vite: {
    ...siteConfig.vite,
    cacheDir: "./.vite-cache",
    // node_modules is a symlink to the repository's. Resolving through it to
    // the real path puts dependency .astro components (Vercel's analytics)
    // outside this project root, where Astro cannot compile them.
    resolve: { preserveSymlinks: true },
  },
};
`
  );

  const notesDirectory = join(project, "src/site/notes");
  await mkdir(join(project, "src/site/img/user"), { recursive: true });

  return {
    project,
    notesDirectory,
    writeNote: async (
      relativePath,
      { title, permalink, body, home = false, hide = false, untagged }
    ) => {
      const path = join(notesDirectory, relativePath);
      await mkdir(dirname(path), { recursive: true });
      const noTags =
        untagged === undefined
          ? { tags: [] }
          : untagged === "empty"
            ? { tags: null }
            : {};
      const frontmatter = {
        "dg-publish": true,
        ...(home ? { tags: ["gardenEntry"] } : noTags),
        "dg-path": relativePath,
        "dg-permalink": permalink,
        permalink,
        ...(hide ? { hide: true } : {}),
        "dg-note-properties": {
          title,
          description: `${title} (fixture).`,
          ...noTags,
          published: "2026-01-01T00:00",
          last_updated: "2026-01-01T00:00",
        },
      };
      await writeFile(
        path,
        `---\n${JSON.stringify(frontmatter)}\n---\n${body}\n`
      );
    },
    cleanup: () => rm(project, { recursive: true, force: true }),
  };
}

/**
 * Regenerate the project's wikilink index from its own notes, as
 * `npm run build` does first. Fixture builds otherwise keep the copy of the
 * real site's index, which tests that link to real notes rely on.
 */
export async function generateFixtureIndex(project: string) {
  const logPath = join(project, "generate.log");
  const log = await open(logPath, "w");
  try {
    const child = spawn(
      process.execPath,
      [join(repository, "scripts/generate-wikilink-index.ts")],
      { cwd: project, stdio: ["ignore", log.fd, log.fd], timeout: 15_000 }
    );
    const [status] = (await once(child, "close")) as [number | null];
    assert.equal(status, 0, await readFile(logPath, "utf8"));
  } finally {
    await log.close();
  }
}

/** Build the project with `astro build --force` into its `dist/`. */
export async function buildFixture(project: string) {
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
    const [status, signal] = (await once(child, "close")) as [
      number | null,
      NodeJS.Signals | null,
    ];
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
