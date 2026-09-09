import { describe, it, expect } from 'vitest';
import { defaultPolicy, resolvePolicy, due, ring2Targets, RING_IDS, type Did, type RepoSnapshot } from 'croft-pwa/pds-walker';

// Phase 2c (plan 2026-09-08): cadence — per-ring refresh intervals and "which repos are due
// now". Through the export path (1c's rule).
const snap = (did: Did, fetchedAt: number): RepoSnapshot => ({ did, pds: 'https://x.example', rev: 'r', follows: [], fetchedAt });

describe('defaultPolicy — the research § 4 cadence', () => {
  it('has exactly the five ring keys, and hop2 refreshes on hop\'s cadence (OQ6 c)', () => {
    expect(Object.keys(defaultPolicy.refreshMs).sort()).toEqual([...RING_IDS].sort());
    expect(defaultPolicy.refreshMs.hop2).toBe(defaultPolicy.refreshMs.hop);
    expect(defaultPolicy.refreshMs.me).toBe(60_000);
    expect(defaultPolicy.refreshMs.fol).toBe(10 * 60_000);
    expect(defaultPolicy.refreshMs.hop).toBe(24 * 60 * 60_000);
    expect(defaultPolicy.perHostConcurrency).toBe(4);
    expect(defaultPolicy.ring2Parallel).toBe(10);
  });
  it('resolvePolicy merges refreshMs per key, leaving the rest at defaults (no shallow merge)', () => {
    const p = resolvePolicy({ refreshMs: { hop: 1 } });
    expect(p.refreshMs.hop).toBe(1);
    expect(p.refreshMs.hop2).toBe(defaultPolicy.refreshMs.hop2);
    expect(p.refreshMs.me).toBe(defaultPolicy.refreshMs.me);
    expect(p.refreshMs.mut).toBe(defaultPolicy.refreshMs.mut);
    expect(p.refreshMs.fol).toBe(defaultPolicy.refreshMs.fol);
    expect(p.perHostConcurrency).toBe(4);
    expect(resolvePolicy({ ring2Parallel: 3 }).ring2Parallel).toBe(3);
    expect(resolvePolicy(undefined)).toEqual(defaultPolicy);
  });
});

describe('due() — which repos are due for a ring, at its cadence', () => {
  const R = 1000;
  const policy = resolvePolicy({ refreshMs: { fol: R } });
  it('R−1 is not due, R is due, R+1 is due', () => {
    const now = 5000;
    const snaps = [snap('did:plc:a', now - (R - 1)), snap('did:plc:b', now - R), snap('did:plc:c', now - (R + 1))];
    expect(due({ snapshots: snaps, now, policy, ring: 'fol' })).toEqual(['did:plc:b', 'did:plc:c']);
  });
  it('uses the cadence of the ring asked for', () => {
    const now = 5000;
    const snaps = [snap('did:plc:a', now - 2000)];
    expect(due({ snapshots: snaps, now, policy, ring: 'fol' })).toEqual(['did:plc:a']);
    expect(due({ snapshots: snaps, now, policy, ring: 'hop' })).toEqual([]);
  });
  it('accepts a Map and returns dids in snapshot order', () => {
    const now = 100_000; // past the `me` cadence (60 s) for snapshots taken at t=0
    const m = new Map<Did, RepoSnapshot>([['did:plc:z', snap('did:plc:z', 0)], ['did:plc:y', snap('did:plc:y', 0)]]);
    expect(due({ snapshots: m, now, policy, ring: 'me' })).toEqual(['did:plc:z', 'did:plc:y']);
  });
});

describe('ring2Targets() — only the movers are re-walked', () => {
  it('returns exactly the followees whose rev moved, deduplicated, in order', () => {
    expect(ring2Targets({ moved: ['did:plc:b', 'did:plc:a', 'did:plc:b'] })).toEqual(['did:plc:b', 'did:plc:a']);
    expect(ring2Targets({ moved: [] })).toEqual([]);
  });
});
