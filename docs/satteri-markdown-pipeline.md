# Satteri Markdown Pipeline

Olaolu's understanding, drafted from memory; corrections and additions from Claude are marked as `[!ai-text]` blockquotes.

## Key Questions

- What is Sätteri and where does it sit in an Astro project?
- What are the stages markdown goes through before it becomes HTML in the browser?
- What is the difference between mdast and hast, and why are there two plugin stages?
- What is a *visitor*, and who does the tree traversal — the plugin or the engine?
- Why does an mdast plugin set node properties instead of writing HTML directly?

## How It Works

Satteri first generates the markdown AST by parsing the markdown. From there we have what is called mdast plugins which is code that transforms the resulting markdown AST. The function these plugins define (that Satteri runs) on the AST nodes are called visitors. The process for this is:

- Satteri traverses the tree, once for each plugin
- Applies the plugin's specified transformation to whatever node or nodes the plugin is keyed on/registered for.

After all the plugins have ran and transformed the MD AST, Satteri converts the Markdown AST (MDAST) to an HTML AST (HAST).

Following that conversion is another similar AST transformation sequence but on the HTML AST using HAST plugins. After the plugins/visitors have transformed HTML AST, Satteri serializes it into proper HTML. The end result is what we see in the browser.

> [!ai-text] **Context: what Sätteri is.**
> Sätteri is Astro's default markdown processor since Astro v7 — a Rust-based engine replacing the older unified (remark/rehype) pipeline, which is still available opt-in. The same two-stage model applies there: remark plugins = mdast stage, rehype plugins = hast stage. The concepts in this note transfer between both.

## More Info

The plugin's transformation is applied to whatever node or nodes the plugin is keyed on — the plugin does not search the tree itself.

> [!ai-text] Why Two Plugin Stages?
> Each stage matches a different kind of concern. Markdown-semantics work (recognizing `[[wikilinks]]` in text, math syntax) belongs in the mdast stage, where the tree still speaks in markdown terms (`text`, `link`, `paragraph`). HTML-output work (wrapping blockquotes into callout markup, decorating `<a>` tags) belongs in the hast stage, where the tree speaks in elements and attributes. Working at the right altitude keeps a plugin from parsing someone else's output format.

> [!ai-text] **The visitor vocabulary.**
> The function a plugin registers is called a **visitor** — keyed by node type, receiving `(node, ctx)` and able to return a replacement. Sätteri is the *walker*: it owns the traversal loop and invokes visitors when it reaches a matching node. The visitor is the inspector, the engine is the guide walking it through the building. Also: visitors run on **nodes** (typed tree pieces), not tokens — tokens are the earlier, parser-internal stage and are gone by plugin time.
>
> Plugins execute in array order, each seeing the changes the previous ones made.

> [!ai-text] **Cross-stage implication (why hProperties, not HTML strings).**
> An mdast plugin thinks only in markdown terms and never writes HTML. Whatever it emits is *converted* by the next stage — e.g. a `link` node becomes an `<a>` element, and the node's `hProperties` (like `class: "is-unresolved"` on a dead wikilink) become that element's attributes. Everything a plugin produces is visible to later stages; nothing from later stages is visible to it.

## References

- [Sätteri plugin docs](https://satteri.bruits.org/docs/plugins/)
- [Astro markdown guide](https://docs.astro.build/en/guides/markdown-content/)
