# RUN-PDS-WALKER-06-SUMMARY — G6: the rings page (the library's reference page)

date: 2026-09-08 · plan: `plans/2026-09-08-plan-pds-walker.md` · phases 6a, 6a-ii, 6a-iii, 6b, 6b-ii, 6b-iii ·
branch `claude/pds-walker-g6` · session https://claude.ai/code/session_01HEcsAGKMs6PdtboTFsh1id

## Scope

`rings.html`: a handle in, that account's rings walked live from the data servers —
Mutuals · Follows · Global by default, One hop out · Two hops out behind a native
disclosure — each with a count and an "as of … complete/incomplete" stamp, a Hosts panel
listing what could not be reached, and a live-region progress line. The page imports the
walker through the package's export path and hands it the page's own logger. The one
per-page CSP exception (`connect-src https:`). Gated: hermetic behaviour, axe in both
themes, 320/360/390 px, 44 px targets, the current tab, the page-list sweeps, the standards
index card, a user-guide chapter.

## Red → green evidence

| phase | RED predicted | RED observed | GREEN |
|---|---|---|---|
| 6a | `Expected: 200 … Received: 404` | verbatim; then a runtime throw (`reading 'expires'`) until `page_rings` was registered | the smoke case: 200, h1, five cards (three visible), closed disclosure, empty hosts state, zero off-site requests |
| 6a-ii | csp.spec `/rings.html`: `Expected substring: "https:"` | verbatim (13th row; the other twelve rows the guard) | `cspFor(page)`; one `dist/*.html` line ends in `https:` |
| 6a-iii | `toHaveText … Received string: "—"` | both behaviour cases timed out on the placeholder | counts, "as of", hop2 growth, the 502 host listed, one `[croft]` warn, no DID without `?debug=1`, the DID at debug with it |
| 6b | the current-tab case | verbatim (`Expected: "Standards"`) | nav `active` list; guide chapter `guide-rings` |
| 6b-ii | the sweeps fail on a deliberate break | break 1 (400px card + surface-coloured text): overflow rows failed at 320/360/390 — the axe rows did **not**; break 2 (`<img>` without alt): `image-alt (critical) × 1` in both themes | both restored (`git diff` empty); a11y +2 rows, mobile-fit +3 rows |
| 6b-iii | `Expected: 8 Received: 7` | verbatim | the CHAPTERS card |

Bundle: `rings` **8.6 KB gz** (budget 20 KB); the atproto page is 11.3 KB for comparison.

## Broad validation — the built page against the real network (6a-iii (a))

Served from `dist/` on localhost, driven headless, `bsky.app` entered (it follows accounts
hosted on `losers.club` and `pds.pckt.cafe`, both off `bsky.network` — the reason 6a-ii
exists):

```
mut: 12 — as of 7:57:17 PM · complete
fol: 14 — as of 7:57:17 PM · complete
hop: 2626 — as of 7:57:17 PM · complete
hop2: 2630 — as of 7:57:17 PM · complete
hosts panel: Hosts |  | 14 reached.
off-bsky hosts reached: losers.club pds.pckt.cafe
CSP violations: 0 · failed requests: 0 · console lines with did: 0
```

(b) a handle whose PDS is down: not walked live — no stable such handle to hand; the routed
502 case in `rings.spec.ts` is the evidence for that shape. (c) the PR-preview run: see the
ledger below, filled at landing.

## The gate (full output of the last run, `npm test` at the branch tip)

```

> croft-pwa@0.1.0 test
> npm run build:lib && npm run lint && npm run typecheck && npm run unit && npm run build && npm run e2e


> croft-pwa@0.1.0 build:lib
> tsc -p tsconfig.lib.json


> croft-pwa@0.1.0 lint
> eslint .


/Users/cpettet/git/chasemp/CroftC/worktrees/pds-walker/croft-pwa/.stryker-tmp/sandbox-9AqIZu/stryker-setup-2.js
  24:9  warning  Unused eslint-disable directive (no problems were reported from 'no-empty-pattern')
  46:9  warning  Unused eslint-disable directive (no problems were reported from 'no-empty-pattern')

/Users/cpettet/git/chasemp/CroftC/worktrees/pds-walker/croft-pwa/.stryker-tmp/sandbox-9AqIZu/stryker-setup-3.js
  24:9  warning  Unused eslint-disable directive (no problems were reported from 'no-empty-pattern')
  46:9  warning  Unused eslint-disable directive (no problems were reported from 'no-empty-pattern')

/Users/cpettet/git/chasemp/CroftC/worktrees/pds-walker/croft-pwa/.stryker-tmp/sandbox-9AqIZu/tools/guide-shots.mjs
  50:9  warning  Unused eslint-disable directive (no problems were reported from 'no-undef')

✖ 5 problems (0 errors, 5 warnings)
  0 errors and 5 warnings potentially fixable with the `--fix` option.


> croft-pwa@0.1.0 typecheck
> tsc --noEmit


> croft-pwa@0.1.0 unit
> vitest run


 RUN  v2.1.9 /Users/cpettet/git/chasemp/CroftC/worktrees/pds-walker/croft-pwa

 ✓ tests/unit/atproto-read.test.ts (9 tests) 5ms
 ✓ tests/unit/oauth-resolve.test.ts (9 tests) 7ms
 ✓ tests/unit/bridge.test.ts (7 tests) 4ms
 ✓ tests/unit/signin-providers.test.ts (11 tests) 3ms
 ✓ tests/unit/oauth-crypto.test.ts (7 tests) 8ms
 ✓ tests/unit/oauth-writes.test.ts (4 tests) 9ms
 ✓ tests/unit/pds-walker-resolve.test.ts (7 tests) 4ms
 ✓ tests/unit/pds-walker-transport.test.ts (5 tests) 5ms
 ✓ tests/unit/pds-walker-pds.test.ts (11 tests) 6ms
 ✓ tests/unit/pds-walker-walker.test.ts (17 tests) 9ms
 ✓ tests/unit/pds-walker-rings.test.ts (7 tests) 20ms
 ✓ tests/unit/oauth-client.test.ts (13 tests) 30ms
 ✓ tests/unit/pds-walker-limiter.test.ts (13 tests) 42ms
 ✓ tests/unit/pds-walker-cadence.test.ts (6 tests) 2ms
 ✓ tests/unit/measure-store.test.ts (7 tests) 5ms
 ✓ tests/unit/pds-walker-store.test.ts (4 tests) 3ms
 ✓ tests/unit/brand-tokens.test.ts (16 tests) 2ms
 ✓ tests/unit/guide-content.test.ts (4 tests) 2ms
 ✓ tests/unit/sealedbox.test.ts (5 tests) 16ms
 ✓ tests/unit/pds-walker-revgate.test.ts (5 tests) 2ms
 ✓ tests/unit/measure-registry.test.ts (5 tests) 3ms
 ✓ tests/unit/sw-nav.test.ts (5 tests) 1ms
 ✓ tests/unit/tid.test.ts (5 tests) 2ms
 ✓ tests/unit/brand-nohex.test.ts (2 tests) 2ms
 ✓ tests/unit/theme.test.ts (3 tests) 1ms
 ✓ tests/unit/vault.test.ts (4 tests) 260ms
 ✓ tests/unit/feed-parse.test.ts (5 tests) 9ms

> croft-pwa@0.1.0 prepare
> npm run build:lib


> croft-pwa@0.1.0 build:lib
> tsc -p tsconfig.lib.json

 ✓ tests/unit/pds-walker-export.test.ts (3 tests) 917ms
   ✓ croft-pwa/pds-walker — the export path > packs only the built library plus package.json, README and LICENSE 853ms

 Test Files  28 passed (28)
      Tests  199 passed (199)
   Start at  19:59:10
   Duration  1.54s (transform 376ms, setup 0ms, collect 939ms, tests 1.38s, environment 497ms, prepare 2.11s)


> croft-pwa@0.1.0 build
> node build.mjs

sizes(gz): index 4.0K · settings 4.0K · user-guide 6.0K · reference 4.3K · chassis 5.0K · brand 4.6K · pwa 4.6K · agent-method 4.6K · metrics 4.7K · atproto 11.3K · rings 8.6K · content-fetch 5.5K · reader 5.4K · styles.css 4.4K
built v0 0.1.0+4e4c56e -> dist/  (13 pages, sw + precache 30, CSP+SRI on, budget ok)

> croft-pwa@0.1.0 e2e
> playwright test


Running 121 tests using 7 workers

  ✓    3 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /reader.html (light) — no serious/critical violations (954ms)
  ✓    4 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /index.html (light) — no serious/critical violations (995ms)
  ✓    2 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /index.html (dark) — no serious/critical violations (1.0s)
  ✓    6 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /reference.html (light) — no serious/critical violations (1.0s)
  ✓    7 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /reader.html (dark) — no serious/critical violations (1.0s)
  ✓    1 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /user-guide.html (dark) — no serious/critical violations (1.1s)
  ✓    5 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /user-guide.html (light) — no serious/critical violations (1.1s)
  ✓    8 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /reference.html (dark) — no serious/critical violations (884ms)
  ✓   11 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /brand.html (light) — no serious/critical violations (857ms)
  ✓   12 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /brand.html (dark) — no serious/critical violations (863ms)
  ✓   10 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /chassis.html (dark) — no serious/critical violations (904ms)
  ✓    9 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /chassis.html (light) — no serious/critical violations (911ms)
  ✓   14 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /pwa.html (dark) — no serious/critical violations (834ms)
  ✓   13 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /pwa.html (light) — no serious/critical violations (850ms)
  ✓   15 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /agent-method.html (light) — no serious/critical violations (860ms)
  ✓   16 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /agent-method.html (dark) — no serious/critical violations (850ms)
  ✓   17 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /content-fetch.html (light) — no serious/critical violations (841ms)
  ✓   18 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /content-fetch.html (dark) — no serious/critical violations (838ms)
  ✓   21 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /atproto.html (light) — no serious/critical violations (834ms)
  ✓   19 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /metrics.html (light) — no serious/critical violations (859ms)
  ✓   20 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /metrics.html (dark) — no serious/critical violations (865ms)
  ✓   28 [chromium] › tests/e2e/atproto.spec.ts:33:1 › sealed-box demo seals a message and opens it (real WebCrypto) (101ms)
  ✓   27 [chromium] › tests/e2e/atproto.spec.ts:5:1 › atproto demo resolves a handle and shows DID/PDS/profile (196ms)
  ✓   29 [chromium] › tests/e2e/atproto.spec.ts:42:1 › atproto demo shows a friendly error when resolution fails (110ms)
  ✓   31 [chromium] › tests/e2e/atproto.spec.ts:122:3 › OAuth sign-in (PKCE + PAR + DPoP) › a normal load is not treated as a callback (69ms)
  ✓   32 [chromium] › tests/e2e/atproto.spec.ts:128:3 › OAuth sign-in (PKCE + PAR + DPoP) › the write demo asks you to sign in first (81ms)
  ✓   30 [chromium] › tests/e2e/atproto.spec.ts:61:3 › OAuth sign-in (PKCE + PAR + DPoP) › signs in with a handle and completes the token exchange (218ms)
  ✓   33 [chromium] › tests/e2e/atproto.spec.ts:135:1 › vault demo wraps a key behind a passphrase and unlocks it (real WebCrypto) (259ms)
  ✓   22 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /atproto.html (dark) — no serious/critical violations (822ms)
  ✓   23 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /rings.html (light) — no serious/critical violations (819ms)
  ✓   24 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /rings.html (dark) — no serious/critical violations (818ms)
  ✓   25 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /settings.html (light) — no serious/critical violations (806ms)
  ✓   26 [chromium] › tests/e2e/a11y.spec.ts:30:5 › a11y: /settings.html (dark) — no serious/critical violations (798ms)
  ✓   34 [chromium] › tests/e2e/csp.spec.ts:20:3 › /index.html: no CSP violations, no cross-origin scripts (556ms)
  ✓   35 [chromium] › tests/e2e/csp.spec.ts:20:3 › /settings.html: no CSP violations, no cross-origin scripts (567ms)
  ✓   36 [chromium] › tests/e2e/csp.spec.ts:20:3 › /reader.html: no CSP violations, no cross-origin scripts (562ms)
  ✓   38 [chromium] › tests/e2e/csp.spec.ts:20:3 › /reference.html: no CSP violations, no cross-origin scripts (554ms)
  ✓   40 [chromium] › tests/e2e/csp.spec.ts:20:3 › /brand.html: no CSP violations, no cross-origin scripts (586ms)
  ✓   39 [chromium] › tests/e2e/csp.spec.ts:20:3 › /chassis.html: no CSP violations, no cross-origin scripts (602ms)
  ✓   37 [chromium] › tests/e2e/csp.spec.ts:20:3 › /user-guide.html: no CSP violations, no cross-origin scripts (616ms)
  ✓   47 [chromium] › tests/e2e/metrics.spec.ts:3:1 › metrics page shows the registry, local counts, and the wire preview (87ms)
  ✓   41 [chromium] › tests/e2e/csp.spec.ts:20:3 › /pwa.html: no CSP violations, no cross-origin scripts (556ms)
  ✓   48 [chromium] › tests/e2e/metrics.spec.ts:25:1 › sharing consent is opt-in, persists, and defaults off (126ms)
  ✓   49 [chromium] › tests/e2e/metrics.spec.ts:35:1 › a flush writes the payload to the console and nothing else leaves (79ms)
  ✓   50 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /index.html at 320px (73ms)
  ✓   51 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /settings.html at 320px (58ms)
  ✓   52 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /reader.html at 320px (63ms)
  ✓   53 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /user-guide.html at 320px (62ms)
  ✓   42 [chromium] › tests/e2e/csp.spec.ts:20:3 › /agent-method.html: no CSP violations, no cross-origin scripts (567ms)
  ✓   54 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /reference.html at 320px (82ms)
  ✓   55 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /chassis.html at 320px (80ms)
  ✓   56 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /brand.html at 320px (66ms)
  ✓   43 [chromium] › tests/e2e/csp.spec.ts:20:3 › /content-fetch.html: no CSP violations, no cross-origin scripts (556ms)
  ✓   44 [chromium] › tests/e2e/csp.spec.ts:20:3 › /metrics.html: no CSP violations, no cross-origin scripts (561ms)
  ✓   45 [chromium] › tests/e2e/csp.spec.ts:20:3 › /atproto.html: no CSP violations, no cross-origin scripts (553ms)
  ✓   46 [chromium] › tests/e2e/csp.spec.ts:20:3 › /rings.html: no CSP violations, no cross-origin scripts (554ms)
  ✓   57 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /pwa.html at 320px (117ms)
  ✓   60 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /atproto.html at 320px (75ms)
  ✓   59 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /metrics.html at 320px (87ms)
  ✓   58 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /agent-method.html at 320px (119ms)
  ✓   61 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /rings.html at 320px (66ms)
  ✓   68 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /brand.html at 360px (131ms)
  ✓   63 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /settings.html at 360px (159ms)
  ✓   67 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /chassis.html at 360px (139ms)
  ✓   62 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /index.html at 360px (161ms)
  ✓   65 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /user-guide.html at 360px (140ms)
  ✓   64 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /reader.html at 360px (142ms)
  ✓   66 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /reference.html at 360px (142ms)
  ✓   71 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /metrics.html at 360px (143ms)
  ✓   75 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /index.html at 390px (142ms)
  ✓   73 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /rings.html at 360px (142ms)
  ✓   74 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /settings.html at 390px (141ms)
  ✓   70 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /agent-method.html at 360px (143ms)
  ✓   72 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /atproto.html at 360px (146ms)
  ✓   69 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /pwa.html at 360px (149ms)
  ✓   77 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /reader.html at 390px (142ms)
  ✓   76 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /user-guide.html at 390px (146ms)
  ✓   79 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /chassis.html at 390px (146ms)
  ✓   81 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /pwa.html at 390px (144ms)
  ✓   82 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /agent-method.html at 390px (143ms)
  ✓   78 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /reference.html at 390px (148ms)
  ✓   80 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /brand.html at 390px (147ms)
  ✓   84 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /atproto.html at 390px (147ms)
  ✓   85 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /rings.html at 390px (147ms)
  ✓   83 [chromium] › tests/e2e/mobile-fit.spec.ts:20:5 › no horizontal overflow: /metrics.html at 390px (147ms)
  ✓   89 [chromium] › tests/e2e/pds-walker-store.spec.ts:32:1 › indexedDbStore: put/get/all round-trip, keyed by did, keeps the newer, survives a reload (188ms)
  ✓   87 [chromium] › tests/e2e/rings.spec.ts:104:3 › rings.html — the page walks (6a-iii) › with ?debug=1 the library's debug line carries the walked DID (the only place a DID is printed) (255ms)
  ✓   93 [chromium] › tests/e2e/rings.spec.ts:141:3 › rings.html — gated (6b) › the Standards tab is current on this page (68ms)
  ✓   91 [chromium] › tests/e2e/rings.spec.ts:131:3 › rings.html — gated (6b) › at 390 px: no horizontal overflow, and the disclosure summary and the Walk button are ≥ 44 px tall (124ms)
  ✓   86 [chromium] › tests/e2e/rings.spec.ts:77:3 › rings.html — the page walks (6a-iii) › given a handle, the default rings fill with counts and "as of"; hop2 grows; an unreachable host is listed, not counted as empty (292ms)
  ✓   96 [chromium] › tests/e2e/signin-sheet.spec.ts:40:1 › the registry carries both postures, or this spec proves nothing (39ms)
  ✓   94 [chromium] › tests/e2e/settings.spec.ts:3:1 › settings shows an Update control, About, and the Croft attribution (108ms)
  ✓   95 [chromium] › tests/e2e/settings.spec.ts:21:1 › every page carries the Croft attribution in the footer (122ms)
  ✓   97 [chromium] › tests/e2e/signin-sheet.spec.ts:45:1 › closed until asked; the trigger opens a native dialog titled for an atmo provider (148ms)
  ✓   98 [chromium] › tests/e2e/signin-sheet.spec.ts:57:1 › front page = open providers with Create + Sign in; invite-only sit behind Another provider (141ms)
  ✓   99 [chromium] › tests/e2e/signin-sheet.spec.ts:80:1 › fits the narrowest phone: no sideways scroll at 320px and every control ≥44px (169ms)
  ✓   88 [chromium] › tests/e2e/rings.spec.ts:8:3 › rings.html — the shell (6a) › serves, renders five ring cards (three shown, two behind a closed disclosure), an empty hosts panel, and touches no network (562ms)
  ✓  102 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › bsky: Sign in clears the CSP and reaches PAR at https://bsky.social (153ms)
  ✓  103 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › blacksky: Sign in clears the CSP and reaches PAR at https://blacksky.app (168ms)
  ✓  104 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › eurosky: Sign in clears the CSP and reaches PAR at https://eurosky.social (168ms)
  ✓  100 [chromium] › tests/e2e/signin-sheet.spec.ts:101:3 › a11y: the OPEN sheet has no serious/critical violations (light) (403ms)
  ✓  105 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › northsky: Sign in clears the CSP and reaches PAR at https://northsky.social (191ms)
  ✓  101 [chromium] › tests/e2e/signin-sheet.spec.ts:101:3 › a11y: the OPEN sheet has no serious/critical violations (dark) (391ms)
  ✓  108 [chromium] › tests/e2e/signin-sheet.spec.ts:199:1 › the four probed providers are in the registry (51ms)
  ✓  109 [chromium] › tests/e2e/smoke.spec.ts:3:1 › home renders the shell, wordmark, and build stamp (100ms)
  ✓  107 [chromium] › tests/e2e/signin-sheet.spec.ts:185:1 › a handle on any other provider reaches the same seam, leading @ stripped (187ms)
  ✓  110 [chromium] › tests/e2e/smoke.spec.ts:10:1 › tabs navigate to settings (real link, real document) (102ms)
  ✓  111 [chromium] › tests/e2e/smoke.spec.ts:17:1 › theme toggle flips the document theme (110ms)
  ✓  115 [chromium] › tests/e2e/standards.spec.ts:32:3 › chapter pwa.html renders its heading, entries, and TOC (84ms)
  ✓  114 [chromium] › tests/e2e/standards.spec.ts:32:3 › chapter brand.html renders its heading, entries, and TOC (120ms)
  ✓  113 [chromium] › tests/e2e/standards.spec.ts:32:3 › chapter chassis.html renders its heading, entries, and TOC (146ms)
  ✓   90 [chromium] › tests/e2e/rings.spec.ts:121:5 › rings.html — gated (6b) › a11y (dark): no serious/critical axe violations, hermetically (943ms)
  ✓   92 [chromium] › tests/e2e/rings.spec.ts:121:5 › rings.html — gated (6b) › a11y (light): no serious/critical axe violations, hermetically (943ms)
  ✓  112 [chromium] › tests/e2e/standards.spec.ts:21:1 › the standards index links to every chapter (161ms)
  ✓  106 [chromium] › tests/e2e/signin-sheet.spec.ts:167:1 › Create account starts OAuth at that provider in the CREATE intent; Sign in sends no prompt (452ms)
  ✓  116 [chromium] › tests/e2e/standards.spec.ts:32:3 › chapter agent-method.html renders its heading, entries, and TOC (117ms)
  ✓  117 [chromium] › tests/e2e/standards.spec.ts:32:3 › chapter content-fetch.html renders its heading, entries, and TOC (117ms)
  ✓  119 [chromium] › tests/e2e/user-guide.spec.ts:23:1 › guide screenshots load (not broken references) (120ms)
  ✓  118 [chromium] › tests/e2e/user-guide.spec.ts:3:1 › the guide renders every entry, and the TOC links to each (140ms)
  ✓  120 [subpath] › tests/e2e/subpath.spec.ts:6:1 › renders under a subpath with no failed requests (587ms)
  ✓  121 [subpath] › tests/e2e/subpath.spec.ts:17:1 › relative nav stays within the subpath (654ms)

  121 passed (9.3s)
```

Counts: 28 unit files / 199 tests; 121 e2e; exit 0.

## Files touched

| file | new / changed | phase |
|---|---|---|
| `rings.html`, `src/pages/rings.ts` | new | 6a, 6a-iii |
| `build.mjs` | changed (PAGES entry; `cspFor(page)`) | 6a, 6a-ii |
| `styles.css` | changed (ring classes) | 6a |
| `src/measure/registry.ts` | changed (`page_rings`) | 6a |
| `tests/e2e/rings.spec.ts` | new (smoke, behaviour, gating halves) | 6a, 6a-iii, 6b |
| `tests/e2e/csp.spec.ts` | changed (list + both-direction connect-src assertion) | 6a-ii |
| `docs/SECURITY.md`, `docs/ATPROTO.md` | changed (the exception) | 6a-ii, 6a-iii |
| `src/nav.ts`, `src/pages/guide-content.ts` | changed | 6b |
| `tests/e2e/a11y.spec.ts`, `tests/e2e/mobile-fit.spec.ts` | changed (list) | 6b-ii |
| `src/pages/reference.ts`, `tests/e2e/standards.spec.ts` | changed | 6b-iii |
| `CHANGELOG.md`, `plans/…`, this file | changed / new | landing |

## Verify-in-run ledger

- The deliberate-break outputs above (6b-ii); both breaks restored before any commit.
- The real-network run above (6a-iii (a)).
- PR preview (6a-iii (c)): filled after the PR's preview deploys — see the addendum at the end of this file.
