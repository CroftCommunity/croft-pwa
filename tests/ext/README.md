# Extension e2e tier (`npm run e2e:ext`)

Node-driven end-to-end tests for the **Croft Bridge** extension (`../../extension/`).
A **separate tier**, deliberately **not** part of the default `npm test` gate — it drives real
Chromium with an unpacked MV3 extension loaded, which the default hermetic e2e does not.

```
npm run e2e:ext        # node tests/ext/run-ext.mjs — exit 0 = all checks green
```

## Why node, not the Playwright test-runner

The mechanism under test — *a page can only read a no-CORS origin via the extension* — is identical
either way. But the Playwright **test-runner** intermittently **wedges the content-script extension's
page context** for 20–30s in this environment, and it survives every mitigation tried (a warmup
`globalSetup`, per-test unique profile dirs, `waitUntil: 'commit'` navigation, bounded timeouts, and
retries). Driving the exact same scenario from a plain **node** script via `playwright-core` is 100%
reliable (verified repeatedly, cold). That is the same channel the discovery spike
(`discovery/alpha/experiments/extension-content-fetch/`) and the `@live` atproto tier use, so the tier
is node-driven here too.

## Layout

- `harness.mjs` — `startOrigins` (origin A = the test page, origin B = a no-ACAO reader; ephemeral
  ports), `launchExtension` (persistent Chromium context + resolved extension id), and a small
  `check`/`summarise` registry.
- `run-ext.mjs` — the scenarios, run in order; `process.exit` reflects pass/fail. Later phases (consent,
  reader) append scenarios here.
- `fixtures/min-ext/` — a minimal SW-only extension (proves the harness loads an extension).
- `fixtures/page/` — the test page + `__directFetch` / `__viaExtension` probes.

## CI

Not in CI yet. Folding it into the gate is gated on plan Phase 8a / D5 (confirming a headless-extension
run is reliable on ubuntu CI). Chromium-only for now; Firefox/Safari are parked.
