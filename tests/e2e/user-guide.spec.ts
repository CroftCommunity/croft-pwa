import { test, expect } from '@playwright/test';

test('the guide renders every entry, and the TOC links to each', async ({ page }) => {
  await page.goto('/user-guide.html');
  await expect(page.getByRole('heading', { name: 'How to build a Croft PWA', level: 1 })).toBeVisible();

  const tocLinks = page.locator('.guide-toc a');
  const entries = page.locator('.guide-entry');
  const tocCount = await tocLinks.count();
  const entryCount = await entries.count();

  expect(entryCount).toBeGreaterThan(0);
  expect(tocCount).toBe(entryCount);

  // Every TOC link points at an entry section that exists on the page.
  for (let i = 0; i < tocCount; i++) {
    const href = await tocLinks.nth(i).getAttribute('href');
    expect(href).toMatch(/^#guide-/);
    await expect(page.locator(href as string)).toHaveCount(1);
  }
});

test('guide screenshots load (not broken references)', async ({ page }) => {
  await page.goto('/user-guide.html');
  const imgs = page.locator('.guide-shot img');
  const count = await imgs.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const ok = await imgs.nth(i).evaluate((el) => {
      const img = el as HTMLImageElement;
      return img.complete && img.naturalWidth > 0;
    });
    expect(ok, `screenshot ${i} failed to load`).toBe(true);
  }
});
