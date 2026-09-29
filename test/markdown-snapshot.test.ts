/**
 * A snapshot of one note that uses every Markdown feature the site
 * supports, rendered through the site's own processor (docs/
 * markdown-pipeline.md): the HTML, and the headings and embedded-heading
 * positions the page receives.
 *
 * Why a snapshot, and why this level: the other Markdown tests pin the
 * rules each plugin owns. Dependency updates (Astro, Sätteri, Shiki,
 * MathJax arrive together in Dependabot's grouped pull request) can change
 * everything else: attributes, wrappers, class names, whitespace. A whole-
 * output snapshot shows any such change in review. The note is written
 * here, not taken from the vault, so publishing never changes it. Its
 * wikilinks are in the publisher's form (full path, `\|` before the alias,
 * which the publisher always adds) and point at two real notes (Home and
 * Dotfiles Reorg) through the real index. Diagrams come from the local
 * fake Kroki.
 *
 * Update deliberately, after reading the diff:
 * node --test --test-update-snapshots test/markdown-snapshot.test.ts
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateConfig } from "astro/config";
import { startFakeKroki, type FakeKroki } from "./support/fake-kroki.ts";
import { publisherEmbed } from "./support/publisher-embed.ts";

const HOME = "Outbox/Digital Garden & Blog/Home";
const DOTFILES =
  "Outbox/Digital Garden & Blog/Content/Blogposts/Dotfiles Reorg";

const NOTE = [
  "Plain text with *emphasis*, **bold**, `inline code`, ~~struck~~ text, and a line  ",
  'break. An [external link](https://example.com/page), a [relative link](/posts/), <a href="/raw/">raw HTML</a>, and mail@example.com.',
  "",
  `Wikilinks: [[${HOME}\\|Home]], [[${DOTFILES}#Setup\\|a heading]], [[${DOTFILES}#^block-id\\|Dotfiles Reorg]], and [[Missing note]].`,
  "",
  "==Highlighted **bold** text== and == not a highlight ==.",
  "",
  "A line broken with a single newline",
  "and the line after it.",
  "",
  "## A section",
  "",
  "Inline math $a^2 + b^2 = c^2$ and display math:",
  "",
  "$$\\sum_{i=0}^{n} i = \\frac{n(n+1)}{2}$$",
  "",
  "### A subsection",
  "",
  "- One",
  "  - Nested",
  "- Two",
  "",
  "1. First",
  "2. Second",
  "",
  "- [x] Done **task**",
  "- [ ] Open task",
  "  - [ ] Nested task",
  "",
  "A paragraph with a block ID. ",
  "{ #block-id}",
  "",
  "| Left | Centre | Right |",
  "| :--- | :----: | ----: |",
  "| `a` | b | 1 |",
  "",
  "> A quote with a [[" + HOME + "\\|wikilink]].",
  "",
  "> [!note]- Collapsed callout",
  "> Callout body,",
  "> on two lines.",
  ">",
  "> > [!tip] Nested",
  "> > Inner body.",
  "",
  "```ad-warning",
  "title: An admonition",
  "Admonition body with $x$.",
  "```",
  "",
  "```ts",
  "const answer: number = 42;",
  "```",
  "",
  "```",
  "plain fence",
  "```",
  "",
  "```mermaid",
  "graph LR",
  "  A --> B",
  "```",
  "",
  "![Remote image](https://example.com/image.png)",
  "",
  "![Sized image\\|300](https://example.com/sized.png)",
  "",
  "A footnote reference.[^1]",
  "",
  "---",
  publisherEmbed({
    href: "/posts/dotfiles-reorg-a-journey/#Why",
    body: "## Why\n\nEmbedded text with a [[" + HOME + "\\|wikilink]].",
  }),
  publisherEmbed({ title: "# Embed title", body: "Unpublished text." }),
  "",
  "[^1]: The footnote.",
].join("\n");

let kroki: FakeKroki;
let cacheDir: string;
let rendered: {
  code: string;
  metadata: {
    headings: unknown[];
    frontmatter: Record<string, unknown>;
  };
};

before(async () => {
  kroki = await startFakeKroki();
  cacheDir = await mkdtemp(join(tmpdir(), "markdown-snapshot-test-"));
  // The site's config reads these when it builds its plugins.
  process.env.KROKI_URL = kroki.url;
  process.env.KROKI_CACHE_DIR = cacheDir;
  const { default: siteConfig } = await import("../astro.config.ts");
  const { markdown } = await validateConfig(
    siteConfig,
    fileURLToPath(new URL("../", import.meta.url)),
    "build"
  );
  const renderer = await markdown.processor.createRenderer(markdown);
  rendered = await renderer.render(NOTE, { frontmatter: {} });
});

after(async () => {
  await kroki?.close();
  await rm(cacheDir, { recursive: true, force: true });
});

// Store text as is, so the snapshot file reads like HTML.
const asText = { serializers: [(value: unknown) => String(value)] };

describe("Markdown snapshot", () => {
  it("renders the reviewed HTML", t => {
    t.assert.snapshot(rendered.code, asText);
  });

  it("collects the reviewed headings", t => {
    t.assert.snapshot(
      JSON.stringify(
        {
          headings: rendered.metadata.headings,
          embeddedHeadings: rendered.metadata.frontmatter.embeddedHeadings,
        },
        null,
        2
      ),
      asText
    );
  });
});
