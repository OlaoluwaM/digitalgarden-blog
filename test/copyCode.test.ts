/**
 * Exercise the real initializer with parsed HTML, mocked browser APIs, and
 * Node's fake timers. This checks DOM changes and control flow, not browser
 * clipboard permissions, focus behavior, or Astro page integration.
 */
import assert from "node:assert/strict";
import { it, type Mock, type TestContext } from "node:test";
import { parse, type HTMLElement } from "node-html-parser";
import { initializeCopyButtons } from "../src/scripts/copyCode.ts";

function fixture(
  t: TestContext,
  options: {
    html?: string;
    clipboard?: object | null;
    fallback?: () => boolean;
  } = {}
) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(console, "error", () => {});
  const root = parse(
    `<body>${options.html ?? '<pre class="astro-code"><code>example</code></pre>'}</body>`,
    { blockTextElements: { script: true, style: true } }
  );
  const body = root.querySelector("body")!;
  const listeners = new Map<HTMLElement, () => Promise<void>>();
  const writeText = t.mock.fn(async (_text: string) => {});
  const textareas: {
    value: string;
    focus: Mock<() => void>;
    select: Mock<() => void>;
  }[] = [];

  function createElement(tag: string) {
    const element = Object.assign(
      parse(`<${tag}></${tag}>`).querySelector(tag)!,
      {
        disabled: false,
        type: "",
        value: "",
        style: {} as Record<string, string>,
        focus: t.mock.fn(() => {}),
        select: t.mock.fn(() => {}),
        addEventListener(event: string, listener: () => Promise<void>) {
          assert.equal(event, "click");
          listeners.set(element, listener);
        },
      }
    );
    // node-html-parser supplies the tree and selectors; these browser-only
    // properties and event callbacks are the small surface the script needs.
    Object.defineProperty(element, "className", {
      get: () => element.getAttribute("class"),
      set: (value: string) => element.setAttribute("class", value),
    });
    if (tag === "textarea") textareas.push(element);
    return element;
  }

  const execCommand = t.mock.fn((command: string) => {
    assert.equal(command, "copy");
    const textarea = body.querySelector("textarea");
    assert.ok(textarea, "The fallback textarea must be attached while copying");
    const created = textareas.at(-1)!;
    assert.equal(created.focus.mock.callCount(), 1);
    assert.equal(created.select.mock.callCount(), 1);
    return options.fallback?.() ?? true;
  });
  const document = {
    body,
    querySelectorAll: (selector: string) => root.querySelectorAll(selector),
    createElement,
    execCommand,
  };

  // Restore Node's globals after every case, including its navigator getter.
  for (const [name, value] of Object.entries({
    document,
    navigator: {
      clipboard:
        options.clipboard === undefined ? { writeText } : options.clipboard,
    },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  }

  initializeCopyButtons();
  return {
    root,
    writeText,
    execCommand,
    textareas,
    buttons: () =>
      root.querySelectorAll("button") as ReturnType<typeof createElement>[],
    async click(index = 0) {
      const button = root.querySelectorAll("button")[index]!;
      const listener = listeners.get(button);
      assert.ok(listener);
      // Invoke the handler even when disabled to check its pending-copy guard.
      await listener();
    },
  };
}

it("adds one button per Astro block and leaves other code alone", t => {
  const f = fixture(t, {
    html: '<pre class="astro-code"><code>a</code></pre><pre class="astro-code"><code>b</code></pre><pre><code>plain</code></pre><p><code>inline</code></p>',
  });
  assert.equal(f.buttons().length, 2);
  for (const button of f.buttons()) {
    assert.equal(button.getAttribute("class"), "copy-code-btn");
    assert.equal(button.type, "button");
    assert.equal(button.textContent, "Copy");
  }
  initializeCopyButtons();
  assert.equal(f.buttons().length, 2);
  assert.equal(
    f.root.querySelectorAll("pre:not(.astro-code) button, p button").length,
    0
  );
});

for (const text of ['  const x = "<&>";\n\n\tconsole.log(x);\n', ""]) {
  it(`copies ${text ? "exact text, including whitespace and special characters" : "an empty code block"}`, async t => {
    const f = fixture(t);
    f.root.querySelector("code")!.textContent = text;
    await f.click();
    assert.deepEqual(
      f.writeText.mock.calls.map(call => call.arguments),
      [[text]]
    );
    assert.equal(f.execCommand.mock.callCount(), 0);
    assert.equal(f.buttons()[0]!.textContent, "Copied!");
    assert.equal(f.buttons()[0]!.disabled, false);
    t.mock.timers.tick(1999);
    assert.equal(f.buttons()[0]!.textContent, "Copied!");
    t.mock.timers.tick(1);
    assert.equal(f.buttons()[0]!.textContent, "Copy");
  });
}

for (const [name, clipboard] of [
  ["missing clipboard", null],
  ["missing writeText", {}],
  ["non-callable writeText", { writeText: true }],
] as const) {
  it(`uses the textarea fallback for ${name}`, async t => {
    const f = fixture(t, { clipboard });
    const text = "  first\n\tsecond & <third>\n";
    f.root.querySelector("code")!.textContent = text;
    await f.click();
    assert.equal(f.execCommand.mock.callCount(), 1);
    assert.equal(f.textareas[0]!.value, text);
    assert.equal(f.root.querySelector("textarea"), null);
    assert.equal(f.buttons()[0]!.textContent, "Copied!");
    assert.equal(f.buttons()[0]!.disabled, false);
  });
}

it("falls back after a rejected clipboard write", async t => {
  const writeText = t.mock.fn(async (_text: string) => {
    throw new Error("Permission denied");
  });
  const f = fixture(t, { clipboard: { writeText } });
  await f.click();
  assert.equal(writeText.mock.callCount(), 1);
  assert.equal(f.execCommand.mock.callCount(), 1);
  assert.equal(f.textareas[0]!.value, "example");
  assert.equal(f.root.querySelector("textarea"), null);
  assert.equal(f.buttons()[0]!.textContent, "Copied!");
  assert.equal(f.buttons()[0]!.disabled, false);
});

for (const throws of [false, true]) {
  it(`cleans up and reports failure when the fallback ${throws ? "throws" : "returns false"}`, async t => {
    const f = fixture(t, {
      clipboard: null,
      fallback: () => {
        if (throws) throw new Error("Copy failed");
        return false;
      },
    });
    await f.click();
    assert.equal(f.execCommand.mock.callCount(), 1);
    assert.equal(f.root.querySelector("textarea"), null);
    assert.equal(f.buttons()[0]!.textContent, "Failed");
    assert.equal(f.buttons()[0]!.disabled, false);
    t.mock.timers.tick(2000);
    assert.equal(f.buttons()[0]!.textContent, "Copy");
  });
}

it("ignores overlapping clicks and allows another copy once settled", async t => {
  const pending = Promise.withResolvers<void>();
  const writeText = t.mock.fn(() => pending.promise);
  const f = fixture(t, { clipboard: { writeText } });
  const first = f.click();
  assert.equal(f.buttons()[0]!.disabled, true);
  await f.click();
  assert.equal(writeText.mock.callCount(), 1);
  pending.resolve();
  await first;
  assert.equal(f.buttons()[0]!.disabled, false);
  await f.click();
  assert.equal(writeText.mock.callCount(), 2);
});

for (const success of [true, false]) {
  it(`gives the latest ${success ? "success" : "failure"} feedback a full two seconds`, async t => {
    const f = fixture(t, { clipboard: null, fallback: () => success });
    const feedback = success ? "Copied!" : "Failed";
    await f.click();
    t.mock.timers.tick(1000);
    await f.click();
    t.mock.timers.tick(1000);
    assert.equal(
      f.buttons()[0]!.textContent,
      feedback,
      "The first timer must not reset the latest feedback"
    );
    t.mock.timers.tick(999);
    assert.equal(f.buttons()[0]!.textContent, feedback);
    t.mock.timers.tick(1);
    assert.equal(f.buttons()[0]!.textContent, "Copy");
  });
}

it("keeps feedback timers independent between code blocks", async t => {
  const f = fixture(t, {
    html: '<pre class="astro-code"><code>a</code></pre><pre class="astro-code"><code>b</code></pre>',
  });
  await f.click(0);
  t.mock.timers.tick(1000);
  await f.click(1);
  t.mock.timers.tick(1000);
  assert.deepEqual(
    f.buttons().map(button => button.textContent),
    ["Copy", "Copied!"]
  );
  t.mock.timers.tick(1000);
  assert.deepEqual(
    f.buttons().map(button => button.textContent),
    ["Copy", "Copy"]
  );
});

it("reports a missing code element without attempting to copy", async t => {
  const f = fixture(t, { html: '<pre class="astro-code"></pre>' });
  await f.click();
  assert.equal(f.buttons()[0]!.textContent, "No code");
  assert.equal(f.buttons()[0]!.disabled, false);
  assert.equal(f.writeText.mock.callCount(), 0);
  assert.equal(f.execCommand.mock.callCount(), 0);
});
