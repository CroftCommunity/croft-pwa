# RUN ATPROTO-02 — sealed box (privacy in public)

Scope: the first increment of the atproto **auth phase** — the self-contained
crypto piece that is fully provable now (no network, no credentials, no consent).
OAuth sign-in + DPoP writes + the key-at-rest vault remain the next increments.
Branch: main.

## Why this increment first

The auth phase is three intricate pieces (OAuth, writes, sealed-box). Sealed-box
is the only one that is deterministically verifiable in this environment: pure
WebCrypto, no network egress (which the sandbox blocks for the browser) and no
credentials/consent. Landing it first proves the crypto foundation the encrypted
writes will sit on, and keeps each increment shippable + verified rather than
dropping a large half-tested OAuth stack.

## What shipped

- **`src/crypto/sealedbox.ts`** (ported from skylite's network-proven code):
  `generateKeypair`, `seal(plaintext, publicJwk)`, `open(box, privateJwk)`,
  `assertPublicJwk`. Ephemeral ECDH(P-256) → HKDF-SHA256 → AES-256-GCM, all
  WebCrypto, zero dependencies. `assertPublicJwk` refuses to treat a private key
  (JWK with `d`) as public, so a private key can't be published by accident; the
  guard is also enforced inside `seal()`.
- **Live demo** on `/atproto.html`: seal a message to a fresh keypair's public
  half, open it with the private half, in the browser.
- `docs/ATPROTO.md` updated (sealed-box now shipped; vault staged with writes).

## Evidence — the gate is green

```
lint clean · typecheck clean
unit   56 passed  (+5 sealedbox: round-trip, ciphertext-uniqueness, wrong-key
                   rejection, GCM tamper rejection, reject-private-key guard)
build  10 pages, budget ok
e2e    80 passed  (+ sealed-box browser round-trip with real WebCrypto)
```

The crypto is proven deterministically (unit + a real-WebCrypto browser e2e) —
no sandbox-egress caveat, unlike the network pieces.

## Staged (the rest of the auth phase — skylite is the reference)

- **OAuth** sign-in: PKCE + PAR + DPoP, hosted `client-metadata.json`, rotating
  refresh, `sub`-verification, a signin callback page, and a hermetic mock of the
  full discovery→PAR→authorize→token chain (the intricate part; real consent is a
  device pass, not runnable in this sandbox).
- **DPoP writes** to the user's own repo + the sealed-box **vault** (WebAuthn-PRF /
  passphrase wrap protecting the private key at rest).
- **Lexicon conventions** (owned namespace, TID rkeys, no PII).

## Files touched

New: `src/crypto/sealedbox.ts`, `tests/unit/sealedbox.test.ts`,
`RUN-ATPROTO-02-SUMMARY.md`.
Changed: `src/pages/atproto.ts` (sealed demo + intro note), `docs/ATPROTO.md`,
`tests/e2e/atproto.spec.ts` (sealed round-trip).
