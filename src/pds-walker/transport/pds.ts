// The two PDS calls the walker makes (plan 2026-09-08 § Phase 3b), unauthenticated and
// CORS-open on every PDS measured (research § 3.1). Honest on failure: a call that cannot
// complete answers `{ unknown: reason }`, and a paged listing that fails on page N answers
// unknown with NOTHING from the pages before it — a partial list would shrink a ring.
import type { Did, Rev } from '../core/rings.js';
import type { Limiter } from './limiter.js';

/** Injectable fetch, and the per-host limiter every call runs under (3c). */
export type PdsDeps = { readonly fetchImpl?: typeof fetch; readonly limiter?: Limiter };

/** The failure shape shared by every transport call. */
export type Unknown = { readonly unknown: string };

const FOLLOW = 'app.bsky.graph.follow';
const PAGE = 100;

const hostOf = (pds: string): string => { try { return new URL(pds).host; } catch { return pds; } };
const fetchOf = (deps: PdsDeps): typeof fetch => deps.fetchImpl ?? globalThis.fetch.bind(globalThis);

async function getJson(url: string, host: string, deps: PdsDeps): Promise<{ ok: true; body: unknown } | { ok: false; reason: string }> {
  const doFetch = async (): Promise<Response> => {
    const r = await fetchOf(deps)(url, { headers: { accept: 'application/json' } });
    deps.limiter?.observe(host, r);
    return r;
  };
  let res: Response;
  try {
    res = deps.limiter === undefined ? await doFetch() : await deps.limiter.run(host, doFetch);
  } catch (e) {
    return { ok: false, reason: `${host}: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!res.ok) return { ok: false, reason: `${host}: ${res.status}` };
  try {
    const parsed: unknown = await res.json();
    return { ok: true, body: parsed };
  } catch (e) {
    return { ok: false, reason: `${host}: bad JSON (${e instanceof Error ? e.message : String(e)})` };
  }
}

/** `com.atproto.sync.getLatestCommit` → the repo's current rev, or unknown. */
export async function latestRev(pds: string, did: string, deps: PdsDeps = {}): Promise<Rev | Unknown> {
  const url = `${pds}/xrpc/com.atproto.sync.getLatestCommit?did=${encodeURIComponent(did)}`;
  const r = await getJson(url, hostOf(pds), deps);
  if (!r.ok) return { unknown: `getLatestCommit ${r.reason}` };
  const body: unknown = r.body;
  const rev: unknown = typeof body === 'object' && body !== null && 'rev' in body ? body.rev : undefined;
  return typeof rev === 'string' && rev.length > 0 ? rev : { unknown: `getLatestCommit ${hostOf(pds)}: no rev in body` };
}

/**
 * `com.atproto.repo.listRecords` over `app.bsky.graph.follow`, 100 per page, following
 * `cursor` until a page has none. A last page of records still carries a cursor on the
 * reference PDS; the page after it is empty with no cursor (harvested 2026-09-08). An empty
 * cursor string is treated as absent.
 */
export async function listFollows(pds: string, did: string, deps: PdsDeps = {}): Promise<readonly Did[] | Unknown> {
  const subjects: Did[] = [];
  let cursor: string | undefined;
  for (let page = 1; ; page++) {
    const url = `${pds}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${FOLLOW}&limit=${PAGE}` +
      (cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`);
    const r = await getJson(url, hostOf(pds), deps);
    if (!r.ok) return { unknown: `listRecords ${r.reason} at page ${page}` };
    const raw: unknown = r.body;
    const body = typeof raw === 'object' && raw !== null ? (raw as { records?: unknown; cursor?: unknown }) : {};
    const records: readonly unknown[] = Array.isArray(body.records) ? (body.records as unknown[]) : [];
    for (const rec of records) {
      const subject = (rec as { value?: { subject?: unknown } } | null)?.value?.subject;
      if (typeof subject === 'string' && subject.startsWith('did:')) subjects.push(subject as Did);
    }
    const next: unknown = body.cursor;
    if (typeof next !== 'string' || next === '') return subjects;
    cursor = next;
  }
}
