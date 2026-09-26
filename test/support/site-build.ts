/**
 * Build the real site once into a throwaway directory for build-level tests.
 *
 * The output lives under the ignored `.astro/` directory because Astro moves
 * built assets with `rename`, which fails across filesystems (a `/tmp` tmpfs).
 * Builds use `--force` so rendered Markdown reflects current plugin code
 * instead of Astro's content cache.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../", import.meta.url));

export interface SiteBuild {
  outDir: string;
  /** Output-relative paths of every generated HTML page. */
  pages: string[];
  read(path: string): Promise<string>;
  cleanup(): Promise<void>;
}

export async function buildSite(): Promise<SiteBuild> {
  const workDir = await mkdtemp(join(repository, ".astro", "site-build-"));
  const outDir = join(workDir, "out");
  const log = await runAstroBuild(outDir);
  const pages = (await listFiles(outDir))
    .filter(path => path.endsWith(".html"))
    .map(path => relative(outDir, path))
    .sort();

  if (pages.length === 0) {
    throw new Error(`The site build produced no pages:\n${log}`);
  }

  return {
    outDir,
    pages,
    read: path => readFile(join(outDir, path), "utf8"),
    cleanup: () => rm(workDir, { recursive: true, force: true }),
  };
}

function runAstroBuild(outDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        join(repository, "node_modules/astro/bin/astro.mjs"),
        "build",
        "--force",
        "--outDir",
        outDir,
      ],
      { cwd: repository, stdio: ["ignore", "pipe", "pipe"] }
    );
    let log = "";
    child.stdout.on("data", chunk => (log += chunk));
    child.stderr.on("data", chunk => (log += chunk));
    child.on("error", reject);
    child.on("close", code =>
      code === 0
        ? resolve(log)
        : reject(new Error(`astro build exited with ${code}:\n${log}`))
    );
  });
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name));
}
