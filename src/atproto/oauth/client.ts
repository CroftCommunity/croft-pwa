import { createPkce } from './pkce';
import {
  generateDpopKey,
  exportDpopKey,
  importDpopKey,
  createDpopProof,
  type DpopKey,
  type StoredDpopKey,
} from './dpop';
import { resolveIdentity, type ResolveDeps } from './resolve';
import { randomB64url } from './jose';

/**
 * atproto OAuth for a public (SPA) client — authorization-code + PKCE + PAR,
 * with DPoP-bound tokens (RFC 9449). No client secret; the `client_id` is the
 * hosted client-metadata.json URL. The DPoP-nonce handshake (servers demand a
 * fresh `nonce` on the first try) is handled with a single retry.
 *
 * Ported from skylite's proven src/atproto/oauth/client.ts. Sign-in landed in
 * increment 2; DPoP-authenticated writes (putRecord/createRecord/deleteRecord,
 * below) landed in increment 3.
 *
 * The live authorize→consent→callback round-trip against a real PDS is a
 * verify-in-run item; the pure builders and the token/PAR requests here are
 * exercised hermetically with mocked responses.
 */

export interface OAuthConfig {
  /** The hosted client-metadata.json URL — also the OAuth client_id. */
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope: string;
  readonly fetchImpl?: typeof fetch;
}

export interface PendingAuth {
  readonly state: string;
  readonly verifier: string;
  readonly dpopKey: StoredDpopKey;
  readonly did: string;
  readonly pds: string;
  readonly authServer: string;
  readonly issuer: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly parEndpoint: string;
}

export interface OAuthSession {
  readonly did: string;
  readonly pds: string;
  readonly issuer: string;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly tokenEndpoint: string;
  /** The client_id, needed to refresh without re-resolving. */
  readonly clientId: string;
  readonly dpopKey: StoredDpopKey;
  readonly dpopNonce?: string;
  /** Epoch ms when the access token expires (from `expires_in`), if known. */
  readonly expiresAt?: number;
}

function fetchOf(cfg: OAuthConfig): typeof fetch {
  return cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
}

interface XrpcJson {
  error?: string;
  [k: string]: unknown;
}

/**
 * POST a form to an OAuth endpoint with a DPoP proof, retrying once when the
 * server asks for a nonce (`use_dpop_nonce`). Returns the parsed JSON and the
 * latest server nonce to persist.
 */
async function dpopForm(
  endpoint: string,
  params: Record<string, string>,
  key: DpopKey,
  fetchImpl: typeof fetch,
  opts: { nonce?: string; accessToken?: string } = {},
): Promise<{ data: XrpcJson; nonce: string | undefined; status: number }> {
  const attempt = async (nonce: string | undefined): Promise<Response> => {
    const proof = await createDpopProof({
      key,
      htm: 'POST',
      htu: endpoint,
      ...(nonce ? { nonce } : {}),
      ...(opts.accessToken ? { accessToken: opts.accessToken } : {}),
    });
    return fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', dpop: proof },
      body: new URLSearchParams(params).toString(),
    });
  };

  let res = await attempt(opts.nonce);
  let serverNonce = res.headers.get('DPoP-Nonce') ?? undefined;
  let data = (await res.json().catch(() => ({}))) as XrpcJson;

  if (!res.ok && data.error === 'use_dpop_nonce' && serverNonce) {
    res = await attempt(serverNonce);
    serverNonce = res.headers.get('DPoP-Nonce') ?? serverNonce;
    data = (await res.json().catch(() => ({}))) as XrpcJson;
  }
  return { data, nonce: serverNonce, status: res.status };
}

/** Step 1: resolve identity, push the authorization request, return the URL to visit. */
export async function beginAuthorization(
  handleOrDid: string,
  cfg: OAuthConfig,
  deps: ResolveDeps = {},
): Promise<{ authorizeUrl: string; pending: PendingAuth }> {
  const fetchImpl = fetchOf(cfg);
  const id = await resolveIdentity(handleOrDid, { ...deps, ...(cfg.fetchImpl ? { fetchImpl } : {}) });
  const pkce = await createPkce();
  const key = await generateDpopKey();
  const state = randomB64url(16);

  const { data, status } = await dpopForm(
    id.meta.pushed_authorization_request_endpoint,
    {
      client_id: cfg.clientId,
      response_type: 'code',
      redirect_uri: cfg.redirectUri,
      scope: cfg.scope,
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      login_hint: handleOrDid,
    },
    key,
    fetchImpl,
  );
  const requestUri = data.request_uri;
  if (typeof requestUri !== 'string') {
    throw new Error(`PAR failed (${status})${data.error ? `: ${data.error}` : ''}`);
  }

  const authorizeUrl = new URL(id.meta.authorization_endpoint);
  authorizeUrl.searchParams.set('client_id', cfg.clientId);
  authorizeUrl.searchParams.set('request_uri', requestUri);

  return {
    authorizeUrl: authorizeUrl.toString(),
    pending: {
      state,
      verifier: pkce.verifier,
      dpopKey: await exportDpopKey(key),
      did: id.did,
      pds: id.pds,
      authServer: id.authServer,
      issuer: id.meta.issuer,
      authorizationEndpoint: id.meta.authorization_endpoint,
      tokenEndpoint: id.meta.token_endpoint,
      parEndpoint: id.meta.pushed_authorization_request_endpoint,
    },
  };
}

/** Step 2: exchange the callback code for DPoP-bound tokens. */
export async function completeAuthorization(
  pending: PendingAuth,
  callback: { code: string; state: string },
  cfg: OAuthConfig,
): Promise<OAuthSession> {
  if (callback.state !== pending.state) throw new Error('OAuth state mismatch — refusing the callback');
  const fetchImpl = fetchOf(cfg);
  const key = await importDpopKey(pending.dpopKey);

  const { data, nonce, status } = await dpopForm(
    pending.tokenEndpoint,
    {
      grant_type: 'authorization_code',
      code: callback.code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      code_verifier: pending.verifier,
    },
    key,
    fetchImpl,
  );
  const accessToken = data.access_token;
  if (typeof accessToken !== 'string') {
    throw new Error(`Token exchange failed (${status})${data.error ? `: ${data.error}` : ''}`);
  }
  // atproto binds the returned `sub` to the authenticated DID; verify it.
  if (typeof data.sub === 'string' && data.sub !== pending.did) {
    throw new Error('Token subject does not match the resolved DID');
  }

  return {
    did: pending.did,
    pds: pending.pds,
    issuer: pending.issuer,
    accessToken,
    ...(typeof data.refresh_token === 'string' ? { refreshToken: data.refresh_token } : {}),
    tokenEndpoint: pending.tokenEndpoint,
    clientId: cfg.clientId,
    dpopKey: pending.dpopKey,
    ...(nonce ? { dpopNonce: nonce } : {}),
    ...(typeof data.expires_in === 'number' ? { expiresAt: Date.now() + data.expires_in * 1000 } : {}),
  };
}

/**
 * Refresh the session (rotating refresh token). atproto refresh tokens are
 * single-use and rotate, so the returned session must replace the old one.
 */
export async function refresh(
  session: OAuthSession,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<OAuthSession> {
  if (!session.refreshToken) throw new Error('No refresh token — a new sign-in is needed.');
  const key = await importDpopKey(session.dpopKey);
  const { data, nonce, status } = await dpopForm(
    session.tokenEndpoint,
    { grant_type: 'refresh_token', refresh_token: session.refreshToken, client_id: session.clientId },
    key,
    fetchImpl,
    session.dpopNonce ? { nonce: session.dpopNonce } : {},
  );
  const accessToken = data.access_token;
  if (typeof accessToken !== 'string') {
    throw new Error(`Refresh failed (${status})${data.error ? `: ${data.error}` : ''}`);
  }
  const nextNonce = nonce ?? session.dpopNonce;
  return {
    ...session,
    accessToken,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : session.refreshToken,
    ...(nextNonce ? { dpopNonce: nextNonce } : {}),
    ...(typeof data.expires_in === 'number' ? { expiresAt: Date.now() + data.expires_in * 1000 } : {}),
  };
}

/**
 * Proactive refresh-on-open: return a session whose access token is comfortably
 * valid, refreshing first if it is missing or within `skewMs` of expiry. This
 * keeps re-auth rare — the sign-in flow is only ever pulled in when the refresh
 * chain itself has broken.
 */
export async function ensureFresh(
  session: OAuthSession,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  skewMs = 60_000,
): Promise<OAuthSession> {
  if (session.expiresAt !== undefined && session.expiresAt - Date.now() > skewMs) return session;
  return refresh(session, fetchImpl);
}

// --- DPoP-authenticated writes to the user's own repo (increment 3) ---------

/**
 * A DPoP-authenticated JSON POST to the session's PDS, with the single
 * use_dpop_nonce retry. The proof carries the access-token hash (ath) and is
 * bound to the session's DPoP key, so a stolen bearer token is useless without
 * the key. Ported from skylite's pdsRequest.
 */
async function pdsJson(
  session: OAuthSession,
  path: string,
  body: unknown,
  fetchImpl: typeof fetch,
): Promise<{ data: XrpcJson; nonce: string | undefined; status: number }> {
  const key = await importDpopKey(session.dpopKey);
  const url = new URL(path, session.pds).toString();
  const attempt = async (nonce: string | undefined): Promise<Response> => {
    const proof = await createDpopProof({
      key,
      htm: 'POST',
      htu: url,
      accessToken: session.accessToken,
      ...(nonce ? { nonce } : {}),
    });
    return fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `DPoP ${session.accessToken}`,
        dpop: proof,
      },
      body: JSON.stringify(body),
    });
  };
  let res = await attempt(session.dpopNonce);
  let serverNonce = res.headers.get('DPoP-Nonce') ?? session.dpopNonce;
  let data = (await res.json().catch(() => ({}))) as XrpcJson;
  if (!res.ok && data.error === 'use_dpop_nonce' && serverNonce) {
    res = await attempt(serverNonce);
    serverNonce = res.headers.get('DPoP-Nonce') ?? serverNonce;
    data = (await res.json().catch(() => ({}))) as XrpcJson;
  }
  return { data, nonce: serverNonce, status: res.status };
}

function withNonce(session: OAuthSession, nonce: string | undefined): OAuthSession {
  return nonce ? { ...session, dpopNonce: nonce } : session;
}

export interface WriteResult {
  /** The session, carrying any refreshed DPoP nonce (thread it into the next write). */
  readonly session: OAuthSession;
  readonly uri?: string;
  readonly cid?: string;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** Put a record at a known rkey in the user's own repo. */
export async function putRecord(
  session: OAuthSession,
  params: { collection: string; rkey: string; record: unknown },
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<WriteResult> {
  const { data, nonce, status } = await pdsJson(
    session,
    '/xrpc/com.atproto.repo.putRecord',
    {
      repo: session.did,
      collection: params.collection,
      rkey: params.rkey,
      record: params.record,
      validate: false,
    },
    fetchImpl,
  );
  if (status < 200 || status >= 300) {
    throw new Error(`putRecord failed (${status})${data.error ? `: ${data.error}` : ''}`);
  }
  const uri = str(data.uri);
  const cid = str(data.cid);
  return { session: withNonce(session, nonce), ...(uri ? { uri } : {}), ...(cid ? { cid } : {}) };
}

/** Create a record (server-assigned rkey unless one is given) in the user's own repo. */
export async function createRecord(
  session: OAuthSession,
  params: { collection: string; record: unknown; rkey?: string },
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<WriteResult> {
  const { data, nonce, status } = await pdsJson(
    session,
    '/xrpc/com.atproto.repo.createRecord',
    {
      repo: session.did,
      collection: params.collection,
      record: params.record,
      validate: false,
      ...(params.rkey ? { rkey: params.rkey } : {}),
    },
    fetchImpl,
  );
  if (status < 200 || status >= 300) {
    throw new Error(`createRecord failed (${status})${data.error ? `: ${data.error}` : ''}`);
  }
  const uri = str(data.uri);
  const cid = str(data.cid);
  return { session: withNonce(session, nonce), ...(uri ? { uri } : {}), ...(cid ? { cid } : {}) };
}

/** Delete a record by rkey from the user's own repo. */
export async function deleteRecord(
  session: OAuthSession,
  params: { collection: string; rkey: string },
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<OAuthSession> {
  const { data, nonce, status } = await pdsJson(
    session,
    '/xrpc/com.atproto.repo.deleteRecord',
    { repo: session.did, collection: params.collection, rkey: params.rkey },
    fetchImpl,
  );
  if (status < 200 || status >= 300) {
    throw new Error(`deleteRecord failed (${status})${data.error ? `: ${data.error}` : ''}`);
  }
  return withNonce(session, nonce);
}
