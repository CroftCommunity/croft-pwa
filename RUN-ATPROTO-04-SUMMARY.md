# RUN ATPROTO-04 — DPoP writes + vault + lexicon conventions

Scope: the last core of the auth phase — DPoP-authenticated writes to the user's
own repo, the key-at-rest vault (passphrase path), and lexicon conventions.
Branch: main. Ported from skylite's proven code.

## What shipped

- **Writes** (`src/atproto/oauth/client.ts` + `putRecord`/`createRecord`/`deleteRecord`):
  DPoP-authenticated JSON POST to the session's PDS — proof carries the access-token
  hash (`ath`), bound to the session's DPoP key, single `use_dpop_nonce` retry.
- **TID** (`src/atproto/tid.ts`): 13-char base32-sortable record keys — random +
  time-sortable, never derived from content.
- **Vault** (`src/crypto/vault.ts`): `wrapKey`/`unwrapKey` — PBKDF2-SHA256 (600k) →
  HKDF → AES-256-GCM wraps a private-key JWK behind a passphrase; the wrong
  passphrase fails the auth tag. This makes a persistent session (or a stored
  sealed-box key) safe at rest. WebAuthn-PRF path staged (device-dependent).
- **Lexicon** (`lexicons/ing.croft.croftpwa.note.json`): the demo note record —
  owned `ing.croft.<app>.*` namespace, TID rkey, mirrors a mainline post.
- **Demos** on `/atproto.html`: write a note to your repo + delete it (needs
  sign-in); wrap/unlock a key behind a passphrase (self-contained).

## Evidence — the gate is green

```
lint clean · typecheck clean
unit  89 passed  (+13: tid ×5, vault ×4 [round-trip, no-plaintext, wrong-pass,
                  requires-pass], oauth-writes ×4 [DPoP-signed request shape,
                  nonce retry, error, delete] with a REAL DPoP key vs a recording fetch)
build 10 pages, budget ok (atproto 9.3K gz, < 20K)
e2e   green  (+ write-a-record after a mocked sign-in; write demo asks to sign in
              first; vault demo wraps+unlocks with real WebCrypto)
```

## Verify-in-run ledger

- **Writes are unit-proven** against a recording fetch with a real DPoP key
  (correct xrpc path, `authorization: DPoP`, a `dpop` proof, nonce retry). The UI
  write demo is exercised hermetically after a mocked sign-in. A **real** write to
  a real repo needs a live session (human consent) — device pass, per skylite.
- **Vault = passphrase path only.** WebAuthn-PRF (passkey/biometric) is
  device-dependent and not hermetically testable — staged.
- **PBKDF2 at 600k** in the unit + browser demo runs in well under a second here.

## Staged (skylite is the reference)

WebAuthn-PRF vault + a persisted vault-wrapped session across reloads; sealed-box
records written to a PDS (sealed box + write + vault composed — the full
"privacy in public" archive).

## Files touched

New: `src/atproto/tid.ts`, `src/crypto/vault.ts`,
`lexicons/ing.croft.croftpwa.note.json`,
`tests/unit/{tid,vault,oauth-writes}.test.ts`, `RUN-ATPROTO-04-SUMMARY.md`.
Changed: `src/atproto/oauth/client.ts` (+writes), `src/pages/atproto.ts`
(write + vault demos, session state), `docs/ATPROTO.md`,
`tests/e2e/atproto.spec.ts`.
