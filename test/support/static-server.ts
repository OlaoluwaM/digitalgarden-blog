/**
 * Serve a built site over HTTP for browser tests, like a static host: a
 * directory's index.html, else 404.html with status 404.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

export interface StaticServer {
  origin: string;
  close: () => Promise<void>;
}

export async function serveStatic(outDir: string): Promise<StaticServer> {
  const server = createServer((request, response) => {
    void (async () => {
      const pathname = decodeURIComponent(
        new URL(request.url ?? "/", "http://x").pathname
      );
      const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
      const candidates = relative.endsWith("/")
        ? [join(relative, "index.html")]
        : [relative, join(relative, "index.html")];
      for (const candidate of candidates) {
        try {
          const body = await readFile(join(outDir, candidate));
          response.writeHead(200, {
            "content-type":
              CONTENT_TYPES[extname(candidate)] ?? "application/octet-stream",
          });
          response.end(body);
          return;
        } catch {
          // Not there; try the next candidate.
        }
      }
      response.writeHead(404, { "content-type": CONTENT_TYPES[".html"] });
      response.end(await readFile(join(outDir, "404.html")));
    })();
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
      ),
  };
}
