// The rev gate (plan 2026-09-08 § Phase 2b): the one decision the walker makes per repo on
// refresh. Pure — the walker asks the transport for the rev and hands both here.
import type { RepoSnapshot, Rev } from './rings';

/** What the transport answered for `getLatestCommit`: a rev, nothing, or an honest unknown. */
export type LatestRev = Rev | undefined | { readonly unknown: string };

/** `keep` — nothing moved; `relist` — fetch the follows again; `unknown` — keep what is stored, mark the host. */
export type Verdict = 'keep' | 'relist' | 'unknown';

/**
 * Branch order matters and is pinned by the tests: a repo we have never listed is relisted
 * no matter what the rev call said (there is nothing to keep), while a repo we HAVE listed
 * whose rev could not be read is `unknown` — the stored snapshot stands, never shrinks.
 * Revs compare for equality only; "moved or not" is the whole question.
 */
export function decide({ snapshot, latestRev }: { readonly snapshot: RepoSnapshot | undefined; readonly latestRev: LatestRev }): Verdict {
  if (snapshot === undefined) return 'relist';
  if (latestRev === undefined || typeof latestRev !== 'string') return 'unknown';
  return latestRev === snapshot.rev ? 'keep' : 'relist';
}
