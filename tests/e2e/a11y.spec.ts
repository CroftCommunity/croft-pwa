import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Automated accessibility scan. Every page, both themes (contrast is
// theme-dependent), must have zero serious/critical axe violations. Minor/
// moderate are not gated yet — tighten later if we choose to.
const PAGES = [
  '/index.html',
  '/user-guide.html',
  '/reference.html',
  '/chassis.html',
  '/brand.html',
  '/pwa.html',
  '/agent-method.html',
  '/metrics.html',
  '/settings.html',
];

for (const path of PAGES) {
  for (const theme of ['light', 'dark'] as const) {
    test(`a11y: ${path} (${theme}) — no serious/critical violations`, async ({ page }) => {
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('croft-theme', t);
        } catch {
          /* private mode — theme still applies for the session */
        }
      }, theme);
      await page.goto(path, { waitUntil: 'networkidle' });

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id} (${v.impact ?? '?'}) × ${v.nodes.length}`);

      expect(blocking, blocking.join(' · ')).toEqual([]);
    });
  }
}
