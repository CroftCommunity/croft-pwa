import { describe, it, expect } from 'vitest';
import { resolveEntryway, resolveHandleToDid, resolveIdentity } from '../../src/atproto/oauth/resolve';

// atproto OAuth discovery: handle → DID → PDS → protected-resource →
// authorization-server metadata. Ported from skylite, reusing croft-pwa's
// own read.ts for the handle/PDS steps rather than a separate RepoClient.

function mockFetch(routes: Record<string, unknown>): typeof fetch {
  return (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    for (const [needle, body] of Object.entries(routes)) {
      if (url.includes(needle)) {
        return Promise.resolve(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }));
      }
    }
    return Promise.resolve(new Response('not found', { status: 404 }));
  };
}

describe('resolveHandleToDid', () => {
  it('resolves a handle to a DID via the AppView', async () => {
    const did = await resolveHandleToDid('alice.test', {
      fetchImpl: mockFetch({ resolveHandle: { did: 'did:plc:alice' } }),
    });
    expect(did).toBe('did:plc:alice');
  });

  it('strips a leading @', async () => {
    let seen = '';
    const fetchImpl = ((input: RequestInfo | URL) => {
      seen = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return Promise.resolve(new Response(JSON.stringify({ did: 'did:plc:x' })));
    }) as typeof fetch;
    await resolveHandleToDid('@bob.test', { fetchImpl });
    expect(seen).toContain('handle=bob.test');
    expect(seen).not.toContain('%40');
  });
});

describe('resolveIdentity', () => {
  it('walks handle → DID → PDS → authserver metadata', async () => {
    const fetchImpl = mockFetch({
      resolveHandle: { did: 'did:plc:alice' },
      'plc.directory/did:plc:alice': {
        id: 'did:plc:alice',
        service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example' }],
      },
      'pds.example/.well-known/oauth-protected-resource': {
        authorization_servers: ['https://auth.example'],
      },
      'auth.example/.well-known/oauth-authorization-server': {
        issuer: 'https://auth.example',
        authorization_endpoint: 'https://auth.example/authorize',
        token_endpoint: 'https://auth.example/token',
        pushed_authorization_request_endpoint: 'https://auth.example/par',
      },
    });

    const id = await resolveIdentity('alice.test', { fetchImpl });
    expect(id.did).toBe('did:plc:alice');
    expect(id.pds).toBe('https://pds.example');
    expect(id.authServer).toBe('https://auth.example');
    expect(id.meta.token_endpoint).toBe('https://auth.example/token');
    expect(id.meta.pushed_authorization_request_endpoint).toBe('https://auth.example/par');
  });

  it('accepts a DID directly (skips handle resolution)', async () => {
    const fetchImpl = mockFetch({
      'plc.directory/did:plc:zed': {
        id: 'did:plc:zed',
        service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.zed' }],
      },
      'pds.zed/.well-known/oauth-protected-resource': { authorization_servers: ['https://auth.zed'] },
      'auth.zed/.well-known/oauth-authorization-server': {
        authorization_endpoint: 'https://auth.zed/a',
        token_endpoint: 'https://auth.zed/t',
        pushed_authorization_request_endpoint: 'https://auth.zed/p',
      },
    });
    const id = await resolveIdentity('did:plc:zed', { fetchImpl });
    expect(id.did).toBe('did:plc:zed');
    expect(id.meta.issuer).toBe('https://auth.zed'); // falls back to authServer when issuer absent
  });

  it('throws on incomplete authserver metadata', async () => {
    const fetchImpl = mockFetch({
      'plc.directory/did:plc:x': {
        id: 'did:plc:x',
        service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://p.x' }],
      },
      'p.x/.well-known/oauth-protected-resource': { authorization_servers: ['https://a.x'] },
      'a.x/.well-known/oauth-authorization-server': { authorization_endpoint: 'only-this' },
    });
    await expect(resolveIdentity('did:plc:x', { fetchImpl })).rejects.toThrow(/incomplete/);
  });
});

// A provider start from a bare origin (the sheet's Sign in, no handle). Two
// live shapes, harvested 2026-08-30 with curl:
//   - a single-host provider (Blacksky, EuroSky, Northsky) is its own PDS AND
//     authorization server, and answers oauth-protected-resource naming itself;
//   - Bluesky's https://bsky.social is an ENTRYWAY — the authorization server for
//     a fleet of PDS hosts (*.host.bsky.network), which are the ones that serve
//     oauth-protected-resource. The entryway answers 404 there and serves
//     oauth-authorization-server directly.
// @atproto/oauth-client's resolveFromService tries protected-resource first and
// falls back to reading the input as an issuer. Before these tests, this code
// assumed shape one everywhere and the Bluesky row failed with
// "protected-resource failed: 404" (found on fun, which ports this file).
function recordingFetch(routes: Record<string, unknown>): { fetchImpl: typeof fetch; calls: () => string[] } {
  const calls: string[] = [];
  const inner = mockFetch(routes);
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return inner(input, init);
  }) as typeof fetch;
  return { fetchImpl, calls: () => calls };
}

const AS_DOC = (issuer: string) => ({
  issuer,
  authorization_endpoint: `${issuer}/oauth/authorize`,
  token_endpoint: `${issuer}/oauth/token`,
  pushed_authorization_request_endpoint: `${issuer}/oauth/par`,
});

describe('resolveEntryway', () => {
  it('a PDS-shaped provider: follows its protected-resource document to the authorization server', async () => {
    const fetchImpl = mockFetch({
      'pds.example/.well-known/oauth-protected-resource': { authorization_servers: ['https://auth.example'] },
      'auth.example/.well-known/oauth-authorization-server': AS_DOC('https://auth.example'),
    });
    const id = await resolveEntryway('https://pds.example', { fetchImpl });
    expect(id).toMatchObject({ did: '', pds: 'https://pds.example', authServer: 'https://auth.example' });
    expect(id.meta.pushed_authorization_request_endpoint).toBe('https://auth.example/oauth/par');
  });

  it('an entryway with no protected-resource document (bsky.social): reads it as the authorization server itself', async () => {
    const { fetchImpl, calls } = recordingFetch({
      'bsky.social/.well-known/oauth-authorization-server': AS_DOC('https://bsky.social'),
    });
    const id = await resolveEntryway('https://bsky.social', { fetchImpl });
    expect(id).toMatchObject({ did: '', pds: 'https://bsky.social', authServer: 'https://bsky.social' });
    expect(id.meta.authorization_endpoint).toBe('https://bsky.social/oauth/authorize');
    // protected-resource is asked for FIRST (a PDS host must not be mistaken for
    // an issuer); the issuer read is the fallback, and it is read once.
    expect(calls()).toEqual([
      'https://bsky.social/.well-known/oauth-protected-resource',
      'https://bsky.social/.well-known/oauth-authorization-server',
    ]);
  });

  it('an origin serving neither document: fails with the protected-resource status, not only the fallback\'s', async () => {
    await expect(resolveEntryway('https://nothing.example', { fetchImpl: mockFetch({}) })).rejects.toThrow(
      'protected-resource failed: 404',
    );
  });

  it('a trailing slash on the entryway is not carried into the resolved origins', async () => {
    const fetchImpl = mockFetch({ 'bsky.social/.well-known/oauth-authorization-server': AS_DOC('https://bsky.social') });
    const id = await resolveEntryway('https://bsky.social/', { fetchImpl });
    expect(id).toMatchObject({ pds: 'https://bsky.social', authServer: 'https://bsky.social' });
  });
});
