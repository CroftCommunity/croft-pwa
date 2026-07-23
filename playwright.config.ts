import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// In the managed sandbox a prebuilt Chromium lives here; pointing at it avoids a
// download and any Playwright<->browser revision mismatch. In CI the path is
// absent, so Playwright uses the browser it installed itself.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined;

const PORT = 4173;
// A second server serves the same build under a subpath, emulating a GitHub
// project page / the /pr-preview/pr-N/ preview workflow, so the relative-path
// standard is guarded (see tests/e2e/subpath.spec.ts).
const SUBPATH_PORT = 4174;
const SUBPATH_BASE = '/pr-preview/pr-1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // The service worker makes its own fetches that bypass page.route mocks, so
    // block it by default for the mock-driven hermetic specs. The pwa spec
    // re-enables it (test.use) to exercise the SW itself.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /subpath\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
    {
      // Runs the site under a subpath to prove relative paths hold there.
      name: 'subpath',
      testMatch: /subpath\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${SUBPATH_PORT}${SUBPATH_BASE}/`,
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: [
    {
      command: `node tools/serve.mjs dist ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `BASE=${SUBPATH_BASE} node tools/serve.mjs dist ${SUBPATH_PORT}`,
      url: `http://localhost:${SUBPATH_PORT}${SUBPATH_BASE}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
