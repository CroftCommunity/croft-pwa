import { describe, it, expect } from 'vitest';
import {
  resolveHandle,
  resolvePds,
  resolveIdentity,
  getProfile,
  pdsEndpointFromDoc,
  AtprotoReadError,
  type ReadDeps,
} from '../../src/atproto/read';

// A fetchImpl that answers from a URL→response map, so the read logic is tested
// with no network. Each value is [status, jsonBody].
function fakeFetch(routes: Record<string, [number, unknown]>): typeof fetch {
  return (input) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    for (const [pattern, [status, body]] of Object.entries(routes)) {
      if (href.includes(pattern)) {
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
    }
    return Promise.resolve(new Response('not found', { status: 404 }));
  };
}

const deps = (routes: Record<string, [number, unknown]>): ReadDeps => ({ fetchImpl: fakeFetch(routes) });

describe('atproto read: identity resolution', () => {
  it('resolves a handle to a DID via the AppView', async () => {
    const did = await resolveHandle('bsky.app', deps({ 'resolveHandle?handle=bsky.app': [200, { did: 'did:plc:abc' }] }));
    expect(did).toBe('did:plc:abc');
  });

  it('throws AtprotoReadError with the status on a failed lookup', async () => {
    await expect(resolveHandle('nope.invalid', deps({ resolveHandle: [400, {}] }))).rejects.toMatchObject({
      name: 'AtprotoReadError',
      status: 400,
    });
  });

  it('picks the atproto PDS endpoint out of a DID document', () => {
    expect(
      pdsEndpointFromDoc({
        id: 'did:plc:abc',
        service: [
          { id: '#other', type: 'X', serviceEndpoint: 'https://x' },
          { id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example/' },
        ],
      }),
    ).toBe('https://pds.example/');
  });

  it('resolves a did:plc to its PDS via the directory (trailing slash trimmed)', async () => {
    const pds = await resolvePds(
      'did:plc:abc',
      deps({
        'plc.directory/did:plc:abc': [
          200,
          { id: 'did:plc:abc', service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example/' }] },
        ],
      }),
    );
    expect(pds).toBe('https://pds.example');
  });

  it('rejects an unsupported DID method', async () => {
    await expect(resolvePds('did:example:xyz')).rejects.toThrow(AtprotoReadError);
  });

  it('resolveIdentity chains handle → DID → PDS', async () => {
    const id = await resolveIdentity(
      'alice.test',
      deps({
        'resolveHandle?handle=alice.test': [200, { did: 'did:plc:alice' }],
        'plc.directory/did:plc:alice': [
          200,
          { id: 'did:plc:alice', service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.alice' }] },
        ],
      }),
    );
    expect(id).toEqual({ did: 'did:plc:alice', pds: 'https://pds.alice' });
  });
});

describe('atproto read: profile (open-world)', () => {
  it('returns did+handle and tolerates missing optional fields', async () => {
    const p = await getProfile('did:plc:abc', deps({ getProfile: [200, { did: 'did:plc:abc', handle: 'bsky.app', extra: 'ignored' }] }));
    expect(p).toEqual({ did: 'did:plc:abc', handle: 'bsky.app' });
  });

  it('carries displayName when present', async () => {
    const p = await getProfile('x', deps({ getProfile: [200, { did: 'did:plc:x', handle: 'x.test', displayName: 'X' }] }));
    expect(p.displayName).toBe('X');
  });

  it('fails loud when a required field is missing', async () => {
    await expect(getProfile('x', deps({ getProfile: [200, { handle: 'x.test' }] }))).rejects.toThrow(AtprotoReadError);
  });
});
