// A minimal TID (timestamp identifier) generator, ported from skylite. atproto
// record keys are TIDs: 13 base32-sortable chars encoding (microseconds << 10 |
// clockId), high bit zero. A record gets a RANDOM, sortable rkey — never a name
// or anything derived from user content (lexicon convention: no PII in the key).

const B32 = '234567abcdefghijklmnopqrstuvwxyz';

/** Encode a 64-bit value (as bigint) into a 13-char base32-sortable TID. */
export function encodeTid(n: bigint): string {
  let v = n;
  let s = '';
  for (let i = 0; i < 13; i++) {
    s = B32[Number(v & 31n)] + s;
    v >>= 5n;
  }
  return s;
}

/** True if a string is a well-formed TID (13 chars, base32-sortable alphabet). */
export function isTid(s: string): boolean {
  return s.length === 13 && [...s].every((c) => B32.includes(c));
}

/**
 * Generate a TID from a millisecond timestamp and a 10-bit clock id. Pure so it
 * is deterministic in tests; callers pass Date.now() and a random clockId.
 */
export function genTid(nowMs: number, clockId: number): string {
  const micros = BigInt(Math.max(0, Math.floor(nowMs))) * 1000n;
  const n = (micros << 10n) | BigInt(clockId & 0x3ff);
  return encodeTid(n);
}

/** A fresh random rkey for a new record (browser convenience wrapper). */
export function randomRkey(): string {
  const clockId = Math.floor(Math.random() * 0x3ff);
  return genTid(Date.now(), clockId);
}
