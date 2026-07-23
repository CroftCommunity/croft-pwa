# RUN ATPROTO-01 — the PDA read path + a real @live tier

Scope: land the atproto/PDA foundation in croft-pwa — the public, unauthenticated
read path — with a live demo page, unit + hermetic e2e coverage, and a genuine
`@live` tier (which had been a dangling script). The auth phase (OAuth/DPoP/
writes/sealed-box) is deliberately staged. Branch: main.

## What shipped

- **Read module** (`src/atproto/read.ts`, ported from skylite's network-verified
  code): `resolveHandle` (handle→DID via the public AppView), `resolvePds`
  (DID→PDS via plc.directory / .well-known, did:plc + did:web), `resolveIdentity`,
  `getProfile` (open-world), `pdsEndpointFromDoc`. Every fetch is injectable.
- **Live demo** (`atproto.html` / `src/pages/atproto.ts`): enter a handle → it
  resolves handle→DID→PDS and reads the public profile off the network, in the
  browser. Linked as the "atproto / PDA" chapter from the Standards index.
- **CSP** widened `connect-src` to the AppView, PLC directory, and bsky PDS hosts.
- **@live tier made real**: `playwright.live.config.ts` + `tests/live/atproto-read.live.spec.ts`
  (real network, `npm run e2e:live`, local-only, never in push CI) — closing the
  dangling-script gap.
- `docs/ATPROTO.md`; `page_atproto` added to the measure registry.

## Evidence — the gate is green

```
lint       clean            typecheck  0 errors
unit       Tests 51 passed (51)   (+10 atproto-read: resolution, did:plc/did:web,
                                    open-world profile, fail-loud, injected fetch)
build      10 pages, sw + precache 24, CSP+SRI on, budget ok
e2e        79 passed         (+ hermetic atproto: resolve→read→render, + error path;
                              + atproto in mobile-fit/csp/a11y; a11y both themes)
```

## Live verification (the read path actually works)

Browser `@live` cannot run in this sandbox (it resets headless-Chromium TLS —
the documented egress limit), so the **real module** was bundled and run against
the **real network** via node:

```
resolveIdentity('bsky.app') → { did: did:plc:z72i7hdynmk6r22z27h6tvur,
                                pds: https://puffball.us-east.host.bsky.network }
getProfile(did)             → { handle: bsky.app, displayName: Bluesky }
```

The `@live` browser spec is correct and runs in a networked environment; the
hermetic e2e proves the page wiring; node proves the code against production
atproto.

## Verify-in-run ledger

- **Browser @live unrun here** (sandbox egress) — module verified live via node,
  spec runs in a networked env. Same posture skylite documents.
- **Arbitrary non-bsky PDS hosts** can't be in a `<meta>` CSP `connect-src`; the
  demo reads via the AppView (documented in docs/ATPROTO.md).

## Scoped out (the auth phase — skylite is the reference until it lands)

OAuth (PKCE + PAR + DPoP), DPoP-authenticated writes to the user's repo, lexicon
conventions + an owned namespace, and client-side sealed-box encryption.

## Files touched

New: `src/atproto/read.ts`, `src/pages/atproto.ts`, `atproto.html`,
`playwright.live.config.ts`, `tests/live/atproto-read.live.spec.ts`,
`tests/unit/atproto-read.test.ts`, `tests/e2e/atproto.spec.ts`,
`docs/ATPROTO.md`, `RUN-ATPROTO-01-SUMMARY.md`.
Changed: `build.mjs` (page + CSP connect-src), `src/nav.ts` (Standards match),
`src/pages/reference.ts` (chapter card), `src/measure/registry.ts` (page_atproto),
`styles.css`, `tsconfig.json`, `tests/e2e/{mobile-fit,csp,a11y,standards}.spec.ts`.
