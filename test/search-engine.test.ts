/**
 * The search engine behind the search dialog (src/scripts/searchEngine.ts,
 * the FlexSearch index over `/searchIndex.json` entries) and the text it
 * renders (src/scripts/searchText.ts: query terms, excerpts, and where
 * matches are highlighted). Ported from Eleventy's `searchScript.njk`.
 *
 * Why this level: this logic takes entries and a query and returns plain
 * data, so it runs in Node without a browser, fast enough to pin every case.
 * The entries mirror real index entries (decoded text, the note's own tags).
 * Turning the data into elements is tested in Chrome
 * (test/browser/search.test.ts), and the built site's index end to end in
 * test/layout/site-layout.test.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSearchEngine,
  type SearchDocument,
} from "../src/scripts/searchEngine.ts";
import {
  excerpt,
  highlightSegments,
  searchTerms,
} from "../src/scripts/searchText.ts";

const documents: SearchDocument[] = [
  {
    title: "IO in Haskell, an epiphany",
    url: "/posts/io-in-haskell-an-epiphany/",
    tags: ["software-engineering", "haskell"],
    content:
      "It seems to me like IO is Haskell's way of modelling the general concept of a statement.",
  },
  {
    title: "Implementing Redis INFO in Haskell",
    url: "/posts/implementing-redis-info-in-haskell/",
    tags: ["haskell", "software-engineering"],
    content:
      "In a previous blog post, I talked about how I used Cabal's custom setup script.",
  },
  {
    title: "How to produce multiple executables from a stack project",
    url: "/posts/how-to-produce-multiple-executables-from-a-stack-project/",
    tags: ["software-engineering", "haskell"],
    content:
      "Run it with stack exec my-exe -- <options-to-pass-to-executable>.",
  },
  {
    title: "Numbers? Numerals? Oh Boy",
    url: "/posts/numbers-numerals-oh-boy/",
    tags: ["software-engineering", "computer-science"],
    content:
      "If you attempt to get the char code for a character in Haskell, it'll give you a decimal number.",
  },
  {
    title: "Be deliberate",
    url: "/posts/be-deliberate/",
    tags: ["non-technical", "self-development"],
    content: "Create your life rather than live it. Order a crème brûlée.",
  },
];

const engine = createSearchEngine(documents);
const titles = (query: string) =>
  engine.search(query).map(document => document.title);

describe("search", () => {
  // Why: a word in a title is the strongest signal, so title matches come
  // first (live searched titles, then content), and a note that matches
  // both appears once.
  it("lists title matches before content matches, each note once", () => {
    const found = titles("haskell");
    assert.deepEqual(
      new Set(found.slice(0, 2)),
      new Set([
        "IO in Haskell, an epiphany",
        "Implementing Redis INFO in Haskell",
      ])
    );
    assert.ok(found.includes("Numbers? Numerals? Oh Boy"));
    assert.equal(new Set(found).size, found.length);
    assert.ok(!found.includes("Be deliberate"));
  });

  // Why: readers type fragments. Titles match word beginnings as the
  // reader types; content also matches word endings (live's `reverse`
  // tokenizer).
  it("matches the start of title words and either end of content words", () => {
    assert.ok(titles("hask").includes("IO in Haskell, an epiphany"));
    assert.ok(titles("askell").includes("Numbers? Numerals? Oh Boy"));
  });

  // Why: readers rarely type accents or capitals; live folded both.
  it("ignores case and accents", () => {
    assert.deepEqual(titles("CREME BRULEE"), ["Be deliberate"]);
  });

  // Why: tag buttons search `#tag`, which must list the notes carrying the
  // tag, not every note that mentions the word.
  it("searches only tags when the query starts with #", () => {
    const tagged = [
      "IO in Haskell, an epiphany",
      "Implementing Redis INFO in Haskell",
      "How to produce multiple executables from a stack project",
    ];
    assert.deepEqual(new Set(titles("#haskell")), new Set(tagged));
    assert.deepEqual(new Set(titles("#hask")), new Set(tagged));
  });

  // Why: the dialog shows its hint for an empty query, not every note.
  it("finds nothing for an empty or unknown query", () => {
    assert.deepEqual(titles(""), []);
    assert.deepEqual(titles("   "), []);
    assert.deepEqual(titles("zzqqxx"), []);
  });

  // Why: the dialog renders results straight from the entries, so they
  // must come back whole.
  it("returns the index entries themselves", () => {
    assert.deepEqual(engine.search("epiphany"), [documents[0]]);
  });
});

describe("searchTerms", () => {
  // Why: these are what get highlighted. Quotes keep a phrase together,
  // single letters would light up everywhere, and longer terms go first so
  // a longer match wins where terms overlap.
  it("splits a query into lowercase terms, phrases whole, longest first", () => {
    assert.deepEqual(searchTerms('IO "Type Level" a Haskell'), [
      "type level",
      "haskell",
      "io",
    ]);
    assert.deepEqual(searchTerms("  "), []);
  });
});

describe("excerpt", () => {
  const content =
    "Pure functions are easy to test because they have no side effects. " +
    "Haskell makes the distinction explicit through the type system, which " +
    "is the whole point of this long paragraph about types and effects.";

  // Why: a result shows the text around the first match, not the note's
  // opening lines, with ellipses where it was cut (live: 50 characters of
  // lead-in and 120 in all).
  it("shows the text around the first match", () => {
    const start = content.indexOf("Haskell") - 50;
    assert.equal(
      excerpt(content, ["haskell"]),
      `...${content.slice(start, start + 120)}...`
    );
  });

  it("starts at the beginning when the match is near it", () => {
    assert.equal(excerpt(content, ["pure"]), `${content.slice(0, 120)}...`);
  });

  it("shows the opening when nothing matches, and short text whole", () => {
    assert.equal(excerpt(content, ["zzqqxx"]), `${content.slice(0, 117)}...`);
    assert.equal(excerpt("Short.", ["short"]), "Short.");
  });

  // Why: index entries are decoded text, so `<...>` is part of the note
  // (a command's placeholder). Live stripped anything shaped like a tag
  // and lost those words.
  it("keeps text that looks like markup", () => {
    assert.equal(
      excerpt(documents[2]!.content, []),
      "Run it with stack exec my-exe -- <options-to-pass-to-executable>."
    );
  });
});

describe("highlightSegments", () => {
  const joined = (segments: { text: string }[]) =>
    segments.map(segment => segment.text).join("");
  const matches = (segments: { text: string; match: boolean }[]) =>
    segments.filter(segment => segment.match).map(segment => segment.text);

  // Why: matches keep their original case, and every occurrence is marked.
  it("marks every occurrence of each term, ignoring case", () => {
    const segments = highlightSegments("Haskell is haskell", ["haskell"]);
    assert.deepEqual(segments, [
      { text: "Haskell", match: true },
      { text: " is ", match: false },
      { text: "haskell", match: true },
    ]);
  });

  // Why: live inserted `<span class="search-highlight">` into the string
  // and then searched that string for the next term, so queries like
  // `span`, `class`, or `search` matched its own markup and broke the
  // result. Segments are computed on the text alone.
  it("is not confused by terms that look like markup", () => {
    const text = "A span with a class and a search-highlight";
    const segments = highlightSegments(text, [
      "search-highlight",
      "class",
      "span",
    ]);
    assert.equal(joined(segments), text);
    assert.deepEqual(matches(segments), ["span", "class", "search-highlight"]);
  });

  // Why: overlapping terms ("hask" inside "haskell") must mark one run, not
  // nest or split it.
  it("merges overlapping matches", () => {
    assert.deepEqual(
      matches(highlightSegments("Haskell", ["haskell", "hask", "kell"])),
      ["Haskell"]
    );
  });

  // Why: terms are text, not patterns.
  it("matches regular expression characters literally", () => {
    assert.deepEqual(
      matches(highlightSegments("C++ (and C)", ["c++", "(and"])),
      ["C++", "(and"]
    );
  });

  it("returns the text unmarked without terms", () => {
    assert.deepEqual(highlightSegments("Text", []), [
      { text: "Text", match: false },
    ]);
    assert.deepEqual(highlightSegments("", ["a"]), []);
  });
});
