# Practices

The operational disciplines a Croft PWA follows. `docs/DESIGN.md` covers brand;
`docs/SECURITY.md` covers CSP/SRI. This covers the build, the service worker,
testing, and the working method.

## One gate

`npm run test` = lint · typecheck · unit · build · e2e, identical to CI. A
change is not done until this passes on a fresh checkout. Deploy is "done" only
when the live origin serves the pushed build (the version stamp is visible in
the footer and keyed into the SW cache name) — not when CI goes green.

## Build → self-contained `dist/`

`build.mjs` is the whole build: esbuild bundles each page entry with a
content-hashed name, concatenates `tokens.css` + `styles.css` into one
stylesheet, injects the CSP + SRI + version into each HTML shell, and generates
a version-stamped service worker with a precache manifest keyed to the exact
build. Hashed asset names make a stale subresource structurally impossible.

## Service worker recipe

The routing decision is a pure function (`src/sw-nav.ts`), unit-tested apart
from the worker runtime:

- non-GET → skip
- navigations / HTML → **network-first** (a shipped update wins; cached shell is
  the offline fallback)
- same-origin, content-hashed assets → **cache-first**
- cross-origin → **skip** (never `respondWith`)

Precache is per-asset tolerant (one miss must not brick install). `skipWaiting`
+ `clients.claim` so a fix is not stranded; registration failure is swallowed
(progressive enhancement).

## Testing

- **Unit (vitest, node):** pure logic only — the SW routing decision, theme
  resolution, brand-token ratios, the no-hex guard. Tests target behaviour
  through public APIs.
- **Hermetic e2e (playwright):** against the *built* bundle over the zero-dep
  static server; service workers blocked by default (they bypass route mocks).
  Smoke (shell renders, navigation, theme), mobile-fit (no overflow at
  320/360/390), and CSP (zero violations, no cross-origin script).
- **`@live` tier:** arrives with the atproto module (Phase 3), gated behind
  `npm run e2e:live`, real network, local-only, never in push CI.
- **Watch it fail first.** A test you did not see go RED has not earned trust.

## Working method

- **Plans.** Non-trivial work gets a dated plan in `plans/` carrying **Problem
  statement**, **Approach**, and **Reasoning**, plus locked decisions, RED→GREEN
  order, and an explicit "not in this run".
- **RUN summaries.** Each run writes a `RUN-<name>-SUMMARY.md` at the repo root:
  scope, red→green evidence, the full gate output with counts, a screenshot/a11y
  note, what was scoped out and why, and a files-touched table (new vs changed).
  Summaries are a historical record — not rewritten after the fact.
- **Fail loud, file don't hide.** Anything a hermetic test cannot reach (a live
  consent screen, a real device install) is recorded in the RUN summary's
  verify-in-run ledger, never quietly claimed.
