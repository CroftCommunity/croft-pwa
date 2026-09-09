import { describe, it, expect } from 'vitest';
import { rings, RING_IDS, type Did, type RepoSnapshot, type RingId } from 'croft-pwa/pds-walker';

// Phase 2a (plan 2026-09-08): the pure core — rings and "as of". Imported through the export
// path (1c's rule), so this file is an entry-point test.
const ME: Did = 'did:plc:me';
const snap = (did: Did, follows: readonly Did[], fetchedAt: number): RepoSnapshot => ({
  did, pds: `https://${did.slice(8)}.example`, rev: `rev-${did}`, follows, fetchedAt,
});

describe('rings() — five nested rings from repo snapshots', () => {
  // The research's worked example: M is a mutual (follows me back), F is not. Both have
  // follows of their own; X is reachable only through F, Y only through M.
  const M: Did = 'did:plc:m', F: Did = 'did:plc:f', X: Did = 'did:plc:x', Y: Did = 'did:plc:y';
  const example = [snap(ME, [M, F], 5), snap(M, [ME, Y], 1), snap(F, [X], 9)];

  it('me / mut / fol come from my snapshot and who follows me back', () => {
    const r = rings({ me: ME, snapshots: example });
    expect([...r.me.members]).toEqual([ME]);
    expect(r.mut.members).toEqual(new Set([ME, M]));
    expect(r.fol.members).toEqual(new Set([ME, M, F]));
  });

  it('hop is the mutuals\' follows; hop2 is every followee\'s follows (a non-mutual separates them)', () => {
    const r = rings({ me: ME, snapshots: example });
    expect(r.hop.members.has(Y)).toBe(true);
    expect(r.hop2.members.has(Y)).toBe(true);
    expect(r.hop2.members.has(X)).toBe(true);
    expect(r.hop.members.has(X)).toBe(false);
  });

  it('asOf is the OLDEST fetchedAt among the ring\'s sources, per ring', () => {
    const r = rings({ me: ME, snapshots: example });
    expect(r.fol.asOf).toBe(5); // fol reads only my snapshot (t=5)
    expect(r.mut.asOf).toBe(1); // mut reads mine and every followee's (t=5, 1, 9) → 1
    expect(r.hop2.asOf).toBe(1);
  });

  it('a missing followee snapshot lowers complete, never the membership (unknown is not empty)', () => {
    const full = rings({ me: ME, snapshots: example });
    const partial = rings({ me: ME, snapshots: [snap(ME, [M, F], 5), snap(M, [ME, Y], 1)] }); // F unknown
    expect(full.hop2.complete).toBe(true);
    expect(partial.hop2.complete).toBe(false);
    expect(partial.mut.complete).toBe(false);
    expect(partial.fol.complete).toBe(true); // fol needs only my snapshot
    expect(partial.mut.members).toEqual(full.mut.members);
    expect(partial.hop.members).toEqual(full.hop.members);
    expect(partial.fol.members).toEqual(full.fol.members);
    // M1: hop2 with F unknown holds exactly what the present sources say — no X, and nothing invented.
    expect(partial.hop2.members).toEqual(new Set([ME, M, F, Y]));
  });

  it('with no snapshot for me at all, every ring is {me}, incomplete, asOf 0', () => {
    const r = rings({ me: ME, snapshots: [] });
    for (const id of RING_IDS) {
      expect(r[id].id).toBe(id); // M1: every ring carries its own id
      expect([...r[id].members]).toEqual([ME]);
      expect(r[id].complete).toBe(false);
      expect(r[id].asOf).toBe(0);
    }
  });

  it('accepts a Map of snapshots as well as an array', () => {
    const byDid = new Map(example.map((s) => [s.did, s] as const));
    expect(rings({ me: ME, snapshots: byDid }).hop2.members).toEqual(rings({ me: ME, snapshots: example }).hop2.members);
  });
});

// The containment chain me ⊂ mut ⊂ fol ⊂ hop ⊂ hop2 must hold on every graph (forage's
// rings.js rule, now a property). OQ1 (confirmed): a seeded generator, no new dependency.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}
function randomGraph(seed: number): { me: Did; snapshots: RepoSnapshot[] } {
  const rnd = lcg(seed);
  const n = 2 + Math.floor(rnd() * 7); // 2..8 accounts
  const dids: Did[] = Array.from({ length: n }, (_, i) => `did:plc:n${i}` as Did);
  const snapshots: RepoSnapshot[] = [];
  for (const d of dids) {
    if (rnd() < 0.2) continue; // some accounts have no snapshot (unknown)
    const follows = dids.filter((o) => o !== d && rnd() < 0.5);
    snapshots.push(snap(d, follows, 1 + Math.floor(rnd() * 100)));
  }
  return { me: dids[0] as Did, snapshots };
}
const CHAIN: readonly RingId[] = ['me', 'mut', 'fol', 'hop', 'hop2'];

describe('property: the containment chain holds on random graphs', () => {
  it('me ⊂ mut ⊂ fol ⊂ hop ⊂ hop2 for 300 seeded graphs', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = rings(randomGraph(seed));
      for (let i = 1; i < CHAIN.length; i++) {
        const inner = r[CHAIN[i - 1] as RingId].members, outer = r[CHAIN[i] as RingId].members;
        for (const d of inner) expect(outer.has(d), `seed ${seed}: ${CHAIN[i - 1]} ⊄ ${CHAIN[i]} (${d})`).toBe(true);
      }
      expect(RING_IDS).toEqual(CHAIN);
    }
  });
});
