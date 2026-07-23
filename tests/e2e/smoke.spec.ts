import { test, expect } from '@playwright/test';

test('home renders the shell, wordmark, and build stamp', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('heading', { name: 'Building Croft PWAs', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Croft PWA' })).toBeVisible();
  await expect(page.locator('[data-version-stamp]').first()).toBeVisible();
});

test('tabs navigate to settings (real link, real document)', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/settings\.html$/);
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
});

test('theme toggle flips the document theme', async ({ page }) => {
  await page.goto('/index.html');
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  await page.getByRole('button', { name: 'Toggle colour theme' }).click();
  const after = await html.getAttribute('data-theme');
  expect(after).not.toBe(before);
  expect(['light', 'dark']).toContain(after);
});
