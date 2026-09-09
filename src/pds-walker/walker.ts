// The walker (plan 2026-09-08 § Phase 5): core + transport + store + clock wired into the
// public surface. Ring 1 (me, my follows) is awaited; the outer rings fill in the background
// as each followee's follows are listed, and `refresh()` is rev-gated — only repos whose rev
// moved are listed again. Two invariants hold throughout: unknown is not empty (a failing
// host marks itself and leaves the last answer standing), and the containment chain holds
// after every event (rings() guarantees it by construction).
import { rings as computeRings, RING_IDS } from './core/rings.js';
import type { Did, RepoSnapshot, RingId, Ring, Logger } from './core/rings.js';
import { decide } from './core/revgate.js';
import { resolvePolicy, due as dueRepos, ring2Targets } from './core/cadence.js';
import type { Policy, PolicyOverrides } from './core/cadence.js';
import type { Store } from './store/memory.js';
import { defaultLogger } from './transport/limiter.js';

/** What the walker needs from the network — three calls, each honest on failure. */
export type Transport = {
  resolve(did: string): Promise<{ readonly pds: string } | { readonly unknown: string }>;
  latestRev(pds: string, did: string): Promise<string | { readonly unknown: string }>;
  listFollows(pds: string, did: string): Promise<readonly Did[] | { readonly unknown: string }>;
};

/** A host the walker has talked to: reachable, or unknown since a moment, with the reason. */
export type HostState = { readonly host: string; readonly state: 'ok' | 'unknown'; readonly since: number; readonly reason?: string };
/** Background-fill progress: followees listed so far, out of how many. */
export type Progress = { readonly done: number; readonly total: number };
export type WalkerEvent = 'ring' | 'host' | 'progress';

export type Walker = {
  /** The current answer for a ring — never throws, never empty by accident. */
  ring(id: RingId): Ring;
  /** Read what the store already knows for `me`, with no network — the warm start. */
  load(me: Did): Promise<void>;
  /** Resolve and list ring 1 (awaited); fill the outer rings in the background. */
  walk(me: Did): Promise<void>;
  /** Rev-gated: ask the rev of due repos, re-list only the movers, walk any new followee. */
  refresh(): Promise<void>;
  /** Resolves when no background work is running. */
  idle(): Promise<void>;
  hosts(): HostState[];
  on(event: WalkerEvent, fn: (e: unknown) => void): () => void;
  /** Cancel background work; what has been learned stays. */
  stop(): void;
};

export type WalkerDeps = {
  readonly transport: Transport;
  readonly store: Store;
  readonly policy?: PolicyOverrides;
  readonly now?: () => number;
  readonly log?: Logger;
};

const hostOf = (pds: string): string => { try { return new URL(pds).host; } catch { return pds; } };
const directoryOf = (did: string): string => (did.startsWith('did:web:') ? did.slice('did:web:'.length).split(':')[0] ?? 'did:web' : 'plc.directory');
const sameRing = (a: Ring, b: Ring): boolean =>
  a.complete === b.complete && a.asOf === b.asOf && a.members.size === b.members.size && [...a.members].every((d) => b.members.has(d));

export function createWalker(deps: WalkerDeps): Walker {
  const { transport, store } = deps;
  const policy: Policy = resolvePolicy(deps.policy);
  const now = deps.now ?? Date.now;
  const log = deps.log ?? defaultLogger();

  const snaps = new Map<Did, RepoSnapshot>();
  const hostStates = new Map<string, HostState>();
  const listeners: Record<WalkerEvent, Set<(e: unknown) => void>> = { ring: new Set(), host: new Set(), progress: new Set() };
  let me: Did | undefined;
  const emptyRings = (): Record<RingId, Ring> =>
    Object.fromEntries(RING_IDS.map((id) => [id, Object.freeze({ id, members: new Set<Did>(), asOf: 0, complete: false })])) as unknown as Record<RingId, Ring>;
  let current: Record<RingId, Ring> = emptyRings();
  let stopped = false;
  let background: Promise<void> = Promise.resolve();

  const emit = (event: WalkerEvent, e: unknown): void => { for (const fn of listeners[event]) fn(e); };

  // Recompute from the in-memory mirror of the store; emit only the rings that changed, in
  // chain order — so for one listing a `hop` event always precedes the `hop2` event.
  const compute = (): void => {
    if (me === undefined) return;
    const next = computeRings({ me, snapshots: snaps });
    for (const id of RING_IDS) {
      const was = current[id]; const is = next[id];
      if (sameRing(was, is)) continue;
      if (was.complete !== is.complete) log.info('pds-walker: ring', id, is.members.size, is.asOf, is.complete);
      emit('ring', is);
    }
    current = next;
  };

  const markUnknown = (host: string, reason: string): void => {
    const was = hostStates.get(host);
    if (was?.state === 'unknown') return; // once per host, not per call
    const state: HostState = { host, state: 'unknown', since: now(), reason };
    hostStates.set(host, state);
    log.warn('pds-walker: host unknown', host, reason);
    emit('host', state);
  };
  const markOk = (host: string): void => {
    const was = hostStates.get(host);
    if (was?.state === 'ok') return;
    const state: HostState = { host, state: 'ok', since: now() };
    hostStates.set(host, state);
    if (was !== undefined) emit('host', state);
  };

  const remember = async (s: RepoSnapshot): Promise<void> => { snaps.set(s.did, s); await store.put(s); };

  type RevCheck = { verdict: 'unknown' } | { verdict: 'keep' | 'relist'; pds: string; rev: string };
  const checkRev = async (did: Did): Promise<RevCheck> => {
    const resolved = await transport.resolve(did);
    if ('unknown' in resolved) { markUnknown(directoryOf(did), resolved.unknown); return { verdict: 'unknown' }; }
    markOk(directoryOf(did));
    const host = hostOf(resolved.pds);
    const latest = await transport.latestRev(resolved.pds, did);
    // A rev we could not read is an unknown host whether or not a snapshot exists: the gate
    // would say "relist" for a repo never listed, but a listing needs the rev it is filed
    // under, so the honest answer is to mark the host and leave the ring incomplete.
    if (typeof latest !== 'string') { markUnknown(host, latest.unknown); return { verdict: 'unknown' }; }
    markOk(host);
    const stored = snaps.get(did);
    const verdict = decide({ snapshot: stored, latestRev: latest });
    if (verdict === 'relist' && stored !== undefined) log.debug('pds-walker: rev moved', did, stored.rev, latest);
    return { verdict, pds: resolved.pds, rev: latest };
  };
  const listRepo = async (did: Did, pds: string, rev: string): Promise<void> => {
    const follows = await transport.listFollows(pds, did);
    if ('unknown' in follows) { markUnknown(hostOf(pds), follows.unknown); return; }
    markOk(hostOf(pds));
    await remember({ did, pds, rev, follows: [...follows], fetchedAt: now() });
  };
  // Check the rev and, if it moved (or the repo is new), list it — the unit of the walk.
  const syncRepo = async (did: Did): Promise<void> => {
    const c = await checkRev(did);
    if (c.verdict === 'relist') await listRepo(did, c.pds, c.rev);
  };

  const parallel = async (items: readonly Did[], n: number, fn: (d: Did) => Promise<void>): Promise<void> => {
    let i = 0;
    const worker = async (): Promise<void> => { while (!stopped && i < items.length) { const d = items[i++] as Did; await fn(d); } };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
  };
  // The background fill: list each followee, recompute after each, report progress.
  const fill = (followees: readonly Did[]): Promise<void> => {
    let done = 0;
    const job = parallel(followees, policy.ring2Parallel, async (f) => {
      await syncRepo(f);
      done++;
      compute();
      emit('progress', { done, total: followees.length });
    }).then(() => { compute(); });
    background = background.then(() => job);
    return job;
  };
  const followeesOf = (): readonly Did[] => (me === undefined ? [] : (snaps.get(me)?.follows ?? []));

  return {
    ring: (id) => current[id],
    async load(who) {
      me = who; stopped = false;
      for (const s of await store.all()) snaps.set(s.did, s);
      compute();
    },
    async walk(who) {
      await this.load(who);
      log.debug('pds-walker: walk', who);
      await syncRepo(who);
      compute();
      void fill(followeesOf());
    },
    async refresh() {
      if (me === undefined) return;
      stopped = false;
      const mine = snaps.get(me);
      // A `me` with no snapshot yet (its directory or host was unknown at walk time) is always
      // due: refresh is how a transient failure at the root gets retried.
      const dueMe: Did[] = mine === undefined ? [me] : dueRepos({ snapshots: [mine], now: now(), policy, ring: 'me' });
      const known = followeesOf().map((f) => snaps.get(f)).filter((s): s is RepoSnapshot => s !== undefined);
      const dueFollowees = dueRepos({ snapshots: known, now: now(), policy, ring: 'fol' });
      const dueList: Did[] = [...dueMe, ...dueFollowees];
      const moved: Did[] = []; let kept = 0, unknown = 0;
      const checks = new Map<Did, RevCheck>();
      await parallel(dueList, policy.ring2Parallel, async (d) => {
        const c = await checkRev(d);
        checks.set(d, c);
        if (c.verdict === 'relist') moved.push(d); else if (c.verdict === 'keep') kept++; else unknown++;
      });
      const before = new Set(followeesOf());
      await parallel(ring2Targets({ moved }), policy.ring2Parallel, async (d) => {
        const c = checks.get(d);
        if (c?.verdict === 'relist') await listRepo(d, c.pds, c.rev);
      });
      compute();
      log.info('pds-walker: refresh', { due: dueList.length, moved: moved.length, kept, unknown });
      void fill(followeesOf().filter((f) => !before.has(f)));
    },
    idle: () => background,
    hosts: () => [...hostStates.values()],
    on(event, fn) { listeners[event].add(fn); return () => { listeners[event].delete(fn); }; },
    stop() { stopped = true; log.info('pds-walker: stopped'); },
  };
}
