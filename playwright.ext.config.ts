import { defineConfig } from '@playwright/test';

// The extension e2e tier (`npm run e2e:ext`) — a SEPARATE config, deliberately
// NOT part of the default `npm test` gate. It loads an unpacked MV3 extension in
// a persistent Chromium context (see tests/ext/helpers.ts), which needs the full
// Chromium build (channel: 'chromium', set per-test in the fixture) rather than
// the headless shell the default e2e uses. Each spec starts its own local origin
// servers, so there is no shared webServer here. Folded into CI only after D5
// confirms headless-extension works on ubuntu (ROADMAP_TODO / plan Phase 8a).
export default defineConfig({
  testDir: './tests/ext',
  testMatch: /\.ext\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
});
