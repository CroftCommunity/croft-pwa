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

## Relative paths (subpath-portable)

Every path is **relative** — asset references, navigation hrefs, the manifest
(`start_url`/`scope`/icons), and the service-worker registration and precache.
No path starts from the domain root. This is a hard standard, for one reason: the
same build must run unchanged at a domain root **and** under a subpath. Two real
deploys need the subpath case:

- a **GitHub project page** is served under `/<repo>/` (e.g. `/croft-pwa/`);
- the **per-PR preview** workflow serves a build under `/pr-preview/pr-N/`.

An absolute path like `/assets/app.js` resolves to the domain root and 404s under
either — a blank page. So:

- The build **fails** if any emitted page contains an absolute-root `href`/`src`.
- The active nav tab is matched by page **basename**, not by absolute pathname.
- `tests/e2e/subpath.spec.ts` serves the build under a subpath and asserts it
  renders with zero failed requests and that relative nav stays within the subpath.

The local root-served gate alone will not catch an absolute-path regression —
that is exactly why the subpath test and the build check exist.

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

## Service-worker updates ("ask, don't ambush")

When you ship a new build the browser installs the new worker but parks it in a
**waiting** state until the pages the old worker controls go away — the update is
automatic but lazy, never mid-session. There are three stances for *when* the new
worker takes over; a Croft PWA picks one deliberately:

- **Ask (the default).** The waiting worker is surfaced — a transient update toast
  and the **Settings → Update** button — and only takes over when the user asks
  (`applyUpdate()` posts `SKIP_WAITING`; the page reloads on `controllerchange`).
  No swap under a live session; the reload is a clean boundary with matched
  JS + chunks. This is the default because content still updates on reload anyway
  (navigations are network-first), so the only thing gated is the *worker code*.
- **Ambush** (`skipWaiting()` in the SW's install). The new worker activates
  immediately, into open tabs. Choose this only when a patch **must** land
  unconditionally (e.g. a safety/moderation fix that can't wait for a tab left
  open for days — skylite's case), and make the app state-resilient so a
  mid-flight swap can't corrupt in-progress work.
- **Silent/lazy** (do nothing). The update lands on the next visit after all tabs
  close. Fine for a throwaway page; a long-lived open tab can sit on old worker
  code indefinitely.

The default lives in `src/sw.ts` (no `skipWaiting()` in install) + `src/sw-register.ts`
(waiting-worker detection, `applyUpdate`, `checkForUpdate`) + `src/update-toast.ts`
+ the Settings Update control. To switch an app to ambush, add `skipWaiting()`
back to the install handler.

## About + attribution

Every page carries a small **Croft attribution** in the footer (bottom-right), and
the **Settings → About** section names what the app is and links to Croft. The
attribution wording/target is a placeholder (`croft.ing`) pending the brand-name
resolution in the discovery corpus.

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
