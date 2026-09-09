import { describe, it, expect } from 'vitest';
import { createFetchTransport, type Logger, type Transport } from 'croft-pwa/pds-walker';

// Phase 3d (plan 2026-09-08): `createFetchTransport` is the entry point consumers get, so one
// chain case per 3a–3c behaviour runs through it — the group's Isolation-Trap defence.
const PDS = 'https://puffball.us-east.host.bsky.network';
const DID = 'did:plc:z72i7hdynmk6r22z27h6tvur';
const DOC = { id: DID, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] };
const j = JSON.stringify;
const rec = (subject: string) => ({ uri: 'x', cid: 'y', value: { $type: 'app.bsky.graph.follow', subject } });

type Route = [status: number, body: string, headers?: Record<string, string>];
function fakeFetch(routes: Array<[RegExp | string, Route]>): typeof fetch {
  return (input) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    for (const [pattern, [status, body, headers]] of routes) {
      if (typeof pattern === 'string' ? href.includes(pattern) : pattern.test(href)) return Promise.resolve(new Response(body, { status, headers: { 'content-type': 'application/json', ...(headers ?? {}) } }));
    }
    return Promise.resolve(new Response('not found', { status: 404 }));
  };
}
function recordingLogger(): Logger & { lines: Array<[string, unknown[]]> } {
  const lines: Array<[string, unknown[]]> = [];
  const at = (level: string) => (...args: unknown[]) => { lines.push([level, args]); };
  return { lines, debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}

describe('createFetchTransport() — the transport a consumer gets', () => {
  it('resolve: a DID to its PDS, or unknown on a 404', async () => {
    const t: Transport = createFetchTransport({ fetchImpl: fakeFetch([['plc.directory/' + DID, [200, j(DOC)]]]) });
    expect(await t.resolve(DID)).toEqual({ pds: PDS });
    expect(await t.resolve('did:plc:nobody')).toEqual({ unknown: 'DID resolution failed: 404' });
  });
  it('latestRev and a two-page listFollows through the same transport', async () => {
    const t = createFetchTransport({ fetchImpl: fakeFetch([
      ['getLatestCommit', [200, j({ cid: 'c', rev: '3muzvzlycuh2v' })]],
      [/listRecords\?(?!.*cursor=)/, [200, j({ records: [rec('did:plc:a')], cursor: 'c1' })]],
      [/cursor=c1/, [200, j({ records: [rec('did:plc:b')] })]],
    ]) });
    expect(await t.latestRev(PDS, DID)).toBe('3muzvzlycuh2v');
    expect(await t.listFollows(PDS, DID)).toEqual(['did:plc:a', 'did:plc:b']);
  });
  it('a 502 mid-listing → unknown, never a partial list', async () => {
    const t = createFetchTransport({ fetchImpl: fakeFetch([
      [/listRecords\?(?!.*cursor=)/, [200, j({ records: [rec('did:plc:a')], cursor: 'c1' })]],
      [/cursor=c1/, [502, '']],
    ]) });
    const r = await t.listFollows(PDS, DID);
    expect('unknown' in r).toBe(true);
  });
  it('perHost: 1 serializes two calls to one host (the limiter is built in)', async () => {
    let inFlight = 0; let max = 0; const releases: Array<() => void> = [];
    const fetchImpl: typeof fetch = () => { inFlight++; max = Math.max(max, inFlight); return new Promise((resolve) => releases.push(() => { inFlight--; resolve(new Response(j({ rev: 'r' }), { status: 200, headers: { 'content-type': 'application/json' } })); })); };
    const t = createFetchTransport({ fetchImpl, perHost: 1 });
    const calls = [t.latestRev(PDS, 'did:plc:a'), t.latestRev(PDS, 'did:plc:b')];
    for (let i = 0; i < 6; i++) await Promise.resolve();
    expect(releases).toHaveLength(1);
    while (releases.length > 0) { releases.shift()?.(); for (let i = 0; i < 6; i++) await Promise.resolve(); }
    await Promise.all(calls);
    expect(max).toBe(1);
  });
  it('a low RateLimit-Remaining pauses the host, and the injected logger sees the warn (no DID in it)', async () => {
    const log = recordingLogger(); const sleeps: number[] = []; let now = 1_000_000;
    const t = createFetchTransport({
      fetchImpl: fakeFetch([['getLatestCommit', [200, j({ rev: 'r' }), { 'ratelimit-remaining': '2', 'ratelimit-reset': String((now + 4_000) / 1000) }]]]),
      log, now: () => now, sleep: (ms) => { sleeps.push(ms); now += ms; return Promise.resolve(); },
    });
    await t.latestRev(PDS, 'did:plc:a');
    await t.latestRev(PDS, 'did:plc:b');
    expect(sleeps).toEqual([4_000]);
    const warn = log.lines.find(([l]) => l === 'warn');
    expect(String(warn?.[1][0])).toContain('host paused');
    for (const [, args] of log.lines) for (const a of args) expect(String(a)).not.toMatch(/did:/);
  });
});
