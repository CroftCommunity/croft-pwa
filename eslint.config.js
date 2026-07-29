// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // `.claude/` holds untracked tooling scratch, incl. nested git worktrees
    // (full repo checkouts) — exclude it so lint never scans another context's copy.
    ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', '.claude/**'],
  },
  // Type-checked linting for the TypeScript app + tests only.
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', '*.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node, ...globals.serviceworker },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  // Plain (non-type-checked) linting for tooling JS files.
  {
    files: ['eslint.config.js', 'build.mjs', 'tools/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // The node-driven extension e2e runner. Node globals for the harness, plus
  // browser globals because the page.evaluate() callbacks reference `window`.
  {
    files: ['tests/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  // The Croft Bridge extension: plain browser JS running as a content script and
  // an MV3 service worker, with the webextension `chrome` API. Not type-checked
  // (it ships as-is, no build step), but linted for correctness.
  {
    files: ['extension/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.serviceworker, ...globals.webextensions },
    },
  },
);
