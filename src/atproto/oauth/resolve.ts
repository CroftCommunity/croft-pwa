import { resolveHandle, resolvePds, type ReadDeps } from '../read';

// atproto OAuth discovery: handle → DID → PDS → protected-resource →
// authorization-server metadata. Fetch-based and injectable, so it is unit
// tested with mocked responses. Ported from skylite's src/atproto/oauth/resolve.ts,
// adapted to reuse croft-pwa's own read.ts for the handle/PDS steps instead of
// a separate RepoClient.

export interface AuthServerMeta {
  readonly issuer: string;
  readonly authorization_endpoint: string;
  readonly token_endpoint: string;
  readonly pushed_authorization_request_endpoint: string;
}

export interface ResolvedIdentity {
  readonly did: string;
  readonly pds: string;
  readonly authServer: string;
  readonly meta: AuthServerMeta;
}

export type ResolveDeps = ReadDeps;

function fetchOf(deps: ResolveDeps): typeof fetch {
  return deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
}

async function json(res: Response, what: string): Promise<Record<string, unknown>> {
  if (!res.ok) throw new Error(`${what} failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export async function resolveHandleToDid(handle: string, deps: ResolveDeps = {}): Promise<string> {
  return resolveHandle(handle, deps);
}

/** The authorization server a PDS delegates to (its protected-resource metadata). */
export async function authServerFromPds(pds: string, fetchImpl: typeof fetch): Promise<string> {
  const url = new URL('/.well-known/oauth-protected-resource', pds);
  const data = await json(await fetchImpl(url, { headers: { accept: 'application/json' } }), 'protected-resource');
  const servers = data.authorization_servers;
  const authServer: unknown = Array.isArray(servers) ? (servers as unknown[])[0] : undefined;
  if (typeof authServer !== 'string') throw new Error('no authorization server for PDS');
  return authServer.replace(/\/+$/, '');
}

export async function fetchAuthServerMeta(authServer: string, fetchImpl: typeof fetch): Promise<AuthServerMeta> {
  const url = new URL('/.well-known/oauth-authorization-server', authServer);
  const m = await json(await fetchImpl(url, { headers: { accept: 'application/json' } }), 'authorization-server');
  const { issuer, authorization_endpoint, token_endpoint, pushed_authorization_request_endpoint } = m;
  if (
    typeof authorization_endpoint !== 'string' ||
    typeof token_endpoint !== 'string' ||
    typeof pushed_authorization_request_endpoint !== 'string'
  ) {
    throw new Error('incomplete authorization-server metadata');
  }
  return {
    issuer: typeof issuer === 'string' ? issuer : authServer,
    authorization_endpoint,
    token_endpoint,
    pushed_authorization_request_endpoint,
  };
}

/** Full chain: a handle or DID → everything needed to start the OAuth flow. */
export async function resolveIdentity(handleOrDid: string, deps: ResolveDeps = {}): Promise<ResolvedIdentity> {
  const fetchImpl = fetchOf(deps);
  const did = handleOrDid.startsWith('did:') ? handleOrDid : await resolveHandle(handleOrDid, deps);
  const pds = await resolvePds(did, deps);
  const authServer = await authServerFromPds(pds, fetchImpl);
  const meta = await fetchAuthServerMeta(authServer, fetchImpl);
  return { did, pds, authServer, meta };
}
