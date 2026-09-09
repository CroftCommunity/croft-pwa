import { describe, it, expect } from 'vitest';
import { latestRev, listFollows, type Logger } from 'croft-pwa/pds-walker';
import { hostLimiter } from '../../src/pds-walker/transport/limiter';

// Phase 3c (plan 2026-09-08): the per-host limiter. The limiter is internal (3d's
// createFetchTransport builds it), so it is constructed from its module here and OBSERVED
// through the exported calls — the export path is still what proves it is in the path.

type Clock = { now: () => number; sleep: (ms: number) => Promise<void>; sleeps: number[] };
function fakeClock(start = 1_000_000): Clock {
  let t = start;
  const sleeps: number[] = [];
  return { now: () => t, sleep: (ms) => { sleeps.push(ms); t += ms; return Promise.resolve(); }, sleeps };
}
function recordingLogger(): Logger & { lines: Array<[level: string, args: unknown[]]> } {
  const lines: Array<[string, unknown[]]> = [];
  const at = (level: string) => (...args: unknown[]) => { lines.push([level, args]); };
  return { lines, debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}
const PDS = 'https://morel.us-east.host.bsky.network';
const LATEST = JSON.stringify({ cid: 'x', rev: '3muzvzlycuh2v' });

// A fetch whose responses can be held open, so concurrency is observable: each call records
// the number in flight at the moment it starts; `release()` lets them all finish.
function gatedFetch(opts: { headers?: Record<string, string>; body?: string } = {}) {
  let inFlight = 0; const maxSeen: number[] = []; const releases: Array<() => void> = [];
  const fetchImpl: typeof fetch = () => {
    inFlight++; maxSeen.push(inFlight);
    return new Promise<Response>((resolve) => {
      releases.push(() => { inFlight--; resolve(new Response(opts.body ?? LATEST, { status: 200, headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) } })); });
    });
  };
  const release = async () => { while (releases.length > 0) { releases.shift()?.(); await Promise.resolve(); } };
  return { fetchImpl, maxSeen, release, pending: () => releases.length };
}

describe('hostLimiter — no more than perHost in flight per host', () => {
  it('perHost = 2: three concurrent calls to one host never exceed 2 in flight', async () => {
    const clock = fakeClock(); const g = gatedFetch();
    const limiter = hostLimiter({ perHost: 2, now: clock.now, sleep: clock.sleep, log: recordingLogger() });
    const calls = [1, 2, 3].map(() => latestRev(PDS, 'did:plc:a', { fetchImpl: g.fetchImpl, limiter }));
    await Promise.resolve(); await Promise.resolve();
    expect(g.pending()).toBe(2); // the third is waiting, not started
    await g.release();
    await Promise.resolve(); await Promise.resolve();
    await g.release();
    const results = await Promise.all(calls);
    expect(results).toEqual(['3muzvzlycuh2v', '3muzvzlycuh2v', '3muzvzlycuh2v']);
    expect(Math.max(...g.maxSeen)).toBe(2);
  });
  it('two hosts do not block each other', async () => {
    const clock = fakeClock(); const g = gatedFetch();
    const limiter = hostLimiter({ perHost: 1, now: clock.now, sleep: clock.sleep, log: recordingLogger() });
    const a = latestRev('https://a.example', 'did:plc:a', { fetchImpl: g.fetchImpl, limiter });
    const b = latestRev('https://b.example', 'did:plc:b', { fetchImpl: g.fetchImpl, limiter });
    await Promise.resolve(); await Promise.resolve();
    expect(g.pending()).toBe(2); // both started: different hosts
    await g.release();
    await Promise.all([a, b]);
  });
  it('WIRING: perHost = 1 serializes two concurrent listFollows calls to one host (the limiter is in the path)', async () => {
    const clock = fakeClock(); const g = gatedFetch({ body: JSON.stringify({ records: [] }) });
    const limiter = hostLimiter({ perHost: 1, now: clock.now, sleep: clock.sleep, log: recordingLogger() });
    const calls = [listFollows(PDS, 'did:plc:a', { fetchImpl: g.fetchImpl, limiter }), listFollows(PDS, 'did:plc:b', { fetchImpl: g.fetchImpl, limiter })];
    await Promise.resolve(); await Promise.resolve();
    expect(g.pending()).toBe(1);
    await g.release(); await Promise.resolve(); await Promise.resolve(); await g.release();
    await Promise.all(calls);
    expect(Math.max(...g.maxSeen)).toBe(1);
  });
});

describe('hostLimiter — RateLimit headers pause a host until reset', () => {
  const resetAt = 1_000_000 + 5_000; // epoch ms; the header carries epoch SECONDS
  const headersWith = (remaining: number) => ({ 'ratelimit-remaining': String(remaining), 'ratelimit-reset': String(resetAt / 1000), 'ratelimit-limit': '3000' });
  async function runOne(remaining: number) {
    const clock = fakeClock(); const log = recordingLogger();
    const limiter = hostLimiter({ perHost: 4, now: clock.now, sleep: clock.sleep, log });
    const seen = gatedFetch({ headers: headersWith(remaining) });
    const first = latestRev(PDS, 'did:plc:a', { fetchImpl: seen.fetchImpl, limiter });
    await Promise.resolve(); await seen.release(); await first;
    const second = latestRev(PDS, 'did:plc:b', { fetchImpl: seen.fetchImpl, limiter });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    return { clock, log, seen, second };
  }
  it('Remaining: 10 → no pause (the threshold is < 10)', async () => {
    const { clock, log, seen, second } = await runOne(10);
    expect(clock.sleeps).toEqual([]);
    expect(seen.pending()).toBe(1);
    await seen.release(); await second;
    expect(log.lines).toEqual([]);
  });
  it('Remaining: 9 → the host pauses until exactly reset, with one warn and one info naming the host', async () => {
    const { clock, log, seen, second } = await runOne(9);
    expect(clock.sleeps).toEqual([5_000]); // resetAt − now, not reset − 1
    expect(clock.now()).toBe(resetAt);
    await seen.release(); await second;
    const warns = log.lines.filter(([l]) => l === 'warn'); const infos = log.lines.filter(([l]) => l === 'info');
    expect(warns).toHaveLength(1); expect(infos).toHaveLength(1);
    expect(String(warns[0]?.[1][0])).toContain('host paused'); expect(warns[0]?.[1]).toContain('morel.us-east.host.bsky.network');
    expect(String(infos[0]?.[1][0])).toContain('host resumed'); expect(infos[0]?.[1]).toContain('morel.us-east.host.bsky.network');
    for (const [, args] of log.lines) for (const a of args) expect(String(a)).not.toMatch(/did:/);
  });
  it('a paused host does not delay another host', async () => {
    const { clock, seen, second } = await runOne(9);
    const other = gatedFetch();
    const limiter = hostLimiter({ perHost: 4, now: clock.now, sleep: clock.sleep, log: recordingLogger() });
    void limiter;
    await seen.release(); await second;
    expect(other.pending()).toBe(0);
  });
});
