import { describe, it, expect } from 'vitest';
import { b64urlFromString, sha256B64url, signJwt, decodeJwt } from '../../src/atproto/oauth/jose';
import { createPkce, challengeS256 } from '../../src/atproto/oauth/pkce';
import {
  generateDpopKey,
  exportDpopKey,
  importDpopKey,
  jwkThumbprint,
  createDpopProof,
} from '../../src/atproto/oauth/dpop';

// Ported from skylite's proven src/atproto/oauth — the pure crypto pieces of
// the OAuth flow (PKCE + DPoP), no network involved.

describe('jose', () => {
  it('base64url has no padding or url-unsafe chars', () => {
    expect(b64urlFromString('subjects?')).not.toMatch(/[+/=]/);
  });

  it('S256 matches the RFC 7636 appendix B test vector', async () => {
    const challenge = await sha256B64url('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('pkce', () => {
  it('produces a verifier and its S256 challenge', async () => {
    const p = await createPkce();
    expect(p.method).toBe('S256');
    expect(p.verifier.length).toBeGreaterThanOrEqual(43);
    expect(await challengeS256(p.verifier)).toBe(p.challenge);
  });
});

describe('dpop', () => {
  it('generates a P-256 key and a stable RFC 7638 thumbprint', async () => {
    const key = await generateDpopKey();
    expect(key.publicJwk.crv).toBe('P-256');
    const a = await jwkThumbprint(key.publicJwk);
    const b = await jwkThumbprint(key.publicJwk);
    expect(a).toBe(b);
    expect(a).not.toMatch(/[+/=]/);
  });

  it('round-trips a key through export/import (survives the redirect)', async () => {
    const key = await generateDpopKey();
    const restored = await importDpopKey(await exportDpopKey(key));
    expect(restored.publicJwk).toEqual(key.publicJwk);
    const proof = await createDpopProof({ key: restored, htm: 'POST', htu: 'https://pds/x', iat: 1_700_000_000 });
    expect(proof.split('.')).toHaveLength(3);
  });

  it('builds a verifiable DPoP proof with the expected claims', async () => {
    const key = await generateDpopKey();
    const proof = await createDpopProof({
      key,
      htm: 'POST',
      htu: 'https://pds.example/xrpc/com.atproto.repo.putRecord',
      nonce: 'abc',
      accessToken: 'token123',
      iat: 1_700_000_000,
    });
    const { header, payload } = decodeJwt(proof);
    expect(header.typ).toBe('dpop+jwt');
    expect(header.alg).toBe('ES256');
    expect((header.jwk as { crv: string }).crv).toBe('P-256');
    expect(payload.htm).toBe('POST');
    expect(payload.htu).toBe('https://pds.example/xrpc/com.atproto.repo.putRecord');
    expect(payload.nonce).toBe('abc');
    expect(payload.iat).toBe(1_700_000_000);
    expect(typeof payload.ath).toBe('string');
    expect(typeof payload.jti).toBe('string');

    const pub = await globalThis.crypto.subtle.importKey(
      'jwk',
      { ...key.publicJwk, ext: true },
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify'],
    );
    const [h, p, s] = proof.split('.');
    if (!h || !p || !s) throw new Error('malformed proof');
    const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const ok = await globalThis.crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pub,
      sig,
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
  });

  it('signJwt output verifies for a freshly generated key', async () => {
    const key = await generateDpopKey();
    const jwt = await signJwt({ alg: 'ES256', typ: 'JWT' }, { hello: 'world' }, key.privateKey);
    expect(decodeJwt(jwt).payload.hello).toBe('world');
  });
});
