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
