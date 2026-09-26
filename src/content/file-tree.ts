// Pure tree builder for the sidebar/mobile file tree (`SiteNavigation`).
// Ports the sort rules from Eleventy's `src/helpers/filetreeUtils.js`
// (`sortTree`'s `defaultCompare`, ~lines 33-80): folders before files, notes
// by created date newest first, natural-name fallback. `pinned` is unused in
// that file and is not ported.
//
// Kept free of `astro:content` and any runtime import of `./posts.ts`, so
// plain `node --test` can load this module directly; `Post` is a type-only
// import and is erased before this file ever runs.
import type { Post } from "./posts.ts";
import { isHomePost } from "./home.ts";

export interface FileTreeFolderNode {
  readonly type: "folder";
  /** The raw dg-path segment, e.g. " Posts" (leading space preserved). */
  readonly name: string;
  readonly children: readonly FileTreeNode[];
}

export interface FileTreeFileNode {
  readonly type: "file";
  readonly title: string;
  readonly href: string;
}

export type FileTreeNode = FileTreeFolderNode | FileTreeFileNode;

/**
 * Build the sidebar/file-tree structure from published posts. Folder
 * structure comes from each post's `dg-path` (e.g. " Posts/Be deliberate.md"
 * yields a " Posts" folder containing a "Be deliberate" file). The display
 * title is `rawNoteProps.title`; the href is `/` for the garden entry
 * (`isHomePost`) and `pluginProps.permalink` otherwise.
 */
export function buildFileTree(posts: readonly Post[]): readonly FileTreeNode[] {
  const root = new Map<string, BuildEntry>();

  for (const post of posts) {
    const segments = post.data.pluginProps["dg-path"].split("/");
    insert(root, segments, post);
  }

  return toSortedNodes(root);
}

/* -------------------------------------------------------------------------- */
/*                                  // Build                                  */
/* -------------------------------------------------------------------------- */

type BuildEntry = BuildFolderEntry | BuildFileEntry;

interface BuildFolderEntry {
  readonly type: "folder";
  readonly children: Map<string, BuildEntry>;
}

interface BuildFileEntry {
  readonly type: "file";
  readonly post: Post;
}

function insert(
  level: Map<string, BuildEntry>,
  segments: readonly string[],
  post: Post
): void {
  const [head, ...rest] = segments;
  if (head === undefined) return; // An empty dg-path has nothing to insert.

  if (rest.length === 0) {
    level.set(head, { type: "file", post });
    return;
  }

  let folder = level.get(head);
  if (folder === undefined || folder.type !== "folder") {
    folder = { type: "folder", children: new Map() };
    level.set(head, folder);
  }

  insert(folder.children, rest, post);
}

/* -------------------------------------------------------------------------- */
/*                                  // Sort                                   */
/* -------------------------------------------------------------------------- */

function toSortedNodes(
  level: ReadonlyMap<string, BuildEntry>
): readonly FileTreeNode[] {
  const entries = [...level.entries()].sort(
    ([aName, aEntry], [bName, bEntry]) =>
      compareEntries(aName, aEntry, bName, bEntry)
  );

  return entries.map(([name, entry]) => toNode(name, entry));
}

function toNode(name: string, entry: BuildEntry): FileTreeNode {
  if (entry.type === "folder") {
    return { type: "folder", name, children: toSortedNodes(entry.children) };
  }

  const { post } = entry;
  return {
    type: "file",
    title: post.data.rawNoteProps.title,
    href: isHomePost(post) ? "/" : post.data.pluginProps.permalink,
  };
}

// Mirrors `sortTree`'s `defaultCompare`: folders before files; among files,
// newest `created` (here, `published`) first; otherwise (two folders, or
// files with no comparable date) fall back to a natural compare of the raw
// path-segment name.
function compareEntries(
  aName: string,
  aEntry: BuildEntry,
  bName: string,
  bEntry: BuildEntry
): number {
  const aIsFile = aEntry.type === "file";
  const bIsFile = bEntry.type === "file";

  if (aIsFile && !bIsFile) return 1;
  if (!aIsFile && bIsFile) return -1;

  if (aIsFile && bIsFile) {
    const aCreated = parseCreated(aEntry.post);
    const bCreated = parseCreated(bEntry.post);
    if (aCreated !== null && bCreated !== null) return bCreated - aCreated;
    if (aCreated !== null) return -1;
    if (bCreated !== null) return 1;
  }

  return naturalCompare(aName, bName);
}

function parseCreated(post: Post): number | null {
  const published = post.data.rawNoteProps.published;
  if (!published) return null;
  const timestamp = Date.parse(published);
  return Number.isNaN(timestamp) ? null : timestamp;
}

// Ported from Eleventy's `naturalCompare` in `filetreeUtils.js`: splits into
// alternating digit/non-digit chunks and compares numeric chunks as numbers,
// so "File 2" sorts before "File 10".
function naturalCompare(a: string, b: string): number {
  const aChunks = a.toLowerCase().match(/(\d+|\D+)/g) ?? [];
  const bChunks = b.toLowerCase().match(/(\d+|\D+)/g) ?? [];
  const length = Math.max(aChunks.length, bChunks.length);

  for (let i = 0; i < length; i++) {
    const aChunk = aChunks[i] ?? "";
    const bChunk = bChunks[i] ?? "";
    const aIsNum = /^\d+$/.test(aChunk);
    const bIsNum = /^\d+$/.test(bChunk);

    if (aIsNum && bIsNum) {
      const diff = parseInt(aChunk, 10) - parseInt(bChunk, 10);
      if (diff !== 0) return diff;
    } else if (aChunk !== bChunk) {
      return aChunk < bChunk ? -1 : 1;
    }
  }

  return 0;
}
