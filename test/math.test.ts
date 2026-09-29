/**
 * Render through the site's Astro processor: math must match Eleventy's
 * markdown-it-mathjax3 output, which renders TeX to self-contained SVG at
 * build time with assistive MathML and inline styles. These are processor
 * tests, not full builds or browser checks.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateConfig } from "astro/config";
import { parse, type HTMLElement } from "node-html-parser";
import siteConfig from "../astro.config.ts";

const { markdown } = await validateConfig(
  siteConfig,
  fileURLToPath(new URL("../", import.meta.url)),
  "build"
);
const renderer = await markdown.processor.createRenderer(markdown);

async function render(source: string) {
  const { code } = await renderer.render(source);
  return parse(code, { blockTextElements: { script: true, style: true } });
}

function mathContainers(document: HTMLElement) {
  return document.querySelectorAll("mjx-container");
}

function assertRenderedMath(container: HTMLElement, display: boolean) {
  assert.ok(container.classList.contains("MathJax"));
  assert.equal(container.getAttribute("jax"), "SVG");
  assert.equal(container.getAttribute("display") === "true", display);
  assert.ok(container.querySelector("svg"), "Expected an SVG rendering");
  // Errors render as SVG too; they must not pass as successful output.
  // Syntax errors carry data-mjx-error; undefined macros render in red.
  assert.equal(container.querySelector("[data-mjx-error]"), null);
  assert.equal(container.querySelector("merror"), null);
  assert.equal(container.querySelector('[mathcolor="red"]'), null);
}

describe("inline math", () => {
  it("renders $…$ as a MathJax SVG container", async () => {
    const document = await render("The value $p$ is returned.");
    const containers = mathContainers(document);
    assert.equal(containers.length, 1);
    assertRenderedMath(containers[0], false);
    assert.equal(document.querySelector("code"), null);
    assert.doesNotMatch(document.text, /\$/);
  });

  it("does not turn * or _ between expressions into emphasis", async () => {
    // From the Maths note: Markdown emphasis previously spanned these.
    const document = await render(
      "Thus, $p = (a_n * x) + a_{n-1} = a_n*x + a_{n-1}$. Since $i = n-1$, $p$ is also equal to $a_n*x + a_i$."
    );
    assert.equal(mathContainers(document).length, 4);
    assert.equal(document.querySelector("em"), null);
    assert.equal(document.querySelector("strong"), null);
  });

  it("supports the TeX commands the Maths note uses", async () => {
    const document = await render(
      "$\\text{3, the index} = n-i$ and $a_{n-3}*x^{n-i-3} + \\ldots + a_{i}$"
    );
    const containers = mathContainers(document);
    assert.equal(containers.length, 2);
    for (const container of containers) assertRenderedMath(container, false);
  });

  it("keeps each expression self-contained", async () => {
    // Why: an expression is copied into the feed and into notes that embed
    // this one, so every glyph it reuses must be defined in its own SVG,
    // not in another expression's. Glyph IDs must also be unique on the
    // page, or a reference could reach another expression's glyph.
    const document = await render("$x$ and $x^2$ and $x$");
    const containers = mathContainers(document);
    assert.equal(containers.length, 3);
    const ids: string[] = [];
    for (const container of containers) {
      const defined = container
        .querySelectorAll("defs [id]")
        .map(glyph => glyph.id);
      const used = container
        .querySelectorAll("use")
        .map(use => use.getAttribute("xlink:href") ?? use.getAttribute("href"));
      assert.ok(used.length > 0, "Expected reused glyphs");
      for (const reference of used) {
        assert.ok(defined.includes(reference?.slice(1) ?? ""), reference);
      }
      ids.push(...defined);
    }
    assert.equal(new Set(ids).size, ids.length, ids.join(", "));
  });

  it("keeps surrounding prose and punctuation", async () => {
    const document = await render("Before $x$, after.");
    const paragraph = document.querySelector("p");
    assert.ok(paragraph);
    assert.equal(paragraph.childNodes[0].text, "Before ");
    assert.equal(paragraph.childNodes.at(-1)?.text, ", after.");
  });
});

describe("accessibility and styles", () => {
  it("hides the SVG from assistive technology and adds MathML", async () => {
    const document = await render("$a_i$");
    const container = mathContainers(document)[0];
    assert.ok(container);
    assert.equal(
      container.querySelector("svg")?.getAttribute("aria-hidden"),
      "true"
    );
    const assistive = container.querySelector("mjx-assistive-mml");
    assert.ok(assistive, "Expected assistive MathML");
    assert.equal(assistive.getAttribute("display"), "inline");
    assert.ok(assistive.querySelector("math"));
  });

  it("inlines the styles that visually hide the assistive MathML", async () => {
    // Eleventy inlines MathJax's stylesheet with juice; without it the
    // MathML copy is visible beside the SVG.
    const document = await render("$a_i$");
    const container = mathContainers(document)[0];
    assert.ok(container);
    assert.match(container.getAttribute("style") ?? "", /position:\s*relative/);
    const assistiveStyle =
      container.querySelector("mjx-assistive-mml")?.getAttribute("style") ?? "";
    assert.match(assistiveStyle, /position:\s*absolute/);
    assert.match(assistiveStyle, /clip:\s*rect\(1px,\s*1px,\s*1px,\s*1px\)/);
    assert.equal(document.querySelector("style"), null);
  });
});

describe("display math", () => {
  it("renders $$…$$ as display math instead of a code block", async () => {
    const document = await render("$$\nx^2 + \\ldots\n$$");
    const containers = mathContainers(document);
    assert.equal(containers.length, 1);
    assertRenderedMath(containers[0], true);
    assert.equal(document.querySelector("pre"), null);
  });
});

describe("math in callouts", () => {
  it("renders math inside a native callout", async () => {
    const document = await render("> [!note]\n> The value $a_n*x$ holds.");
    assert.ok(document.querySelector(".callout"));
    const containers = mathContainers(document);
    assert.equal(containers.length, 1);
    assertRenderedMath(containers[0], false);
  });

  it("renders math inside a converted ad-* fence", async () => {
    const document = await render(
      "```ad-note\ntitle: Invariant\n$p = a_n*x + a_i$\n```"
    );
    assert.ok(document.querySelector(".callout"));
    const containers = mathContainers(document);
    assert.equal(containers.length, 1);
    assertRenderedMath(containers[0], false);
  });
});

describe("non-math dollars", () => {
  it("leaves dollars in inline code and code fences literal", async () => {
    const document = await render(
      "`$not math$`\n\n```sh\necho $HOME and $PATH\n```"
    );
    assert.equal(mathContainers(document).length, 0);
    assert.match(document.text, /\$not math\$/);
    assert.match(document.text, /\$HOME/);
  });

  it("leaves an escaped dollar literal", async () => {
    const document = await render("It costs \\$5.");
    assert.equal(mathContainers(document).length, 0);
    assert.match(document.text, /\$5/);
  });
});
