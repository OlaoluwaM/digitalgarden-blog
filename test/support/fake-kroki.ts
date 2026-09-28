/**
 * A local stand-in for Kroki, so no test calls kroki.io (ADR 0006). It
 * answers `POST /{mermaid|plantuml}/svg` with a real Kroki SVG from
 * test/fixtures/kroki, answers 400 with Kroki's error text for a source
 * containing "BROKEN", and records each request.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingHttpHeaders } from "node:http";

export interface KrokiRequest {
  path: string;
  options: Record<string, string>;
  headers: IncomingHttpHeaders;
  body: string;
}

export interface FakeKroki {
  url: string;
  requests: KrokiRequest[];
  close: () => Promise<void>;
}

const fixture = (name: string) =>
  readFile(new URL(`../fixtures/kroki/${name}`, import.meta.url), "utf8");

export async function startFakeKroki(): Promise<FakeKroki> {
  const answers: Record<string, string> = {
    "/mermaid/svg": await fixture("mermaid-flowchart.svg"),
    "/plantuml/svg": await fixture("plantuml-sequence.svg"),
  };
  const requests: KrokiRequest[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      const url = new URL(request.url ?? "/", "http://kroki");
      const path = url.pathname;
      requests.push({
        path,
        options: Object.fromEntries(url.searchParams),
        headers: request.headers,
        body,
      });
      const svg = answers[path];
      if (request.method !== "POST" || svg === undefined) {
        response.writeHead(404, { "content-type": "text/plain" });
        response.end("Error 404: Not Found");
      } else if (body.includes("BROKEN")) {
        response.writeHead(400, { "content-type": "text/plain" });
        response.end(
          "Error 400: SyntaxError: Parse error on line 2:\nBROKEN\n^\nExpecting 'NODE_STRING', got 'EOF'\n    at Worker.convert (file:///usr/local/kroki/src/worker.js:103:15)"
        );
      } else {
        response.writeHead(200, { "content-type": "image/svg+xml" });
        response.end(svg);
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
      ),
  };
}
