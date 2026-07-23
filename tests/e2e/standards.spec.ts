import { test, expect } from '@playwright/test';

const CHAPTERS = [
  { href: 'chassis.html', title: 'Chassis' },
  { href: 'brand.html', title: 'Brand' },
  { href: 'pwa.html', title: 'PWA mechanics' },
  { href: 'agent-method.html', title: 'Agent method' },
];

test('the standards index links to every chapter', async ({ page }) => {
  await page.goto('/reference.html');
  await expect(page.getByRole('heading', { name: 'Standards', level: 1 })).toBeVisible();
  const cards = page.locator('[data-chapter]');
  expect(await cards.count()).toBe(CHAPTERS.length);
  for (const chapter of CHAPTERS) {
    await expect(page.getByRole('link', { name: chapter.title })).toHaveAttribute('href', chapter.href);
  }
});

for (const chapter of CHAPTERS) {
  test(`chapter ${chapter.href} renders its heading, entries, and TOC`, async ({ page }) => {
    await page.goto(chapter.href);
    await expect(page.getByRole('heading', { name: chapter.title, level: 1 })).toBeVisible();
    const entries = page.locator('.guide-entry');
    const tocLinks = page.locator('.guide-toc a');
    const entryCount = await entries.count();
    expect(entryCount).toBeGreaterThan(0);
    expect(await tocLinks.count()).toBe(entryCount);
    // The Standards tab is current on a chapter page.
    await expect(page.locator('.tab[aria-current="page"]')).toHaveText('Standards');
  });
}
