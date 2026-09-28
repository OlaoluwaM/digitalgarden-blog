/**
 * Build the lookup table that turns a wikilink into its destination URL.
 * For example, src/site/notes/Guides/My Note.md becomes the target
 * "Guides/My Note". Its frontmatter permalink supplies the destination,
 * so [[Guides/My Note]] can link to /posts/my-note/.
 *
 * Run `npm run generate:wikilink-index` from the repository root with Node 24.
 * The npm commands for Astro dev and build run this first through their
 * predev and prebuild hooks. This script runs once and exits;
 * it doesn't watch for later note changes. Rerun it when the index needs updating.
 *
 * Read notes from src/site/notes and write src/generated/wikilink-index.ts.
 * Edit the notes or this generator when the mapping needs to change. Manual
 * changes to the generated file will be overwritten on the next successful run.
 * Run `npm run test:wikilink-index` to check the generator with temporary notes.
 */
import {
  glob,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { z } from "astro/zod";
import matter from "gray-matter";
import { format, resolveConfig } from "prettier";

import { permalinkSchema } from "../src/content/permalinks.ts";

// Frontmatter is the metadata block at the start of a note. Check the two
// fields this script uses: a valid permalink and an optional list of tags.
// Reuse the content collection's permalink rules so both accept the same paths.
// A missing tags field becomes []; a supplied value must be an array of strings.
const frontmatterSchema = z.object({
  permalink: permalinkSchema,
  tags: z.array(z.string()).default([]),
});

/**
 * Read and validate every matching note, then replace the generated index.
 * Resolves without a return value on success. Throws on failure so the command
 * below can report the problem and exit with a failure status.
 */
async function generateWikilinkIndex(): Promise<void> {
  // resolve() starts from the process's working directory. The tests use this
  // to run the same script against a temporary project with its own notes.
  const notesDirectory = resolve("src/site/notes");
  const outputFile = resolve("src/generated/wikilink-index.ts");
  // A failed stat becomes the message below. This currently treats every stat
  // error as a missing path; it doesn't separately check whether it's a directory.
  const isNotesDirectory = await stat(notesDirectory).catch(() => null);

  if (!isNotesDirectory) {
    throw new Error(`Notes path does not exist: ${notesDirectory}`);
  }

  // glob() finds .md and .mdx files in the notes folder and its subfolders.
  // It yields paths as they become available. Array.fromAsync waits for them
  // all and collects them into an array that we can sort before reading files.
  // Sorting makes the processing order repeatable, including which error we
  // report first when several notes are invalid. The output is sorted separately.
  const files = await Array.fromAsync(
    glob("**/*.{md,mdx}", { cwd: notesDirectory })
  ).then(f => f.sort());

  // Keep the original filename beside each destination so a duplicate-target
  // error can name both files. Different targets may share a destination here.
  // Duplicate published page routes are checked separately in posts.ts.
  const entriesByTarget = new Map<
    string,
    { sourceFile: string; permalink: string }
  >();

  for (const file of files) {
    // Use the path relative to the notes folder, with its final extension removed.
    // Keep folder names, spaces, and case: "Guides/My Note.md" becomes
    // "Guides/My Note". Use / between folders on every operating system.
    const target = file
      .split(sep)
      .join("/")
      .replace(/\.(md|mdx)$/, "");

    // Note.md and Note.mdx in the same folder would claim the same target.
    // Reject that ambiguity before one entry can overwrite the other.
    const existing = entriesByTarget.get(target);

    if (existing) {
      throw new Error(
        `Duplicate wikilink target "${target}": ${existing.sourceFile}, ${file}`
      );
    }

    try {
      const source = await readFile(join(notesDirectory, file), "utf8");
      // gray-matter reads the opening metadata block, including the publisher's
      // JSON-shaped metadata and ordinary YAML. Text in the note body cannot
      // override these fields. safeParse returns either checked data or errors.
      const result = frontmatterSchema.safeParse(matter(source).data);

      if (!result.success) {
        throw new Error(z.prettifyError(result.error));
      }

      // Index every matching file, including notes with dg-publish: false, to
      // preserve the previous generator's behavior. An index entry alone doesn't
      // establish whether the site builds a page for that destination.
      // A gardenEntry points to the home route. Validate its stored permalink
      // first, even though the index will use / as its destination.
      const { permalink, tags } = result.data;
      entriesByTarget.set(target, {
        sourceFile: file,
        permalink: tags.includes("gardenEntry") ? "/" : permalink,
      });
    } catch (error) {
      // Include the filename in read, parsing, and validation errors so you can
      // find the note to fix. Keep the original error as the cause for debugging.
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Cannot index "${file}": ${message}`, { cause: error });
    }
  }

  // Sort targets by their UTF-8 bytes, matching the Bash script's LC_ALL=C sort.
  // This avoids language-specific sorting rules changing the generated diff.
  // Once sorted, discard source filenames and keep [target, destination] pairs.
  const entries = [...entriesByTarget]
    .sort(([left], [right]) =>
      Buffer.compare(Buffer.from(left), Buffer.from(right))
    )
    .map(([target, entry]) => [target, entry.permalink]);

  // JSON.stringify escapes quotes and backslashes in names before they become
  // TypeScript source. Object.fromEntries turns the pairs into the lookup object.
  // It also creates an ordinary entry for a target named __proto__; writing that
  // name directly as an object-literal key would give it special behavior.
  // The generated interface allows undefined because a requested target may
  // have no entry. The wikilink plugin handles that missing-target case.
  const source = `// This file is generated by scripts/generate-wikilink-index.ts
// Do not edit this file by hand

export interface WikilinkIndex {
  [wikilinkTarget: string]: string | undefined;
}

export const wikilinkIndex: WikilinkIndex = Object.fromEntries(${JSON.stringify(entries)});
`;
  // Use the repository's Prettier settings so a generated file follows the same
  // formatting as handwritten TypeScript. Finish this before touching the output:
  // an invalid formatter configuration should leave the previous index in place.
  const formatted = await format(source, {
    ...(await resolveConfig(outputFile)),
    filepath: outputFile,
    parser: "typescript",
  });

  // Write a complete temporary file before replacing the existing index. Putting
  // it beside the output keeps both on the same filesystem, where rename can
  // replace the file in one step. Readers don't see a partly written index.
  // An empty notes folder is valid and produces an empty lookup object.
  const outputDirectory = dirname(outputFile);
  await mkdir(outputDirectory, { recursive: true });
  const temporaryDirectory = await mkdtemp(
    join(outputDirectory, ".wikilink-index-")
  );

  try {
    const temporaryFile = join(temporaryDirectory, "wikilink-index.ts");
    await writeFile(temporaryFile, formatted, "utf8");
    await rename(temporaryFile, outputFile);
  } finally {
    // Remove the temporary folder after either success or failure. If writing
    // or renaming fails, this also removes any temporary file left behind.
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

// Report a readable error and mark the command as failed. npm can then stop
// the dev/build command when its generator hook fails. Setting exitCode lets
// Node finish pending work before exiting.
try {
  await generateWikilinkIndex();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
