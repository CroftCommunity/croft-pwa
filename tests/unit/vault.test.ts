import { describe, it, expect } from 'vitest';
import { wrapKey, unwrapKey } from '../../src/crypto/vault';
import { generateKeypair } from '../../src/crypto/sealedbox';

describe('vault (key at rest, passphrase path)', () => {
  it('wraps a private key and unwraps it with the right passphrase', async () => {
    const { privateKeyJwk } = await generateKeypair();
    const wrapped = await wrapKey(privateKeyJwk, 'correct horse battery staple');
    expect(wrapped.iv && wrapped.ct && wrapped.salt).toBeTruthy();
    expect(wrapped.iterations).toBeGreaterThanOrEqual(100_000);
    const back = await unwrapKey(wrapped, 'correct horse battery staple');
    expect(back).toEqual(privateKeyJwk);
  });

  it('does not carry the plaintext key in the wrapped blob', async () => {
    const { privateKeyJwk } = await generateKeypair();
    const wrapped = await wrapKey(privateKeyJwk, 'pw');
    expect(JSON.stringify(wrapped)).not.toContain(privateKeyJwk.d ?? 'NOPE');
  });

  it('the wrong passphrase fails the auth tag and throws', async () => {
    const { privateKeyJwk } = await generateKeypair();
    const wrapped = await wrapKey(privateKeyJwk, 'right');
    await expect(unwrapKey(wrapped, 'wrong')).rejects.toThrow();
  });

  it('requires a passphrase', async () => {
    const { privateKeyJwk } = await generateKeypair();
    await expect(wrapKey(privateKeyJwk, '')).rejects.toThrow(/passphrase/);
  });
});
