import { describe, it, expect } from 'vitest';
import { resolveDid } from 'croft-pwa/pds-walker';

// Phase 3a (plan 2026-09-08): identity resolution — a DID to its PDS endpoint, or an honest
// `{ unknown }`. Through the export path (1c's rule). Fixtures are HARVESTED (2026-09-08) and
// inline, each behind its source.

// source: https://plc.directory/did:plc:z72i7hdynmk6r22z27h6tvur (2026-09-08) — bsky.app's doc,
// trimmed to the fields resolution reads (id + service).
const PLC_DOC = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  id: 'did:plc:z72i7hdynmk6r22z27h6tvur',
  alsoKnownAs: ['at://bsky.app'],
  service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://puffball.us-east.host.bsky.network' }],
};

type Route = [status: number, body: string, contentType?: string];
function fakeFetch(routes: Record<string, Route>): typeof fetch {
  return (input) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    for (const [pattern, [status, body, ct]] of Object.entries(routes)) {
      if (href.includes(pattern)) return Promise.resolve(new Response(body, { status, headers: { 'content-type': ct ?? 'application/json' } }));
    }
    return Promise.resolve(new Response('not found', { status: 404 }));
  };
}

describe('resolveDid() — a DID to its PDS, or unknown', () => {
  it('did:plc → the #atproto_pds endpoint from plc.directory', async () => {
    const r = await resolveDid('did:plc:z72i7hdynmk6r22z27h6tvur', { fetchImpl: fakeFetch({ 'plc.directory/did:plc:z72i7': [200, JSON.stringify(PLC_DOC)] }) });
    expect(r).toEqual({ pds: 'https://puffball.us-east.host.bsky.network' });
  });
  it('did:web → https://<host>/.well-known/did.json', async () => {
    const doc = { ...PLC_DOC, id: 'did:web:example.org', service: [{ ...PLC_DOC.service[0], serviceEndpoint: 'https://pds.example.org/' }] };
    const r = await resolveDid('did:web:example.org', { fetchImpl: fakeFetch({ 'https://example.org/.well-known/did.json': [200, JSON.stringify(doc)] }) });
    expect(r).toEqual({ pds: 'https://pds.example.org' }); // trailing slash trimmed
  });
  it('a 404 from the directory → unknown, and the reason names the status', async () => {
    const r = await resolveDid('did:plc:missing', { fetchImpl: fakeFetch({}) });
    expect('unknown' in r).toBe(true);
    if ('unknown' in r) expect(r.unknown).toContain('404');
  });
  it('a document with no PDS service → unknown, and the reason names the cause (not the status)', async () => {
    const r = await resolveDid('did:plc:nopds', { fetchImpl: fakeFetch({ 'did:plc:nopds': [200, JSON.stringify({ ...PLC_DOC, service: [] })] }) });
    expect('unknown' in r).toBe(true);
    if ('unknown' in r) { expect(r.unknown).toMatch(/no PDS endpoint/); expect(r.unknown).not.toContain('404'); }
  });
  it('a 200 whose body is not JSON (the OpenDNS interception page) → unknown, not a throw', async () => {
    // source: https://selfhosted.social/xrpc/… answered by this machine's resolver (2026-09-08), first bytes
    const html = '<html><head><script type="text/javascript">location.replace("https://block.opendns.com/?url=847077';
    const r = await resolveDid('did:plc:intercepted', { fetchImpl: fakeFetch({ 'did:plc:intercepted': [200, html, 'text/html'] }) });
    expect('unknown' in r).toBe(true);
    if ('unknown' in r) expect(r.unknown).toMatch(/JSON/);
  });
  it('an unsupported DID method → unknown', async () => {
    const r = await resolveDid('did:key:zabc', { fetchImpl: fakeFetch({}) });
    expect('unknown' in r).toBe(true);
    if ('unknown' in r) expect(r.unknown).toMatch(/unsupported/);
  });
});
