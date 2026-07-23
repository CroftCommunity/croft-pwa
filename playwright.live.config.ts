import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// The @live tier: the built site driven against the REAL network (no mocks) —
// e.g. resolving a real handle through the public atproto AppView. Local only,
// never in push CI (`npm run e2e:live`). It needs real browser egress; in a
// sandbox that blocks outbound TLS from headless Chromium the read module is
// instead verified live via node (see RUN summary), and this tier runs in a
// networked environment.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined;
const PORT = 4173;

export default defineConfig({
  testDir: './tests/live',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'live',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: `node tools/serve.mjs dist ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
