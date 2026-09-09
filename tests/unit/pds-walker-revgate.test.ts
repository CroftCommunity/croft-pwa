import { describe, it, expect } from 'vitest';
import { decide, type RepoSnapshot } from 'croft-pwa/pds-walker';

// Phase 2b (plan 2026-09-08): the rev gate — from a stored snapshot and a fresh rev, keep,
// relist, or admit the answer is unknown. Through the export path (1c's rule).
const snapshot: RepoSnapshot = { did: 'did:plc:a', pds: 'https://a.example', rev: '3muya5yt7ef2c', follows: [], fetchedAt: 10 };

describe('decide() — the rev gate', () => {
  it('no snapshot → relist, whatever the rev says (even unknown)', () => {
    expect(decide({ snapshot: undefined, latestRev: '3muya5yt7ef2c' })).toBe('relist');
    expect(decide({ snapshot: undefined, latestRev: undefined })).toBe('relist');
    expect(decide({ snapshot: undefined, latestRev: { unknown: 'host down' } })).toBe('relist');
  });
  it('snapshot present, rev unknown → unknown (never relist, never keep)', () => {
    expect(decide({ snapshot, latestRev: undefined })).toBe('unknown');
    expect(decide({ snapshot, latestRev: { unknown: '502' } })).toBe('unknown');
  });
  it('equal revs → keep', () => {
    expect(decide({ snapshot, latestRev: '3muya5yt7ef2c' })).toBe('keep');
  });
  it('a rev that differs only in its last character → relist (equality, not prefix)', () => {
    expect(decide({ snapshot, latestRev: '3muya5yt7ef2d' })).toBe('relist');
  });
  it('a rev that differs anywhere → relist', () => {
    expect(decide({ snapshot, latestRev: '3muzvmturnp2n' })).toBe('relist');
  });
});
