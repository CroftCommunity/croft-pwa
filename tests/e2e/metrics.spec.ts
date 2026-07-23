import { test, expect } from '@playwright/test';

test('metrics page shows the registry, local counts, and the wire preview', async ({ page }) => {
  await page.goto('/metrics.html');
  await expect(page.getByRole('heading', { name: 'Metrics', level: 1 })).toBeVisible();

  // Visiting the page counts page_metrics locally.
  await expect(page.locator('[data-count="page_metrics"]')).toBeVisible();

  // The disclosure list names every metric with its plain-language line.
  await expect(page.locator('.measure-list', { hasText: 'page_home' }).first()).toBeVisible();
  await expect(page.getByText('That the metrics screen was opened')).toBeVisible();

  // The wire preview is the only-thing-sent shape and includes the coarse period.
  const preview = await page.locator('pre code').first().innerText();
  const payload = JSON.parse(preview) as { v: number; period: string; counts: Record<string, number> };
  expect(payload.v).toBe(1);
  expect(payload.period).toMatch(/^\d{4}-\d{2}$/);
  expect(payload.counts.page_metrics).toBeGreaterThanOrEqual(1);
  // No identity leaks into the preview.
  expect(preview).not.toContain('device');
  expect(preview).not.toContain('session');
});

test('sharing consent is opt-in, persists, and defaults off', async ({ page }) => {
  await page.goto('/metrics.html');
  const toggle = page.locator('[data-testid="consent-toggle"]');
  await expect(toggle).toHaveText(/Sharing: off/);
  await toggle.click();
  await expect(toggle).toHaveText(/Sharing: on/);
  await page.reload();
  await expect(page.locator('[data-testid="consent-toggle"]')).toHaveText(/Sharing: on/);
});

test('a flush writes the payload to the console and nothing else leaves', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(msg.text()));

  // No request should ever leave this origin — a flush is console-only, no endpoint.
  const offOrigin: string[] = [];
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') offOrigin.push(req.url());
  });

  await page.goto('/metrics.html');
  await page.locator('[data-testid="flush-now"]').click();

  await expect
    .poll(() => logs.some((l) => l.includes('[croft-measure]')))
    .toBe(true);
  expect(offOrigin).toEqual([]);
});
