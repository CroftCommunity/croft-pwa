import { describe, it, expect } from 'vitest';
import { memoryStore, type RepoSnapshot, type Store } from 'croft-pwa/pds-walker';

// Phase 4a (plan 2026-09-08): the store — the persistence seam, and its memory implementation
// for tests and Node. Through the export path (1c's rule).
const snap = (did: RepoSnapshot['did'], fetchedAt: number, follows: RepoSnapshot['follows'] = []): RepoSnapshot => ({ did, pds: 'https://x.example', rev: `r${fetchedAt}`, follows, fetchedAt });

describe('memoryStore() — put / get / all', () => {
  it('round-trips a snapshot by did; a missing did is null', async () => {
    const s: Store = memoryStore();
    expect(await s.get('did:plc:a')).toBeNull();
    await s.put(snap('did:plc:a', 10));
    expect(await s.get('did:plc:a')).toEqual(snap('did:plc:a', 10));
    expect(await s.all()).toHaveLength(1);
  });
  it('keeps the NEWER snapshot: a newer put replaces, an older put does not', async () => {
    const s = memoryStore();
    await s.put(snap('did:plc:a', 10));
    await s.put(snap('did:plc:a', 20));
    expect((await s.get('did:plc:a'))?.fetchedAt).toBe(20);
    await s.put(snap('did:plc:a', 15)); // older than what is stored
    expect((await s.get('did:plc:a'))?.fetchedAt).toBe(20);
    await s.put(snap('did:plc:a', 20, ['did:plc:z'])); // equal fetchedAt replaces (a re-list at the same instant is newer information)
    expect((await s.get('did:plc:a'))?.follows).toEqual(['did:plc:z']);
    expect(await s.all()).toHaveLength(1);
  });
  it('returns copies: mutating what get() or all() returned does not change the next read', async () => {
    const s = memoryStore();
    await s.put(snap('did:plc:a', 10, ['did:plc:f']));
    const got = (await s.get('did:plc:a')) as unknown as { follows: string[]; fetchedAt: number };
    got.follows.push('did:plc:mutated');
    got.fetchedAt = 999;
    expect(await s.get('did:plc:a')).toEqual(snap('did:plc:a', 10, ['did:plc:f']));
    const all = await s.all();
    all.pop();
    expect(await s.all()).toHaveLength(1);
  });
  it('all() lists every snapshot, and two stores do not share rows', async () => {
    const a = memoryStore(); const b = memoryStore();
    await a.put(snap('did:plc:a', 1)); await a.put(snap('did:plc:b', 2));
    expect((await a.all()).map((x) => x.did).sort()).toEqual(['did:plc:a', 'did:plc:b']);
    expect(await b.all()).toEqual([]);
  });
});
