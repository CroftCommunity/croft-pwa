# RUN-PDS-WALKER-03-SUMMARY — G3: the fetch transport (resolve, PDS calls, per-host limiter) + M2

date: 2026-09-08 · plan: `plans/2026-09-08-plan-pds-walker.md` · phases 3a, 3b, 3c, M2, 3d ·
branch `claude/pds-walker-g3` · session https://claude.ai/code/session_01HEcsAGKMs6PdtboTFsh1id

## Scope

Everything with a network in it: `resolveDid` (a wrapper over `src/atproto/read.ts`),
`latestRev` and `listFollows` against a PDS, the per-host limiter (in the path of every
call, reading `RateLimit-*`), `defaultLogger`, and `createFetchTransport` — the transport a
consumer gets. Mutation-tested (M2). Scoped out: the store (G4) and the walker (G5).

## Red → green evidence, per phase

| phase | RED predicted | RED observed | GREEN |
|---|---|---|---|
| 3a | `… 'resolveDid'` | first a transform error from a stray `)` in the harvested string (my typo); then `resolveDid is not a function` | 6 tests; `lib/atproto/read.{js,d.ts}` emitted beside `lib/pds-walker/` (the emit consequence, now observed) |
| 3b | `… 'listFollows'` | `latestRev is not a function` | 8 tests (later 12) incl. the three-page cursor shape |
| 3c | module missing; then the wiring case failing | `Failed to load url ../../src/pds-walker/transport/limiter`; then, with the module present and `pds.ts` unwired, the two concurrency cases and the pause case failed | 6 tests (later 13); limiter wired into `getJson` |
| 3d | `… 'createFetchTransport'` | `createFetchTransport is not a function` | 5 chain cases through the export |

Lint findings caught before commits (the type-aware rules earn their keep): `Did | string`
redundancy, unguarded `unknown` body reads, `Array.isArray` not narrowing a readonly union,
an `any` from `expect.stringMatching`, a promise rejected with a string, an unnarrowed
template literal in the live spec.

## M2 — mutation testing of `transport/` (limiter, pds, resolve)

| round | score | killed | timeouts | survived | no coverage |
|---|---|---|---|---|---|
| 1 | 82.55% | 235 | 11 | 36 | 16 |
| 2 | 94.33% | 273 | 10 | 15 | 2 |
| 3 | 97.65% | 281 | 10 | 7 | 0 |
| 4 | **98.32%** | 283 | 10 | 5 | 0 |

**Two real defects the phase tests had not caught:** `hostOf` was handed the full URL, so a
failure reason named the URL rather than the host; and `Number(null)` is `0`, so a response
carrying only `RateLimit-Reset` would have paused the host (both headers are now required).
Real test gaps closed (~17 rows): unpinned unknown reasons (no/empty rev, null and
non-object bodies, a throwing fetch, a non-URL pds), the `accept` header, the exact first
`listRecords` URL, empty/null pages, a record with no `value`, a null record, a non-DID
subject, `defaultLogger`'s posture, the default sleep, one-warn-per-pause, the both-headers
and non-numeric guards, a later reset extending a pause, the warn's seconds argument, the
bad-JSON prefix, a non-Error throw, the exact 404 reason. Equivalent branches collapsed:
the resume log's redundant clause; `AtprotoReadError` vs `Error` (same message). The five
survivors are recorded equivalents (plan § M2).

## The live journey (3d, once)

```

> croft-pwa@0.1.0 e2e:live
> playwright test --config playwright.live.config.ts tests/live/pds-walker.live.spec.ts


Running 1 test using 1 worker

[live] pds=https://puffball.us-east.host.bsky.network rev=3muzvzlycuh2v follows=14
  ✓  1 [live] › tests/live/pds-walker.live.spec.ts:10:1 › @live the transport resolves bsky.app, reads its rev, and lists its follows from its PDS (644ms)

  1 passed (1.6s)
```

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

 ✓ tests/unit/oauth-crypto.test.ts (7 tests) 10ms
 ✓ tests/unit/oauth-resolve.test.ts (9 tests) 7ms
 ✓ tests/unit/oauth-client.test.ts (13 tests) 29ms
 ✓ tests/unit/signin-providers.test.ts (11 tests) 3ms
 ✓ tests/unit/pds-walker-cadence.test.ts (6 tests) 2ms
 ✓ tests/unit/pds-walker-resolve.test.ts (7 tests) 4ms
 ✓ tests/unit/pds-walker-limiter.test.ts (13 tests) 40ms
 ✓ tests/unit/oauth-writes.test.ts (4 tests) 10ms
 ✓ tests/unit/pds-walker-pds.test.ts (11 tests) 7ms
 ✓ tests/unit/pds-walker-transport.test.ts (5 tests) 8ms
 ✓ tests/unit/bridge.test.ts (7 tests) 5ms
 ✓ tests/unit/atproto-read.test.ts (9 tests) 6ms
 ✓ tests/unit/pds-walker-rings.test.ts (7 tests) 17ms
 ✓ tests/unit/measure-store.test.ts (7 tests) 3ms
 ✓ tests/unit/brand-tokens.test.ts (16 tests) 3ms
 ✓ tests/unit/guide-content.test.ts (4 tests) 2ms
 ✓ tests/unit/sealedbox.test.ts (5 tests) 11ms
 ✓ tests/unit/pds-walker-revgate.test.ts (5 tests) 1ms
 ✓ tests/unit/measure-registry.test.ts (5 tests) 3ms
 ✓ tests/unit/sw-nav.test.ts (5 tests) 2ms
 ✓ tests/unit/brand-nohex.test.ts (2 tests) 3ms
 ✓ tests/unit/tid.test.ts (5 tests) 3ms
 ✓ tests/unit/theme.test.ts (3 tests) 2ms
 ✓ tests/unit/vault.test.ts (4 tests) 273ms
 ✓ tests/unit/feed-parse.test.ts (5 tests) 10ms

> croft-pwa@0.1.0 prepare
> npm run build:lib


> croft-pwa@0.1.0 build:lib
> tsc -p tsconfig.lib.json

 ✓ tests/unit/pds-walker-export.test.ts (2 tests) 990ms
   ✓ croft-pwa/pds-walker — the export path > packs only the built library plus package.json, README and LICENSE 982ms

 Test Files  26 passed (26)
      Tests  177 passed (177)
   Start at  19:27:26
   Duration  1.68s (transform 288ms, setup 0ms, collect 638ms, tests 1.45s, environment 634ms, prepare 2.48s)


> croft-pwa@0.1.0 build
> node build.mjs

sizes(gz): index 4.0K · settings 4.0K · user-guide 5.4K · reference 4.2K · chassis 4.9K · brand 4.6K · pwa 4.5K · agent-method 4.6K · metrics 4.7K · atproto 11.2K · content-fetch 5.4K · reader 5.4K · styles.css 4.1K
built v0 0.1.0+a79f214 -> dist/  (12 pages, sw + precache 28, CSP+SRI on, budget ok)

> croft-pwa@0.1.0 e2e
> playwright test


Running 107 tests using 7 workers

  ✓    5 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reader.html (light) — no serious/critical violations (987ms)
  ✓    3 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reader.html (dark) — no serious/critical violations (1.0s)
  ✓    7 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /index.html (dark) — no serious/critical violations (1.0s)
  ✓    2 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reference.html (light) — no serious/critical violations (1.0s)
  ✓    1 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /index.html (light) — no serious/critical violations (1.1s)
  ✓    6 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /user-guide.html (light) — no serious/critical violations (1.1s)
  ✓    4 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /user-guide.html (dark) — no serious/critical violations (1.1s)
  ✓    8 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reference.html (dark) — no serious/critical violations (879ms)
  ✓   11 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /brand.html (light) — no serious/critical violations (874ms)
  ✓   12 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /brand.html (dark) — no serious/critical violations (884ms)
  ✓    9 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /chassis.html (light) — no serious/critical violations (906ms)
  ✓   14 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /pwa.html (dark) — no serious/critical violations (837ms)
  ✓   10 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /chassis.html (dark) — no serious/critical violations (931ms)
  ✓   13 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /pwa.html (light) — no serious/critical violations (850ms)
  ✓   15 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /agent-method.html (light) — no serious/critical violations (862ms)
  ✓   16 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /agent-method.html (dark) — no serious/critical violations (835ms)
  ✓   17 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /content-fetch.html (light) — no serious/critical violations (846ms)
  ✓   18 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /content-fetch.html (dark) — no serious/critical violations (853ms)
  ✓   21 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /atproto.html (light) — no serious/critical violations (833ms)
  ✓   19 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /metrics.html (light) — no serious/critical violations (860ms)
  ✓   20 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /metrics.html (dark) — no serious/critical violations (880ms)
  ✓   26 [chromium] › tests/e2e/atproto.spec.ts:33:1 › sealed-box demo seals a message and opens it (real WebCrypto) (149ms)
  ✓   27 [chromium] › tests/e2e/atproto.spec.ts:42:1 › atproto demo shows a friendly error when resolution fails (183ms)
  ✓   29 [chromium] › tests/e2e/atproto.spec.ts:122:3 › OAuth sign-in (PKCE + PAR + DPoP) › a normal load is not treated as a callback (68ms)
  ✓   25 [chromium] › tests/e2e/atproto.spec.ts:5:1 › atproto demo resolves a handle and shows DID/PDS/profile (256ms)
  ✓   30 [chromium] › tests/e2e/atproto.spec.ts:128:3 › OAuth sign-in (PKCE + PAR + DPoP) › the write demo asks you to sign in first (102ms)
  ✓   28 [chromium] › tests/e2e/atproto.spec.ts:61:3 › OAuth sign-in (PKCE + PAR + DPoP) › signs in with a handle and completes the token exchange (276ms)
  ✓   31 [chromium] › tests/e2e/atproto.spec.ts:135:1 › vault demo wraps a key behind a passphrase and unlocks it (real WebCrypto) (297ms)
  ✓   22 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /atproto.html (dark) — no serious/critical violations (809ms)
  ✓   23 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /settings.html (light) — no serious/critical violations (794ms)
  ✓   24 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /settings.html (dark) — no serious/critical violations (798ms)
  ✓   32 [chromium] › tests/e2e/csp.spec.ts:19:3 › /index.html: no CSP violations, no cross-origin scripts (554ms)
  ✓   33 [chromium] › tests/e2e/csp.spec.ts:19:3 › /settings.html: no CSP violations, no cross-origin scripts (548ms)
  ✓   34 [chromium] › tests/e2e/csp.spec.ts:19:3 › /reader.html: no CSP violations, no cross-origin scripts (548ms)
  ✓   35 [chromium] › tests/e2e/csp.spec.ts:19:3 › /user-guide.html: no CSP violations, no cross-origin scripts (570ms)
  ✓   36 [chromium] › tests/e2e/csp.spec.ts:19:3 › /reference.html: no CSP violations, no cross-origin scripts (559ms)
  ✓   38 [chromium] › tests/e2e/csp.spec.ts:19:3 › /brand.html: no CSP violations, no cross-origin scripts (564ms)
  ✓   37 [chromium] › tests/e2e/csp.spec.ts:19:3 › /chassis.html: no CSP violations, no cross-origin scripts (590ms)
  ✓   39 [chromium] › tests/e2e/csp.spec.ts:19:3 › /pwa.html: no CSP violations, no cross-origin scripts (555ms)
  ✓   40 [chromium] › tests/e2e/csp.spec.ts:19:3 › /agent-method.html: no CSP violations, no cross-origin scripts (555ms)
  ✓   41 [chromium] › tests/e2e/csp.spec.ts:19:3 › /content-fetch.html: no CSP violations, no cross-origin scripts (551ms)
  ✓   46 [chromium] › tests/e2e/metrics.spec.ts:35:1 › a flush writes the payload to the console and nothing else leaves (73ms)
  ✓   44 [chromium] › tests/e2e/metrics.spec.ts:3:1 › metrics page shows the registry, local counts, and the wire preview (104ms)
  ✓   45 [chromium] › tests/e2e/metrics.spec.ts:25:1 › sharing consent is opt-in, persists, and defaults off (168ms)
  ✓   47 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 320px (97ms)
  ✓   49 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 320px (70ms)
  ✓   48 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 320px (91ms)
  ✓   50 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 320px (66ms)
  ✓   54 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 320px (110ms)
  ✓   55 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 320px (107ms)
  ✓   52 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 320px (112ms)
  ✓   53 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 320px (111ms)
  ✓   51 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 320px (116ms)
  ✓   42 [chromium] › tests/e2e/csp.spec.ts:19:3 › /metrics.html: no CSP violations, no cross-origin scripts (555ms)
  ✓   60 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 360px (127ms)
  ✓   59 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 360px (133ms)
  ✓   61 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 360px (115ms)
  ✓   58 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 360px (135ms)
  ✓   56 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 320px (136ms)
  ✓   57 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 320px (136ms)
  ✓   43 [chromium] › tests/e2e/csp.spec.ts:19:3 › /atproto.html: no CSP violations, no cross-origin scripts (560ms)
  ✓   66 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 360px (131ms)
  ✓   64 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 360px (133ms)
  ✓   62 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 360px (134ms)
  ✓   67 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 360px (134ms)
  ✓   65 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 360px (136ms)
  ✓   63 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 360px (135ms)
  ✓   68 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 360px (69ms)
  ✓   71 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 390px (155ms)
  ✓   74 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 390px (151ms)
  ✓   75 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 390px (123ms)
  ✓   72 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 390px (155ms)
  ✓   69 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 390px (157ms)
  ✓   73 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 390px (154ms)
  ✓   70 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 390px (157ms)
  ✓   82 [chromium] › tests/e2e/signin-sheet.spec.ts:40:1 › the registry carries both postures, or this spec proves nothing (73ms)
  ✓   76 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 390px (162ms)
  ✓   77 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 390px (162ms)
  ✓   78 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 390px (164ms)
  ✓   79 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 390px (164ms)
  ✓   80 [chromium] › tests/e2e/settings.spec.ts:3:1 › settings shows an Update control, About, and the Croft attribution (172ms)
  ✓   81 [chromium] › tests/e2e/settings.spec.ts:21:1 › every page carries the Croft attribution in the footer (204ms)
  ✓   83 [chromium] › tests/e2e/signin-sheet.spec.ts:45:1 › closed until asked; the trigger opens a native dialog titled for an atmo provider (152ms)
  ✓   84 [chromium] › tests/e2e/signin-sheet.spec.ts:80:1 › fits the narrowest phone: no sideways scroll at 320px and every control ≥44px (310ms)
  ✓   85 [chromium] › tests/e2e/signin-sheet.spec.ts:57:1 › front page = open providers with Create + Sign in; invite-only sit behind Another provider (317ms)
  ✓   90 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › eurosky: Sign in clears the CSP and reaches PAR at https://eurosky.social (260ms)
  ✓   88 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › bsky: Sign in clears the CSP and reaches PAR at https://bsky.social (318ms)
  ✓   89 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › blacksky: Sign in clears the CSP and reaches PAR at https://blacksky.app (276ms)
  ✓   94 [chromium] › tests/e2e/signin-sheet.spec.ts:199:1 › the four probed providers are in the registry (53ms)
  ✓   95 [chromium] › tests/e2e/smoke.spec.ts:3:1 › home renders the shell, wordmark, and build stamp (163ms)
  ✓   96 [chromium] › tests/e2e/smoke.spec.ts:10:1 › tabs navigate to settings (real link, real document) (126ms)
  ✓   87 [chromium] › tests/e2e/signin-sheet.spec.ts:101:3 › a11y: the OPEN sheet has no serious/critical violations (dark) (534ms)
  ✓   86 [chromium] › tests/e2e/signin-sheet.spec.ts:101:3 › a11y: the OPEN sheet has no serious/critical violations (light) (539ms)
  ✓   99 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter chassis.html renders its heading, entries, and TOC (93ms)
  ✓  100 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter brand.html renders its heading, entries, and TOC (91ms)
  ✓   93 [chromium] › tests/e2e/signin-sheet.spec.ts:185:1 › a handle on any other provider reaches the same seam, leading @ stripped (313ms)
  ✓   97 [chromium] › tests/e2e/smoke.spec.ts:17:1 › theme toggle flips the document theme (146ms)
  ✓   91 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › northsky: Sign in clears the CSP and reaches PAR at https://northsky.social (331ms)
  ✓   98 [chromium] › tests/e2e/standards.spec.ts:20:1 › the standards index links to every chapter (120ms)
  ✓  102 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter agent-method.html renders its heading, entries, and TOC (134ms)
  ✓  103 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter content-fetch.html renders its heading, entries, and TOC (123ms)
  ✓  101 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter pwa.html renders its heading, entries, and TOC (136ms)
  ✓  105 [chromium] › tests/e2e/user-guide.spec.ts:23:1 › guide screenshots load (not broken references) (131ms)
  ✓  104 [chromium] › tests/e2e/user-guide.spec.ts:3:1 › the guide renders every entry, and the TOC links to each (138ms)
  ✓   92 [chromium] › tests/e2e/signin-sheet.spec.ts:167:1 › Create account starts OAuth at that provider in the CREATE intent; Sign in sends no prompt (543ms)
  ✓  106 [subpath] › tests/e2e/subpath.spec.ts:6:1 › renders under a subpath with no failed requests (586ms)
  ✓  107 [subpath] › tests/e2e/subpath.spec.ts:17:1 › relative nav stays within the subpath (629ms)

  107 passed (8.8s)
```

Counts: 26 unit files / 177 tests; 107 e2e; exit 0.

## Files touched

| file | new / changed | phase |
|---|---|---|
| `src/pds-walker/transport/resolve.ts` | new | 3a (M2) |
| `src/pds-walker/transport/pds.ts` | new; changed | 3b, 3c (M2) |
| `src/pds-walker/transport/limiter.ts` | new | 3c (M2) |
| `src/pds-walker/index.ts` | changed (re-exports; `Transport`, `createFetchTransport`) | 3a, 3b, 3d |
| `tests/unit/pds-walker-resolve.test.ts` | new | 3a (M2 rows) |
| `tests/unit/pds-walker-pds.test.ts` | new | 3b (M2 rows) |
| `tests/unit/pds-walker-limiter.test.ts` | new | 3c (M2 rows) |
| `tests/unit/pds-walker-transport.test.ts` | new | 3d |
| `tests/live/pds-walker.live.spec.ts` | new | 3d |
| `stryker.config.json` | changed (mutate widened) | M2 |
| `CHANGELOG.md`, `plans/…`, this file | changed / new | landing |

## Verify-in-run ledger

- Harvested fixtures (inline in the tests, each behind its source URL): bsky.app's DID doc
  from `plc.directory`; `getLatestCommit` from `puffball.us-east.host.bsky.network`; three
  `listRecords` pages (limit=2, then the cursor chain to the empty terminal page); a 502 body
  from `liquid.bluesky.page`; the OpenDNS interception HTML this machine's resolver serves
  for `selfhosted.social`.
- The live spec above ran once against the real network from this machine (644 ms).
- Two chains committed red states before stopping (2c earlier; the M2 round-1 triage here);
  both amended before any push. Every later chain runs `/tmp/pdsw/phase-chain.sh`
  (`set -euo pipefail`: build:lib, the named tests, lint, typecheck) before `npm test`.
