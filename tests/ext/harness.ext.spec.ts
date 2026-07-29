import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import { extensionTest, startOrigins } from './helpers';

const here = dirname(fileURLToPath(import.meta.url));
const MIN_EXT = join(here, 'fixtures', 'min-ext');

// The wiring test for the Phase 2 harness: it proves the harness can (a) load an
// unpacked MV3 extension and see its background service worker register, and (b)
// serve the local test page origin. Everything the Phase 3/4/7 specs build on.
const test = extensionTest(MIN_EXT);

test('loads an unpacked extension and its service worker registers', ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-z]{32}$/);
});

test('serves the test page on the PWA origin', async ({ page }) => {
  const origins = await startOrigins('<rss></rss>');
  try {
    await page.goto(origins.pwaUrl);
    await expect(page.locator('#marker')).toHaveText('croft-ext-test-page');
    // The page exposes the probes later specs use.
    expect(await page.evaluate(() => typeof window.__directFetch)).toBe('function');
    expect(await page.evaluate(() => typeof window.__viaExtension)).toBe('function');
  } finally {
    await origins.stop();
  }
});
