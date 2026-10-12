// Reading the design tokens (src/styles/tokens.css) in code: the style guide
// and the giscus theme (lib/giscus.ts) take their values from the file, so
// neither can drift from it.
import postcss from "postcss";

/** The value of `name`, failing the build if tokens.css lacks it. */
export function tokenValue(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`tokens.css has no ${name}`);
  return value;
}

/** Every declaration in tokens.css, in file order, without the resets. */
export function parseTokens(source: string): Map<string, string> {
  const tokens = new Map<string, string>();
  postcss.parse(source).walkDecls(decl => {
    if (!decl.prop.endsWith("*")) {
      tokens.set(decl.prop, decl.value.replace(/\s+/g, " "));
    }
  });
  return tokens;
}
