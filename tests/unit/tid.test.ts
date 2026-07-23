import { describe, it, expect } from 'vitest';
import { genTid, isTid, randomRkey, encodeTid } from '../../src/atproto/tid';

describe('TID (record keys)', () => {
  it('is 13 base32-sortable chars and validates', () => {
    const t = genTid(1_700_000_000_000, 42);
    expect(t).toHaveLength(13);
    expect(isTid(t)).toBe(true);
  });

  it('is deterministic for the same (time, clockId)', () => {
    expect(genTid(1_700_000_000_000, 7)).toBe(genTid(1_700_000_000_000, 7));
  });

  it('sorts by time (later timestamp → lexicographically greater)', () => {
    const earlier = genTid(1_700_000_000_000, 0);
    const later = genTid(1_700_000_001_000, 0);
    expect(later > earlier).toBe(true);
  });

  it('rejects non-TID strings', () => {
    expect(isTid('nope')).toBe(false);
    expect(isTid('0000000000000')).toBe(false); // '0'/'1' are not in the alphabet
    expect(isTid(encodeTid(0n))).toBe(true);
  });

  it('randomRkey is a valid TID', () => {
    expect(isTid(randomRkey())).toBe(true);
  });
});
