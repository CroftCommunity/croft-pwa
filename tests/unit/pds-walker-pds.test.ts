import { describe, it, expect } from 'vitest';
import { latestRev, listFollows } from 'croft-pwa/pds-walker';

// Phase 3b (plan 2026-09-08): the two PDS calls the walker makes, honest on failure. Through
// the export path (1c's rule). Bodies are HARVESTED (2026-09-08, bsky.app's repo on
// puffball.us-east.host.bsky.network) and inline, trimmed to two records per page.

const PDS = 'https://puffball.us-east.host.bsky.network';
const DID = 'did:plc:z72i7hdynmk6r22z27h6tvur';
// source: <PDS>/xrpc/com.atproto.sync.getLatestCommit?did=<DID>
const LATEST = { cid: 'bafyreigsqtgu5e6letzvffddjyjdg6inzbloaqp4grk62vovpkhimzwc2a', rev: '3muzvzlycuh2v' };
const rec = (rkey: string, subject: string) => ({
  uri: `at://${DID}/app.bsky.graph.follow/${rkey}`, cid: 'bafyreif2q76zc4awq6hyti2zhi7v6fkp7t5qnhiwzqk5iva5ivxeszg67m',
  value: { $type: 'app.bsky.graph.follow', subject, createdAt: '2026-09-01T18:17:23.980Z' },
});
// source: <PDS>/xrpc/com.atproto.repo.listRecords?repo=<DID>&collection=app.bsky.graph.follow&limit=2
const PAGE1 = { records: [rec('3muhzr5gxv22v', 'did:plc:rcbtnmlk2la67bm4po65oe23'), rec('3mtwpsysbse2f', 'did:plc:a1')], cursor: '3mtwpsysbse2f' };
// source: …&cursor=3mtwpsysbse2f — the last page of records STILL carries a cursor…
const PAGE2 = { records: [rec('3juc5mymmz22b', 'did:plc:b2')], cursor: '3juc5mymmz22b' };
// source: …&cursor=3juc5mymmz22b — …and the page after it is empty with NO cursor (the terminal shape)
const PAGE3 = { records: [] };

type Route = [status: number, body: string, headers?: Record<string, string>];
type Seen = { url: string; accept?: string }[];
function fakeFetch(routes: Array<[pattern: RegExp | string, route: Route]>, seen: Seen = []): typeof fetch {
  return (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const accept = (init?.headers as Record<string, string> | undefined)?.accept;
    seen.push(accept === undefined ? { url: href } : { url: href, accept });
    for (const [pattern, [status, body, headers]] of routes) {
      const hit = typeof pattern === 'string' ? href.includes(pattern) : pattern.test(href);
      if (hit) return Promise.resolve(new Response(body, { status, headers: { 'content-type': 'application/json', ...(headers ?? {}) } }));
    }
    return Promise.resolve(new Response('not found', { status: 404 }));
  };
}
const j = JSON.stringify;

describe('latestRev() — com.atproto.sync.getLatestCommit', () => {
  it('returns the rev', async () => {
    const seen: Seen = [];
    const r = await latestRev(PDS, DID, { fetchImpl: fakeFetch([['getLatestCommit', [200, j(LATEST)]]], seen) });
    expect(r).toBe('3muzvzlycuh2v');
    expect(seen[0]?.url).toBe(`${PDS}/xrpc/com.atproto.sync.getLatestCommit?did=${encodeURIComponent(DID)}`);
  });
  it('a non-2xx → unknown naming the host and status', async () => {
    const r = await latestRev(PDS, DID, { fetchImpl: fakeFetch([['getLatestCommit', [502, '']]]) });
    expect(typeof r).toBe('object');
    if (typeof r !== 'string') { expect(r.unknown).toMatch(/502/); expect(r.unknown).toContain('puffball.us-east.host.bsky.network'); }
  });
  it('a 200 with no rev, an empty rev, a null body, or a non-object body → unknown naming the cause (M2)', async () => {
    for (const body of [j({ cid: 'x' }), j({ rev: '' }), 'null', '"just a string"']) {
      const r = await latestRev(PDS, DID, { fetchImpl: fakeFetch([['getLatestCommit', [200, body]]]) });
      expect(typeof r).toBe('object');
      if (typeof r !== 'string') expect(r.unknown).toBe('getLatestCommit puffball.us-east.host.bsky.network: no rev in body');
    }
  });
  it('sends accept: application/json, and a fetch that throws (network) → unknown with the message (M2)', async () => {
    const seen: Seen = [];
    await latestRev(PDS, DID, { fetchImpl: fakeFetch([['getLatestCommit', [200, j(LATEST)]]], seen) });
    expect(seen[0]?.accept).toBe('application/json');
    const r = await latestRev(PDS, DID, { fetchImpl: () => Promise.reject(new Error('ECONNRESET')) });
    if (typeof r !== 'string') expect(r.unknown).toBe('getLatestCommit puffball.us-east.host.bsky.network: ECONNRESET');
  });
  it('a pds that is not a URL is named as given in the reason (M2)', async () => {
    const r = await latestRev('not a url', DID, { fetchImpl: fakeFetch([]) });
    if (typeof r !== 'string') expect(r.unknown).toBe('getLatestCommit not a url: 404');
  });
});

describe('listFollows() — com.atproto.repo.listRecords over app.bsky.graph.follow, paged', () => {
  const pages = (): Array<[RegExp, Route]> => [
    [/listRecords\?(?!.*cursor=)/, [200, j(PAGE1)]],
    [/cursor=3mtwpsysbse2f/, [200, j(PAGE2)]],
    [/cursor=3juc5mymmz22b/, [200, j(PAGE3)]],
  ];
  it('walks every page until a page has no cursor, returning every subject in order', async () => {
    const seen: Seen = [];
    const r = await listFollows(PDS, DID, { fetchImpl: fakeFetch(pages(), seen) });
    expect(r).toEqual(['did:plc:rcbtnmlk2la67bm4po65oe23', 'did:plc:a1', 'did:plc:b2']);
    expect(seen).toHaveLength(3);
    expect(seen[0]?.url).toContain('collection=app.bsky.graph.follow');
    expect(seen[0]?.url).toContain('limit=100');
    expect(seen[0]?.url).toBe(`${PDS}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(DID)}&collection=app.bsky.graph.follow&limit=100`);
    expect(seen[2]?.url).toContain('cursor=3juc5mymmz22b');
  });
  it('a 502 on page 2 of 3 → unknown with NO subjects from page 1 (never a partial list)', async () => {
    const r = await listFollows(PDS, DID, { fetchImpl: fakeFetch([
      [/listRecords\?(?!.*cursor=)/, [200, j(PAGE1)]],
      [/cursor=3mtwpsysbse2f/, [502, '']],
    ]) });
    expect('unknown' in r).toBe(true);
    if ('unknown' in r) expect(r.unknown).toMatch(/502.*page 2|page 2.*502/);
  });
  it('an empty-string cursor is treated as the last page', async () => {
    const r = await listFollows(PDS, DID, { fetchImpl: fakeFetch([[/listRecords/, [200, j({ records: [rec('k', 'did:plc:only')], cursor: '' })]]]) });
    expect(r).toEqual(['did:plc:only']);
  });
  it('a 200 whose body is HTML (the OpenDNS interception) → unknown, not a JSON crash', async () => {
    const html = '<html><head><script type="text/javascript">location.replace("https://block.opendns.com/?url=847077';
    const r = await listFollows(PDS, DID, { fetchImpl: fakeFetch([[/listRecords/, [200, html, { 'content-type': 'text/html' }]]]) });
    expect('unknown' in r).toBe(true);
    if ('unknown' in r) expect(r.unknown).toMatch(/JSON/);
  });
  it('a 200 with no records field, or a null body, is an empty last page (M2)', async () => {
    expect(await listFollows(PDS, DID, { fetchImpl: fakeFetch([[/listRecords/, [200, j({})]]]) })).toEqual([]);
    expect(await listFollows(PDS, DID, { fetchImpl: fakeFetch([[/listRecords/, [200, 'null']]]) })).toEqual([]);
  });
  it('a record without a subject, a null record, or a non-DID subject is skipped (M2)', async () => {
    const r = await listFollows(PDS, DID, { fetchImpl: fakeFetch([[/listRecords/, [200, j({ records: [{ uri: 'x', cid: 'y', value: { $type: 'app.bsky.graph.follow' } }, { uri: 'no-value', cid: 'z' }, null, rec('k', 'at://not-a-did'), rec('k2', 'did:plc:ok')] })]]]) });
    expect(r).toEqual(['did:plc:ok']);
  });
});
