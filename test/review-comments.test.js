const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const markdownIt = require("markdown-it");

const { parseExpression } = require("../src/helpers/bases-engine/exprParser");
const { evalExpr } = require("../src/helpers/bases-engine/exprEval");
const { executeBaseQuery, renderViews } = require("../src/helpers/bases-engine");
const { basesPlugin, clearRenderCache } = require("../src/helpers/basesPlugin");
const { getGraph } = require("../src/helpers/linkUtils");

describe("bases expression review fixes", () => {
	it("evaluates logical expressions parsed by jsep as LogicalExpression nodes", () => {
		const ast = parseExpression('status == "open" && priority > 1');
		const result = evalExpr(ast, {
			metadata: {
				status: "open",
				priority: 2,
			},
		});

		assert.equal(result, true);
	});

	it("handles folder membership edge cases safely", () => {
		assert.equal(
			evalExpr(parseExpression('file.inFolder("notes/projects")'), {
				path: "notes/projects/demo.md",
				metadata: {},
			}),
			true,
		);
		assert.equal(
			evalExpr(parseExpression('file.inFolder("/")'), {
				path: "demo.md",
				metadata: {},
			}),
			true,
		);
		assert.equal(
			evalExpr(parseExpression('file.inFolder("notes")'), {
				metadata: {},
			}),
			false,
		);
	});

	it("matches links by normalized path instead of substring", () => {
		assert.equal(
			evalExpr(parseExpression('file.hasLink("/foo/")'), {
				metadata: {
					links: ["/foo-bar/"],
				},
			}),
			false,
		);
		assert.equal(
			evalExpr(parseExpression('file.hasLink("/foo")'), {
				metadata: {
					links: ["/foo/"],
				},
			}),
			true,
		);
	});
});

describe("bases rendering review fixes", () => {
	it("filters synthetic system tags from file.tags columns", () => {
		const result = executeBaseQuery(
			[
				"views:",
				"  - type: table",
				"    order: [file.tags]",
			].join("\n"),
			[
				{
					path: "demo.md",
					url: "/demo/",
					metadata: {
						tags: ["note", "gardenEntry", "project"],
					},
				},
			],
		);

		const html = renderViews(result, []);

		assert.match(html, /project/);
		assert.doesNotMatch(html, /gardenEntry/);
		assert.doesNotMatch(html, />note</);
	});

	beforeEach(() => {
		clearRenderCache();
	});

	it("invalidates cached base renders when note metadata changes", () => {
		const md = markdownIt();
		basesPlugin(md);
		const content = [
			"```base",
			"views:",
			"  - type: table",
			"    order: [status]",
			"```",
		].join("\n");
		const firstNotes = [
			{
				path: "demo.md",
				url: "/demo/",
				fileSlug: "demo",
				metadata: { status: "Open" },
			},
		];
		const secondNotes = [
			{
				path: "demo.md",
				url: "/demo/",
				fileSlug: "demo",
				metadata: { status: "Closed" },
			},
		];

		const firstRender = md.render(content, { basesNotes: firstNotes });
		const secondRender = md.render(content, { basesNotes: secondNotes });

		assert.match(firstRender, /Open/);
		assert.match(secondRender, /Closed/);
		assert.doesNotMatch(secondRender, /Open/);
	});

	it("keeps a single delegated document click handler in the bases script", () => {
		const script = fs.readFileSync(
			path.join(
				__dirname,
				"../src/site/_includes/components/basesScript.njk",
			),
			"utf8",
		);

		assert.equal(
			(script.match(/document\.addEventListener\("click"/g) || []).length,
			1,
		);
		assert.match(script, /if \(container\.contains\(event\.target\)\) return;/);
	});
});

describe("graph extraction review fixes", () => {
	it("extracts base links from fences with trailing info text", async () => {
		const graph = await getGraph({
			collections: {
				note: [
					{
						url: "/source/",
						fileSlug: "source",
						filePathStem: "/notes/source",
						data: {
							title: "Source",
							tags: ["note"],
						},
						template: {
							read: async () => ({
								content: [
									"```base   {.wide}",
									"views:",
									"  - type: table",
									'    filters: file.name == "target"',
									"    order: [file.name]",
									"```",
								].join("\n"),
							}),
						},
					},
					{
						url: "/target/",
						fileSlug: "target",
						filePathStem: "/notes/target",
						data: {
							title: "Target",
							tags: ["note"],
						},
						template: {
							read: async () => ({ content: "" }),
						},
					},
				],
			},
		});

		assert.ok(graph.nodes["/source/"].outBound.includes("/target/"));
		assert.ok(graph.nodes["/target/"].backLinks.includes("/source/"));
	});
});
