import { test, expect } from '@playwright/test';

// The build-time CSP + SRI is enforced by test: every document loads under the
// meta policy with zero violations, and no script is loaded cross-origin. If a
// change introduces an inline handler or a third-party script, this fails.
for (const path of [
  '/index.html',
  '/settings.html',
  '/user-guide.html',
  '/reference.html',
  '/chassis.html',
  '/brand.html',
  '/pwa.html',
  '/agent-method.html',
]) {
  test(`${path}: no CSP violations, no cross-origin scripts`, async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });

    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const violations = await page.evaluate(() => {
      const w = window as unknown as { __csp?: string[] };
      return w.__csp ?? [];
    });
    expect(violations).toEqual([]);

    const crossOrigin = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[src]'))
        .map((s) => (s as HTMLScriptElement).src)
        .filter((src) => new URL(src).origin !== location.origin),
    );
    expect(crossOrigin).toEqual([]);
  });
}
