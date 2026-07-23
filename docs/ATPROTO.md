# atproto / PDA integration

A Croft PWA treats the user's AT Protocol data server (PDS) as the backend: the
user owns their records, and the app is one client among many. There is no
server of ours in the middle. This is the substrate the whole family is built
on; skylite is the deepest reference implementation.

## The read path (shipped here)

Read-only and unauthenticated — no login, no keys. `src/atproto/read.ts`:

```
handle ──resolveHandle (public AppView)──▶ DID
DID ──resolvePds (plc.directory / .well-known)──▶ PDS endpoint
actor ──getProfile (public AppView)──▶ public profile
repo  ──getRecord / listRecords (the PDS)──▶ public records
```

- Every fetch is **injectable** (`fetchImpl`), so the logic is unit-tested with
  no network and the live path is exercised by the `@live` tier.
- Reads are **open-world**: only the truly-required fields (a DID, a handle) fail
  loud; unknown fields are tolerated and preserved.
- The `/atproto.html` page documents this and **demonstrates it live** — type a
  handle, watch it resolve to a DID + PDS and read the public profile straight
  off the network.

## CSP

`connect-src` allows the public AppView (`public.api.bsky.app`), the PLC
directory, and the bsky PDS hosts (`bsky.social`, `*.host.bsky.network`).
Arbitrary non-bsky PDS hosts cannot be statically allowlisted in a `<meta>` CSP;
the read demo goes through the AppView, which covers them. An app that must read
directly from an arbitrary PDS needs a header-level CSP or a per-host relaxation.

## Testing

- **Unit** (`tests/unit/atproto-read.test.ts`): resolution + reads with an
  injected fetch — handle→DID, DID→PDS (did:plc + did:web), open-world profile,
  fail-loud on missing required fields.
- **Hermetic e2e** (`tests/e2e/atproto.spec.ts`): the demo page with the AppView
  + PLC mocked via `page.route` — proves resolve → read → render.
- **@live** (`tests/live/atproto-read.live.spec.ts`, `npm run e2e:live`): the
  built page against the real network, resolving a stable handle. Local only,
  never in push CI. Needs real browser egress; where a sandbox resets
  headless-Chromium TLS, the module is verified live via node instead.

## Sealed box — privacy in public (shipped)

`src/crypto/sealedbox.ts` (ported from skylite): a record can live in a public
repo yet stay private — seal it to a recipient's **public** key, and only the
matching **private** key opens it. Ephemeral ECDH(P-256) → HKDF-SHA256 →
AES-256-GCM, all WebCrypto, no dependencies. A fresh ephemeral per message means
two seals of the same text differ; a wrong key or any tampering fails the GCM
auth tag. `assertPublicJwk` refuses to treat a private key (a JWK with `d`) as a
public one, so a private key can never be published by accident. Unit-tested
(round-trip, uniqueness, wrong-key, tamper, reject-private-key) and demonstrated
live on `/atproto.html`.

The key-at-rest **vault** (WebAuthn-PRF / passphrase wrap that protects the
private key) is the layer that pairs with real encrypted writes — staged with the
write path below.

## OAuth sign-in (shipped)

`src/atproto/oauth/{jose,pkce,dpop,resolve,client}.ts` (ported from skylite): a
public (SPA) client — authorization-code + PKCE + a pushed authorization request
(PAR), with DPoP-bound tokens (RFC 9449). No client secret; `client_id` is the
hosted `client-metadata.json` URL (repo root, served at the site root, copied
verbatim by `build.mjs`); `redirect_uri` is derived from the live origin
(`location.origin + location.pathname`) so the same code round-trips correctly
on GitHub Pages, a PR preview subpath, or the local dev/test server.

```
handle ──resolveIdentity (handle→DID→PDS→authserver metadata)──▶ AuthServerMeta
   │
   ▼ beginAuthorization: PKCE + a fresh DPoP key + PAR ──▶ authorizeUrl
   │  (pending auth — verifier, DPoP key, state — kept in sessionStorage;
   │   it must survive the full-page redirect to the PDS and back)
   ▼ browser navigates to authorizeUrl, user consents on their own PDS
   ▼ PDS redirects back to redirect_uri with ?code&state
   ▼ completeAuthorization: exchanges the code for DPoP-bound tokens,
     verifies the returned `sub` matches the resolved DID ──▶ OAuthSession
```

- `refresh` / `ensureFresh` rotate the (single-use) refresh token and keep the
  access token comfortably valid, so re-auth stays rare.
- The DPoP-nonce handshake (a server demanding a fresh `nonce` on the first try)
  is handled with a single retry, on both PAR and token requests.
- The session is kept in memory / `sessionStorage` only for this increment — not
  `localStorage` — because a persistent session needs the key-at-rest **vault**
  (below) to protect the DPoP private key; that pairing lands with DPoP writes.
- The `/atproto.html` page demonstrates sign-in live, right below the read-path
  demo: enter a handle, sign in on your own PDS, land back signed in as your DID.
- **Testing**: `tests/unit/oauth-crypto.test.ts` (jose/PKCE/DPoP — RFC 7636 test
  vector, RFC 7638 thumbprint, a verifiable DPoP proof), `tests/unit/oauth-resolve.test.ts`
  (the discovery chain), `tests/unit/oauth-client.test.ts` (begin/complete/refresh,
  state-mismatch and `sub`-mismatch rejection). Hermetic e2e in
  `tests/e2e/atproto.spec.ts` mocks the whole discovery→PAR→authorize→token chain
  on CSP-allowlisted hosts (`bsky.social` + `*.host.bsky.network`), so the real
  begin→redirect→callback→token-exchange path runs unmodified through the page's
  own code — only the live consent screen and server-side DPoP validation are out
  of scope there. The live authorize→consent→callback round-trip against a real
  PDS is a verify-in-run item, not runnable in this sandbox (device consent, not
  just network egress).

## DPoP writes (shipped)

`src/atproto/oauth/client.ts` gains `putRecord` / `createRecord` / `deleteRecord`:
a DPoP-authenticated JSON POST to the session's PDS. The proof carries the
access-token hash (`ath`) and is bound to the session's DPoP key, so a stolen
bearer token is useless without the key; the single `use_dpop_nonce` retry is
handled. Record keys are TIDs (`src/atproto/tid.ts`) — random and sortable, never
derived from content. Unit-tested with a real DPoP key against a recording fetch
(request shape, DPoP + authorization headers, nonce retry, error). The
`/atproto.html` write demo creates a note in your repo and deletes it — exercised
hermetically end-to-end after a mocked sign-in; a real write needs a live session.

## Vault — a key safe at rest (shipped, passphrase path)

`src/crypto/vault.ts`: `wrapKey(privateKeyJwk, passphrase)` / `unwrapKey(...)`.
PBKDF2-SHA256 (600k iterations) → HKDF → AES-256-GCM wraps a private-key JWK; the
wrong passphrase fails the auth tag and `unwrapKey` throws. This is what makes a
**persistent** session (or a stored sealed-box key) safe to keep at rest. The
stronger **WebAuthn-PRF** path (a passkey/biometric derives the wrapping secret —
nothing to remember or phish) is device-dependent and not hermetically testable,
so it is staged. Unit-tested (round-trip, no-plaintext-in-blob, wrong-passphrase);
demonstrated live on `/atproto.html`.

## Lexicon conventions (shipped)

- **Owned namespace** `ing.croft.<app>.*` (croft-pwa's demo record is
  `ing.croft.croftpwa.note`, in `lexicons/`).
- **TID record keys** — random + sortable, never derived from user content (no PII
  in the key).
- **Mirror mainline** where possible (the note is `text` + `createdAt`, like a
  post) so records stay portable to other clients.

## Deliberately staged (skylite is the reference)

- The **WebAuthn-PRF vault path** (passkey/biometric key-at-rest) and a
  **persisted, vault-wrapped session** across reloads.
- Client-side **sealed-box records** written to a PDS (compose the sealed box +
  a write + the vault) — the full "privacy in public" archive pattern.
