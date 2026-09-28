import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import astro from "eslint-plugin-astro";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// The type-aware `no-unsafe-*` rules. They need types TypeScript cannot
// see for `.astro` modules (below).
const unsafeRulesOff = {
  "@typescript-eslint/no-unsafe-argument": "off",
  "@typescript-eslint/no-unsafe-assignment": "off",
  "@typescript-eslint/no-unsafe-call": "off",
  "@typescript-eslint/no-unsafe-member-access": "off",
  "@typescript-eslint/no-unsafe-return": "off",
} as const;

// Lint rules only: Prettier owns formatting (`npm run format:check`), and
// eslint-config-prettier turns off every rule that would disagree with it.
export default defineConfig(
  globalIgnores([
    "dist/",
    ".astro/",
    ".vercel/",
    ".browser-artifacts/",
    // Written by scripts/generate-wikilink-index.ts before each build.
    "src/generated/",
    // Published notes and images; the Digital Garden plugin owns them.
    "src/site/",
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Each file uses its nearest tsconfig.json (the root one, or
        // test/tsconfig.json for tests).
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".astro"],
      },
      globals: { ...globals.node },
    },
  },
  {
    rules: {
      // The code asserts non-null on purpose (DOM queries, regex groups);
      // the type checker still checks nullability, and
      // no-unnecessary-type-assertion removes assertions it can prove.
      "@typescript-eslint/no-non-null-assertion": "off",
      // `() => voidCall()` is idiomatic in callbacks and tests; the fix
      // wraps every one in braces.
      "@typescript-eslint/no-confusing-void-expression": "off",
      // Numbers read fine in messages; other non-strings still need String().
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      // node:test's it() and describe() return promises the runner already
      // tracks; awaiting them is not required.
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            {
              from: "package",
              package: "node:test",
              name: ["it", "test", "describe", "suite"],
            },
          ],
        },
      ],
      // A leading underscore marks a deliberately unused binding.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Frontmatter and <script> blocks in .astro files, and the template's
  // accessibility (alt text, labels, valid ARIA).
  astro.configs["flat/recommended"],
  astro.configs["flat/jsx-a11y-recommended"],
  {
    // astro-eslint-parser has no project service; it finds each .astro
    // file's tsconfig.json itself. TypeScript alone can't type `.astro`
    // components or JSX in templates (astro check can), so their values
    // arrive as error types and the no-unsafe-* rules would flag them all.
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: { projectService: false, project: true },
    },
    rules: unsafeRulesOff,
  },
  {
    // Component tests import `.astro` files, which have the same gap.
    files: ["test/components/**/*.ts"],
    rules: unsafeRulesOff,
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      // Teardown hooks guard state that a failed setup never assigned
      // (`site?.cleanup()`); the declared types can't express that.
      "@typescript-eslint/no-unnecessary-condition": "off",
      // Fakes are often async only to match a Promise-returning signature.
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    // Client scripts run in the browser, not Node.
    files: ["src/scripts/**/*.ts", "**/*.astro/*.ts", "**/*.astro/*.js"],
    languageOptions: { globals: { ...globals.browser } },
  },
  prettier
);
