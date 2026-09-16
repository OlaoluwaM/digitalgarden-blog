import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parse, type HTMLElement } from "node-html-parser";
import { defineHastPlugin, markdownToHtml } from "satteri";
import type { Element, ElementContent, Text } from "hast";

import { hastAdmonitionCalloutPlugin } from "../src/plugins/hast/callout.ts";
import { mkmdastAdmonitionCalloutPlugin } from "../src/plugins/mdast/admonitions.ts";
import { mkmdastWikilinksPlugin } from "../src/plugins/mdast/wikilinks.ts";

// Exercise the public plugin through Sätteri. Assertions describe the HTML
// expected by the existing callout styles and browser script. Whitespace,
// attribute order, and the implementation's helper functions can vary.
// Browser interaction is separate; nested ad-* conversion is exercised below
// with both the MDAST converter and HAST renderer enabled.
const render = (markdown: string) =>
  markdownToHtml(markdown, {
    hastPlugins: [hastAdmonitionCalloutPlugin],
  }).html;

function required(parent: HTMLElement, selector: string): HTMLElement {
  const element = parent.querySelector(selector);
  assert.ok(element, `Expected ${selector} in:\n${parent.outerHTML}`);
  return element;
}

function callout(markdown: string): HTMLElement {
  return required(parse(render(markdown)), ".callout");
}

function title(element: HTMLElement): HTMLElement {
  const heading = required(element, ".callout-title");
  assert.equal(
    heading.parentNode,
    element,
    "Title must belong to this callout"
  );
  return required(heading, ".callout-title-inner");
}

function body(element: HTMLElement): HTMLElement {
  const content = required(element, ".callout-content");
  assert.equal(content.parentNode, element, "Body must belong to this callout");
  return content;
}

const text = (value: string): Text => ({ type: "text", value });
const element = (
  tagName: string,
  children: ElementContent[] = [],
  properties: Element["properties"] = {}
): Element => ({ type: "element", tagName, properties, children });

// Supply exact HAST shapes through an earlier plugin. Markdown parsing would
// normalize some whitespace and cannot express every empty-node case below.
// These still exercise the public callout plugin, without exporting its helpers.
function renderBlockquote(
  children: ElementContent[],
  transform = true
): string {
  const fixture = defineHastPlugin({
    name: "test-callout-fixture",
    element: {
      filter: ["blockquote"],
      visit() {
        return element("blockquote", structuredClone(children));
      },
    },
  });
  return markdownToHtml("> Fixture", {
    hastPlugins: transform ? [fixture, hastAdmonitionCalloutPlugin] : [fixture],
  }).html;
}

function calloutFromParagraph(children: ElementContent[]): HTMLElement {
  return required(
    parse(renderBlockquote([element("p", children)])),
    ".callout"
  );
}

describe("hastAdmonitionCalloutPlugin", () => {
  it("builds the callout wrapper, title, and body from a blockquote", () => {
    const element = callout("> [!note] My title\n>\n> Body text.");
    assert.equal(element.tagName, "DIV");
    assert.equal(element.getAttribute("data-callout"), "note");
    assert.equal(title(element).textContent, "My title");
    assert.equal(body(element).innerHTML.trim(), "<p>Body text.</p>");
    assert.ok(!element.textContent.includes("[!note]"));
  });

  for (const [type, expected] of [
    ["note", "Note"],
    ["custom-type", "Custom Type"],
    ["ai-text", "AI Text"],
    ["constructor", "Constructor"],
    ["AI-TEXT", "AI Text"],
  ]) {
    it(`uses the default title ${expected} when ${type} has no title`, () => {
      const element = callout(`> [!${type}]\n>\n> Body`);
      assert.equal(element.getAttribute("data-callout"), type.toLowerCase());
      assert.equal(title(element).textContent, expected);
    });
  }

  it("normalizes the type's case without changing the supplied title", () => {
    const element = callout("> [!WARNING] Keep THIS Title\n>\n> Body");
    assert.equal(element.getAttribute("data-callout"), "warning");
    assert.equal(title(element).textContent, "Keep THIS Title");
  });

  it("preserves callout metadata from the marker", () => {
    const element = callout("> [!note|wide] My title\n>\n> Body");
    assert.equal(element.getAttribute("data-callout"), "note");
    assert.equal(element.getAttribute("data-callout-metadata"), "wide");
    assert.equal(title(element).textContent, "My title");
  });

  for (const [marker, collapsible, collapsed] of [
    ["", true, false],
    ["+", true, false],
    ["-", true, true],
  ] as const) {
    it(`sets collapse classes and the fold container for ${marker || "no marker"}`, () => {
      const element = callout(`> [!note]${marker} Title\n>\n> Body`);
      assert.equal(element.classList.contains("is-collapsible"), collapsible);
      assert.equal(element.classList.contains("is-collapsed"), collapsed);
      const heading = required(element, ".callout-title");
      assert.equal(
        heading.querySelectorAll(".callout-fold").length,
        collapsible ? 1 : 0
      );
      assert.equal(title(element).textContent, "Title");
      assert.equal(body(element).textContent.trim(), "Body");
    });
  }

  it("preserves inline formatting and links in the title", () => {
    const element = callout("> [!note] A **bold** [title](/guide/)\n>\n> Body");
    const heading = title(element);
    assert.equal(heading.textContent, "A bold title");
    assert.equal(required(heading, "strong").textContent, "bold");
    assert.equal(required(heading, "a").getAttribute("href"), "/guide/");
  });

  it("trims title padding without removing spaces between formatted words", () => {
    const element = callout(
      "> [!note]   **A** *formatted* title   \n>\n> Body"
    );
    assert.equal(title(element).textContent, "A formatted title");
    assert.equal(required(title(element), "strong").textContent, "A");
    assert.equal(required(title(element), "em").textContent, "formatted");
  });

  it("uses the default title when the supplied title is only whitespace", () => {
    const element = callout("> [!note]   \n>\n> Body");
    assert.equal(title(element).textContent, "Note");
  });

  it("keeps the body when it shares a paragraph with the marker line", () => {
    const element = callout(
      "> [!note] Title\n> First **body** line.\n> Second line."
    );
    assert.equal(title(element).textContent, "Title");
    assert.equal(
      body(element).textContent.trim(),
      "First body line.\nSecond line."
    );
    assert.equal(required(body(element), "strong").textContent, "body");
  });

  it("renders a title-only callout without retaining the marker", () => {
    const element = callout("> [!note] Just a title");
    assert.equal(title(element).textContent, "Just a title");
    assert.equal(element.textContent.trim(), "Just a title");
    // An absent body and an empty content wrapper are both acceptable.
    const content = element.querySelector(".callout-content");
    if (content) assert.equal(content.textContent.trim(), "");
  });

  it("preserves paragraphs, emphasis, links, lists, and literal code in the body", () => {
    const markdown = [
      "First **bold** and *emphasized* [link](/guide/).",
      "",
      "- One",
      "- Two",
      "",
      "`[!warning]`",
      "",
      "```text",
      "[!tip] literal code",
      "```",
    ].join("\n");
    const quoted = markdown
      .split("\n")
      .map(line => `> ${line}`)
      .join("\n");
    const element = callout(`> [!note] Title\n>\n${quoted}`);
    assert.equal(
      body(element).innerHTML.trim(),
      markdownToHtml(markdown).html.trim()
    );
  });

  it("keeps escaped title text as text", () => {
    const element = callout(
      "> [!note] &lt;img src=x onerror=alert(1)&gt;\n>\n> Body"
    );
    assert.equal(title(element).textContent, "<img src=x onerror=alert(1)>");
    assert.equal(element.querySelector("img"), null);
  });

  for (const [name, markdown] of [
    ["ordinary blockquote", "> An ordinary quotation."],
    [
      "marker in a later paragraph",
      "> Ordinary opening.\n>\n> [!note] Example",
    ],
    ["marker after other text", "> Explaining [!note] syntax."],
    ["marker in inline code", "> `[!note]` Example"],
    ["marker in a code fence", "```text\n> [!note] Example\n```"],
    ["empty type", "> [!] Example"],
    ["unclosed marker", "> [!note Example"],
    ["unclosed metadata", "> [!note|wide Example"],
    ["metadata without a type", "> [!|wide] Example"],
    ["space inside the type", "> [!not a type] Example"],
    [
      "list before the marker paragraph",
      "> - Keep this list.\n>\n> [!note] Later",
    ],
  ]) {
    it(`preserves the input for ${name}`, () => {
      assert.equal(render(markdown), markdownToHtml(markdown).html);
    });
  }

  it("preserves existing attributes and classes on the blockquote", () => {
    const annotate = defineHastPlugin({
      name: "test-blockquote-properties",
      element: {
        filter: ["blockquote"],
        visit(node, ctx) {
          ctx.setProperty(node, "id", "keep-me");
          ctx.setProperty(node, "className", ["existing"]);
          ctx.setProperty(node, "data-source", "fixture");
        },
      },
    });
    const { html } = markdownToHtml("> [!note] Title\n>\n> Body", {
      hastPlugins: [annotate, hastAdmonitionCalloutPlugin],
    });
    const element = required(parse(html), ".callout");
    assert.equal(element.id, "keep-me");
    assert.ok(element.classList.contains("existing"));
    assert.equal(element.getAttribute("data-source"), "fixture");
  });

  it("transforms nested callouts with independent titles and collapse states", () => {
    const element = callout(
      [
        "> [!note]+ Outer",
        ">",
        "> Before.",
        ">",
        "> > [!tip]- Inner",
        "> >",
        "> > Inside **bold**.",
        ">",
        "> After.",
      ].join("\n")
    );
    assert.equal(title(element).textContent, "Outer");
    assert.ok(element.classList.contains("is-collapsible"));
    assert.ok(!element.classList.contains("is-collapsed"));
    const content = body(element);
    assert.ok(content.textContent.includes("Before."));
    assert.ok(content.textContent.includes("After."));
    const inner = required(content, '.callout[data-callout="tip"]');
    assert.equal(title(inner).textContent, "Inner");
    assert.ok(inner.classList.contains("is-collapsible"));
    assert.ok(inner.classList.contains("is-collapsed"));
    assert.equal(body(inner).textContent.trim(), "Inside bold.");
    assert.equal(required(body(inner), "strong").textContent, "bold");
    assert.equal(element.querySelectorAll(".callout").length, 1);
    assert.equal(element.querySelectorAll("blockquote").length, 0);
  });

  it("keeps an ordinary quotation inside a callout", () => {
    const element = callout("> [!note] Outer\n>\n> > Just a quotation.");
    assert.equal(
      required(body(element), "blockquote").textContent.trim(),
      "Just a quotation."
    );
    assert.equal(element.querySelectorAll(".callout").length, 0);
  });

  it("does not turn an ordinary outer quotation into its nested callout", () => {
    const document = parse(
      render("> Ordinary outer quote.\n>\n> > [!tip] Inner\n> >\n> > Body")
    );
    const outer = required(document, "blockquote");
    assert.ok(!outer.classList.contains("callout"));
    assert.ok(outer.textContent.includes("Ordinary outer quote."));
    const inner = required(outer, ".callout");
    assert.equal(title(inner).textContent, "Inner");
    assert.equal(body(inner).textContent.trim(), "Body");
  });

  it("transforms sibling callouts without mixing their contents", () => {
    const document = parse(
      render("> [!note] First\n>\n> One\n\n> [!tip] Second\n>\n> Two")
    );
    const elements = document.querySelectorAll(".callout");
    assert.equal(elements.length, 2);
    assert.deepEqual(
      elements.map(element => title(element).textContent),
      ["First", "Second"]
    );
    assert.deepEqual(
      elements.map(element => body(element).textContent.trim()),
      ["One", "Two"]
    );
  });
});

describe("callout header boundaries", () => {
  for (const [name, prefix] of [
    ["no leading text", []],
    ["one newline", [text("\n")]],
    [
      "multiple whitespace nodes",
      [text(""), text(" \t"), text("\r\n"), text("\n")],
    ],
  ] as const) {
    it(`accepts a header after ${name} and preserves the following body`, () => {
      const html = renderBlockquote([
        ...prefix,
        element("p", [text("[!note] Title")]),
        text("\n"),
        element("p", [text("Body")]),
      ]);
      const callout = required(parse(html), ".callout");
      assert.equal(title(callout).textContent, "Title");
      assert.equal(body(callout).innerHTML, "\n<p>Body</p>");
    });
  }

  const laterHeader = element("p", [text("[!note] Later")]);
  for (const [name, children] of [
    ["empty blockquote", []],
    ["whitespace-only blockquote", [text(""), text(" \t\r\n")]],
    ["empty first paragraph", [element("p"), laterHeader]],
    [
      "whitespace-only first paragraph",
      [element("p", [text(" ")]), laterHeader],
    ],
    ["ordinary text before the paragraph", [text("Keep me"), laterHeader]],
    [
      "list before the paragraph",
      [
        text("\n"),
        element("ul", [element("li", [text("Keep me")])]),
        laterHeader,
      ],
    ],
    [
      "formatted marker",
      [element("p", [element("strong", [text("[!note]")])])],
    ],
    ["newline inside the marker", [element("p", [text("[!no\nte] Title")])]],
    [
      "newline inside metadata",
      [element("p", [text("[!note|wide\nlayout] Title")])],
    ],
  ] satisfies [string, ElementContent[]][]) {
    it(`leaves ${name} unchanged`, () => {
      assert.equal(
        renderBlockquote(children),
        renderBlockquote(children, false)
      );
    });
  }

  for (const [header, expectedTitle, collapsed] of [
    ["[!note]Title", "Title", false],
    ["[!note]-Title", "Title", true],
    ["[!note] -Title", "-Title", false],
    ["[!note]++Title", "+Title", false],
  ] as const) {
    it(`leaves text after the marker alone in ${header}`, () => {
      const callout = calloutFromParagraph([text(header)]);
      assert.equal(title(callout).textContent, expectedTitle);
      assert.equal(callout.classList.contains("is-collapsed"), collapsed);
    });
  }

  it("preserves empty metadata without consuming the title", () => {
    const callout = calloutFromParagraph([text("[!note|] Title")]);
    assert.equal(callout.getAttribute("data-callout-metadata"), "");
    assert.equal(title(callout).textContent, "Title");
  });

  it("does not add metadata when the marker omits it", () => {
    const callout = calloutFromParagraph([text("[!note] Title")]);
    assert.equal(callout.getAttribute("data-callout-metadata"), undefined);
  });

  it("uses a text title for __proto__ rather than an inherited object property", () => {
    // Markdown treats the underscores as formatting, so supply the literal HAST.
    const callout = calloutFromParagraph([text("[!__proto__]")]);
    assert.equal(title(callout).textContent, "__proto__");
  });

  it("handles Windows line endings in Markdown", () => {
    const calloutElement = callout(
      "> [!note] Title\r\n> First body line.\r\n> Second line."
    );
    assert.equal(title(calloutElement).textContent, "Title");
    assert.equal(
      body(calloutElement).textContent.trim(),
      "First body line.\r\nSecond line."
    );
  });
});

describe("callout title and body splitting", () => {
  it("keeps formatted title siblings together before a later newline", () => {
    const callout = calloutFromParagraph([
      text("[!note] A "),
      element("strong", [text("bold")]),
      text(" title\nBody "),
      element("em", [text("one\ntwo")]),
      text("\nthree"),
    ]);
    assert.equal(title(callout).textContent, "A bold title");
    assert.equal(title(callout).querySelectorAll("strong").length, 1);
    assert.equal(
      body(callout).innerHTML,
      "<p>Body <em>one\ntwo</em>\nthree</p>"
    );
  });

  it("splits nested formatting at the first newline and preserves ancestor attributes", () => {
    const callout = calloutFromParagraph([
      text("[!note] "),
      element(
        "strong",
        [text("A "), element("em", [text("title\nbody")]), text(" tail")],
        { className: ["keep-me"] }
      ),
      text(" after\nlater"),
    ]);
    const heading = required(title(callout), ".callout-title-content");
    assert.equal(
      heading.innerHTML,
      '<strong class="keep-me">A <em>title</em></strong>'
    );
    assert.equal(
      body(callout).innerHTML,
      '<p><strong class="keep-me"><em>body</em> tail</strong> after\nlater</p>'
    );
  });

  it("keeps a link around each side when its text crosses the boundary", () => {
    const callout = calloutFromParagraph([
      text("[!note] "),
      element("a", [text("Title\nBody")], { href: "/guide/", title: "Guide" }),
    ]);
    assert.equal(
      required(title(callout), "a").outerHTML,
      '<a href="/guide/" title="Guide">Title</a>'
    );
    assert.equal(
      body(callout).innerHTML,
      '<p><a href="/guide/" title="Guide">Body</a></p>'
    );
  });

  it("does not duplicate wrappers or siblings when there is no newline", () => {
    const callout = calloutFromParagraph([
      text("[!note] "),
      element("strong", [
        text("One "),
        element("em", [text("two")]),
        text(" three"),
      ]),
    ]);
    assert.equal(
      required(title(callout), ".callout-title-content").innerHTML,
      "<strong>One <em>two</em> three</strong>"
    );
    assert.equal(
      callout.querySelector(".callout-content")?.innerHTML ?? "",
      ""
    );
  });

  it("keeps later siblings in the body when the boundary has no remainder text", () => {
    const callout = calloutFromParagraph([
      text("[!note] Title\n"),
      element("strong", [text("Body")]),
      text(" tail"),
    ]);
    assert.equal(title(callout).textContent, "Title");
    assert.equal(body(callout).innerHTML, "<p><strong>Body</strong> tail</p>");
  });

  it("supplies a default title when the boundary is the first title character", () => {
    const callout = calloutFromParagraph([text("[!note]\nBody")]);
    assert.equal(title(callout).textContent, "Note");
    assert.equal(body(callout).innerHTML, "<p>Body</p>");
  });

  it("omits empty formatting on the title side of a split", () => {
    const callout = calloutFromParagraph([
      text("[!note] "),
      element("em", [text("\nBody")]),
    ]);
    assert.equal(title(callout).textContent, "Note");
    assert.equal(title(callout).querySelector("em"), null);
    assert.equal(body(callout).innerHTML, "<p><em>Body</em></p>");
  });

  it("omits empty formatting on the body side of a split", () => {
    const callout = calloutFromParagraph([
      text("[!note] "),
      element("em", [text("Title\n")]),
      element("strong", [text("Body")]),
    ]);
    assert.equal(required(title(callout), "em").textContent, "Title");
    assert.equal(body(callout).innerHTML, "<p><strong>Body</strong></p>");
  });

  it("does not create a body paragraph for an empty trailing remainder", () => {
    const callout = calloutFromParagraph([text("[!note] Title\n")]);
    assert.equal(title(callout).textContent, "Title");
    assert.equal(callout.querySelector(".callout-content p"), null);
  });

  it("preserves whitespace-only remainder text before a formatted body sibling", () => {
    const callout = calloutFromParagraph([
      text("[!note] Title\n \t"),
      element("strong", [text("Body")]),
    ]);
    assert.equal(body(callout).innerHTML, "<p> \t<strong>Body</strong></p>");
  });

  it("keeps childless images on both sides of the boundary", () => {
    const callout = calloutFromParagraph([
      text("[!note] "),
      element("img", [], { src: "/title.png", alt: "Title" }),
      text("\n"),
      element("img", [], { src: "/body.png", alt: "Body" }),
    ]);
    assert.equal(
      required(title(callout), "img").getAttribute("src"),
      "/title.png"
    );
    assert.equal(
      required(body(callout), "img").getAttribute("src"),
      "/body.png"
    );
    assert.equal(title(callout).textContent, "");
  });

  it("trims nested title edges while preserving spaces between formatted words", () => {
    const callout = calloutFromParagraph([
      text("[!note]   "),
      element("strong", [
        text("  A "),
        element("em", [text("bold ")]),
        text(" title  "),
      ]),
      text("  \nBody"),
    ]);
    assert.equal(
      required(title(callout), ".callout-title-content").innerHTML,
      "<strong>A <em>bold </em> title</strong>"
    );
    assert.equal(body(callout).innerHTML, "<p>Body</p>");
  });

  it("defaults the title when nested formatting contains only padding", () => {
    const callout = calloutFromParagraph([
      text("[!note] "),
      element("strong", [element("em", [text(" \t")])]),
      text("\nBody"),
    ]);
    assert.equal(title(callout).textContent, "Note");
    assert.equal(title(callout).querySelector("strong"), null);
  });

  it("does not leak split state between consecutive renders", () => {
    const first = calloutFromParagraph([text("[!note] First\nBody")]);
    const second = calloutFromParagraph([
      text("[!tip] Second"),
      element("strong", [text(" title")]),
    ]);
    assert.equal(title(first).textContent, "First");
    assert.equal(body(first).textContent, "Body");
    assert.equal(title(second).textContent, "Second title");
    assert.equal(second.querySelector(".callout-content")?.innerHTML ?? "", "");
  });
});

describe("callout plugin composition", () => {
  const index = { "Some Note": "/posts/some-note/" };
  const mdastPlugins = [
    mkmdastWikilinksPlugin(index),
    mkmdastAdmonitionCalloutPlugin(index),
  ];

  it("renders nested ad-* fences with independent titles, collapse states, and wikilinks", () => {
    const markdown = [
      "````ad-note",
      "title: Outer",
      "collapse: false",
      "Before.",
      "",
      "```ad-aside",
      "title: Inner **title**",
      "collapse: true",
      "See [[Some Note|this note]] and [[Missing]].",
      "```",
      "",
      "After.",
      "````",
    ].join("\n");
    const { html } = markdownToHtml(markdown, {
      features: { wikilinks: true },
      mdastPlugins,
      hastPlugins: [hastAdmonitionCalloutPlugin],
    });
    const document = parse(html);
    const outer = required(document, '.callout[data-callout="note"]');
    const inner = required(body(outer), '.callout[data-callout="aside"]');
    assert.equal(document.querySelectorAll(".callout").length, 2);
    assert.equal(title(outer).textContent, "Outer");
    assert.equal(title(inner).textContent, "Inner title");
    assert.equal(required(title(inner), "strong").textContent, "title");
    assert.ok(outer.classList.contains("is-collapsible"));
    assert.ok(inner.classList.contains("is-collapsible"));
    assert.ok(!outer.classList.contains("is-collapsed"));
    assert.ok(inner.classList.contains("is-collapsed"));
    assert.equal(body(inner).textContent.trim(), "See this note and Missing.");
    const resolved = required(body(inner), 'a[href="/posts/some-note/"]');
    assert.equal(resolved.textContent, "this note");
    assert.ok(resolved.classList.contains("internal-link"));
    assert.ok(!resolved.classList.contains("is-unresolved"));
    assert.ok(
      required(body(inner), 'a[href="/404"]').classList.contains(
        "is-unresolved"
      )
    );
    const siblings = body(outer).children.filter(
      child => child.tagName === "P"
    );
    assert.deepEqual(
      siblings.map(child => child.textContent),
      ["Before.", "After."]
    );
    assert.equal(outer.querySelector("pre"), null);
    assert.equal(outer.querySelector("blockquote"), null);
  });

  for (const [name, metadata, expectedTitle, collapsed] of [
    ["omitted title and collapse", "", "Note", false],
    ["empty explicit title", "title:\n", "Note", false],
    [
      "formatted explicit title",
      "title: A **bold** title\n",
      "A bold title",
      false,
    ],
    ["closed callout", "collapse: true\n", "Note", true],
    ["open callout", "collapse: false\n", "Note", false],
  ] as const) {
    it(`handles ${name} in a converted admonition`, () => {
      const { html } = markdownToHtml(
        `\`\`\`ad-note\n${metadata}Body\n\`\`\``,
        {
          mdastPlugins,
          hastPlugins: [hastAdmonitionCalloutPlugin],
        }
      );
      const callout = required(parse(html), ".callout");
      assert.equal(title(callout).textContent, expectedTitle);
      if (name === "formatted explicit title") {
        assert.equal(required(title(callout), "strong").textContent, "bold");
      }
      assert.ok(callout.classList.contains("is-collapsible"));
      assert.equal(callout.classList.contains("is-collapsed"), collapsed);
      assert.equal(body(callout).textContent.trim(), "Body");
    });
  }

  for (const [type, expected] of [
    ["note", "Note"],
    ["custom-type", "Custom Type"],
    ["ai-text", "AI Text"],
  ]) {
    it(`supplies the default title ${expected} after converting an ad-${type} fence`, () => {
      const { html } = markdownToHtml(`\`\`\`ad-${type}\nBody\n\`\`\``, {
        mdastPlugins,
        hastPlugins: [hastAdmonitionCalloutPlugin],
      });
      const element = required(parse(html), ".callout");
      assert.equal(title(element).textContent, expected);
      assert.equal(body(element).textContent.trim(), "Body");
    });
  }

  // These run the actual Markdown and HTML plugins together. They don't prove
  // Astro registration, CSS, icons, or browser toggling.
  for (const [name, markdown] of [
    [
      "native callout",
      "> [!note] Example\n>\n> See [[Some Note|this note]] and [[Missing]].",
    ],
    [
      "converted ad-note fence",
      "```ad-note\ntitle: Example\n\nSee [[Some Note|this note]] and [[Missing]].\n```",
    ],
  ]) {
    it(`renders a ${name} while preserving resolved and unresolved wikilinks`, () => {
      const { html } = markdownToHtml(markdown, {
        features: { wikilinks: true },
        mdastPlugins,
        hastPlugins: [hastAdmonitionCalloutPlugin],
      });
      const element = required(parse(html), '.callout[data-callout="note"]');
      assert.equal(title(element).textContent, "Example");
      const content = body(element);
      const resolved = required(content, 'a[href="/posts/some-note/"]');
      assert.equal(resolved.textContent, "this note");
      assert.ok(resolved.classList.contains("internal-link"));
      assert.ok(!resolved.classList.contains("is-unresolved"));
      const missing = required(content, 'a[href="/404"]');
      assert.equal(missing.textContent, "Missing");
      assert.ok(missing.classList.contains("internal-link"));
      assert.ok(missing.classList.contains("is-unresolved"));
    });
  }
});
