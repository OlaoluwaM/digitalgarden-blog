const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { getFileTree } = require("../src/helpers/filetreeUtils");

function note(path, data = {}) {
  return {
    filePathStem: `/repo/src/site/notes/${path.replace(/\.md$/, "")}`,
    fileSlug: path.split("/").pop().replace(/\.md$/, ""),
    data,
  };
}

describe("getFileTree", () => {
  it("keeps the default created-date ordering when navigationOrder is absent", () => {
    const filetree = getFileTree({
      collections: {
        note: [
          note("Older.md", { created: "2024-01-01" }),
          note("Newer.md", { created: "2025-01-01" }),
          note("Folder/Inside.md", { created: "2023-01-01" }),
        ],
      },
    });

    assert.deepEqual(Object.keys(filetree), ["Folder", "Newer.md", "Older.md"]);
  });

  it("applies navigationOrder and keeps default ordering for unlisted entries", () => {
    const filetree = getFileTree({
      navigationOrder: {
        "/": ["Second"],
        "/Folder": ["Nested Old"],
      },
      collections: {
        note: [
          note("First.md", { created: "2026-01-01" }),
          note("Second.md", { created: "2024-01-01" }),
          note("Third.md", { created: "2025-01-01" }),
          note("Folder/Nested New.md", { created: "2026-01-01" }),
          note("Folder/Nested Old.md", { created: "2024-01-01" }),
          note("Folder/Nested Middle.md", { created: "2025-01-01" }),
        ],
      },
    });

    assert.deepEqual(Object.keys(filetree), ["Second.md", "Folder", "First.md", "Third.md"]);
    assert.deepEqual(
      Object.keys(filetree.Folder).filter((key) => key !== "isFolder"),
      ["Nested Old.md", "Nested New.md", "Nested Middle.md"]
    );
  });
});
