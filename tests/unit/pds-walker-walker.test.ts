import { describe, it, expect } from 'vitest';
import { createWalker, memoryStore, RING_IDS, type Did, type Logger, type Ring, type RingId, type Transport, type HostState } from 'croft-pwa/pds-walker';

// Phase 5 (plan 2026-09-08): the walker — core + transport + store + clock wired into the
// public surface. Through the export path (1c's rule). A scripted fake transport, the memory
// store, a fake clock and a recording logger make every case deterministic.

type Node = { pds: string; rev: string; follows: Did[] };
type Graph = Record<string, Node>;
type Fake = Transport & { calls: string[]; failHosts: Set<string>; failList: Set<string>; graph: Graph; maxInFlight: number; hold: boolean; release: () => void };
function fakeTransport(graph: Graph): Fake {
  const calls: string[] = []; const failHosts = new Set<string>(); const failList = new Set<string>();
  const hostOf = (pds: string) => { try { return new URL(pds).host; } catch { return pds; } };
  let inFlight = 0; const waiters: Array<() => void> = [];
  const fake: Fake = {
    graph, calls, failHosts, failList, maxInFlight: 0, hold: false, release: () => { while (waiters.length > 0) waiters.shift()?.(); },
    resolve: (did) => { calls.push(`resolve ${did}`); const n = graph[did]; return Promise.resolve(n ? { pds: n.pds } : { unknown: 'DID resolution failed: 404' }); },
    latestRev: (pds, did) => { calls.push(`rev ${did}`); if (failHosts.has(hostOf(pds))) return Promise.resolve({ unknown: `getLatestCommit ${hostOf(pds)}: 502` }); return Promise.resolve(graph[did]?.rev ?? { unknown: 'no such repo' }); },
    listFollows: async (pds, did) => {
      calls.push(`list ${did}`);
      if (failHosts.has(hostOf(pds)) || failList.has(hostOf(pds))) return { unknown: `listRecords ${hostOf(pds)}: 502 at page 1` };
      inFlight++; fake.maxInFlight = Math.max(fake.maxInFlight, inFlight);
      if (fake.hold && did !== ME) await new Promise<void>((resolve) => waiters.push(resolve));
      inFlight--;
      return graph[did]?.follows ?? { unknown: 'no such repo' };
    },
  };
  return fake;
}
function recordingLogger(): Logger & { lines: Array<[string, unknown[]]> } {
  const lines: Array<[string, unknown[]]> = [];
  const at = (level: string) => (...args: unknown[]) => { lines.push([level, args]); };
  return { lines, debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}
const ME: Did = 'did:plc:me';
const A = 'https://a.example', B = 'https://b.example', C = 'https://c.example';
// me follows M (mutual, on A), F (not mutual, on B), N (on C). M follows me + Y; F follows X; N follows nobody.
const graph = (): Graph => ({
  [ME]: { pds: A, rev: 'r-me-1', follows: ['did:plc:m', 'did:plc:f', 'did:plc:n'] },
  'did:plc:m': { pds: A, rev: 'r-m-1', follows: [ME, 'did:plc:y'] },
  'did:plc:f': { pds: B, rev: 'r-f-1', follows: ['did:plc:x'] },
  'did:plc:n': { pds: C, rev: 'r-n-1', follows: [] },
});
const chainHolds = (rings: (id: RingId) => Ring) => {
  for (let i = 1; i < RING_IDS.length; i++) for (const d of rings(RING_IDS[i - 1] as RingId).members) expect(rings(RING_IDS[i] as RingId).members.has(d), `${RING_IDS[i - 1]} ⊄ ${RING_IDS[i]}`).toBe(true);
};

describe('createWalker() — walk', () => {
  it('walks a three-node graph: me/fol at once, mut/hop/hop2 as the followees are listed; containment after every event', async () => {
    const t = fakeTransport(graph()); const log = recordingLogger(); let now = 1000;
    const w = createWalker({ transport: t, store: memoryStore(), log, now: () => now, policy: { ring2Parallel: 1 } }); // sequential, so the sequence is exact
    const events: string[] = [];
    w.on('ring', (e) => { const r = e as Ring; events.push(`${r.id}:${r.members.size}:${r.complete ? 'c' : 'i'}`); chainHolds((id) => w.ring(id)); });
    await w.walk(ME);
    expect(w.ring('me').members).toEqual(new Set([ME]));
    expect(w.ring('fol').members).toEqual(new Set([ME, 'did:plc:m', 'did:plc:f', 'did:plc:n']));
    expect(w.ring('fol').complete).toBe(true);
    await w.idle();
    expect(w.ring('mut').members).toEqual(new Set([ME, 'did:plc:m']));
    expect(w.ring('hop').members).toEqual(new Set([ME, 'did:plc:m', 'did:plc:f', 'did:plc:n', 'did:plc:y']));
    expect(w.ring('hop2').members).toEqual(new Set([ME, 'did:plc:m', 'did:plc:f', 'did:plc:n', 'did:plc:y', 'did:plc:x']));
    expect(w.ring('hop2').complete).toBe(true);
    expect(w.ring('hop2').asOf).toBe(1000);
    now = 2000; // the clock moved; asOf is the oldest source, unchanged
    expect(w.ring('hop2').asOf).toBe(1000);
    // (x) for one listing, the hop event arrives before the hop2 event
    const hopIdx = events.findIndex((e) => e.startsWith('hop:5')); const hop2Idx = events.findIndex((e) => e.startsWith('hop2:6'));
    expect(hopIdx).toBeGreaterThanOrEqual(0); expect(hop2Idx).toBeGreaterThan(hopIdx);
    expect(w.hosts().filter((h) => h.state === 'unknown')).toEqual([]);
    // (M3) the exact sequence: me/fol complete at once; mut/hop/hop2 grow per listing and
    // flip complete together at the end; nothing is emitted twice for an unchanged ring.
    expect(events).toEqual([
      'me:1:i', 'mut:1:i', 'fol:1:i', 'hop:1:i', 'hop2:1:i',            // load(): an empty store, every ring {me}, incomplete
      'me:1:c', 'mut:1:i', 'fol:4:c', 'hop:4:i', 'hop2:4:i',            // me listed: me/fol complete; mut's asOf moved (same members)
      'mut:2:i', 'hop:5:i', 'hop2:5:i',                                 // M listed: a mutual, and Y
      'hop2:6:i',                                                       // F listed: X joins hop2 only
      'mut:2:c', 'hop:5:c', 'hop2:6:c',                                 // N listed: every source known
    ]);
    expect(log.lines.filter(([l, a]) => l === 'info' && a[0] === 'pds-walker: ring')).toHaveLength(5); // one per complete flip: me, fol, mut, hop, hop2
    expect(log.lines.filter(([l, a]) => l === 'debug' && a[0] === 'pds-walker: rev moved')).toHaveLength(0); // a first walk moves nothing
  });
  it('(M3) before any walk every ring is empty and incomplete; refresh before a walk does nothing', async () => {
    const t = fakeTransport(graph()); const log = recordingLogger();
    const w = createWalker({ transport: t, store: memoryStore(), log });
    for (const id of RING_IDS) { expect(w.ring(id).members.size).toBe(0); expect(w.ring(id).complete).toBe(false); expect(w.ring(id).asOf).toBe(0); expect(w.ring(id).id).toBe(id); }
    await w.refresh();
    expect(t.calls).toEqual([]); expect(log.lines).toEqual([]);
  });
  it('(M3) on() returns an unsubscribe; the exact warn and stopped lines; a clean walk emits no host event', async () => {
    const t = fakeTransport(graph()); const log = recordingLogger();
    const w = createWalker({ transport: t, store: memoryStore(), log });
    let n = 0; const off = w.on('progress', () => { n++; }); const hostEvents: unknown[] = []; w.on('host', (e) => hostEvents.push(e));
    await w.walk(ME); await w.idle();
    expect(n).toBe(3); off();
    await w.refresh(); await w.idle();
    expect(n).toBe(3);
    expect(hostEvents).toEqual([]);
    w.stop();
    expect(log.lines.at(-1)).toEqual(['info', ['pds-walker: stopped']]);
    t.failHosts.add('c.example');
    const w2 = createWalker({ transport: t, store: memoryStore(), log: recordingLogger() });
    const log2 = recordingLogger(); const w3 = createWalker({ transport: t, store: memoryStore(), log: log2 }); void w2;
    await w3.walk(ME); await w3.idle();
    expect(log2.lines.filter(([l]) => l === 'warn')).toEqual([['warn', ['pds-walker: host unknown', 'c.example', 'getLatestCommit c.example: 502']]]);
  });
  it('(M3) a listing that fails after its rev was read marks the host and leaves the ring incomplete', async () => {
    const t = fakeTransport(graph()); t.failList.add('b.example'); const log = recordingLogger();
    const w = createWalker({ transport: t, store: memoryStore(), log });
    await w.walk(ME); await w.idle();
    expect(w.hosts().find((h) => h.host === 'b.example')?.state).toBe('unknown');
    expect(w.hosts().find((h) => h.host === 'b.example')?.reason).toBe('listRecords b.example: 502 at page 1');
    expect(w.ring('hop2').complete).toBe(false);
    expect(w.ring('hop2').members.has('did:plc:x')).toBe(false);
    expect(log.lines.filter(([l]) => l === 'warn')).toHaveLength(1);
  });
  it('(M3) ring2Parallel bounds the listings actually in flight: 2 → at most 2, 1 → at most 1', async () => {
    for (const [n, expected] of [[2, 2], [1, 1]] as const) {
      const t = fakeTransport(graph()); t.hold = true;
      const w = createWalker({ transport: t, store: memoryStore(), log: recordingLogger(), policy: { ring2Parallel: n } });
      await w.walk(ME);
      for (let i = 0; i < 20; i++) await Promise.resolve(); // the followee listings reach their hold
      t.hold = false;
      for (let i = 0; i < 40; i++) { t.release(); await Promise.resolve(); }
      await w.idle();
      expect(t.maxInFlight, `ring2Parallel ${n}`).toBe(expected);
      expect(w.ring('hop2').complete).toBe(true);
    }
  });
  it('(M3) an unresolvable did:web names its own host as the unknown directory; a non-URL pds is named as given', async () => {
    const t = fakeTransport({}); const w = createWalker({ transport: t, store: memoryStore(), log: recordingLogger() });
    await w.walk('did:web:example.org'); await w.idle();
    expect(w.hosts()).toEqual([expect.objectContaining({ host: 'example.org', state: 'unknown', reason: 'DID resolution failed: 404' })]);
    const g: Graph = { [ME]: { pds: 'nonsense', rev: 'r', follows: [] } };
    const t2 = fakeTransport(g); t2.failHosts.add('nonsense');
    const w2 = createWalker({ transport: t2, store: memoryStore(), log: recordingLogger() });
    await w2.walk(ME); await w2.idle();
    expect(w2.hosts().map((h) => `${h.host}:${h.state}`)).toEqual(['plc.directory:ok', 'nonsense:unknown']);
  });
  it('(vi) progress counts up to exactly the followee count', async () => {
    const t = fakeTransport(graph()); const w = createWalker({ transport: t, store: memoryStore(), log: recordingLogger() });
    const progress: Array<{ done: number; total: number }> = [];
    w.on('progress', (e) => progress.push(e as { done: number; total: number }));
    await w.walk(ME); await w.idle();
    expect(progress.at(-1)).toEqual({ done: 3, total: 3 });
    expect(progress.map((p) => p.done)).toEqual([1, 2, 3]);
  });
  it('(vii) a failing host produces exactly one warn naming the host, however many followees live on it; (i) the rings keep what is known', async () => {
    const g = graph(); g['did:plc:n'] = { pds: B, rev: 'r-n-1', follows: [] }; // two followees on B now
    const t = fakeTransport(g); t.failHosts.add('b.example'); const log = recordingLogger();
    const w = createWalker({ transport: t, store: memoryStore(), log });
    const hostEvents: HostState[] = []; w.on('host', (e) => hostEvents.push(e as HostState));
    await w.walk(ME); await w.idle();
    const warns = log.lines.filter(([l]) => l === 'warn');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.[1]).toContain('b.example');
    const unknownHosts = w.hosts().filter((h) => h.state === 'unknown');
    expect(unknownHosts.map((h) => h.host)).toEqual(['b.example']); // the reached hosts are listed as ok beside it
    expect(w.hosts().filter((h) => h.state === 'ok').map((h) => h.host).sort()).toEqual(['a.example', 'plc.directory']);
    expect(hostEvents.map((h) => h.host)).toEqual(['b.example']);
    expect(w.ring('fol').members.has('did:plc:f')).toBe(true); // still a followee
    expect(w.ring('hop2').complete).toBe(false);
    expect(w.ring('hop2').members.has('did:plc:y')).toBe(true); // what the working host gave
  });
  it('(viii) no info or warn argument carries a DID; (ix) debug carries the walked DID', async () => {
    const t = fakeTransport(graph()); const log = recordingLogger();
    const w = createWalker({ transport: t, store: memoryStore(), log });
    await w.walk(ME); await w.idle(); await w.refresh();
    for (const [level, args] of log.lines) if (level === 'info' || level === 'warn') for (const a of args) expect(JSON.stringify(a)).not.toMatch(/did:/);
    expect(log.lines.some(([l, a]) => l === 'debug' && a[0] === 'pds-walker: walk' && a[1] === ME)).toBe(true);
    expect(log.lines.some(([l, a]) => l === 'info' && a[0] === 'pds-walker: ring')).toBe(true);
  });
  it('(v) stop() halts the background fill: hop2 stays incomplete at what k listings gave', async () => {
    const t = fakeTransport(graph()); const w = createWalker({ transport: t, store: memoryStore(), log: recordingLogger(), policy: { ring2Parallel: 1 } });
    let listed = 0;
    w.on('progress', () => { listed++; if (listed === 1) w.stop(); });
    await w.walk(ME); await w.idle();
    expect(listed).toBe(1);
    expect(w.ring('hop2').complete).toBe(false);
    expect(w.ring('hop2').members.size).toBeGreaterThanOrEqual(4);
    expect(t.calls.filter((c) => c.startsWith('list ')).length).toBe(2); // me + one followee
  });
  it('an unresolvable me leaves every ring at {me}, incomplete, with the directory marked unknown', async () => {
    const t = fakeTransport({}); const log = recordingLogger();
    const w = createWalker({ transport: t, store: memoryStore(), log });
    await w.walk('did:plc:ghost'); await w.idle();
    for (const id of RING_IDS) { expect([...w.ring(id).members]).toEqual(['did:plc:ghost']); expect(w.ring(id).complete).toBe(false); }
    expect(w.hosts()[0]?.state).toBe('unknown');
    expect(t.calls).toEqual(['resolve did:plc:ghost']);
    await w.refresh();
    expect(t.calls).toEqual(['resolve did:plc:ghost', 'resolve did:plc:ghost']);
  });
});

describe('createWalker() — refresh', () => {
  it('(ii) refresh asks the rev of due repos and re-lists only the movers; (ix) debug records the moved rev; counts at info', async () => {
    const t = fakeTransport(graph()); const log = recordingLogger(); let now = 1000;
    const w = createWalker({ transport: t, store: memoryStore(), log, now: () => now, policy: { refreshMs: { me: 100, mut: 100, fol: 100, hop: 100, hop2: 100 } } });
    await w.walk(ME); await w.idle();
    t.calls.length = 0;
    now = 1050; // nothing due yet
    await w.refresh();
    expect(t.calls).toEqual([]);
    now = 1200; // all due; F moved (new follow Z)
    t.graph['did:plc:f'] = { pds: B, rev: 'r-f-2', follows: ['did:plc:x', 'did:plc:z'] };
    await w.refresh();
    expect(t.calls.filter((c) => c.startsWith('rev ')).sort()).toEqual(['rev did:plc:f', 'rev did:plc:m', 'rev did:plc:me', 'rev did:plc:n']);
    expect(t.calls.filter((c) => c.startsWith('list '))).toEqual(['list did:plc:f']);
    expect(w.ring('hop2').members.has('did:plc:z')).toBe(true);
    expect(log.lines.some(([l, a]) => l === 'debug' && a[0] === 'pds-walker: rev moved' && a[1] === 'did:plc:f' && a[2] === 'r-f-1' && a[3] === 'r-f-2')).toBe(true);
    const refreshInfo = log.lines.find(([l, a]) => l === 'info' && a[0] === 'pds-walker: refresh' && (a[1] as { due: number }).due === 4);
    expect(refreshInfo?.[1][1]).toEqual({ due: 4, moved: 1, kept: 3, unknown: 0 });
  });
  it('(i) a host failing on refresh leaves the ring as it was and marks the host; a later success clears it', async () => {
    let now = 10_000_000;
    const t = fakeTransport(graph()); const w = createWalker({ transport: t, store: memoryStore(), log: recordingLogger(), now: () => now, policy: { refreshMs: { me: 1, mut: 1, fol: 1, hop: 1, hop2: 1 } } });
    await w.walk(ME); await w.idle();
    const before = w.ring('hop2').members;
    const hostEvents: HostState[] = []; w.on('host', (e) => hostEvents.push(e as HostState));
    t.failHosts.add('b.example'); now += 10;
    await w.refresh();
    expect(w.ring('hop2').members).toEqual(before);
    expect(w.hosts().find((h) => h.host === 'b.example')?.state).toBe('unknown');
    t.failHosts.delete('b.example'); now += 10;
    await w.refresh();
    expect(w.hosts().find((h) => h.host === 'b.example')?.state).toBe('ok');
    expect(hostEvents.map((h) => `${h.host}:${h.state}`)).toEqual(['b.example:unknown', 'b.example:ok']);
  });
  it('(M3) refresh counts: a followee whose host fails is unknown; a followee never listed is not due and does not crash', async () => {
    let now = 10_000_000; const log = recordingLogger();
    const t = fakeTransport(graph()); t.failHosts.add('b.example');
    const w = createWalker({ transport: t, store: memoryStore(), log, now: () => now, policy: { refreshMs: { me: 1, mut: 1, fol: 1, hop: 1, hop2: 1 } } });
    await w.walk(ME); await w.idle(); // F never listed (its host failed)
    now += 10;
    await w.refresh();
    const info = log.lines.filter(([l, a]) => l === 'info' && a[0] === 'pds-walker: refresh').at(-1);
    expect(info?.[1][1]).toEqual({ due: 3, moved: 0, kept: 3, unknown: 0 }); // me, M, N are due; F has no snapshot to be due from
    t.failHosts.delete('b.example'); t.failHosts.add('c.example'); now += 10;
    await w.refresh();
    const info2 = log.lines.filter(([l, a]) => l === 'info' && a[0] === 'pds-walker: refresh').at(-1);
    expect(info2?.[1][1]).toEqual({ due: 3, moved: 0, kept: 2, unknown: 1 });
  });
  it('when me moved and gained a followee, the new followee is listed too (its subtree is walked)', async () => {
    let now = 10_000_000;
    const t = fakeTransport(graph()); const w = createWalker({ transport: t, store: memoryStore(), log: recordingLogger(), now: () => now, policy: { refreshMs: { me: 1, mut: 1, fol: 1, hop: 1, hop2: 1 } } });
    await w.walk(ME); await w.idle();
    now += 10;
    t.graph[ME] = { pds: A, rev: 'r-me-2', follows: ['did:plc:m', 'did:plc:f', 'did:plc:n', 'did:plc:new'] };
    t.graph['did:plc:new'] = { pds: C, rev: 'r-new-1', follows: ['did:plc:q'] };
    await w.refresh(); await w.idle();
    expect(w.ring('fol').members.has('did:plc:new')).toBe(true);
    expect(w.ring('hop2').members.has('did:plc:q')).toBe(true);
  });
  it('a new walker over a warm store answers from the store before any network call', async () => {
    const store = memoryStore(); const t = fakeTransport(graph());
    const w1 = createWalker({ transport: t, store, log: recordingLogger() });
    await w1.walk(ME); await w1.idle();
    const t2 = fakeTransport(graph());
    const w2 = createWalker({ transport: t2, store, log: recordingLogger() });
    await w2.load(ME);
    expect(t2.calls).toEqual([]);
    expect(w2.ring('hop2').members).toEqual(w1.ring('hop2').members);
  });
});
