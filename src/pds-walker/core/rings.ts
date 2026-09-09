// The pure core of pds-walker: rings from repo snapshots (plan 2026-09-08 § Phase 2a).
// No I/O, no clock, no async — everything a ring needs is in the snapshots handed in, so
// this file is testable in isolation and portable to a worker or a Node script.

/** An atproto DID. */
export type Did = `did:${string}`;
/** A repo revision as `com.atproto.sync.getLatestCommit` reports it (a TID string). */
export type Rev = string;

/** What the walker remembers about one repo: its host, its rev, its follows, and when. */
export type RepoSnapshot = {
  readonly did: Did;
  readonly pds: string;
  readonly rev: Rev;
  readonly follows: readonly Did[];
  readonly fetchedAt: number;
};

/**
 * The five rings, tightest first. `hop` is what forage ships (everyone my MUTUALS follow);
 * `hop2` is the research's ring 2 (everyone my FOLLOWS follow). Owner decision 2026-09-08
 * (OQ6): both, under two ids. The order of this array IS the containment chain.
 */
export type RingId = 'me' | 'mut' | 'fol' | 'hop' | 'hop2';
export const RING_IDS: readonly RingId[] = Object.freeze(['me', 'mut', 'fol', 'hop', 'hop2']);

/** A ring as the walker answers it: who is in it, how stale, and whether every source was known. */
export type Ring = {
  readonly id: RingId;
  readonly members: ReadonlySet<Did>;
  /** The OLDEST `fetchedAt` among the snapshots this ring was computed from; 0 when none. */
  readonly asOf: number;
  /** True only when every snapshot the ring needs was present. Membership never depends on it. */
  readonly complete: boolean;
};

/** The shape of `src/log.ts`'s `log` — a type only, so the core stays I/O-free (Pass 3). */
export type Logger = {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

type SnapshotInput = ReadonlyMap<Did, RepoSnapshot> | readonly RepoSnapshot[];

function index(snapshots: SnapshotInput): ReadonlyMap<Did, RepoSnapshot> {
  return snapshots instanceof Map
    ? snapshots
    : new Map((snapshots as readonly RepoSnapshot[]).map((s) => [s.did, s] as const));
}

// A ring is a set of members plus the snapshots it was read from. "unknown is not empty":
// a source that is missing lowers `complete` and is left out of `asOf`; it never shrinks
// the membership below what the present sources say.
function ring(id: RingId, members: ReadonlySet<Did>, sources: ReadonlyArray<RepoSnapshot | undefined>): Ring {
  const present = sources.filter((s): s is RepoSnapshot => s !== undefined);
  const asOf = present.length === 0 ? 0 : present.reduce((min, s) => Math.min(min, s.fetchedAt), Infinity);
  return Object.freeze({ id, members, asOf, complete: present.length === sources.length });
}

/**
 * Compute all five rings for `me` from whatever snapshots are known. Each ring contains the
 * tighter ones by construction, so `me ⊂ mut ⊂ fol ⊂ hop ⊂ hop2` always holds.
 */
export function rings({ me, snapshots }: { readonly me: Did; readonly snapshots: SnapshotInput }): Record<RingId, Ring> {
  const byDid = index(snapshots);
  const mine = byDid.get(me);
  const follows: readonly Did[] = mine?.follows ?? [];
  const followeeSnaps = follows.map((f) => byDid.get(f));
  // A mutual is a followee whose snapshot lists me — so every mutual HAS a snapshot, by
  // construction; resolving them here keeps the hop union free of an unreachable branch.
  const mutualSnaps = followeeSnaps.filter((s): s is RepoSnapshot => s !== undefined && s.follows.includes(me));
  const mutuals = mutualSnaps.map((s) => s.did);

  const meSet = new Set<Did>([me]);
  const mutSet = new Set<Did>([...meSet, ...mutuals]);
  const folSet = new Set<Did>([...mutSet, ...follows]);
  const hopSet = new Set<Did>([...folSet, ...mutualSnaps.flatMap((s) => s.follows)]);
  const hop2Set = new Set<Did>([...hopSet, ...follows.flatMap((f) => byDid.get(f)?.follows ?? [])]);

  const graph = [mine, ...followeeSnaps];
  return Object.freeze({
    me: ring('me', meSet, [mine]),
    mut: ring('mut', mutSet, graph),
    fol: ring('fol', folSet, [mine]),
    hop: ring('hop', hopSet, graph),
    hop2: ring('hop2', hop2Set, graph),
  });
}
