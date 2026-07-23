// Sealed box — "privacy in public". Anyone with the recipient's PUBLIC key can
// seal a message; only the holder of the matching PRIVATE key can open it. A
// device can seal a payload to a recipient's public key and write the ciphertext
// to a public repo; on the open network it is inert. Ported from skylite's
// network-proven implementation (src/crypto/sealedbox.ts).
//
// Scheme (all WebCrypto, no dependencies): a fresh ephemeral ECDH(P-256) keypair
// per message → HKDF-SHA256 → AES-256-GCM. Fresh ephemerals mean two seals of the
// same text differ, and a leaked ephemeral exposes only its own message. The real
// secret is the recipient's PRIVATE key — protecting it at rest (a passkey/WebAuthn-
// PRF or passphrase "vault") is the next layer, staged with the write path. A
// wrong key or any tampering fails the GCM auth tag and open() throws.

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c.subtle) throw new Error('WebCrypto is unavailable');
  return c.subtle;
}

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
const HKDF_INFO = new TextEncoder().encode('croft-sealedbox-v1');

export interface SealedBox {
  /** Ephemeral public key (JWK) for this message's ECDH. */
  readonly epk: JsonWebKey;
  /** AES-GCM IV, base64. */
  readonly iv: string;
  /** Ciphertext (incl. GCM tag), base64. */
  readonly ct: string;
}

export interface Keypair {
  readonly publicKeyJwk: JsonWebKey;
  readonly privateKeyJwk: JsonWebKey;
}

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Guard: a JWK meant to be PUBLIC must not carry the private scalar `d`. Publishing
 * a private key would expose everything sealed to it — so this fails loud before a
 * key with `d` is ever treated as, or stored as, a public key.
 */
export function assertPublicJwk(jwk: JsonWebKey): void {
  if (jwk.d !== undefined) {
    throw new Error('refusing to use a private key (JWK has `d`) where a public key is required');
  }
}

/** Generate a recipient keypair (extractable, so the public half can be published). */
export async function generateKeypair(): Promise<Keypair> {
  const pair = await subtle().generateKey(ECDH, true, ['deriveBits']);
  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    subtle().exportKey('jwk', pair.publicKey),
    subtle().exportKey('jwk', pair.privateKey),
  ]);
  return { publicKeyJwk, privateKeyJwk };
}

async function sharedAesKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  const bits = await subtle().deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const hkdf = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: HKDF_INFO },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Seal a plaintext to a recipient's public key. Only the private key can open it. */
export async function seal(plaintext: string, publicKeyJwk: JsonWebKey): Promise<SealedBox> {
  assertPublicJwk(publicKeyJwk);
  const recipient = await subtle().importKey('jwk', publicKeyJwk, ECDH, false, []);
  const ephemeral = await subtle().generateKey(ECDH, true, ['deriveBits']);
  const key = await sharedAesKey(ephemeral.privateKey, recipient);

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const epk = await subtle().exportKey('jwk', ephemeral.publicKey);
  return { epk, iv: b64(iv), ct: b64(ct) };
}

/** Open a sealed box with the recipient's private key. Throws on the wrong key or tampering. */
export async function open(box: SealedBox, privateKeyJwk: JsonWebKey): Promise<string> {
  const priv = await subtle().importKey('jwk', privateKeyJwk, ECDH, false, ['deriveBits']);
  const epk = await subtle().importKey('jwk', box.epk, ECDH, false, []);
  const key = await sharedAesKey(priv, epk);
  const pt = await subtle().decrypt(
    { name: 'AES-GCM', iv: unb64(box.iv) as BufferSource },
    key,
    unb64(box.ct) as BufferSource,
  );
  return new TextDecoder().decode(pt);
}
