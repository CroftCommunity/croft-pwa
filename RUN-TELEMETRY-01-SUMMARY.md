# RUN TELEMETRY-01 — counter-based measurement, trialled locally

Scope: extract the product core of arecipe's `measure-proof` design (PR #58) into
croft-pwa as a real, gate-tested feature, running entirely locally — full flush
pipeline, but console-only "as if" transmission, gated by an opt-in/out toggle,
with a dedicated Metrics page as the local view. Branch: main. Plan:
`plans/2026-07-23-1-plan-croft-pwa.md`.

## What shipped

- **Registry** (`src/measure/registry.ts`): the single source of truth — ten
  metrics (nine pages + the theme-toggle feature), each with a plain-language
  disclosure and an `expires`. `MetricName` derives from the keys, so an
  undeclared metric is a compile error.
- **Privacy boundary** (`src/measure/store.ts`, ported): a rich local store
  (events, timestamps, ids) that never transmits, and `serialiseFlush` /
  `validateWirePayload` that let only `{ v, period, counts }` off the device.
- **Runtime expiry** (`src/measure/expiry.ts`) and **consent** (opt-in/out,
  default off — `src/measure/consent.ts`).
- **Integration** (`src/measure/measure.ts`): persists counts across the
  multi-page navigation (localStorage, per-month bucket), records typed metrics,
  and flushes on `visibilitychange`/`pagehide` (bfcache-safe), logging the exact
  payload to the console as if a remote were receiving it. No endpoint; nothing
  leaves.
- **Metrics page** (`metrics.html` / `src/pages/metrics.ts`, new "Metrics" tab):
  the sharing toggle, the registry with disclosures + expiry, current local
  counts, recent local-only events, and the exact wire-payload preview, plus a
  "preview a flush" button that writes to the console.
- Page metrics recorded from each page entry; `feature_theme_toggle` from the
  theme button. `docs/TELEMETRY.md` documents the posture.

## Evidence — the gate is green

```
lint       ESLint: No issues found
typecheck  tsc --noEmit (0 errors)
unit       Tests 42 passed (42)   (+ measure-store, + measure-registry/expiry)
build      built v0 0.1.0+14ac4ff -> dist/  (9 pages, sw + precache 22, CSP+SRI on)
e2e        49 passed (3.0s)       (+ metrics page/consent/flush, + metrics mobile-fit & csp)
```

TDD: the boundary and validator tests were written to pin the shape before wiring
(`serialiseFlush` emits only `{v,period,counts}`; identity never appears in the
payload; `validateWirePayload` rejects smuggled fields, fine periods, bad counts;
runtime expiry). The e2e proves the local view renders, consent is opt-in and
persists, and a flush leaves the origin untouched.

## Verify-in-run ledger

- **No remote receiver** — transmission is console-only by design this phase; a
  real endpoint (storage + consent-gated `sendBeacon`) is a later explicit step.
- **Screenshots regenerated** after the nav/home change (`npm run guide:shots`);
  a human eyeball pass across light/dark is still owed.
- **Re-linkage attack analysis not ported** — that lives in arecipe's proof; here
  the mitigation is structural (coarse month, counts-only, no identity on the
  wire) rather than measured against a synthetic oracle.
- **`page`/`feature` metric types are exercised; `timing`/`edge` are declared in
  the type but unused** — added when a metric needs them.

## Scoped out (with reason)

Real transmission/receiver + infra (deliberate — testbed is local-only); the
YAML registry + generator + drift test (a typed TS registry has no drift to
guard); atproto/PDA module (still pending as its own phase).

## Files touched

New: `src/measure/{registry,store,expiry,consent,measure}.ts`,
`src/pages/metrics.ts`, `metrics.html`,
`tests/unit/{measure-store,measure-registry}.test.ts`,
`tests/e2e/metrics.spec.ts`, `docs/TELEMETRY.md`, `RUN-TELEMETRY-01-SUMMARY.md`.
Changed: `build.mjs` (metrics page), `src/nav.ts` (Metrics tab + feature record),
`styles.css` (measure list), all nine page entries (record their page metric),
`tests/e2e/{mobile-fit,csp}.spec.ts` (cover /metrics.html),
`assets/guide/*.jpg` (regenerated).
