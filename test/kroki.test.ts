/**
 * Unit tests for `renderWithKroki`, the build's Kroki client (ADR 0006),
 * against a local fake Kroki (test/support/fake-kroki.ts); no test calls
 * kroki.io.
 *
 * Why this level: the request shape, the cache, and each failure mode are
 * the client's whole contract, and a local server exercises them over real
 * HTTP without a build.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { renderWithKroki } from "../src/lib/kroki.ts";
import { startFakeKroki, type FakeKroki } from "./support/fake-kroki.ts";

let kroki: FakeKroki;
let cacheRoot: string;
let caches = 0;

before(async () => {
  kroki = await startFakeKroki();
  cacheRoot = await mkdtemp(join(tmpdir(), "kroki-test-"));
});

after(async () => {
  await kroki?.close();
  await rm(cacheRoot, { recursive: true, force: true });
});

/** Options for one test, with a cache of its own. */
const options = () => ({
  url: kroki.url,
  cacheDir: join(cacheRoot, String(caches++)),
});

describe("renderWithKroki", () => {
  // Why: Kroki takes the source as the POST body at /{type}/svg, and the
  // dark themes (with Mermaid's darker edge labels, and PlantUML's
  // no-metadata) travel as diagram options in the query string; without
  // them diagrams render light on the dark page.
  it("posts the source with each type's diagram options", async () => {
    const before = kroki.requests.length;
    const svg = await renderWithKroki(
      "mermaid",
      "graph LR\n A --> B",
      options()
    );
    await renderWithKroki("plantuml", "@startuml\nA -> B\n@enduml", options());
    assert.match(svg, /^<svg/);
    const [mermaid, plantuml] = kroki.requests.slice(before);
    assert.equal(mermaid?.path, "/mermaid/svg");
    assert.equal(mermaid?.body, "graph LR\n A --> B");
    assert.deepEqual(mermaid?.options, {
      theme: "dark",
      "theme-variables_edge-label-background": "#262626",
    });
    assert.equal(plantuml?.path, "/plantuml/svg");
    assert.deepEqual(plantuml?.options, { theme: "cyborg", "no-metadata": "" });
  });

  // Why: an unchanged diagram needn't be requested again, which keeps
  // rebuilds fast and lets them succeed while Kroki is down.
  it("answers an unchanged diagram from its cache", async () => {
    const shared = options();
    const before = kroki.requests.length;
    const first = await renderWithKroki("mermaid", "graph TD\n A", shared);
    const second = await renderWithKroki("mermaid", "graph TD\n A", shared);
    await renderWithKroki("mermaid", "graph TD\n B", shared);
    assert.equal(second, first);
    assert.equal(kroki.requests.length - before, 2);
  });

  // Why: a diagram Kroki rejects must fail the build with Kroki's reason,
  // not its stack trace, and must not be cached as if it had rendered.
  it("fails with Kroki's message on an error response", async () => {
    const shared = options();
    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(
        renderWithKroki("mermaid", "graph LR\n BROKEN", shared),
        (error: Error) => {
          assert.match(error.message, /Kroki answered 400/);
          assert.match(error.message, /Parse error on line 2/);
          assert.doesNotMatch(error.message, /worker\.js/);
          return true;
        }
      );
    }
  });

  // Why: the build fails when Kroki can't be reached (the chosen policy),
  // naming where it tried.
  it("fails when Kroki can't be reached", async () => {
    // A port that was just free: nothing answers there.
    const closed = await startFakeKroki();
    await closed.close();
    await assert.rejects(
      renderWithKroki("mermaid", "graph LR\n A", {
        url: closed.url,
        cacheDir: options().cacheDir,
      }),
      new RegExp(`Could not reach Kroki at ${closed.url}`)
    );
  });
});
