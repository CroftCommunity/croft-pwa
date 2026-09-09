/** pds-walker — the rev-gated ring walker. The library's own version clock (plan 2026-09-08, D3). */
export const VERSION = '0.1.0';

export { rings, RING_IDS } from './core/rings';
export type { Did, Rev, RepoSnapshot, RingId, Ring, Logger } from './core/rings';
export { decide } from './core/revgate';
export type { LatestRev, Verdict } from './core/revgate';
export { defaultPolicy, resolvePolicy, due, ring2Targets } from './core/cadence';
export type { Policy, PolicyOverrides } from './core/cadence';
export { resolveDid } from './transport/resolve';
export type { ResolveDeps, Resolved } from './transport/resolve';
export { latestRev, listFollows } from './transport/pds';
export type { PdsDeps, Unknown } from './transport/pds';

import { resolveDid as _resolveDid } from './transport/resolve';
import { latestRev as _latestRev, listFollows as _listFollows } from './transport/pds';
import { hostLimiter, defaultLogger } from './transport/limiter';
import type { Did, Rev, Logger } from './core/rings';

/** What the walker needs from the network — three calls, each honest on failure. */
export type Transport = {
  resolve(did: string): Promise<{ readonly pds: string } | { readonly unknown: string }>;
  latestRev(pds: string, did: string): Promise<Rev | { readonly unknown: string }>;
  listFollows(pds: string, did: string): Promise<readonly Did[] | { readonly unknown: string }>;
};

/** Options for the fetch-backed transport. `log` defaults to the library's console posture; a page passes its own. */
export type FetchTransportOptions = {
  readonly fetchImpl?: typeof fetch;
  readonly perHost?: number;
  readonly log?: Logger;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
};

/** The transport a consumer gets: identity resolution, the two PDS calls, and the per-host limiter, composed. */
export function createFetchTransport(opts: FetchTransportOptions = {}): Transport {
  const log = opts.log ?? defaultLogger();
  const limiter = hostLimiter({
    ...(opts.perHost === undefined ? {} : { perHost: opts.perHost }),
    ...(opts.now === undefined ? {} : { now: opts.now }),
    ...(opts.sleep === undefined ? {} : { sleep: opts.sleep }),
    log,
  });
  const deps = { ...(opts.fetchImpl === undefined ? {} : { fetchImpl: opts.fetchImpl }), limiter };
  return {
    resolve: (did) => _resolveDid(did, opts.fetchImpl === undefined ? {} : { fetchImpl: opts.fetchImpl }),
    latestRev: (pds, did) => _latestRev(pds, did, deps),
    listFollows: (pds, did) => _listFollows(pds, did, deps),
  };
}
