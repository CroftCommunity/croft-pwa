// Vault — protect a private key AT REST. A sealed-box private key or a persisted
// DPoP session key must not sit in localStorage in the clear; the vault wraps it
// so only the holder of the passphrase (or, stronger, a passkey) can unwrap it.
// Ported from skylite's src/crypto/vault.ts, scoped to the passphrase path.
//
// Passphrase path (implemented, testable everywhere): PBKDF2-SHA256 at a high
// iteration count derives a wrapping key from the passphrase → HKDF → AES-256-GCM
// wraps the private-key JWK. A wrong passphrase fails the GCM auth tag and
// unwrapKey() throws. The stronger WebAuthn-PRF path (a passkey/biometric derives
// the wrapping secret, nothing to remember or phish) is device-dependent and not
// hermetically testable — staged; see docs/ATPROTO.md.

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c.subtle) throw new Error('WebCrypto is unavailable');
  return c.subtle;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const WRAP_INFO = enc.encode('croft-vault-v1');
export const PBKDF2_ITERATIONS = 600_000;

export interface WrappedKey {
  /** AES-GCM IV, base64. */
  readonly iv: string;
  /** Wrapped private-key JWK (ciphertext incl. GCM tag), base64. */
  readonly ct: string;
  /** PBKDF2 salt, base64. */
  readonly salt: string;
  readonly iterations: number;
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

async function passphraseMaterial(passphrase: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const base = await subtle().importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    256,
  );
  return new Uint8Array(bits);
}

async function aesFromMaterial(material: Uint8Array): Promise<CryptoKey> {
  const hkdf = await subtle().importKey('raw', material as BufferSource, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: WRAP_INFO },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Wrap a private-key JWK at rest behind a passphrase. */
export async function wrapKey(privateKeyJwk: JsonWebKey, passphrase: string): Promise<WrappedKey> {
  if (!passphrase) throw new Error('a passphrase is required');
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const material = await passphraseMaterial(passphrase, salt, PBKDF2_ITERATIONS);
  const key = await aesFromMaterial(material);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(privateKeyJwk)));
  return { iv: b64(iv), ct: b64(ct), salt: b64(salt), iterations: PBKDF2_ITERATIONS };
}

/** Unwrap a private-key JWK. Throws on the wrong passphrase (GCM auth-tag failure). */
export async function unwrapKey(wrapped: WrappedKey, passphrase: string): Promise<JsonWebKey> {
  if (!passphrase) throw new Error('a passphrase is required');
  const material = await passphraseMaterial(passphrase, unb64(wrapped.salt), wrapped.iterations);
  const key = await aesFromMaterial(material);
  const pt = await subtle().decrypt(
    { name: 'AES-GCM', iv: unb64(wrapped.iv) as BufferSource },
    key,
    unb64(wrapped.ct) as BufferSource,
  );
  return JSON.parse(dec.decode(pt)) as JsonWebKey;
}
