import { test, expect } from '@playwright/test';

// The rings page (plan 2026-09-08 § Phase 6a): the library's reference page. This file grows
// by phase — 6a is the smoke half (the shell exists, hermetically), 6a-iii the behaviour half
// (routed PDS bodies), 6b the gating half (axe, widths, targets, the current tab).

test.describe('rings.html — the shell (6a)', () => {
  test('serves, renders five ring cards (three shown, two behind a closed disclosure), an empty hosts panel, and touches no network', async ({ page }) => {
    const offsite: string[] = [];
    await page.route('**/*', (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host === 'localhost' || host === '127.0.0.1') void route.continue();
      else { offsite.push(route.request().url()); void route.abort(); }
    });
    const res = await page.goto('/rings.html');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Rings', level: 1 })).toBeVisible();

    const cards = page.locator('[data-ring]');
    expect(await cards.count()).toBe(5);
    for (const id of ['mut', 'fol', 'global']) await expect(page.locator(`[data-ring="${id}"]`)).toBeVisible();
    const more = page.locator('details[data-more-rings]');
    await expect(more).toHaveCount(1);
    expect(await more.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
    for (const id of ['hop', 'hop2']) {
      const card = page.locator(`[data-ring="${id}"]`);
      expect(await card.count()).toBe(1);
      await expect(card).toBeHidden();
    }
    for (const id of ['mut', 'fol', 'hop', 'hop2']) await expect(page.locator(`[data-ring="${id}"] [data-count]`)).toHaveText('—');

    await expect(page.locator('[data-hosts]')).toContainText('No hosts reached yet');
    await expect(page.getByTestId('rings-handle')).toBeVisible();
    await expect(page.getByTestId('rings-walk')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(offsite).toEqual([]);
  });
});
