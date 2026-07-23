import { describe, it, expect } from 'vitest';
import { resolveHandleToDid, resolveIdentity } from '../../src/atproto/oauth/resolve';

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
