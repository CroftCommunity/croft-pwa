import { test, expect } from '@playwright/test';
import { createFetchTransport } from 'croft-pwa/pds-walker';

// @live (plan 2026-09-08 § Phase 3d): the transport against a REAL PDS — no mocks, ~3
// requests, one public account. Run locally with `npm run e2e:live`; never in push CI.
// OQ3: bsky.app (did:plc:z72i7hdynmk6r22z27h6tvur) — official, stable, follows ≥ 1 account
// (14 on 2026-09-08). Asserts shape, not values.
const DID = 'did:plc:z72i7hdynmk6r22z27h6tvur';

test('@live the transport resolves bsky.app, reads its rev, and lists its follows from its PDS', async () => {
  const t = createFetchTransport();
  const resolved = await t.resolve(DID);
  expect('pds' in resolved, JSON.stringify(resolved)).toBe(true);
  if (!('pds' in resolved)) return;
  expect(resolved.pds).toMatch(/^https:\/\/[a-z0-9.-]+$/);

  const rev = await t.latestRev(resolved.pds, DID);
  expect(typeof rev, JSON.stringify(rev)).toBe('string');
  if (typeof rev !== 'string') return;
  expect(rev).toMatch(/^[2-7a-z]{13}$/); // a TID

  const follows = await t.listFollows(resolved.pds, DID);
  expect(Array.isArray(follows), JSON.stringify(follows)).toBe(true);
  if (!Array.isArray(follows)) return;
  expect(follows.length).toBeGreaterThanOrEqual(1);
  for (const d of follows) expect(d).toMatch(/^did:(plc|web):/);
  console.log(`[live] pds=${resolved.pds} rev=${rev} follows=${follows.length}`);
});
