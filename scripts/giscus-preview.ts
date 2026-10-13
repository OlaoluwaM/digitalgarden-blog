/**
 * See the giscus widget with this working tree's theme and styles (ADR 0008).
 *
 *   npm run dev:giscus [-- <path>]
 *
 * giscus.json lets only https://thunk.blog load the discussions, so the
 * widget never shows on `astro dev`. This starts `astro dev` with
 * GISCUS_PREVIEW set, which loads the widget (lib/giscus.ts), then opens
 * Chromium with every https://thunk.blog request answered by the dev
 * server. The browser sees thunk.blog, so giscus accepts it, and the page,
 * the theme giscus.app loads, and its fonts all come from the working tree.
 * Reload the page to see a theme change.
 *
 * The threads are the real ones: signed in, a comment or reaction lands in
 * the live discussion. The browser profile, and so the giscus sign-in, is
 * kept in .cache/giscus-preview.
 */
import { spawn } from "node:child_process";
import { stripVTControlCharacters } from "node:util";
import { chromium } from "playwright";

const SITE = "https://thunk.blog";
const path = process.argv[2] ?? "/";

const dev = spawn("npm", ["run", "dev"], {
  // Astro backgrounds the server when it detects an AI agent, and would
  // then reuse a running one that lacks GISCUS_PREVIEW.
  env: { ...process.env, GISCUS_PREVIEW: "1", ASTRO_DEV_BACKGROUND: "0" },
  stdio: ["ignore", "pipe", "inherit"],
  // Its own process group, so stopping it stops astro under npm too.
  detached: true,
});
process.on("exit", () => {
  if (dev.pid !== undefined && dev.exitCode === null) {
    process.kill(-dev.pid, "SIGTERM");
  }
});

// Astro moves to the next free port when 4321 is taken, so read the one it
// prints.
const local = await new Promise<string>((resolve, reject) => {
  dev.stdout.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
    const url = /http:\/\/localhost:\d+/.exec(
      stripVTControlCharacters(chunk.toString())
    );
    if (url) resolve(url[0]);
  });
  dev.on("exit", code => reject(new Error(`astro dev exited (${code})`)));
});

const context = await chromium.launchPersistentContext(
  ".cache/giscus-preview",
  {
    headless: false,
    executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH || undefined,
    viewport: null,
  }
);
await context.route(`${SITE}/**`, async route => {
  const url = new URL(route.request().url());
  // A request the dev server drops, as when it restarts, fails on its own
  // instead of ending the preview.
  const response = await route
    .fetch({ url: `${local}${url.pathname}${url.search}`, maxRedirects: 0 })
    .catch(() => undefined);
  if (!response) return route.abort();
  const headers = response.headers();
  if (headers.location) {
    headers.location = headers.location.replace(local, SITE);
  }
  // giscus.app loads the theme and its fonts cross-origin, as vercel.json
  // allows in production.
  headers["access-control-allow-origin"] = "https://giscus.app";
  await route.fulfill({ response, headers });
});
// Vite's client opens its HMR socket on the page's host, so edits reach
// the page only through the dev server's own socket.
await context.routeWebSocket(`${SITE.replace("https", "wss")}/**`, page => {
  const url = new URL(page.url());
  const server = new WebSocket(
    `${local.replace("http", "ws")}${url.pathname}${url.search}`,
    "vite-hmr"
  );
  const pending: string[] = [];
  page.onMessage(message => {
    const data = message.toString();
    if (server.readyState === WebSocket.OPEN) server.send(data);
    else pending.push(data);
  });
  server.addEventListener("open", () => {
    for (const data of pending.splice(0)) server.send(data);
  });
  server.addEventListener("message", event => page.send(String(event.data)));
  server.addEventListener("close", () => void page.close());
  page.onClose(() => server.close());
});
context.on("close", () => process.exit(0));
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => void context.close());
}

const page = context.pages()[0] ?? (await context.newPage());
await page.goto(new URL(path, SITE).href);
console.log(
  `\nPreviewing ${new URL(path, SITE).href} from ${local}.` +
    "\nSigned in, comments and reactions land in the real discussion." +
    "\nClose the browser to stop."
);
