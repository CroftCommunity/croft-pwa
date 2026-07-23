import { describe, it, expect } from 'vitest';
import { putRecord, createRecord, deleteRecord, type OAuthSession } from '../../src/atproto/oauth/client';
import { generateDpopKey, exportDpopKey } from '../../src/atproto/oauth/dpop';

async function testSession(): Promise<OAuthSession> {
  const dpopKey = await exportDpopKey(await generateDpopKey());
  return {
    did: 'did:plc:me',
    pds: 'https://pds.test',
    issuer: 'https://auth.test',
    accessToken: 'access-tok',
    tokenEndpoint: 'https://auth.test/token',
    clientId: 'https://app.test/client-metadata.json',
    dpopKey,
  };
}

interface Captured {
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
}

/** Fake fetch that records the request and replies from a queue of [status, json]. */
function recordingFetch(replies: [number, Record<string, unknown>][]): {
  fetchImpl: typeof fetch;
  calls: Captured[];
} {
  const calls: Captured[] = [];
  let i = 0;
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({
      url,
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const [status, json] = replies[Math.min(i++, replies.length - 1)] ?? [200, {}];
    const headers = status === 400 && json.error === 'use_dpop_nonce' ? { 'DPoP-Nonce': 'srv-nonce' } : {};
    return Promise.resolve(new Response(JSON.stringify(json), { status, headers }));
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('DPoP writes to the user own repo', () => {
  it('createRecord posts a DPoP-signed, authorized request to the PDS and returns the uri', async () => {
    const session = await testSession();
    const { fetchImpl, calls } = recordingFetch([[200, { uri: 'at://did:plc:me/ing.croft.croftpwa.note/abc', cid: 'bafy' }]]);
    const res = await createRecord(
      session,
      { collection: 'ing.croft.croftpwa.note', record: { text: 'hi', createdAt: '2026-07-23T00:00:00Z' } },
      fetchImpl,
    );
    expect(res.uri).toBe('at://did:plc:me/ing.croft.croftpwa.note/abc');
    const call = calls[0];
    expect(call?.url).toBe('https://pds.test/xrpc/com.atproto.repo.createRecord');
    expect(call?.method).toBe('POST');
    expect(call?.headers.get('authorization')).toBe('DPoP access-tok');
    expect(call?.headers.get('dpop')).toBeTruthy(); // a DPoP proof JWT
    expect((call?.body as { repo: string } | undefined)?.repo).toBe('did:plc:me');
  });

  it('retries once on use_dpop_nonce and then succeeds', async () => {
    const session = await testSession();
    const { fetchImpl, calls } = recordingFetch([
      [400, { error: 'use_dpop_nonce' }],
      [200, { uri: 'at://x/y/z' }],
    ]);
    const res = await putRecord(
      session,
      { collection: 'ing.croft.croftpwa.note', rkey: 'abc', record: { text: 'x', createdAt: 'now' } },
      fetchImpl,
    );
    expect(calls).toHaveLength(2);
    expect(calls[1]?.headers.get('dpop')).toBeTruthy();
    expect(res.session.dpopNonce).toBe('srv-nonce');
  });

  it('throws on a non-nonce error', async () => {
    const session = await testSession();
    const { fetchImpl } = recordingFetch([[400, { error: 'InvalidRequest' }]]);
    await expect(
      putRecord(session, { collection: 'c', rkey: 'r', record: {} }, fetchImpl),
    ).rejects.toThrow(/putRecord failed \(400\).*InvalidRequest/);
  });

  it('deleteRecord targets the delete endpoint and returns the session', async () => {
    const session = await testSession();
    const { fetchImpl, calls } = recordingFetch([[200, {}]]);
    const out = await deleteRecord(session, { collection: 'c', rkey: 'r' }, fetchImpl);
    expect(calls[0]?.url).toBe('https://pds.test/xrpc/com.atproto.repo.deleteRecord');
    expect(out.did).toBe('did:plc:me');
  });
});
