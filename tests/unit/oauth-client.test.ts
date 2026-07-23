import { describe, it, expect } from 'vitest';
import {
  beginAuthorization,
  completeAuthorization,
  refresh,
  ensureFresh,
  type PendingAuth,
  type OAuthSession,
} from '../../src/atproto/oauth/client';
import { generateDpopKey, exportDpopKey } from '../../src/atproto/oauth/dpop';

// atproto OAuth for a public (SPA) client — authorization-code + PKCE + PAR,
// DPoP-bound tokens. Ported from skylite's proven src/atproto/oauth/client.ts,
// scoped to sign-in only: DPoP-authenticated writes (putRecord/createRecord/
// deleteRecord) are a separate, later increment (docs/ATPROTO.md).

const CFG = {
  clientId: 'https://croftcommunity.github.io/croft-pwa/client-metadata.json',
  redirectUri: 'https://croftcommunity.github.io/croft-pwa/atproto.html',
  scope: 'atproto transition:generic',
};

const DISCOVERY: Record<string, unknown> = {
  resolveHandle: { did: 'did:plc:alice' },
  'plc.directory/did:plc:alice': {
    id: 'did:plc:alice',
    service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example' }],
  },
  'pds.example/.well-known/oauth-protected-resource': { authorization_servers: ['https://auth.example'] },
  'auth.example/.well-known/oauth-authorization-server': {
    issuer: 'https://auth.example',
    authorization_endpoint: 'https://auth.example/authorize',
    token_endpoint: 'https://auth.example/token',
    pushed_authorization_request_endpoint: 'https://auth.example/par',
  },
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init });
}

/** A stateful mock: discovery GETs + a PAR that demands a DPoP nonce once. */
function mockAuthFetch(): { fetchImpl: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  let parTries = 0;
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    for (const [needle, body] of Object.entries(DISCOVERY)) {
      if (url.includes(needle)) return Promise.resolve(json(body));
    }
    if (url.includes('/par')) {
      parTries++;
      const hasNonce = new Headers(init?.headers).get('dpop')?.includes('nonce') ?? false;
      if (parTries === 1 && !hasNonce) {
        return Promise.resolve(json({ error: 'use_dpop_nonce' }, { status: 400, headers: { 'DPoP-Nonce': 'nonce-1' } }));
      }
      return Promise.resolve(json({ request_uri: 'urn:req:abc', expires_in: 60 }, { status: 201 }));
    }
    return Promise.resolve(new Response('nope', { status: 404 }));
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('beginAuthorization', () => {
  it('resolves, PARs (retrying for the DPoP nonce), and returns an authorize URL', async () => {
    const { fetchImpl } = mockAuthFetch();
    const { authorizeUrl, pending } = await beginAuthorization('alice.test', { ...CFG, fetchImpl });

    expect(authorizeUrl).toContain('https://auth.example/authorize');
    expect(authorizeUrl).toContain('request_uri=urn%3Areq%3Aabc');
    expect(authorizeUrl).toContain(encodeURIComponent(CFG.clientId));

    expect(pending.did).toBe('did:plc:alice');
    expect(pending.pds).toBe('https://pds.example');
    expect(pending.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pending.dpopKey.publicJwk.crv).toBe('P-256');
    expect(pending.state).toBeTruthy();
  });
});

describe('completeAuthorization', () => {
  async function pendingFixture(): Promise<PendingAuth> {
    const { fetchImpl } = mockAuthFetch();
    return (await beginAuthorization('alice.test', { ...CFG, fetchImpl })).pending;
  }

  it('exchanges the code for DPoP-bound tokens', async () => {
    const pending = await pendingFixture();
    const tokenFetch = ((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/token')) {
        return Promise.resolve(
          json(
            { access_token: 'AT', refresh_token: 'RT', token_type: 'DPoP', sub: 'did:plc:alice' },
            { headers: { 'DPoP-Nonce': 'n2' } },
          ),
        );
      }
      return Promise.resolve(new Response('nope', { status: 404 }));
    }) as typeof fetch;

    const session = await completeAuthorization(pending, { code: 'CODE', state: pending.state }, { ...CFG, fetchImpl: tokenFetch });
    expect(session.accessToken).toBe('AT');
    expect(session.refreshToken).toBe('RT');
    expect(session.did).toBe('did:plc:alice');
    expect(session.dpopNonce).toBe('n2');
  });

  it('refuses a mismatched state', async () => {
    const pending = await pendingFixture();
    await expect(
      completeAuthorization(pending, { code: 'x', state: 'WRONG' }, CFG),
    ).rejects.toThrow(/state mismatch/);
  });

  it('refuses a token whose sub is not the resolved DID', async () => {
    const pending = await pendingFixture();
    const badSub = ((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/token')) return Promise.resolve(json({ access_token: 'AT', sub: 'did:plc:evil' }));
      return Promise.resolve(new Response('nope', { status: 404 }));
    }) as typeof fetch;
    await expect(
      completeAuthorization(pending, { code: 'c', state: pending.state }, { ...CFG, fetchImpl: badSub }),
    ).rejects.toThrow(/subject/);
  });
});

describe('refresh + ensureFresh (keeping re-auth rare)', () => {
  async function session(over: Partial<OAuthSession> = {}): Promise<OAuthSession> {
    return {
      did: 'did:plc:alice',
      pds: 'https://pds.example',
      issuer: 'https://auth.example',
      accessToken: 'OLD',
      refreshToken: 'RT1',
      tokenEndpoint: 'https://auth.example/token',
      clientId: 'https://app/client-metadata.json',
      dpopKey: await exportDpopKey(await generateDpopKey()),
      ...over,
    };
  }

  it('rotates the refresh token and updates the access token + expiry', async () => {
    let body = '';
    const fetchImpl = ((_i: RequestInfo | URL, init?: RequestInit) => {
      body = typeof init?.body === 'string' ? init.body : '';
      return Promise.resolve(
        new Response(JSON.stringify({ access_token: 'NEW', refresh_token: 'RT2', expires_in: 3600 }), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    }) as typeof fetch;

    const next = await refresh(await session(), fetchImpl);
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=RT1');
    expect(next.accessToken).toBe('NEW');
    expect(next.refreshToken).toBe('RT2'); // rotated
    expect(next.expiresAt).toBeGreaterThan(Date.now());
  });

  it('ensureFresh returns the session untouched when the token is comfortably valid', async () => {
    let called = false;
    const fetchImpl = (() => {
      called = true;
      return Promise.resolve(new Response('{}'));
    }) as typeof fetch;
    const s = await session({ expiresAt: Date.now() + 3_600_000 });
    const same = await ensureFresh(s, fetchImpl);
    expect(called).toBe(false);
    expect(same).toBe(s);
  });

  it('ensureFresh refreshes when the token is near/at expiry', async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ access_token: 'NEW', refresh_token: 'RT2', expires_in: 3600 }), {
          headers: { 'content-type': 'application/json' },
        }),
      )) as typeof fetch;
    const s = await session({ expiresAt: Date.now() + 1000 }); // within the skew
    const fresh = await ensureFresh(s, fetchImpl);
    expect(fresh.accessToken).toBe('NEW');
  });

  it('refresh without a refresh token asks for a new sign-in', async () => {
    await expect(refresh(await session({ refreshToken: undefined as unknown as string }))).rejects.toThrow(/new sign-in/);
  });
});
