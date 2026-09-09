// The store (plan 2026-09-08 § Phase 4a): the persistence seam the walker reads and writes
// snapshots through, and its memory implementation for tests and Node. `Store` lives here
// (not in a types file of its own) so the seam is exported in the phase that adds it.
import type { Did, RepoSnapshot } from '../core/rings.js';

/** Where snapshots live between sessions. Every method returns copies; `put` keeps the newer of two. */
export type Store = {
  get(did: Did): Promise<RepoSnapshot | null>;
  put(snapshot: RepoSnapshot): Promise<void>;
  all(): Promise<RepoSnapshot[]>;
};

const copy = (s: RepoSnapshot): RepoSnapshot => ({ ...s, follows: [...s.follows] });

/** An in-memory store: tests, Node scripts, and the fallback when IndexedDB is denied. */
export function memoryStore(): Store {
  const rows = new Map<Did, RepoSnapshot>();
  return {
    get: (did) => Promise.resolve(rows.has(did) ? copy(rows.get(did) as RepoSnapshot) : null),
    put: (snapshot) => {
      // "Keep the newer": an older snapshot must never overwrite what a later fetch stored;
      // an equal fetchedAt is newer information (a re-list at the same instant) and wins.
      const have = rows.get(snapshot.did);
      if (have === undefined || snapshot.fetchedAt >= have.fetchedAt) rows.set(snapshot.did, copy(snapshot));
      return Promise.resolve();
    },
    all: () => Promise.resolve([...rows.values()].map(copy)),
  };
}
