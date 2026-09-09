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

// 6a-iii: the behaviour half — routed PDS bodies, no network. me follows M (a mutual, on
// a.example), F (on b.example, whose PDS answers 502) and N (on c.example). M follows me and
// Y; F follows X (never learned — its host is down); N follows nobody.
const ME = 'did:plc:me1234567890abcdefghijklm';
type Node = { host: string; rev: string; follows: string[] };
const GRAPH: Record<string, Node> = {
  [ME]: { host: 'a.example', rev: 'r-me', follows: ['did:plc:m', 'did:plc:f', 'did:plc:n'] },
  'did:plc:m': { host: 'a.example', rev: 'r-m', follows: [ME, 'did:plc:y'] },
  'did:plc:f': { host: 'b.example', rev: 'r-f', follows: ['did:plc:x'] },
  'did:plc:n': { host: 'c.example', rev: 'r-n', follows: [] },
};
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function routeGraph(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
    if (url.pathname.endsWith('/com.atproto.identity.resolveHandle')) return route.fulfill(json({ did: ME }));
    if (url.hostname === 'plc.directory') {
      const did = decodeURIComponent(url.pathname.slice(1)); const node = GRAPH[did];
      if (node === undefined) return route.fulfill({ status: 404, body: 'not found' });
      return route.fulfill(json({ id: did, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: `https://${node.host}` }] }));
    }
    if (url.hostname === 'b.example') return route.fulfill({ status: 502, body: '' });
    if (url.pathname.endsWith('/com.atproto.sync.getLatestCommit')) {
      const node = GRAPH[url.searchParams.get('did') ?? ''];
      return route.fulfill(node ? json({ cid: 'c', rev: node.rev }) : json({ error: 'RepoNotFound' }, 400));
    }
    if (url.pathname.endsWith('/com.atproto.repo.listRecords')) {
      const node = GRAPH[url.searchParams.get('repo') ?? ''];
      const records = (node?.follows ?? []).map((subject, i) => ({ uri: `at://x/app.bsky.graph.follow/${i}`, cid: 'c', value: { $type: 'app.bsky.graph.follow', subject, createdAt: '2026-09-01T00:00:00Z' } }));
      return route.fulfill(json({ records }));
    }
    return route.abort();
  });
}

test.describe('rings.html — the page walks (6a-iii)', () => {
  test('given a handle, the default rings fill with counts and "as of"; hop2 grows; an unreachable host is listed, not counted as empty', async ({ page }) => {
    const consoleLines: Array<{ type: string; text: string }> = [];
    page.on('console', (m) => consoleLines.push({ type: m.type(), text: m.text() }));
    await routeGraph(page);
    await page.goto('/rings.html');
    await page.getByTestId('rings-handle').fill('me.example');
    await page.getByTestId('rings-walk').click();

    await expect(page.locator('[data-ring="fol"] [data-count]')).toHaveText('3');
    await expect(page.locator('[data-ring="mut"] [data-count]')).toHaveText('1');
    await expect(page.locator('[data-ring="fol"] [data-asof]')).toContainText('as of ');
    await expect(page.locator('[data-ring="fol"] [data-asof]')).not.toContainText('as of —');
    await page.locator('details[data-more-rings] summary').click();
    await expect(page.locator('[data-ring="hop"] [data-count]')).toHaveText('4'); // M, F, N + Y
    await expect(page.locator('[data-ring="hop2"] [data-count]')).toHaveText('4'); // X never learned
    await expect(page.locator('[data-ring="hop2"] [data-asof]')).toContainText('incomplete');
    await expect(page.locator('[data-ring="fol"] [data-asof]')).toContainText('complete');
    await expect(page.locator('[data-hosts]')).toContainText('b.example');
    await expect(page.locator('[data-hosts]')).toContainText('502');
    await expect(page.locator('[data-progress]')).toContainText('3 of 3');
    await expect(page.locator('[data-ring="fol"] [data-count]')).toHaveText('3'); // unchanged by the failure

    const warns = consoleLines.filter((l) => l.type === 'warning' && l.text.includes('[croft]'));
    expect(warns).toHaveLength(1);
    expect(warns[0]?.text).toContain('b.example');
    for (const l of consoleLines) expect(l.text, `console ${l.type}: ${l.text}`).not.toContain('did:');
  });
  test('with ?debug=1 the library\'s debug line carries the walked DID (the only place a DID is printed)', async ({ page }) => {
    const consoleLines: string[] = [];
    page.on('console', (m) => consoleLines.push(m.text()));
    await routeGraph(page);
    await page.goto('/rings.html?debug=1');
    await page.getByTestId('rings-handle').fill('me.example');
    await page.getByTestId('rings-walk').click();
    await expect(page.locator('[data-ring="fol"] [data-count]')).toHaveText('3');
    expect(consoleLines.some((t) => t.includes('pds-walker: walk') && t.includes(ME))).toBe(true);
  });
});
