import { test, expect } from '@playwright/test';

// Hermetic: mock the AppView + PLC directory so the real read module runs with
// no network. Proves the demo wires resolve → read → render correctly.
test('atproto demo resolves a handle and shows DID/PDS/profile', async ({ page }) => {
  await page.route('**/xrpc/com.atproto.identity.resolveHandle*', (route) =>
    route.fulfill({ json: { did: 'did:plc:demo123' } }),
  );
  await page.route('**/plc.directory/did:plc:demo123', (route) =>
    route.fulfill({
      json: {
        id: 'did:plc:demo123',
        service: [
          { id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example.test' },
        ],
      },
    }),
  );
  await page.route('**/xrpc/app.bsky.actor.getProfile*', (route) =>
    route.fulfill({ json: { did: 'did:plc:demo123', handle: 'demo.test', displayName: 'Demo Account' } }),
  );

  await page.goto('/atproto.html');
  await page.locator('[data-testid="handle-input"]').fill('demo.test');
  await page.locator('[data-testid="resolve-button"]').click();

  const result = page.locator('[data-testid="resolve-result"]');
  await expect(result).toContainText('did:plc:demo123');
  await expect(result).toContainText('https://pds.example.test');
  await expect(result).toContainText('Demo Account');
});

test('atproto demo shows a friendly error when resolution fails', async ({ page }) => {
  await page.route('**/xrpc/com.atproto.identity.resolveHandle*', (route) =>
    route.fulfill({ status: 400, json: {} }),
  );
  await page.goto('/atproto.html');
  await page.locator('[data-testid="resolve-button"]').click();
  await expect(page.locator('[data-testid="resolve-result"]')).toContainText('Could not resolve');
});
