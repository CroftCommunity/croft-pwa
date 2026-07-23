import { test, expect } from '@playwright/test';

test('settings shows an Update control, About, and the Croft attribution', async ({ page }) => {
  await page.goto('/settings.html');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

  // Update control (the explicit half of "ask, don't ambush"). With the SW
  // blocked in the hermetic gate, no update is waiting, so it reads as idle.
  const update = page.locator('[data-testid="update-button"]');
  await expect(update).toBeVisible();
  await expect(update).toHaveText(/Check for updates|Update available/);

  // About + Croft attribution.
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Croft', exact: true }).first()).toHaveAttribute(
    'href',
    'https://croft.ing',
  );
});

test('every page carries the Croft attribution in the footer', async ({ page }) => {
  for (const path of ['/index.html', '/user-guide.html', '/reference.html', '/metrics.html']) {
    await page.goto(path);
    const attr = page.locator('[data-croft-attribution]');
    await expect(attr).toHaveAttribute('href', 'https://croft.ing');
  }
});
