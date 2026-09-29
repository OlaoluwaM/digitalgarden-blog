/**
 * Tests for `npm run sync-callouts`, which copies the Obsidian vault's custom
 * callout types (color and icon) into the site: the color rules in
 * src/styles/content/callouts.css, the icon map in
 * src/plugins/hast/callout-icons.ts.
 *
 * Why these levels: the merge rules (which vault values win, which are
 * unusable) are pure, so unit tests pin them against the vault's real data
 * shapes. The command is run against a temporary project and vault, since
 * its job is reading and rewriting files. The checked-in outputs are
 * compared with each other, since a hand edit to one would desync them.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import {
  collectCustomCallouts,
  generatedBlock,
  replaceGenerated,
  toRgbTriplet,
  type AdmonitionSettings,
} from "../scripts/callout-sync.ts";

const repository = fileURLToPath(new URL("../", import.meta.url));

// The vault's real shapes (plugin data.json and its generated snippet, plus
// the hand-written snippet that overrides `exercise`), trimmed to the
// fields the sync reads. The SVG strings stand in for the plugin's inlined
// Font Awesome icons.
const PLUGIN: AdmonitionSettings = {
  userAdmonitions: {
    "ai-text": {
      color: "rgb(116, 227, 161)",
      icon: { name: "robot", type: "fas" },
    },
    wikipedia: {
      color: "rgb(232, 230, 227)",
      icon: { name: "book", type: "fas" },
    },
    highlight: {
      color: "rgb(250, 179, 135)",
      icon: { name: "marker", type: "fas" },
    },
    remember: {
      color: "rgb(249, 226, 175)",
      icon: { name: "lightbulb", type: "fas" },
    },
    aside: {
      color: "rgb(127, 132, 156)",
      icon: { name: "comment-alt", type: "font-awesome" },
    },
    exercise: {
      color: "#7d7d7d",
      icon: { name: "lucide-pencil-line", type: "obsidian" },
    },
  },
};
const PLUGIN_SNIPPET = `
.callout[data-callout="ai-text"] { --callout-color: rgb(116, 227, 161); --callout-icon: "<svg class=\\"fa-robot\\"></svg>"; }
.callout[data-callout="aside"] { --callout-color: rgb(127, 132, 156); --callout-icon: ""; }
.callout[data-callout="exercise"] { --callout-icon: lucide-pencil-line; }
`;
const EDITS_SNIPPET = `
.callout[data-callout="exercise"] {
\t--callout-color: 183, 148, 246;
\t/* #B794F6 */
\t--callout-icon: lucide-pencil-line;
}
`;
// What the site holds today, synced from that vault.
const SYNCED = [
  { type: "ai-text", color: "116, 227, 161", icon: "bot" },
  { type: "wikipedia", color: "232, 230, 227", icon: "book-open" },
  { type: "highlight", color: "250, 179, 135", icon: "highlighter" },
  { type: "remember", color: "249, 226, 175", icon: "lightbulb" },
  { type: "aside", color: "127, 132, 156", icon: "message-square" },
  { type: "exercise", color: "183, 148, 246", icon: "pencil-line" },
];

describe("collectCustomCallouts", () => {
  // Why: the vault as it is today must produce exactly what the site holds,
  // or the first sync would change the site's callouts.
  it("reproduces the site's custom types from the vault's data", () => {
    const { callouts, problems } = collectCustomCallouts(PLUGIN, [
      PLUGIN_SNIPPET,
      EDITS_SNIPPET,
    ]);
    assert.deepEqual(problems, []);
    assert.deepEqual(callouts, SYNCED);
  });

  // Why: Obsidian applies enabled snippets over the plugin's settings, and
  // a later snippet over an earlier one, so the site must pick the same
  // value Obsidian shows.
  it("lets snippets override the plugin, later snippets winning", () => {
    const { callouts } = collectCustomCallouts(
      {
        userAdmonitions: {
          tip2: { color: "1, 2, 3", icon: { name: "bot", type: "obsidian" } },
        },
      },
      [
        `.callout[data-callout="tip2"] { --callout-color: 4, 5, 6; --callout-icon: lucide-star; }`,
        `.callout[data-callout="tip2"] { --callout-color: 7, 8, 9; }`,
      ]
    );
    assert.deepEqual(callouts, [
      { type: "tip2", color: "7, 8, 9", icon: "star" },
    ]);
  });

  // Why: snippets also hold values only Obsidian can use (an inlined SVG, an
  // empty icon, a theme variable). Those must not replace a usable value.
  it("ignores snippet values the site cannot use", () => {
    const { callouts } = collectCustomCallouts(
      {
        userAdmonitions: {
          tip2: { color: "1, 2, 3", icon: { name: "bot", type: "obsidian" } },
        },
      },
      [
        `.callout[data-callout="tip2"] { --callout-color: var(--ctp-yellow); --callout-icon: "<svg></svg>"; }`,
        `.callout[data-callout="tip2"] { --callout-icon: ""; }`,
      ]
    );
    assert.deepEqual(callouts, [
      { type: "tip2", color: "1, 2, 3", icon: "bot" },
    ]);
  });

  // Why: the site styles Obsidian's own types itself; only custom types
  // come from the vault.
  it("skips Obsidian's standard types", () => {
    const { callouts } = collectCustomCallouts({ userAdmonitions: {} }, [
      `.callout[data-callout="warning"] { --callout-color: 1, 2, 3; --callout-icon: lucide-bot; }`,
    ]);
    assert.deepEqual(callouts, []);
  });

  // Why: a type the site cannot render correctly must stop the sync with a
  // reason, not publish a callout with no icon or no color.
  it("reports types it cannot resolve, and takes overrides for them", () => {
    const vault: AdmonitionSettings = {
      userAdmonitions: {
        odd: { color: "1, 2, 3", icon: { name: "dragon", type: "fas" } },
        glyph: {
          color: "1, 2, 3",
          icon: { name: "quote-glyph", type: "obsidian" },
        },
      },
    };
    const snippets = [
      `.callout[data-callout="idea"] { --callout-color: var(--ctp-yellow); --callout-icon: lucide-lightbulb; }`,
    ];
    const { callouts, problems } = collectCustomCallouts(vault, snippets);
    assert.deepEqual(callouts, []);
    assert.equal(problems.length, 3, problems.join("\n"));
    assert.match(problems.join("\n"), /odd.*dragon/);
    assert.match(problems.join("\n"), /glyph.*quote-glyph/);
    assert.match(problems.join("\n"), /idea.*var\(--ctp-yellow\)/);

    const fixed = collectCustomCallouts(vault, snippets, {
      icons: { odd: "flame", glyph: "quote" },
      colors: { idea: "249, 226, 175" },
    });
    assert.deepEqual(fixed.problems, []);
    assert.deepEqual(
      fixed.callouts.map(({ type, icon }) => [type, icon]),
      [
        ["odd", "flame"],
        ["glyph", "quote"],
        ["idea", "lightbulb"],
      ]
    );
  });
});

describe("toRgbTriplet", () => {
  // Why: the vault writes colors four ways, and the site's CSS needs one
  // (`R, G, B`, used inside rgba()).
  it("reads every color form the vault uses", () => {
    for (const value of [
      "116, 227, 161",
      "116 227 161",
      "rgb(116, 227, 161)",
      "rgb(116 227 161)",
      "#74e3a1",
    ]) {
      assert.equal(toRgbTriplet(value), "116, 227, 161", value);
    }
    assert.equal(toRgbTriplet("#fff"), "255, 255, 255");
    for (const value of ["var(--ctp-yellow)", "", "300, 0, 0", "red"]) {
      assert.equal(toRgbTriplet(value), undefined, value);
    }
  });
});

describe("replaceGenerated", () => {
  const markers = { start: "/* start */", end: "/* end */" };

  // Why: the sync owns only its block; everything around it is hand-written.
  it("replaces only the text between the markers", () => {
    assert.equal(
      replaceGenerated("a\n/* start */\nold\n/* end */\nb", "new\n", markers),
      "a\n/* start */\nnew\n/* end */\nb"
    );
  });

  // Why: without its markers the sync cannot know what it owns, so it must
  // stop rather than guess.
  it("fails when a marker is missing", () => {
    assert.throws(
      () => replaceGenerated("a\n/* start */\nb", "", markers),
      /\/\* end \*\//
    );
  });
});

describe("the checked-in outputs", () => {
  // Why: the colors and the icon map are written together by the sync; a
  // hand edit to one would leave a type with a color but no icon, or the
  // reverse.
  it("list the same custom types in the CSS and the icon map", async () => {
    const css = generatedBlock(
      await readFile(
        join(repository, "src/styles/content/callouts.css"),
        "utf8"
      ),
      "css"
    );
    const icons = generatedBlock(
      await readFile(
        join(repository, "src/plugins/hast/callout-icons.ts"),
        "utf8"
      ),
      "ts"
    );
    const types = (block: string, pattern: RegExp) =>
      [...block.matchAll(pattern)].map(match => match[1]);
    assert.deepEqual(
      types(icons, /^\s*"?([\w-]+)"?:/gm),
      types(css, /data-callout="([^"]+)"/g)
    );
    assert.deepEqual(
      types(css, /data-callout="([^"]+)"/g),
      SYNCED.map(c => c.type)
    );
  });
});

// A project with the two target files as they are in the repository, and
// a vault with the given plugin data and snippets.
async function fixture(
  t: TestContext,
  vault: { plugin: object; snippets: Record<string, string>; enabled: string[] }
) {
  const root = await mkdtemp(join(tmpdir(), "sync-callouts-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const targets = [
    "src/styles/content/callouts.css",
    "src/plugins/hast/callout-icons.ts",
  ];
  for (const file of [...targets, ".prettierrc"]) {
    await mkdir(dirname(join(root, "project", file)), { recursive: true });
    await copyFile(join(repository, file), join(root, "project", file));
  }
  await symlink(
    join(repository, "node_modules"),
    join(root, "project/node_modules")
  );

  const obsidian = join(root, "vault/.obsidian");
  await mkdir(join(obsidian, "plugins/obsidian-admonition"), {
    recursive: true,
  });
  await mkdir(join(obsidian, "snippets"), { recursive: true });
  await writeFile(
    join(obsidian, "plugins/obsidian-admonition/data.json"),
    JSON.stringify(vault.plugin)
  );
  await writeFile(
    join(obsidian, "appearance.json"),
    JSON.stringify({ enabledCssSnippets: vault.enabled })
  );
  for (const [name, css] of Object.entries(vault.snippets)) {
    await writeFile(join(obsidian, "snippets", `${name}.css`), css);
  }

  const project = join(root, "project");
  const read = () =>
    Promise.all(targets.map(file => readFile(join(project, file), "utf8")));
  return { project, vault: join(root, "vault"), read };
}

async function sync(cwd: string, args: string[]) {
  const child = spawn(
    process.execPath,
    [join(repository, "scripts/sync-callouts.ts"), ...args],
    { cwd, stdio: ["ignore", "pipe", "pipe"] }
  );
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
  const [code] = (await once(child, "close")) as [number];
  return { code, output };
}

describe("npm run sync-callouts", () => {
  // Why: today's vault must leave the checked-in files unchanged, byte for
  // byte (formatting included), and a disabled snippet must not count.
  it("leaves the site unchanged for today's vault", async t => {
    const { project, vault, read } = await fixture(t, {
      plugin: PLUGIN,
      snippets: {
        "custom-admonitions.25685e": PLUGIN_SNIPPET,
        "new-custom-edits": EDITS_SNIPPET,
        "catppuccin-edits": `.callout[data-callout="idea"] { --callout-color: var(--ctp-yellow); --callout-icon: lucide-lightbulb; }`,
      },
      enabled: ["custom-admonitions.25685e", "new-custom-edits"],
    });
    const before = await read();
    const { code, output } = await sync(project, ["--vault", vault]);
    assert.equal(code, 0, output);
    assert.deepEqual(await read(), before);
  });

  // Why: a new vault type must reach both files in one run, and nothing
  // else: Eleventy's Sass copy went with Eleventy.
  it("writes a new type to every target", async t => {
    const plugin = structuredClone(PLUGIN);
    plugin.userAdmonitions["pro-tip"] = {
      color: "#b4befe",
      icon: { name: "star", type: "fas" },
    };
    const { project, vault, read } = await fixture(t, {
      plugin,
      snippets: {},
      enabled: [],
    });
    const { code, output } = await sync(project, ["--vault", vault]);
    assert.equal(code, 0, output);
    const [css, icons] = await read();
    assert.match(
      css!,
      /\.callout\[data-callout="pro-tip"\] \{\s*--callout-color: 180, 190, 254;\s*\}/
    );
    assert.match(icons!, /"pro-tip": "star",/);
    await assert.rejects(
      readFile(join(project, "src/site/styles/user/callouts.scss"))
    );
    assert.match(output, /pro-tip/);
  });

  // Why: an unresolvable type must leave every file as it was, and the run
  // must end by saying which types failed and how to fix each, so the
  // problems are the last thing on screen. `--icon` and `--color` resolve
  // them without editing the vault.
  it("fails without writing on problems, and accepts overrides", async t => {
    const plugin = structuredClone(PLUGIN);
    plugin.userAdmonitions["odd"] = {
      color: "1, 2, 3",
      icon: { name: "dragon", type: "fas" },
    };
    const { project, vault, read } = await fixture(t, {
      plugin,
      snippets: {},
      enabled: [],
    });
    const before = await read();

    // The report lists what resolved, then ends with what did not: each
    // type, why, and the option that fixes it.
    const failed = await sync(project, ["--vault", vault]);
    assert.equal(failed.code, 1);
    const [resolved, unresolved] = failed.output.split(/^Not synced/m);
    assert.ok(unresolved, failed.output);
    assert.match(resolved!, /ai-text/);
    assert.match(unresolved, /odd.*dragon.*--icon odd=/);
    assert.match(unresolved, /nothing was written/i);
    assert.doesNotMatch(unresolved, /ai-text/);
    assert.deepEqual(await read(), before);

    const fixed = await sync(project, [
      "--vault",
      vault,
      "--icon",
      "odd=flame",
    ]);
    assert.equal(fixed.code, 0, fixed.output);
    assert.match((await read())[1]!, /odd: "flame",/);
  });
});
