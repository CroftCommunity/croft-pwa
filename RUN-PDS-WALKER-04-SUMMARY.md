# RUN-PDS-WALKER-04-SUMMARY — G4: the store (memory and IndexedDB)

date: 2026-09-08 · plan: `plans/2026-09-08-plan-pds-walker.md` · phases 4a, 4b ·
branch `claude/pds-walker-g4` · session https://claude.ai/code/session_01HEcsAGKMs6PdtboTFsh1id

## Scope

The persistence seam (`Store { get, put, all }`), `memoryStore()` for tests and Node, and
`indexedDbStore(name)` for the browser — proven in a real Chromium, not a fake.

## Red → green evidence

| phase | RED predicted | RED observed | GREEN |
|---|---|---|---|
| 4a | `… 'memoryStore'` | `memoryStore is not a function` | 4 tests: round-trip, keeps-the-newer (older never overwrites; equal wins), copies, isolation between stores |
| 4b | esbuild in the spec: `No matching export in "lib/pds-walker/index.js" for import "indexedDbStore"` | verbatim | the spec: put/get/all keyed by did, keeps the newer, survives `page.reload()`, a second database name sees nothing, no `[croft]` console error |

The 4b mechanism, as Pass 2 designed it: the driver is bundled inside the spec with the
esbuild API (resolving `croft-pwa/pds-walker` through package exports), served by
`page.route('**/pds-walker-driver.js')` at a same-origin URL that the page's
`script-src 'self'` admits, and loaded with `addScriptTag({ url, type: 'module' })`. No
`bypassCSP`, nothing written to `dist/`, no network.

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

 ✓ tests/unit/oauth-resolve.test.ts (9 tests) 9ms
 ✓ tests/unit/oauth-crypto.test.ts (7 tests) 12ms
 ✓ tests/unit/atproto-read.test.ts (9 tests) 7ms
 ✓ tests/unit/oauth-client.test.ts (13 tests) 31ms
 ✓ tests/unit/bridge.test.ts (7 tests) 5ms
 ✓ tests/unit/pds-walker-cadence.test.ts (6 tests) 2ms
 ✓ tests/unit/pds-walker-resolve.test.ts (7 tests) 4ms
 ✓ tests/unit/pds-walker-transport.test.ts (5 tests) 7ms
 ✓ tests/unit/pds-walker-pds.test.ts (11 tests) 7ms
 ✓ tests/unit/oauth-writes.test.ts (4 tests) 25ms
 ✓ tests/unit/signin-providers.test.ts (11 tests) 5ms
 ✓ tests/unit/pds-walker-rings.test.ts (7 tests) 28ms
 ✓ tests/unit/pds-walker-limiter.test.ts (13 tests) 46ms
 ✓ tests/unit/measure-store.test.ts (7 tests) 3ms
 ✓ tests/unit/pds-walker-store.test.ts (4 tests) 3ms
 ✓ tests/unit/brand-tokens.test.ts (16 tests) 3ms
 ✓ tests/unit/guide-content.test.ts (4 tests) 2ms
 ✓ tests/unit/measure-registry.test.ts (5 tests) 3ms
 ✓ tests/unit/pds-walker-revgate.test.ts (5 tests) 2ms
 ✓ tests/unit/sealedbox.test.ts (5 tests) 16ms
 ✓ tests/unit/sw-nav.test.ts (5 tests) 2ms
 ✓ tests/unit/tid.test.ts (5 tests) 2ms
 ✓ tests/unit/brand-nohex.test.ts (2 tests) 4ms
 ✓ tests/unit/theme.test.ts (3 tests) 3ms
 ✓ tests/unit/vault.test.ts (4 tests) 319ms
 ✓ tests/unit/feed-parse.test.ts (5 tests) 9ms

> croft-pwa@0.1.0 prepare
> npm run build:lib


> croft-pwa@0.1.0 build:lib
> tsc -p tsconfig.lib.json

 ✓ tests/unit/pds-walker-export.test.ts (2 tests) 1128ms
   ✓ croft-pwa/pds-walker — the export path > packs only the built library plus package.json, README and LICENSE 1115ms

 Test Files  27 passed (27)
      Tests  181 passed (181)
   Start at  19:31:43
   Duration  1.94s (transform 546ms, setup 0ms, collect 1.32s, tests 1.69s, environment 566ms, prepare 2.89s)


> croft-pwa@0.1.0 build
> node build.mjs

sizes(gz): index 4.0K · settings 4.0K · user-guide 5.4K · reference 4.2K · chassis 4.9K · brand 4.6K · pwa 4.5K · agent-method 4.6K · metrics 4.7K · atproto 11.2K · content-fetch 5.4K · reader 5.4K · styles.css 4.1K
built v0 0.1.0+9ab89e7 -> dist/  (12 pages, sw + precache 28, CSP+SRI on, budget ok)

> croft-pwa@0.1.0 e2e
> playwright test


Running 108 tests using 7 workers

  ✓    7 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reader.html (dark) — no serious/critical violations (1.0s)
  ✓    1 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /index.html (light) — no serious/critical violations (1.1s)
  ✓    2 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /index.html (dark) — no serious/critical violations (1.1s)
  ✓    6 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reader.html (light) — no serious/critical violations (1.1s)
  ✓    4 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reference.html (light) — no serious/critical violations (1.1s)
  ✓    5 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /user-guide.html (light) — no serious/critical violations (1.2s)
  ✓    3 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /user-guide.html (dark) — no serious/critical violations (1.2s)
  ✓    8 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reference.html (dark) — no serious/critical violations (893ms)
  ✓   10 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /chassis.html (dark) — no serious/critical violations (912ms)
  ✓   11 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /brand.html (light) — no serious/critical violations (923ms)
  ✓    9 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /chassis.html (light) — no serious/critical violations (941ms)
  ✓   13 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /pwa.html (light) — no serious/critical violations (852ms)
  ✓   14 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /pwa.html (dark) — no serious/critical violations (861ms)
  ✓   12 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /brand.html (dark) — no serious/critical violations (939ms)
  ✓   15 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /agent-method.html (light) — no serious/critical violations (885ms)
  ✓   16 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /agent-method.html (dark) — no serious/critical violations (870ms)
  ✓   17 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /content-fetch.html (light) — no serious/critical violations (879ms)
  ✓   18 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /content-fetch.html (dark) — no serious/critical violations (866ms)
  ✓   19 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /metrics.html (light) — no serious/critical violations (891ms)
  ✓   20 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /metrics.html (dark) — no serious/critical violations (888ms)
  ✓   21 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /atproto.html (light) — no serious/critical violations (903ms)
  ✓   26 [chromium] › tests/e2e/atproto.spec.ts:33:1 › sealed-box demo seals a message and opens it (real WebCrypto) (211ms)
  ✓   27 [chromium] › tests/e2e/atproto.spec.ts:42:1 › atproto demo shows a friendly error when resolution fails (200ms)
  ✓   25 [chromium] › tests/e2e/atproto.spec.ts:5:1 › atproto demo resolves a handle and shows DID/PDS/profile (254ms)
  ✓   29 [chromium] › tests/e2e/atproto.spec.ts:122:3 › OAuth sign-in (PKCE + PAR + DPoP) › a normal load is not treated as a callback (105ms)
  ✓   28 [chromium] › tests/e2e/atproto.spec.ts:61:3 › OAuth sign-in (PKCE + PAR + DPoP) › signs in with a handle and completes the token exchange (301ms)
  ✓   30 [chromium] › tests/e2e/atproto.spec.ts:128:3 › OAuth sign-in (PKCE + PAR + DPoP) › the write demo asks you to sign in first (118ms)
  ✓   31 [chromium] › tests/e2e/atproto.spec.ts:135:1 › vault demo wraps a key behind a passphrase and unlocks it (real WebCrypto) (311ms)
  ✓   22 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /atproto.html (dark) — no serious/critical violations (837ms)
  ✓   23 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /settings.html (light) — no serious/critical violations (820ms)
  ✓   24 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /settings.html (dark) — no serious/critical violations (805ms)
  ✓   32 [chromium] › tests/e2e/csp.spec.ts:19:3 › /index.html: no CSP violations, no cross-origin scripts (563ms)
  ✓   33 [chromium] › tests/e2e/csp.spec.ts:19:3 › /settings.html: no CSP violations, no cross-origin scripts (557ms)
  ✓   34 [chromium] › tests/e2e/csp.spec.ts:19:3 › /reader.html: no CSP violations, no cross-origin scripts (557ms)
  ✓   35 [chromium] › tests/e2e/csp.spec.ts:19:3 › /user-guide.html: no CSP violations, no cross-origin scripts (577ms)
  ✓   36 [chromium] › tests/e2e/csp.spec.ts:19:3 › /reference.html: no CSP violations, no cross-origin scripts (552ms)
  ✓   37 [chromium] › tests/e2e/csp.spec.ts:19:3 › /chassis.html: no CSP violations, no cross-origin scripts (578ms)
  ✓   38 [chromium] › tests/e2e/csp.spec.ts:19:3 › /brand.html: no CSP violations, no cross-origin scripts (571ms)
  ✓   44 [chromium] › tests/e2e/metrics.spec.ts:3:1 › metrics page shows the registry, local counts, and the wire preview (88ms)
  ✓   39 [chromium] › tests/e2e/csp.spec.ts:19:3 › /pwa.html: no CSP violations, no cross-origin scripts (557ms)
  ✓   40 [chromium] › tests/e2e/csp.spec.ts:19:3 › /agent-method.html: no CSP violations, no cross-origin scripts (562ms)
  ✓   41 [chromium] › tests/e2e/csp.spec.ts:19:3 › /content-fetch.html: no CSP violations, no cross-origin scripts (556ms)
  ✓   45 [chromium] › tests/e2e/metrics.spec.ts:25:1 › sharing consent is opt-in, persists, and defaults off (150ms)
  ✓   48 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 320px (76ms)
  ✓   47 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 320px (86ms)
  ✓   49 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 320px (75ms)
  ✓   46 [chromium] › tests/e2e/metrics.spec.ts:35:1 › a flush writes the payload to the console and nothing else leaves (156ms)
  ✓   50 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 320px (115ms)
  ✓   53 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 320px (87ms)
  ✓   52 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 320px (87ms)
  ✓   51 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 320px (88ms)
  ✓   42 [chromium] › tests/e2e/csp.spec.ts:19:3 › /metrics.html: no CSP violations, no cross-origin scripts (553ms)
  ✓   54 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 320px (146ms)
  ✓   55 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 320px (119ms)
  ✓   56 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 320px (120ms)
  ✓   59 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 360px (64ms)
  ✓   57 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 320px (121ms)
  ✓   58 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 360px (121ms)
  ✓   43 [chromium] › tests/e2e/csp.spec.ts:19:3 › /atproto.html: no CSP violations, no cross-origin scripts (556ms)
  ✓   62 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 360px (137ms)
  ✓   60 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 360px (138ms)
  ✓   61 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 360px (138ms)
  ✓   63 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 360px (138ms)
  ✓   64 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 360px (140ms)
  ✓   65 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 360px (138ms)
  ✓   66 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 360px (174ms)
  ✓   72 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 390px (132ms)
  ✓   71 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 390px (137ms)
  ✓   67 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 360px (143ms)
  ✓   68 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 360px (144ms)
  ✓   69 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 390px (145ms)
  ✓   70 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 390px (142ms)
  ✓   74 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 390px (161ms)
  ✓   77 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 390px (159ms)
  ✓   76 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 390px (161ms)
  ✓   75 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 390px (163ms)
  ✓   73 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 390px (164ms)
  ✓   78 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 390px (162ms)
  ✓   79 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 390px (160ms)
  ✓   82 [chromium] › tests/e2e/signin-sheet.spec.ts:40:1 › the registry carries both postures, or this spec proves nothing (80ms)
  ✓   81 [chromium] › tests/e2e/settings.spec.ts:3:1 › settings shows an Update control, About, and the Croft attribution (192ms)
  ✓   80 [chromium] › tests/e2e/settings.spec.ts:21:1 › every page carries the Croft attribution in the footer (234ms)
  ✓   85 [chromium] › tests/e2e/pds-walker-store.spec.ts:32:1 › indexedDbStore: put/get/all round-trip, keyed by did, keeps the newer, survives a reload (227ms)
  ✓   83 [chromium] › tests/e2e/signin-sheet.spec.ts:80:1 › fits the narrowest phone: no sideways scroll at 320px and every control ≥44px (306ms)
  ✓   86 [chromium] › tests/e2e/signin-sheet.spec.ts:45:1 › closed until asked; the trigger opens a native dialog titled for an atmo provider (322ms)
  ✓   84 [chromium] › tests/e2e/signin-sheet.spec.ts:57:1 › front page = open providers with Create + Sign in; invite-only sit behind Another provider (327ms)
  ✓   90 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › blacksky: Sign in clears the CSP and reaches PAR at https://blacksky.app (215ms)
  ✓   89 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › bsky: Sign in clears the CSP and reaches PAR at https://bsky.social (217ms)
  ✓   95 [chromium] › tests/e2e/signin-sheet.spec.ts:199:1 › the four probed providers are in the registry (46ms)
  ✓   91 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › eurosky: Sign in clears the CSP and reaches PAR at https://eurosky.social (236ms)
  ✓   93 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › northsky: Sign in clears the CSP and reaches PAR at https://northsky.social (254ms)
  ✓   87 [chromium] › tests/e2e/signin-sheet.spec.ts:101:3 › a11y: the OPEN sheet has no serious/critical violations (light) (509ms)
  ✓   96 [chromium] › tests/e2e/smoke.spec.ts:3:1 › home renders the shell, wordmark, and build stamp (103ms)
  ✓   94 [chromium] › tests/e2e/signin-sheet.spec.ts:185:1 › a handle on any other provider reaches the same seam, leading @ stripped (265ms)
  ✓   88 [chromium] › tests/e2e/signin-sheet.spec.ts:101:3 › a11y: the OPEN sheet has no serious/critical violations (dark) (526ms)
  ✓  100 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter chassis.html renders its heading, entries, and TOC (97ms)
  ✓   98 [chromium] › tests/e2e/smoke.spec.ts:17:1 › theme toggle flips the document theme (152ms)
  ✓   99 [chromium] › tests/e2e/standards.spec.ts:20:1 › the standards index links to every chapter (145ms)
  ✓   97 [chromium] › tests/e2e/smoke.spec.ts:10:1 › tabs navigate to settings (real link, real document) (248ms)
  ✓   92 [chromium] › tests/e2e/signin-sheet.spec.ts:167:1 › Create account starts OAuth at that provider in the CREATE intent; Sign in sends no prompt (512ms)
  ✓  103 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter agent-method.html renders its heading, entries, and TOC (171ms)
  ✓  101 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter brand.html renders its heading, entries, and TOC (181ms)
  ✓  102 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter pwa.html renders its heading, entries, and TOC (176ms)
  ✓  104 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter content-fetch.html renders its heading, entries, and TOC (158ms)
  ✓  106 [chromium] › tests/e2e/user-guide.spec.ts:23:1 › guide screenshots load (not broken references) (109ms)
  ✓  105 [chromium] › tests/e2e/user-guide.spec.ts:3:1 › the guide renders every entry, and the TOC links to each (189ms)
  ✓  107 [subpath] › tests/e2e/subpath.spec.ts:6:1 › renders under a subpath with no failed requests (590ms)
  ✓  108 [subpath] › tests/e2e/subpath.spec.ts:17:1 › relative nav stays within the subpath (641ms)

  108 passed (9.1s)
```

Counts: 27 unit files / 181 tests; 108 e2e (one new); exit 0.

## Files touched

| file | new / changed | phase |
|---|---|---|
| `src/pds-walker/store/memory.ts` | new | 4a |
| `src/pds-walker/store/indexeddb.ts` | new | 4b |
| `src/pds-walker/index.ts` | changed (re-exports) | 4a, 4b |
| `tests/unit/pds-walker-store.test.ts` | new | 4a |
| `tests/e2e/pds-walker-store.spec.ts` | new | 4b |
| `CHANGELOG.md`, `plans/…`, this file | changed / new | landing |

## Verify-in-run ledger

- The IndexedDB proof is the e2e spec itself (a real browser); it ran in the gate above.
