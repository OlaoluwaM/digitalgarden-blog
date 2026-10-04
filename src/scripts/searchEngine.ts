// The search engine behind the search dialog, ported from Eleventy's
// `searchScript.njk`: a FlexSearch index over `/searchIndex.json` entries.
// FlexSearch is most of the search code, so search.ts imports this module
// only when search is first used; searchText.ts holds what rendering needs.
import { Document, type DocumentData } from "flexsearch";

/** An entry of `/searchIndex.json` (src/content/search-index.ts). */
export interface SearchDocument extends DocumentData {
  title: string;
  url: string;
  tags: string[];
  content: string;
}

// Live's settings: at most 5 title and 10 content matches.
const TITLE_LIMIT = 5;
const CONTENT_LIMIT = 10;

// Fold case and accents (á → a), keeping ñ, then split into ASCII words.
// Live's encoder, unchanged, so results match live.
function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/n\u0303/g, "ñ")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC");
}

function encode(text: string) {
  // \x00-\x7F is the ASCII range, not a literal control character.
  // eslint-disable-next-line no-control-regex
  return normalize(text).split(/([^a-z]|[^\x00-\x7F])/);
}

export function createSearchEngine(documents: readonly SearchDocument[]) {
  const index = new Document<SearchDocument & { id: number }>({
    cache: true,
    document: {
      id: "id",
      index: [
        // Content also matches word endings; titles and tags match as typed.
        { field: "content", tokenize: "reverse", encode },
        { field: "title", tokenize: "forward", encode },
        { field: "tags", tokenize: "forward", encode },
      ],
    },
  });
  documents.forEach((document, id) => index.add({ id, ...document }));

  return {
    /**
     * Title matches first, then content matches, each note once. A query
     * starting with `#` searches tags only.
     */
    search(query: string): SearchDocument[] {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const fields =
        trimmed.startsWith("#") && trimmed.length > 1
          ? index.search(trimmed.slice(1), { index: ["tags"] })
          : index.search(trimmed, {
              index: [
                { field: "title", limit: TITLE_LIMIT },
                { field: "content", limit: CONTENT_LIMIT },
              ],
            });

      const order = ["title", "content", "tags"];
      const ids = new Set(
        fields
          .toSorted((a, b) => {
            const aFieldIndex = a.field ? order.indexOf(a.field) : -1;
            const bFieldIndex = b.field ? order.indexOf(b.field) : -1;
            return aFieldIndex - bFieldIndex;
          })
          .flatMap(field => field.result)
      );
      return [...ids].flatMap(id => documents[Number(id)] ?? []);
    },
  };
}
