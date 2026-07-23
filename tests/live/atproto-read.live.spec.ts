import { test, expect } from '@playwright/test';

// @live: drives the built atproto page against the REAL network — no mocks. It
// resolves a stable, well-known handle through the public AppView + PLC
// directory. Run locally with `npm run e2e:live`; never in push CI. Needs real
// browser egress (a sandbox that resets headless-Chromium TLS can't run it — the
// read module is verified live via node there instead).
test('@live resolves bsky.app to its real DID and PDS', async ({ page }) => {
  await page.goto('/atproto.html');
  await page.locator('[data-testid="handle-input"]').fill('bsky.app');
  await page.locator('[data-testid="resolve-button"]').click();

  const result = page.locator('[data-testid="resolve-result"]');
  // bsky.app resolves to a stable did:plc identity served from a bsky.network PDS.
  await expect(result).toContainText(/^did:plc:[a-z0-9]+$/m, { timeout: 15_000 });
  await expect(result).toContainText('bsky.app');
  await expect(result).toContainText('https://');
});
