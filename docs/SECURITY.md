# Security posture

A Croft PWA is a static, backendless site served from a header-less host
(GitHub Pages). Security is therefore built into the artifact at build time and
verified by the gate, not configured on a server.

## Content Security Policy (build-time, in a `<meta>`)

`build.mjs` injects a `default-src 'none'` policy into every page, then opens
exactly what the app needs:

```
default-src 'none'; base-uri 'none'; form-action 'none';
img-src 'self' data:; font-src 'self'; style-src 'self';
manifest-src 'self'; connect-src 'self'; worker-src 'self';
script-src 'self' 'sha256-<pre-paint theme init>'
```

- **No `unsafe-inline`.** The one inline script (the pre-paint theme resolver) is
  admitted by its sha256, computed at build over the exact bytes injected — so
  the hash can never drift from the script.
- **`connect-src 'self'`** for now; it widens to the atproto origins (the AppView,
  `plc.directory`, `bsky.social`, `*.host.bsky.network`) when the PDA module lands
  in Phase 3.
- **`frame-ancestors` is intentionally absent** from the meta CSP — browsers
  ignore it there (it must be an HTTP header). The static host applies it. This
  is noted so a reviewer does not read the omission as a gap.

## Subresource Integrity

The stylesheet and every module script carry a `sha384` `integrity` attribute
(with `crossorigin="anonymous"`), computed at build over the emitted bytes. A
tampered or mis-served asset fails the integrity check and does not execute.
Combined with content-hashed filenames, a stale or swapped bundle is
structurally rejected rather than silently run.

## Verified by the gate

`tests/e2e/csp.spec.ts` loads every document, asserts **zero**
`securitypolicyviolation` events, and asserts no `<script src>` is cross-origin.
A change that introduces an inline handler, an `unsafe-inline`, or a third-party
script fails the gate.

## Service worker

The worker never calls `respondWith` for cross-origin requests (`src/sw-nav.ts`),
so third-party traffic (and, later, PDS/CDN calls) behaves identically with and
without the worker, and test route fixtures are not shadowed. It is
version-stamped and uses `skipWaiting` + `clients.claim` so a shipped fix is
never stranded behind a stale worker.

## What is deferred

Multi-origin signed delivery and a signed status/canary (skylite/arecipe's
Phase-3 trust roadmap) are noted as patterns, not required of every Croft PWA.
The atproto client-side sealed-box encryption and the reject-private-key guard
arrive with the PDA module.
