import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Stryker-only vitest config (M1, plan 2026-09-08 § Checkpoint M1). The gate's tests import
// `croft-pwa/pds-walker`, which resolves to the emitted `lib/`; stryker mutates `src/`, so
// under stryker the export path is aliased to the source surface file. Same tests, same
// re-export presence — only where the module text comes from changes.
export default defineConfig({
  resolve: {
    alias: { 'croft-pwa/pds-walker': fileURLToPath(new URL('./src/pds-walker/index.ts', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/pds-walker-*.test.ts'],
    environment: 'node',
  },
});
