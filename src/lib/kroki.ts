import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// The build's Kroki client (ADR 0006): one POST per diagram, answered from
// a cache when the diagram is unchanged, failing loudly otherwise.

export type DiagramType = "mermaid" | "plantuml";

// Kroki's diagram options (docs.kroki.io/kroki/setup/diagram-options), sent
// in the query string (Kroki ignored nested Mermaid options as headers).
// Dark themes, to sit on the site's dark page. Mermaid's edge labels get
// the site's gray-800 behind them: its dark theme's #585858 left the label
// text at 3.9:1. PlantUML also leaves its source out of the SVG.
const DIAGRAM_OPTIONS: Record<DiagramType, Record<string, string>> = {
  mermaid: {
    theme: "dark",
    "theme-variables_edge-label-background": "#262626",
  },
  plantuml: { theme: "cyborg", "no-metadata": "" },
};

export interface KrokiOptions {
  /** Kroki's base URL, such as https://kroki.io. */
  url: string;
  /** Where rendered SVGs are kept, keyed by a hash of the request. */
  cacheDir: string;
  timeoutMs?: number;
}

/** The diagram's SVG, rendered by Kroki or read from the cache. */
export async function renderWithKroki(
  type: DiagramType,
  source: string,
  { url, cacheDir, timeoutMs = 20_000 }: KrokiOptions
): Promise<string> {
  const options = DIAGRAM_OPTIONS[type];
  const base = url.replace(/\/+$/, "");
  // Keyed by Kroki's URL too, so a test's fake Kroki can never answer for
  // the real one.
  const key = createHash("sha256")
    .update(JSON.stringify([base, type, options, source]))
    .digest("hex");
  const cached = join(cacheDir, `${key}.svg`);
  try {
    return await readFile(cached, "utf8");
  } catch {
    // Not rendered before; ask Kroki.
  }

  let response: Response;
  try {
    response = await fetch(
      `${base}/${type}/svg?${new URLSearchParams(options).toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: source,
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
  } catch (error) {
    throw new Error(`Could not reach Kroki at ${base}: ${describe(error)}`, {
      cause: error,
    });
  }

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Kroki answered ${response.status}: ${reason(body)}`);
  }
  if (!body.trimStart().startsWith("<svg")) {
    throw new Error("Kroki's answer is not an SVG");
  }
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cached, body);
  return body;
}

/** Kroki's error text without its stack trace. */
function reason(body: string): string {
  return body
    .split("\n")
    .filter(line => line.trim() !== "" && !/^\s+at /.test(line))
    .join("\n");
}

function describe(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof Error) return cause.message;
  return error instanceof Error ? error.message : String(error);
}
