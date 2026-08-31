import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PROVIDERS, featuredProviders, otherProviders, ATMO_GLOSS } from '../../src/signin/providers';

// The mobile sign-in sheet — docs/DESIGN.md § Components › Sheet, § Flows ›
// Sign in, § Copy › atmo. Hermetic: no network leaves localhost; the OAuth
// discovery a provider button triggers is answered by page.route, and the PAR
// body is captured so "Create account" can be proved to send prompt=create
// rather than to be a second button with different words.
const OPEN = featuredProviders();
const INVITE = otherProviders();

const rows = (page: Page, within: string) =>
  page.evaluate(
    (sel) =>
      [...document.querySelectorAll(`${sel} [data-provider-row]`)].map((r) => ({
        id: r.getAttribute('data-provider-row'),
        create: !!r.querySelector('[data-provider-create]'),
        signin: !!r.querySelector('[data-provider-signin]'),
        visible: r.getClientRects().length > 0,
        text: (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
      })),
    within,
  );

async function openSheet(page: Page): Promise<void> {
  await page.goto('/atproto.html');
  await page.locator('[data-testid="open-signin-sheet"]').click();
  await expect(page.locator('dialog[data-signin-sheet]')).toHaveAttribute('open', '');
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === 'localhost' || host === '127.0.0.1') void route.continue();
    else void route.abort();
  });
});

test('the registry carries both postures, or this spec proves nothing', () => {
  expect(OPEN.length).toBeGreaterThan(0);
  expect(INVITE.length).toBeGreaterThan(0);
});

test('closed until asked; the trigger opens a native dialog titled for an atmo provider', async ({ page }) => {
  await page.goto('/atproto.html');
  expect(await page.locator('dialog[data-signin-sheet][open]').count()).toBe(0);
  await page.locator('[data-testid="open-signin-sheet"]').click();
  const d = page.locator('dialog[data-signin-sheet]');
  await expect(d).toHaveAttribute('open', '');
  await expect(d.locator('h2')).toHaveText('Choose your atmo provider');
  await expect(d.locator('h2 abbr')).toHaveAttribute('title', ATMO_GLOSS);
  // Touch cannot hover, so the definition is visible without the tooltip.
  await expect(d.locator('p').first()).toContainText('Personal Data Server');
});

test('front page = open providers with Create + Sign in; invite-only sit behind Another provider', async ({ page }) => {
  await openSheet(page);
  const front = await rows(page, 'dialog[data-signin-sheet] > .sheet-list');
  expect(front.map((r) => r.id)).toEqual(OPEN.map((p) => p.id));
  for (const r of front) expect(r.visible && r.create && r.signin, JSON.stringify(r)).toBe(true);
  for (const p of INVITE) expect(front.some((r) => r.id === p.id)).toBe(false);

  const before = await rows(page, '.sheet-other');
  expect(before.map((r) => r.id)).toEqual(INVITE.map((p) => p.id));
  expect(before.every((r) => !r.visible)).toBe(true);

  await page.locator('[data-provider-other]').click();
  await expect(page.locator('[data-provider-other]')).toBeHidden();
  const other = await rows(page, '.sheet-other');
  for (const r of other) {
    expect(r.visible).toBe(true);
    expect(r.create, `${r.id} is invite-only — a Create would land on a screen demanding a code`).toBe(false);
    expect(r.signin).toBe(true);
    expect(r.text).toMatch(/invite only/i);
  }
  await expect(page.locator('[data-provider-handle]')).toBeFocused();
});

test('fits the narrowest phone: no sideways scroll at 320px and every control ≥44px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openSheet(page);
  await page.locator('[data-provider-other]').click();
  const fit = await page.evaluate(() => {
    const d = document.querySelector('dialog[data-signin-sheet]') as HTMLElement;
    const small = [...d.querySelectorAll('button, input')]
      .map((b) => {
        const r = b.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;
        return r.width < 44 || r.height < 44 ? `${(b as HTMLElement).innerText || (b as HTMLElement).tagName} ${Math.round(r.width)}x${Math.round(r.height)}` : null;
      })
      .filter(Boolean);
    return { scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, sheetW: Math.round(d.getBoundingClientRect().width), small };
  });
  expect(fit.scrollW).toBeLessThanOrEqual(fit.innerW + 1);
  expect(fit.sheetW).toBeLessThanOrEqual(320);
  expect(fit.small).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
  test(`a11y: the OPEN sheet has no serious/critical violations (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => {
      try {
        localStorage.setItem('croft-theme', t);
      } catch {
        /* private mode */
      }
    }, theme);
    await openSheet(page);
    await page.locator('[data-provider-other]').click();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact ?? '?'}) × ${v.nodes.length}`);
    expect(blocking, blocking.join(' · ')).toEqual([]);
  });
}

// Intent reaches the seam. Discovery for the chosen entryway is mocked AT THAT
// ENTRYWAY (each registered provider is its own authorization server, probed
// 2026-08-29), so a provider the build forgot to allowlist in connect-src fails
// here with a CSP refusal instead of on a phone. The PAR body is what proves
// the words on the button.
// Entryways that serve only the issuer document, never oauth-protected-resource
// (live shape, harvested 2026-08-30): bsky.social is the issuer for a fleet of PDS
// hosts, and only those serve it. A single-host provider names itself there.
const ISSUER_ONLY_ENTRYWAYS: ReadonlySet<string> = new Set(['https://bsky.social']);

async function mockProvider(page: Page, entryway: string): Promise<{ par: () => URLSearchParams[] }> {
  const bodies: URLSearchParams[] = [];
  await page.route(`${entryway}/.well-known/oauth-protected-resource`, (route) =>
    ISSUER_ONLY_ENTRYWAYS.has(entryway)
      ? route.fulfill({ status: 404, contentType: 'text/html', body: 'Cannot GET /.well-known/oauth-protected-resource' })
      : route.fulfill({ json: { authorization_servers: [entryway] } }),
  );
  await page.route(`${entryway}/.well-known/oauth-authorization-server`, (route) =>
    route.fulfill({
      json: {
        issuer: entryway,
        authorization_endpoint: `${entryway}/oauth/authorize`,
        token_endpoint: `${entryway}/oauth/token`,
        pushed_authorization_request_endpoint: `${entryway}/oauth/par`,
      },
    }),
  );
  await page.route(`${entryway}/oauth/par`, (route) => {
    bodies.push(new URLSearchParams(route.request().postData() ?? ''));
    return route.fulfill({ status: 201, json: { request_uri: 'urn:req:e2e', expires_in: 60 } });
  });
  // The authorize hop would leave the origin; hold it so the test can read state.
  await page.route(`${entryway}/oauth/authorize**`, (route) => route.fulfill({ status: 200, body: 'held' }));
  return { par: () => bodies };
}

for (const p of PROVIDERS) {
  test(`${p.id}: Sign in clears the CSP and reaches PAR at ${p.entryway}`, async ({ page }) => {
    const { par } = await mockProvider(page, p.entryway);
    await openSheet(page);
    if (p.signups === 'invite') await page.locator('[data-provider-other]').click();
    await page.locator(`[data-provider-row="${p.id}"] [data-provider-signin]`).click();
    await page.waitForURL(`${p.entryway}/oauth/authorize**`);
    expect(par()).toHaveLength(1);
    expect(par()[0]?.has('login_hint')).toBe(false);
  });
}

test('Create account starts OAuth at that provider in the CREATE intent; Sign in sends no prompt', async ({ page }) => {
  const p = OPEN[0];
  if (!p) throw new Error('no open provider');
  const { par } = await mockProvider(page, p.entryway);
  await openSheet(page);
  await page.locator(`[data-provider-row="${p.id}"] [data-provider-create]`).click();
  await page.waitForURL(`${p.entryway}/oauth/authorize**`);
  expect(par()).toHaveLength(1);
  expect(par()[0]?.get('prompt')).toBe('create');
  expect(par()[0]?.has('login_hint')).toBe(false);

  await openSheet(page);
  await page.locator(`[data-provider-row="${p.id}"] [data-provider-signin]`).click();
  await page.waitForURL(`${p.entryway}/oauth/authorize**`);
  expect(par()).toHaveLength(2);
  expect(par()[1]?.has('prompt')).toBe(false);
});

test('a handle on any other provider reaches the same seam, leading @ stripped', async ({ page }) => {
  await openSheet(page);
  await page.locator('[data-provider-other]').click();
  const seen: string[] = [];
  await page.route('**/xrpc/com.atproto.identity.resolveHandle*', (route) => {
    seen.push(new URL(route.request().url()).searchParams.get('handle') ?? '');
    return route.fulfill({ status: 400, json: { error: 'InvalidRequest' } });
  });
  await page.locator('[data-provider-handle]').fill('@someone.zio.blue');
  await page.locator('[data-provider-handle-go]').click();
  await expect(page.locator('[data-testid="signin-result"]')).toContainText(/could not start/i);
  expect(seen).toEqual(['someone.zio.blue']);
});

test('the four probed providers are in the registry', () => {
  expect(PROVIDERS.map((p) => p.id).sort()).toEqual(['blacksky', 'bsky', 'eurosky', 'northsky']);
});
