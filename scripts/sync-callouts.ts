/**
 * Copy the Obsidian vault's custom callout types into the site.
 *
 *   npm run sync-callouts [-- --vault <path>] [--icon type=name] [--color type=R,G,B]
 *
 * Reads the Admonition plugin's settings and the enabled CSS snippets from
 * the vault (default ~/Desktop/digital-brain), merges them by the rules in
 * scripts/callout-sync.ts, and writes:
 *   - the color rules between the markers in src/styles/content/callouts.css;
 *   - the icon entries between the markers in src/plugins/hast/callout-icons.ts.
 *
 * A type the site cannot render (an icon with no Lucide equivalent, a color
 * from a theme variable) means nothing is written. The run ends by listing
 * each such type with the `--icon` or `--color` option that resolves it.
 */
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { format, resolveConfig } from "prettier";
import {
  collectCustomCallouts,
  MARKERS,
  renderCss,
  renderIconEntries,
  replaceGenerated,
  type AdmonitionSettings,
} from "./callout-sync.ts";

const TARGETS = {
  css: resolve("src/styles/content/callouts.css"),
  icons: resolve("src/plugins/hast/callout-icons.ts"),
};

/** `type=value` pairs from a repeated option. */
function pairs(values: string[] = []): Record<string, string> {
  return Object.fromEntries(
    values.map(value => {
      const at = value.indexOf("=");
      if (at < 1) throw new Error(`Expected type=value, got "${value}"`);
      return [value.slice(0, at), value.slice(at + 1)];
    })
  );
}

async function readJson<T>(path: string, fallback?: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Cannot read ${path}`, { cause: error });
  }
}

async function formatted(path: string, source: string): Promise<string> {
  return format(source, { ...(await resolveConfig(path)), filepath: path });
}

async function syncCallouts(): Promise<void> {
  const { values } = parseArgs({
    options: {
      vault: {
        type: "string",
        default: join(homedir(), "Desktop/digital-brain"),
      },
      icon: { type: "string", multiple: true },
      color: { type: "string", multiple: true },
    },
  });
  const obsidian = join(values.vault, ".obsidian");

  const settings = await readJson<AdmonitionSettings>(
    join(obsidian, "plugins/obsidian-admonition/data.json")
  );
  // Obsidian applies only the enabled snippets, in this order. A listed
  // snippet whose file is gone is skipped, as Obsidian skips it.
  const { enabledCssSnippets = [] } = await readJson<{
    enabledCssSnippets?: string[];
  }>(join(obsidian, "appearance.json"), {});
  const snippets = await Promise.all(
    enabledCssSnippets.map(name =>
      readFile(join(obsidian, "snippets", `${name}.css`), "utf8").catch(
        () => ""
      )
    )
  );

  const { callouts, problems } = collectCustomCallouts(settings, snippets, {
    icons: pairs(values.icon),
    colors: pairs(values.color),
  });

  // Report what resolved first, so the problems, if any, end the output.
  console.log(`Resolved ${callouts.length} custom callout types:`);
  for (const { type, color, icon } of callouts) {
    console.log(`  ${type}: rgb(${color}), ${icon}`);
  }
  if (problems.length > 0) {
    console.log(
      [
        "",
        `Not synced: ${problems.length} ${problems.length === 1 ? "problem" : "problems"}, so nothing was written.`,
        ...problems.map(problem => `  ${problem}`),
        "",
        "Icon names: https://lucide.dev/icons. To map a Font Awesome icon for",
        "every future run, add it to FONT_AWESOME_TO_LUCIDE in",
        "scripts/callout-sync.ts.",
      ].join("\n")
    );
    process.exitCode = 1;
    return;
  }

  // Build every file before writing any, so a failure leaves both as
  // they were.
  const outputs = await Promise.all([
    readFile(TARGETS.css, "utf8").then(source =>
      formatted(
        TARGETS.css,
        replaceGenerated(source, renderCss(callouts), MARKERS.css)
      )
    ),
    readFile(TARGETS.icons, "utf8").then(source =>
      formatted(
        TARGETS.icons,
        replaceGenerated(source, renderIconEntries(callouts), MARKERS.ts)
      )
    ),
  ]);
  await Promise.all(
    [TARGETS.css, TARGETS.icons].map((path, index) =>
      writeFile(path, outputs[index]!)
    )
  );

  console.log(
    `\nWrote ${Object.values(TARGETS)
      .map(path => relative(process.cwd(), path))
      .join(", ")}.`
  );
}

try {
  await syncCallouts();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
