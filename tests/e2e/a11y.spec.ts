import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Automated accessibility scan. Every page, both themes (contrast is
// theme-dependent), must have zero serious/critical axe violations. Minor/
// moderate are not gated yet — tighten later if we choose to.
//
// HERMETIC by construction: all cross-origin requests are blocked, so every page
// renders the same offline shell on a networked laptop as in CI. Without this the
// scan grades a DOM that varies by runner, and the thing CI blessed is not the
// thing you looked at. The workspace rule and the incident behind it:
// docs/ACCESSIBILITY.md § "Three soundness requirements" (this repo owns that doc).
const PAGES = [
  '/index.html',
  '/reader.html',
  '/user-guide.html',
  '/reference.html',
  '/chassis.html',
  '/brand.html',
  '/pwa.html',
  '/agent-method.html',
  '/content-fetch.html',
  '/metrics.html',  '/atproto.html',
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
      await page.route('**/*', (route) => {
        const host = new URL(route.request().url()).hostname;
        if (host === 'localhost' || host === '127.0.0.1') void route.continue();
        else void route.abort();
      });
      await page.goto(path, { waitUntil: 'networkidle' });

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id} (${v.impact ?? '?'}) × ${v.nodes.length}`);

      expect(blocking, blocking.join(' · ')).toEqual([]);
    });
  }
}
