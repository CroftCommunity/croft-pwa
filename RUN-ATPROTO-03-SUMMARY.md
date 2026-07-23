# RUN ATPROTO-03 — OAuth sign-in (PKCE + PAR + DPoP)

Scope: the second increment of the atproto **auth phase** — OAuth sign-in for a
public (SPA) client. DPoP-authenticated writes to the user's own repo and the
key-at-rest vault remain the next increment. Branch: `worktree-croft-pwa-oauth`.

## Why this increment next

RUN-ATPROTO-02 shipped the sealed-box crypto (the only auth-phase piece fully
provable with no network/consent). OAuth sign-in is next because it is the
gate everything else — writes, the vault — sits behind: no session, no writes.
skylite already carries a proven, zero-dependency implementation (PKCE + PAR +
DPoP over pure WebCrypto, no `@atproto/*` packages), matching croft-pwa's own
zero-runtime-dependency chassis — the correct reference to port, rather than
arecipe's heavier `@atproto/oauth-client-browser`-based approach.

## What shipped

- **`src/atproto/oauth/{jose,pkce,dpop}.ts`** — ported verbatim from skylite:
  base64url/SHA-256/ES256-JWT helpers, RFC 7636 PKCE, RFC 9449 DPoP (key
  gen/export/import, RFC 7638 thumbprint, signed proof JWTs with the nonce +
  access-token-hash claims).
- **`src/atproto/oauth/resolve.ts`** — the handle→DID→PDS→authorization-server
  discovery chain, adapted to reuse croft-pwa's own `read.ts`
  (`resolveHandle`/`resolvePds`) instead of skylite's separate `RepoClient`.
- **`src/atproto/oauth/client.ts`** — `beginAuthorization` (resolve + PKCE + a
  fresh DPoP key + PAR, with single-retry DPoP-nonce handling, → an authorize
  URL + `PendingAuth`), `completeAuthorization` (code exchange, `state` and
  `sub` verification → `OAuthSession`), `refresh` / `ensureFresh` (rotating
  refresh token, proactive refresh-on-open). Scoped to sign-in only —
  `putRecord`/`createRecord`/`deleteRecord` are the next increment.
- **`client-metadata.json`** at the repo root (the OAuth `client_id`, served
  byte-identical at the site root; `build.mjs` copies it verbatim), pointing
  `redirect_uris` at the production `atproto.html`.
- **`/atproto.html` sign-in demo**: a "Sign in with your PDS" panel between the
  read-path demo and the sealed-box demo. `redirect_uri` is derived at runtime
  from `location.origin + location.pathname`, so the same code round-trips on
  GitHub Pages, a PR-preview subpath, or the local dev/test server without a
  loopback special case. The pending auth (PKCE verifier + DPoP key + state)
  lives in `sessionStorage` across the redirect, cleared once consumed; the
  resulting session is shown but not persisted to `localStorage` (the vault
  that would make persistence safe is the next increment).
- `docs/ATPROTO.md` updated (OAuth moved from staged to shipped, with the flow
  diagram and testing posture); the plan's status line updated.

## Evidence — the gate is green

```
lint       clean            typecheck  0 errors
unit       Tests 76 passed (76)  (+12 oauth-crypto/oauth-resolve, +8 oauth-client)
build      10 pages, sw + precache 24, CSP+SRI on, budget ok (atproto 5.8K → 8.0K gz)
e2e        82 passed         (+2 OAuth: full round-trip signs in as the DID and
                              strips the callback params; a plain load shows no
                              stale sign-in state) — CSP + a11y both themes clean
                              on the new panel, no cross-origin scripts
```

No CSP widening was needed: the OAuth discovery/PAR/token endpoints in the
hermetic test use `bsky.social` / `*.host.bsky.network`, both already
allowlisted by the read-path `connect-src` (docs/ATPROTO.md).

## Verify-in-run ledger

- **The live authorize→consent→callback round-trip against a real PDS** is not
  runnable in this sandbox — it needs a human consent screen, not just network
  egress (a stricter bar than the read path's egress-only limitation). The
  hermetic e2e proves the page's own code (begin→redirect→callback→exchange)
  runs correctly; the pure builders (PKCE, DPoP, discovery) are unit-proven
  against RFC test vectors and mocked discovery fixtures, matching skylite's
  documented posture for the same code.

## Staged (the rest of the auth phase — skylite is the reference)

- **DPoP writes** to the user's own repo (`putRecord`/`createRecord`/
  `deleteRecord`) and the sealed-box **vault** (WebAuthn-PRF / passphrase wrap
  protecting the DPoP private key at rest) that makes a persistent session safe.
- **Lexicon conventions** (owned namespace, TID rkeys, no PII).

## Files touched

New: `src/atproto/oauth/jose.ts`, `pkce.ts`, `dpop.ts`, `resolve.ts`, `client.ts`,
`client-metadata.json`, `tests/unit/oauth-crypto.test.ts`,
`tests/unit/oauth-resolve.test.ts`, `tests/unit/oauth-client.test.ts`,
`RUN-ATPROTO-03-SUMMARY.md`.
Changed: `build.mjs` (copy `client-metadata.json`), `src/pages/atproto.ts`
(sign-in panel + OAuth callback handling), `tests/e2e/atproto.spec.ts` (OAuth
round-trip + no-callback specs), `docs/ATPROTO.md`,
`plans/2026-07-23-1-plan-croft-pwa.md` (status line).
