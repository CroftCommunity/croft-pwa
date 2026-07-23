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

## Deliberately staged (the rest of the auth phase)

Not yet in croft-pwa; **skylite is the reference** until they land:

- **OAuth** for a public SPA client — PKCE + PAR + DPoP, a hosted
  `client-metadata.json`, rotating refresh, `sub`-verification.
- **DPoP-authenticated writes** to the user's own repo (`putRecord`/`createRecord`),
  and the sealed-box **vault** (key-at-rest protection).
- **Lexicon conventions** — an owned `*.<app>.*` namespace, TID rkeys, records
  that mirror mainline for portability, no PII.
