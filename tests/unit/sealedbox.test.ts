import { describe, it, expect } from 'vitest';
import { generateKeypair, seal, open, assertPublicJwk } from '../../src/crypto/sealedbox';

describe('sealed box (privacy in public)', () => {
  it('round-trips: a message sealed to a public key opens with the private key', async () => {
    const { publicKeyJwk, privateKeyJwk } = await generateKeypair();
    const box = await seal('the eagle lands at dawn', publicKeyJwk);
    expect(await open(box, privateKeyJwk)).toBe('the eagle lands at dawn');
  });

  it('two seals of the same text differ (fresh ephemeral per message)', async () => {
    const { publicKeyJwk } = await generateKeypair();
    const a = await seal('same', publicKeyJwk);
    const b = await seal('same', publicKeyJwk);
    expect(a.ct).not.toBe(b.ct);
    expect(a.epk).not.toEqual(b.epk);
  });

  it('the wrong private key cannot open the box', async () => {
    const recipient = await generateKeypair();
    const stranger = await generateKeypair();
    const box = await seal('secret', recipient.publicKeyJwk);
    await expect(open(box, stranger.privateKeyJwk)).rejects.toThrow();
  });

  it('tampering with the ciphertext fails the GCM auth tag', async () => {
    const { publicKeyJwk, privateKeyJwk } = await generateKeypair();
    const box = await seal('secret', publicKeyJwk);
    // Flip a byte in the base64 ciphertext.
    const tampered = { ...box, ct: box.ct.slice(0, -2) + (box.ct.endsWith('A') ? 'B' : 'A') + '=' };
    await expect(open(tampered, privateKeyJwk)).rejects.toThrow();
  });

  it('refuses to treat a private key (JWK with `d`) as a public key', async () => {
    const { publicKeyJwk, privateKeyJwk } = await generateKeypair();
    expect(privateKeyJwk.d).toBeTruthy();
    expect(() => assertPublicJwk(privateKeyJwk)).toThrow(/private key/);
    expect(() => assertPublicJwk(publicKeyJwk)).not.toThrow();
    // seal() enforces the guard too.
    await expect(seal('x', privateKeyJwk)).rejects.toThrow(/private key/);
  });
});
