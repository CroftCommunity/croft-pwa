import { randomB64url, sha256B64url } from './jose';

// PKCE (RFC 7636) for the OAuth authorization-code flow. atproto OAuth requires
// the S256 challenge method. Ported from skylite's proven src/atproto/oauth/pkce.ts.

export interface Pkce {
  readonly verifier: string;
  readonly challenge: string;
  readonly method: 'S256';
}

/** A random code verifier — 43–128 chars of unreserved base64url (32 bytes → 43). */
export function generateVerifier(): string {
  return randomB64url(32);
}

/** The S256 challenge for a verifier: base64url(SHA-256(verifier)). */
export async function challengeS256(verifier: string): Promise<string> {
  return sha256B64url(verifier);
}

export async function createPkce(): Promise<Pkce> {
  const verifier = generateVerifier();
  return { verifier, challenge: await challengeS256(verifier), method: 'S256' };
}
