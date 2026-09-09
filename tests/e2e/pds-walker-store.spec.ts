import { test, expect, type Page } from '@playwright/test';
import * as esbuild from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Phase 4b (plan 2026-09-08): the IndexedDB store proven in a REAL browser, not a fake.
// The page's CSP is `script-src 'self' 'sha256-…'`, so an inline module tag would be refused;
// a same-origin URL is admitted by 'self'. The driver is bundled here with the esbuild API
// (it resolves the self-reference `croft-pwa/pds-walker` through package exports) and served
// by `page.route`, so nothing is written to dist/ and no network is touched. The service
// worker is blocked in this project, so nothing intercepts the route.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DRIVER = `
  import { indexedDbStore } from 'croft-pwa/pds-walker';
  window.__pdsStore = (name) => indexedDbStore(name);
`;
type Snap = { did: string; pds: string; rev: string; follows: string[]; fetchedAt: number };
type W = { __pdsStore: (name: string) => { get(did: string): Promise<Snap | null>; put(s: Snap): Promise<void>; all(): Promise<Snap[]> } };

async function bundleDriver(): Promise<string> {
  const out = await esbuild.build({ stdin: { contents: DRIVER, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  return out.outputFiles[0]?.text ?? '';
}
async function loadDriver(page: Page, body: string): Promise<void> {
  await page.route('**/pds-walker-driver.js', (route) => route.fulfill({ contentType: 'text/javascript', body }));
  await page.goto('/index.html');
  await page.addScriptTag({ url: 'pds-walker-driver.js', type: 'module' });
  await page.waitForFunction(() => typeof (window as unknown as Partial<W>).__pdsStore === 'function');
}
const snap = (did: string, fetchedAt: number, follows: string[] = []): Snap => ({ did, pds: 'https://x.example', rev: `r${fetchedAt}`, follows, fetchedAt });

test('indexedDbStore: put/get/all round-trip, keyed by did, keeps the newer, survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && m.text().includes('[croft]')) errors.push(m.text()); });
  const body = await bundleDriver();
  await loadDriver(page, body);
  const first = await page.evaluate(async (s) => {
    const store = (window as unknown as W).__pdsStore('pds-walker-e2e');
    await store.put(s.a10); await store.put(s.a20); await store.put(s.a15); await store.put(s.b1);
    return { a: await store.get('did:plc:a'), count: (await store.all()).length, missing: await store.get('did:plc:nobody') };
  }, { a10: snap('did:plc:a', 10), a20: snap('did:plc:a', 20, ['did:plc:f']), a15: snap('did:plc:a', 15), b1: snap('did:plc:b', 1) });
  expect(first.a?.fetchedAt).toBe(20);
  expect(first.a?.follows).toEqual(['did:plc:f']);
  expect(first.count).toBe(2); // keyed by did: three puts of a → one row
  expect(first.missing).toBeNull();

  await page.reload();
  await loadDriver(page, body);
  const after = await page.evaluate(async () => {
    const store = (window as unknown as W).__pdsStore('pds-walker-e2e');
    const other = (window as unknown as W).__pdsStore('pds-walker-e2e-other');
    return { a: await store.get('did:plc:a'), count: (await store.all()).length, otherCount: (await other.all()).length };
  });
  expect(after.a?.fetchedAt).toBe(20); // persisted across the reload
  expect(after.count).toBe(2);
  expect(after.otherCount).toBe(0); // the name argument is honoured
  expect(errors).toEqual([]);
});
