# Web behavior testing — the workspace standard

Canonical reasoning doc for the **web-behavior-testing** standard dimension; the
one-screen index is `CroftC/.claude/WEB-TESTING.md`, and this repo is the reference
implementation (as it is for CI — `docs/CI.md`). Scope: how browser-facing behavior is
tested across the workspace's web apps. Every rule carries its why; refine rule and why
together.

## The stack (canonical versions)

- **`@playwright/test`: range `^1.61.1`, resolved `1.61.1`** + **`@axe-core/playwright`
  `^4.12.1`**. **The range is the policy; the lockfile is the pin — and the audit checks
  the RESOLVED version, not the declared range.** *Why both:* a bare `^1.61.1` resolves
  to whatever is newest today (1.62.1 at time of writing), so every repo can declare
  compliance and still run a different Playwright than its siblings — the estate looked
  aligned on paper while `view` and `fun` ran 1.62.0 against everyone else's 1.61.1
  (found 2026-08-26). A newer resolution can also need a browser build that is not in
  the shared cache, which fails on first run or misses in CI.
- **`overrides: { "playwright-core": "1.61.1" }`** — **required** as soon as a repo's
  lockfile resolves more than one `playwright-core` (audit check 15 flags that), and
  worth adding **preventively** in any repo carrying `@axe-core/playwright`, which is
  what produces the duplicate. Carried today by `bluebird`, `fun`, and `view` — the three
  where it actually appeared; `croft-pwa` and `arecipe` have axe-core but currently
  resolve a single copy, so they are compliant without it. *Why:* axe-core pulls its own
  `playwright-core`, which npm hoists to the newest satisfying version while
  `@playwright/test` nests the matching one — two copies whose `Page` types are
  incompatible under `exactOptionalPropertyTypes`, breaking typecheck.
- *Why one version at all:* the two original cohorts (1.49.1/1.61.1) existed by accident
  — drift means a chassis fix or gotcha learned in one repo silently doesn't apply in
  another.
- **Chromium-only in CI** (decision 2026-08-07, recorded in `CroftC/.claude/CI-PATTERN.md`):
  the mobile-fit specs test layout width, not engine differences. `fun`'s
  `mobile-webkit` project (real WebKit + touch) is the deliberate exception, kept
  because games are touch-first.
- Pure logic never needs a browser: unit tests (vitest / `node --test`) for
  model/transforms, hermetic e2e for page wiring, live for real-backend smoke — the
  same split the global TDD discipline prescribes.

## Tiers, and the canonical idiom

| Tier | Where | Runs in CI? | Role |
|---|---|---|---|
| Hermetic e2e | `tests/e2e/`, base `playwright.config.ts` | YES — inside the one gate | The behavior gate: page wiring, a11y (axe, both themes), CSP, mobile-fit/overflow, PWA/offline |
| Live | `tests/live/`, **`playwright.live.config.ts`** | NEVER in push CI | Real-backend smoke, local only — "a smoke check, not a gate" |
| Extension / device harnesses | repo-specific (`e2e:ext`, device runbooks) | headed/local | Where a real service worker, extension origin, or physical device is the point |

**Canonical idiom for new repos: the separate live config** (this repo and skylite).
*Why:* the hermetic/live boundary is structural — a different config and directory —
rather than a `@live` tag a spec could omit, and live-only settings (real network,
ports) have a home. The grep-tag variant (`LIVE=1` + `@live`, arecipe/greetings_site)
is a recorded accepted variant for existing repos; both agree on the invariant that
matters: **live suites never run in push CI** (the audit FLAGs a workflow that invokes
one).

## The chassis (copy from here, not from the last repo you saw)

The base config carries, with these whys:

- `serviceWorkers: 'block'` by default — SW fetches bypass `page.route` mocks, so a
  cached SW can make a mocked test pass against yesterday's build; the PWA spec that
  tests the SW re-enables it deliberately.
- The sandbox-Chromium fallback (`existsSync('/opt/pw-browsers/chromium')` →
  `launchOptions.executablePath`) — containerized environments pin a different browser
  build than npm's Playwright expects; the tell-tale is every test failing at once.
  (arecipe still uses the throwaway `pw-local.config.ts` variant — see its CLAUDE.md;
  prefer the in-config fallback when touching that repo next.)
- A `subpath` project (second server under a prefix path) where the repo deploys PR
  previews — proves relative-path discipline before the preview does.
- `retries: 2` in CI + `trace: 'on-first-retry'` — CI runners give ~2 workers vs ~7
  locally; budget honestly per `docs/CI.md` § "Budgeting a browser suite, honestly"
  (local wall-clock understates CI ~5×; cache browsers, bound the apt install).
- An explicit `webServer` so the gate is one command with no ambient server — the
  stale-reused-server gotcha (smoke fails while csp/mobile-fit pass) is the tell-tale
  documented in this repo's CLAUDE.md.

## Live-run safety (binds every live tier)

Shared accounts/devices are registered in `CroftC/.claude/TESTBED.md` — claim
`testbed--<resource>` before a run. Credentials come from `CroftC/.env`, never
committed, and **never re-fill a filled credential field** (a leak vector arecipe's
live helper guards). Any suite that writes to a PDS carries a **hard test-DID guard**
(arecipe `tests/e2e/helpers/live.ts`: refuse to write/purge unless the resolved DID is
the registered test account). Device-side OAuth legs are driven with Playwright over
the Chrome DevTools socket as throwaway scripts — deliberately not committed (each run's
specifics differ; the pattern is recorded in the croft two-device runbook).

## Behavior discipline (practiced here)

- **Test behavior, not implementation** — the global rule, applied to pages: assert
  what a user sees/does; select by `data-testid`/`data-*`, never structural CSS.
- **Verify the user-visible artifact** — e.g. a share-link test reads the clipboard
  back rather than calling the internal function; "in the nav" and "arrives when
  clicked" are two different claims — assert the one the user experiences.
- **Readiness flags over sleeps** — the app publishes an explicit ready signal the
  harness waits on; racing async states with timeouts is where flakes live.
- **Loud skips, never silent** — an environment that can't run a family prints the
  skip per suite; a silently-skipped browser suite is how 418 "gating" tests turn out
  to run only on one laptop (measured, 2026-08-07 — `docs/CI.md`).
- **The gate must bite** — commit a deliberate violation once to watch it fail
  (CI-PATTERN's rule, doubly true for browser suites).

## Adopt-when-building: the harness patterns (distilled from external prior art, 2026-08-25)

Not yet implemented in any workspace repo — **the first committed browser tier that
fits them (forage's, per its behavior-scale plans) should adopt them** rather than
re-deriving per-test plumbing:

1. **Scenario-declaration harness.** A test names an app state from a small vocabulary
   (e.g. absent / unconfigured / locked / live) plus data fixtures; one composer wires
   server, browser, fakes, and collectors, returning a page-object handle. Tests read
   as workflows, not plumbing.
2. **Two-backend harness + a one-question fitness rule.** The same harness vocabulary
   fronts a fast fake-backend tier and a slow real-backend tier; ONE written question
   decides placement (e.g. "does it need the real service worker / origin?"), and each
   behavior is tested on exactly one side.
3. **Refusal-faithful fakes that import the real policy.** A fake backend imports the
   production allowlist/policy module instead of duplicating it, and reproduces the
   real *failure* answers, not just successes — a fake that answers differently from
   the thing it fakes is a hole in every test that trusts it.
4. **Scenario-scoped ambient-failure collectors.** Every page in a scenario feeds one
   page-error list and one CSP-violation list (separate channels — CSP refusals are
   console messages, not page errors), asserted at scenario close, because regressions
   fire after boot too.
5. **Negative observation channels.** The test server logs every request path so tests
   can assert what the app did NOT fetch; storage probes return store names and key
   counts only, never values — a count answers "was anything stored/cleared?" without
   reading data that may be real.
6. **Validators must have real callers.** A contract checker gets unit tests of its
   edges, a test that runs it against every spec the app actually registers (new
   entries covered by construction), and a smoke asserting the render-time check's
   silence — "a test asserting a control is not evidence of one."

## Maintenance

Versions above are canonical — bump them HERE first, then repos (the drift NOTE is the
reminder). The two audit checks: Playwright-version drift across repos (advisory) and
live-suite-in-CI (violation). Where a new pattern above gets its first implementation,
move it from this section into "practiced here" with the repo named — that is the
adoption ratchet.
