// The font giscus's theme draws reactions with (ADR 0008): eight Lucide
// icons, each at the characters of the emoji giscus writes for a reaction,
// so the reactions match the site's own icons and take the theme's grays.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import opentype from "opentype.js";

/** Each reaction as giscus writes it (`Reactions` in giscus's
 * lib/reactions.ts) and the Lucide icon drawn for it, by the glyph's name
 * in lucide-static's font: an icon's current name, not an alias. */
export const reactionIcons = {
  "👍": "thumbs-up",
  "👎": "thumbs-down",
  // Formerly `laugh`.
  "😄": "face-grinning",
  "🎉": "party-popper",
  // Lucide has no confused face. Formerly `frown`.
  "😕": "face-slightly-frowning",
  "❤️": "heart",
  "🚀": "rocket",
  // Lucide has no pair of eyes.
  "👀": "eye",
} as const;

/** Asks for the color form of the character before it; ❤️ ends with it. */
const EMOJI_PRESENTATION = 0xfe0f;

/**
 * lucide-static's icon font: Lucide's icons with their strokes outlined,
 * as a font needs. The package is pinned to `lucide`'s version, so these
 * icons are the ones the rest of the site draws.
 */
export function lucideFont(): ArrayBuffer {
  const path = createRequire(import.meta.url).resolve(
    "lucide-static/font/lucide.ttf"
  );
  const file = readFileSync(path);
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

/** How far below the baseline emoji reach, as a share of the em: about
 * what Apple's and Google's emoji fonts dip. */
const EMOJI_DESCENT = 0.2;

/** A color layer's palette entry meaning "the text color" (COLR spec). */
const TEXT_COLOR = 0xffff;

// opentype.js 2 edits color tables through these; @types/opentype.js
// describes 1.3, which had neither.
declare module "opentype.js" {
  interface Font {
    palettes: { add(colors: string[]): void };
    layers: {
      add(
        glyphIndex: number,
        layers: { glyph: number; paletteIndex: number }
      ): void;
      get(glyphIndex: number): { glyph: Glyph; paletteIndex: number }[];
    };
  }
}

/**
 * A font of only the reaction icons, taken from `lucide` (lucideFont()).
 * An icon that Lucide renames or drops fails the build.
 *
 * ❤️ is U+2764 then U+FE0F, which asks for the color form, and Chrome
 * draws such a pair only from a color font. So U+FE0F gets an empty glyph,
 * and each icon is a color glyph (COLR) of one layer, its own outline in
 * the text color: the font counts as color, and the icons still take the
 * theme's grays.
 */
export function reactionIconsFont(lucide: ArrayBuffer): ArrayBuffer {
  const source = opentype.parse(lucide);
  const byName = new Map<string, opentype.Glyph>();
  for (let index = 0; index < source.glyphs.length; index++) {
    const glyph = source.glyphs.get(index);
    if (glyph.name) byName.set(glyph.name, glyph);
  }

  // Lucide's icons stand on the baseline; emoji dip below it, and giscus
  // aligns each reaction to its count's baseline. Lowering the icons as
  // far as emoji dip centers them on the count.
  const drop = Math.round(source.unitsPerEm * EMOJI_DESCENT);
  const outlines = Object.entries(reactionIcons).map(([emoji, name]) => {
    const icon = byName.get(name);
    if (!icon) throw new Error(`lucide-static has no "${name}" icon`);
    const unicode = emoji.codePointAt(0);
    if (unicode === undefined) throw new Error(`"${name}" has no emoji`);
    return {
      name,
      unicode,
      advanceWidth: icon.advanceWidth ?? source.unitsPerEm,
      path: lowered(icon.path, drop),
    };
  });

  // Glyph 0 is .notdef, then the icons, then U+FE0F, then each icon's
  // color layer: the same outline with no character of its own.
  const firstIcon = 1;
  const firstLayer = firstIcon + outlines.length + 1;
  const font = new opentype.Font({
    familyName: "Reaction Icons",
    styleName: "Regular",
    unitsPerEm: source.unitsPerEm,
    ascender: source.ascender - drop,
    descender: source.descender - drop,
    glyphs: [
      new opentype.Glyph({
        name: ".notdef",
        advanceWidth: source.unitsPerEm,
        path: new opentype.Path(),
      }),
      ...outlines.map(outline => new opentype.Glyph(outline)),
      new opentype.Glyph({
        name: "uniFE0F",
        unicode: EMOJI_PRESENTATION,
        advanceWidth: 0,
        path: new opentype.Path(),
      }),
      ...outlines.map(
        ({ name, advanceWidth, path }) =>
          new opentype.Glyph({ name: `${name}.layer`, advanceWidth, path })
      ),
    ],
  });
  // A color font needs a palette, even though no layer uses it.
  font.palettes.add(["#000000"]);
  outlines.forEach((_, index) =>
    font.layers.add(firstIcon + index, {
      glyph: firstLayer + index,
      paletteIndex: TEXT_COLOR,
    })
  );
  return font.toArrayBuffer();
}

/** `path` moved down by `by` font units. */
function lowered(path: opentype.Path, by: number): opentype.Path {
  const moved = new opentype.Path();
  moved.commands = path.commands.map(command => {
    const copy = { ...command } as Record<string, unknown>;
    for (const key of ["y", "y1", "y2"]) {
      if (typeof copy[key] === "number") copy[key] -= by;
    }
    return copy as unknown as opentype.PathCommand;
  });
  return moved;
}
