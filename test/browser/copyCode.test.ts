/**
 * Run the initializer in Chrome with real DOM elements, events, focus, and
 * selection. Clipboard failures are mocked; one case uses the real clipboard.
 * Fake timers keep feedback timing tests fast and deterministic.
 */
import { afterEach, assert, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { initializeCopyButtons } from "../../src/scripts/copyCode.ts";

let root: HTMLElement;

afterEach(() => {
  root?.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function fixture(
  options: {
    html?: string;
    clipboard?: object | null;
    fallback?: () => boolean;
    nativeClipboard?: boolean;
  } = {}
) {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.spyOn(console, "error").mockImplementation(() => {});
  root = document.createElement("main");
  root.innerHTML =
    options.html ?? '<pre class="astro-code"><code>example</code></pre>';
  document.body.append(root);
  const writeText = vi.fn(async (_text: string) => {});
  if (!options.nativeClipboard) {
    vi.spyOn(navigator, "clipboard", "get").mockReturnValue(
      (options.clipboard === undefined
        ? { writeText }
        : options.clipboard) as Clipboard
    );
  }
  const textareas: HTMLTextAreaElement[] = [];
  const execCommand = vi
    .spyOn(document, "execCommand")
    .mockImplementation(command => {
      assert.strictEqual(command, "copy");
      const textarea = document.querySelector("textarea");
      assert.ok(
        textarea,
        "The fallback textarea must be attached while copying"
      );
      textareas.push(textarea);
      assert.strictEqual(document.activeElement, textarea);
      assert.strictEqual(textarea.selectionStart, 0);
      assert.strictEqual(textarea.selectionEnd, textarea.value.length);
      return options.fallback?.() ?? true;
    });

  initializeCopyButtons();
  const buttons = () =>
    Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
  return {
    root,
    writeText,
    execCommand,
    textareas,
    buttons,
    async click(index = 0) {
      await page.elementLocator(buttons()[index]!).click();
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}
it("adds one button per Astro block and leaves other code alone", () => {
  const f = fixture({
    html: '<pre class="astro-code"><code>a</code></pre><pre class="astro-code"><code>b</code></pre><pre><code>plain</code></pre><p><code>inline</code></p>',
  });
  assert.strictEqual(f.buttons().length, 2);
  for (const button of f.buttons()) {
    assert.strictEqual(button.getAttribute("class"), "copy-code-btn");
    assert.strictEqual(button.type, "button");
    assert.strictEqual(button.textContent, "Copy");
  }
  initializeCopyButtons();
  assert.strictEqual(f.buttons().length, 2);
  assert.strictEqual(
    f.root.querySelectorAll("pre:not(.astro-code) button, p button").length,
    0
  );
});

for (const text of ['  const x = "<&>";\n\n\tconsole.log(x);\n', ""]) {
  it(`copies ${text ? "exact text, including whitespace and special characters" : "an empty code block"}`, async () => {
    const f = fixture();
    f.root.querySelector("code")!.textContent = text;
    await f.click();
    assert.deepEqual(f.writeText.mock.calls, [[text]]);
    assert.strictEqual(f.execCommand.mock.calls.length, 0);
    assert.strictEqual(f.buttons()[0]!.textContent, "Copied!");
    assert.strictEqual(f.buttons()[0]!.disabled, false);
    await vi.advanceTimersByTimeAsync(1999);
    assert.strictEqual(f.buttons()[0]!.textContent, "Copied!");
    await vi.advanceTimersByTimeAsync(1);
    assert.strictEqual(f.buttons()[0]!.textContent, "Copy");
  });
}

for (const [name, clipboard] of [
  ["missing clipboard", null],
  ["missing writeText", {}],
  ["non-callable writeText", { writeText: true }],
] as const) {
  it(`uses the textarea fallback for ${name}`, async () => {
    const f = fixture({ clipboard });
    const text = "  first\n\tsecond & <third>\n";
    f.root.querySelector("code")!.textContent = text;
    await f.click();
    assert.strictEqual(f.execCommand.mock.calls.length, 1);
    assert.strictEqual(f.textareas[0]!.value, text);
    assert.strictEqual(f.root.querySelector("textarea"), null);
    assert.strictEqual(f.buttons()[0]!.textContent, "Copied!");
    assert.strictEqual(f.buttons()[0]!.disabled, false);
  });
}

it("falls back after a rejected clipboard write", async () => {
  const writeText = vi.fn(async (_text: string) => {
    throw new Error("Permission denied");
  });
  const f = fixture({ clipboard: { writeText } });
  await f.click();
  assert.strictEqual(writeText.mock.calls.length, 1);
  assert.strictEqual(f.execCommand.mock.calls.length, 1);
  assert.strictEqual(f.textareas[0]!.value, "example");
  assert.strictEqual(f.root.querySelector("textarea"), null);
  assert.strictEqual(f.buttons()[0]!.textContent, "Copied!");
  assert.strictEqual(f.buttons()[0]!.disabled, false);
});

for (const throws of [false, true]) {
  it(`cleans up and reports failure when the fallback ${throws ? "throws" : "returns false"}`, async () => {
    const f = fixture({
      clipboard: null,
      fallback: () => {
        if (throws) throw new Error("Copy failed");
        return false;
      },
    });
    await f.click();
    assert.strictEqual(f.execCommand.mock.calls.length, 1);
    assert.strictEqual(f.root.querySelector("textarea"), null);
    assert.strictEqual(f.buttons()[0]!.textContent, "Failed");
    assert.strictEqual(f.buttons()[0]!.disabled, false);
    await vi.advanceTimersByTimeAsync(2000);
    assert.strictEqual(f.buttons()[0]!.textContent, "Copy");
  });
}

it("ignores overlapping clicks and allows another copy once settled", async () => {
  const pending = Promise.withResolvers<void>();
  const writeText = vi.fn(() => pending.promise);
  const f = fixture({ clipboard: { writeText } });
  await f.click();
  assert.strictEqual(f.buttons()[0]!.disabled, true);
  f.buttons()[0]!.dispatchEvent(new MouseEvent("click"));
  assert.strictEqual(writeText.mock.calls.length, 1);
  pending.resolve();
  await vi.advanceTimersByTimeAsync(0);
  assert.strictEqual(f.buttons()[0]!.disabled, false);
  await f.click();
  assert.strictEqual(writeText.mock.calls.length, 2);
});

for (const success of [true, false]) {
  it(`gives the latest ${success ? "success" : "failure"} feedback a full two seconds`, async () => {
    const f = fixture({ clipboard: null, fallback: () => success });
    const feedback = success ? "Copied!" : "Failed";
    await f.click();
    await vi.advanceTimersByTimeAsync(1000);
    await f.click();
    await vi.advanceTimersByTimeAsync(1000);
    assert.strictEqual(
      f.buttons()[0]!.textContent,
      feedback,
      "The first timer must not reset the latest feedback"
    );
    await vi.advanceTimersByTimeAsync(999);
    assert.strictEqual(f.buttons()[0]!.textContent, feedback);
    await vi.advanceTimersByTimeAsync(1);
    assert.strictEqual(f.buttons()[0]!.textContent, "Copy");
  });
}

it("keeps feedback timers independent between code blocks", async () => {
  const f = fixture({
    html: '<pre class="astro-code"><code>a</code></pre><pre class="astro-code"><code>b</code></pre>',
  });
  await f.click(0);
  await vi.advanceTimersByTimeAsync(1000);
  await f.click(1);
  await vi.advanceTimersByTimeAsync(1000);
  assert.deepEqual(
    f.buttons().map(button => button.textContent),
    ["Copy", "Copied!"]
  );
  await vi.advanceTimersByTimeAsync(1000);
  assert.deepEqual(
    f.buttons().map(button => button.textContent),
    ["Copy", "Copy"]
  );
});

it("reports a missing code element without attempting to copy", async () => {
  const f = fixture({ html: '<pre class="astro-code"></pre>' });
  await f.click();
  assert.strictEqual(f.buttons()[0]!.textContent, "No code");
  assert.strictEqual(f.buttons()[0]!.disabled, false);
  assert.strictEqual(f.writeText.mock.calls.length, 0);
  assert.strictEqual(f.execCommand.mock.calls.length, 0);
});

it("copies exact text to the real browser clipboard", async () => {
  const f = fixture({ nativeClipboard: true });
  vi.useRealTimers();
  const text = '  const value = "<&>";\n\n\tconsole.log(value);\n';
  f.root.querySelector("code")!.textContent = text;
  // Keep the locator independent of the changing Copy/Copied! label.
  const button = page.getByRole("button");
  await button.click();
  await expect.element(button).toHaveTextContent("Copied!");
  assert.strictEqual(await navigator.clipboard.readText(), text);
  assert.strictEqual(f.execCommand.mock.calls.length, 0);
  await expect.element(button).toHaveTextContent("Copy");
});
