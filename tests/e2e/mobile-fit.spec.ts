import { test, expect } from '@playwright/test';

// Mobile-first, tap-first: nothing may overflow horizontally on a phone. Guard
// the three narrow widths (320/360/390) after any layout change — the arecipe
// rule, carried here as a standard.
for (const width of [320, 360, 390]) {
  for (const path of [
    '/index.html',
    '/settings.html',
    '/user-guide.html',
    '/reference.html',
    '/chassis.html',
    '/brand.html',
    '/pwa.html',
    '/agent-method.html',
    '/metrics.html',
  ]) {
    test(`no horizontal overflow: ${path} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      await page.goto(path);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflows).toBe(false);
    });
  }
}
