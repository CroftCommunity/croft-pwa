# croft-pwa — a guide for AI agents

croft-pwa is a meta-site about building Croft SPA/PWAs: the standards and a
reference implementation in one repo, built to the standards it documents. This
page is the front door for an agent asked to work in this repo or to build a new
Croft PWA from it.

## If you are working in this repo

Read [`CLAUDE.md`](./CLAUDE.md) — it is the operating manual: the one gate
(`npm run test`), TDD-first, the brand/CSP/navigation conventions, and the local
e2e stale-server gotcha. Follow the plan/RUN-summary method in `plans/` and
`RUN-*-SUMMARY.md`.

## If you are building a new Croft PWA

The chassis in this repo is the template. The load-bearing standards:

- **One static HTML shell per destination; no framework, no router.** Navigation
  is real links between real documents. Each page has an entry bundle in
  `src/pages/`.
- **Zero runtime dependencies.** Everything is built on the platform (fetch,
  WebCrypto, the DOM). Dev-only toolchain: esbuild, vitest, playwright, tsc,
  eslint.
- **One gate, identical to CI:** lint · typecheck · unit · build · e2e.
- **Design tokens with hex confined to `tokens.css`,** every text/UI pair
  clearing WCAG AA with the ratio recorded and asserted.
- **Build-time CSP (`default-src 'none'`) + Subresource Integrity,** enforced by
  an e2e spec.
- **A version-stamped service worker** whose routing decision is a pure,
  unit-tested function: network-first for navigations, cache-first for
  content-hashed assets, never intercept cross-origin.
- **TDD-first, with a dated plan and a per-run RUN summary** carrying red→green
  evidence and a files-touched ledger.

The atproto/PDA integration standard (OAuth with PKCE + PAR + DPoP, public
repo reads, custom lexicons, client-side sealed-box encryption) lands in Phase 3;
until then, [skylite](https://github.com/CroftCommunity/skylite) is the reference
implementation to read.

## Provenance

This repo distills conventions proven in two working Croft PWAs — arecipe (the
TDD working method and brand-token discipline) and skylite (the atproto/PDA
stack and provenance discipline) — and supersedes the older, generic
`peadoubleueh` notes. The discovery corpus's "tectonic" palette
(`discovery/beta/socialization/visual-identity-and-the-progressive-depth-website.md`)
is the brand starting point.
