// Cadence (plan 2026-09-08 § Phase 2c, research § 4): how often each ring is refreshed and
// which repos are due now. Pure — the clock is a parameter.
import type { Did, RepoSnapshot, RingId } from './rings.js';

/** Refresh intervals per ring, the per-host in-flight cap, and ring-2 fan-out. */
export type Policy = {
  readonly refreshMs: Readonly<Record<RingId, number>>;
  /** The PDS rate limit is per host (3,000 / 5 min per IP), so the cap is per host too. */
  readonly perHostConcurrency: number;
  /** How many followees' listings run at once while the outer rings fill in the background. */
  readonly ring2Parallel: number;
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Research § 4: me every minute, ring 1 every 10 minutes, the outer rings daily (hop2 on hop's clock — OQ6 c). */
export const defaultPolicy: Policy = Object.freeze({
  refreshMs: Object.freeze({ me: MINUTE, mut: 10 * MINUTE, fol: 10 * MINUTE, hop: DAY, hop2: DAY }),
  perHostConcurrency: 4,
  ring2Parallel: 10,
});

/** Partial overrides for `createWalker({ policy })`; `refreshMs` merges per key. */
export type PolicyOverrides = {
  readonly refreshMs?: Partial<Record<RingId, number>>;
  readonly perHostConcurrency?: number;
  readonly ring2Parallel?: number;
};

/** Merge overrides onto the defaults, key by key inside `refreshMs` (a shallow merge would drop the other rings). */
export function resolvePolicy(overrides: PolicyOverrides | undefined): Policy {
  if (overrides === undefined) return defaultPolicy;
  return Object.freeze({
    refreshMs: Object.freeze({ ...defaultPolicy.refreshMs, ...(overrides.refreshMs ?? {}) }),
    perHostConcurrency: overrides.perHostConcurrency ?? defaultPolicy.perHostConcurrency,
    ring2Parallel: overrides.ring2Parallel ?? defaultPolicy.ring2Parallel,
  });
}

type SnapshotInput = ReadonlyMap<Did, RepoSnapshot> | readonly RepoSnapshot[];

/** The repos whose snapshot is at least `refreshMs[ring]` old — due for a rev check, in snapshot order. */
export function due({ snapshots, now, policy, ring }: {
  readonly snapshots: SnapshotInput; readonly now: number; readonly policy: Policy; readonly ring: RingId;
}): Did[] {
  const list: readonly RepoSnapshot[] = snapshots instanceof Map ? [...snapshots.values()] : (snapshots as readonly RepoSnapshot[]);
  const limit = policy.refreshMs[ring];
  return list.filter((s) => now - s.fetchedAt >= limit).map((s) => s.did);
}

/** The followees whose rev moved are the only ring-2 subtrees to re-walk (`hop` and `hop2` alike). */
export function ring2Targets({ moved }: { readonly moved: readonly Did[] }): Did[] {
  return [...new Set(moved)];
}
