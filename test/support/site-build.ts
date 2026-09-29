/**
 * Build the real site once into a throwaway directory for build-level tests.
 *
 * The output lives under the ignored `.astro/` directory because Astro moves
 * built assets with `rename`, which fails across filesystems (a `/tmp` tmpfs).
 * Builds use `--force` so rendered Markdown reflects current plugin code
 * instead of Astro's content cache.
 *
 * Each build gets its own Astro and Vite cache folders, through a small
 * config file that wraps the site's. Test files build in parallel
 * processes, and with the shared `node_modules/.astro`, one build's
 * `--force` cleared the content store while another was still using it
 * (test/site-build-concurrency.test.ts).
 *
 * Why each test file builds for itself instead of sharing one build from a
 * global setup (`node --test --test-global-setup`): only three unit test
 * files and the layout tests need the site, and a build takes a few
 * seconds, so sharing would save little. It would tie every file to a
 * setup file and make the single-file scripts (`npm run test:site-build`)
 * need the flag or a fallback. Revisit if more files need the built site
 * or builds get slow.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEnv } from "./build-env.ts";

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
  let pages: string[];
  // A failed build removes its folder too.
  try {
    const config = join(workDir, "astro.config.ts");
    await writeFile(config, cacheConfig(workDir));
    const log = await runAstroBuild(outDir, config);
    pages = (await listFiles(outDir))
      .filter(path => path.endsWith(".html"))
      .map(path => relative(outDir, path))
      .sort();
    if (pages.length === 0) {
      throw new Error(`The site build produced no pages:\n${log}`);
    }
  } catch (error) {
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }

  return {
    outDir,
    pages,
    read: path => readFile(join(outDir, path), "utf8"),
    cleanup: () => rm(workDir, { recursive: true, force: true }),
  };
}

/** The site's config with Astro and Vite caches inside `workDir`. */
function cacheConfig(workDir: string) {
  const site = JSON.stringify(join(repository, "astro.config.ts"));
  const astroCache = JSON.stringify(join(workDir, "astro-cache"));
  const viteCache = JSON.stringify(join(workDir, "vite-cache"));
  return `import site from ${site};
export default {
  ...site,
  cacheDir: ${astroCache},
  vite: { ...site.vite, cacheDir: ${viteCache} },
};
`;
}

function runAstroBuild(outDir: string, config: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        join(repository, "node_modules/astro/bin/astro.mjs"),
        "build",
        "--force",
        "--outDir",
        outDir,
        // Astro joins this onto the project root.
        "--config",
        relative(repository, config),
      ],
      { cwd: repository, env: buildEnv(), stdio: ["ignore", "pipe", "pipe"] }
    );
    let log = "";
    child.stdout.on("data", (chunk: Buffer) => (log += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (log += chunk.toString()));
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
