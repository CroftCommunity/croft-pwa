# RUN-PDS-WALKER-02-SUMMARY — G2: the pure core (rings, the rev gate, cadence) + M1

date: 2026-09-08 · plan: `plans/2026-09-08-plan-pds-walker.md` · phases 2a, 2b, 2c, M1 ·
branch `claude/pds-walker-g2` · session https://claude.ai/code/session_01HEcsAGKMs6PdtboTFsh1id

## Scope

The I/O-free core of the walker, reachable through `croft-pwa/pds-walker`: `rings()` (five
nested rings — `hop` = the mutuals' follows, `hop2` = every followee's follows, OQ6 (c)),
`decide()` (the rev gate), `defaultPolicy`/`resolvePolicy`/`due()`/`ring2Targets()`
(cadence), plus the `Logger` type. Mutation-tested (M1). Scoped out: everything with a
network in it (G3).

## Red → green evidence, per phase

| phase | RED predicted | RED observed | GREEN |
|---|---|---|---|
| 2a | `does not provide an export named 'rings'` | `rings is not a function` (vitest interop: a missing named export is `undefined`) | 7 tests incl. 300 seeded graphs for `me ⊂ mut ⊂ fol ⊂ hop ⊂ hop2` |
| 2b | `… 'decide'` | `decide is not a function` | 5 tests; branch order pinned |
| 2c | `… 'defaultPolicy'` | `resolvePolicy is not a function` | 6 tests; R−1/R/R+1, per-key merge, five keys |

One correction during 2c: the Map-input test asked for the `me` ring (60 s cadence) with
snapshots 5 s old and expected them due — a test error; the first 2c commit carried it
because the command chain did not stop on the failure. Amended before push.

## M1 — mutation testing of `src/pds-walker/core/**`

Config: `stryker.config.json` + `vitest.stryker.config.ts` (the export path aliased to
`src/` so mutants are what the tests exercise — plan option (a)). Committed before each round.

| round | score | killed | survived | no coverage |
|---|---|---|---|---|
| 1 | 90.10% | 91 | 9 | 1 |
| 2 (after triage) | 100.00% | 97 | 0 | 0 |

Triage of the ten:
- `cadence.ts` `mut: 10 * MINUTE` → `10 / MINUTE` — **real gap**: `mut`'s value was never pinned (only `fol`'s). Row added.
- `revgate.ts` `latestRev === undefined ||` → `false ||` — **equivalent**: subsumed by `typeof !== 'string'`. Clause removed.
- `rings.ts` hop union `?? []` (NoCoverage) and its optional chain — **unreachable**: a mutual has a snapshot by construction (mutuality is read from it). Mutuals are now resolved as snapshots; the branch is gone.
- `rings.ts` hop2 union `?? []` → `?? ["Stryker was here"]` — **real gap**: hop2 membership with an unknown followee was not asserted. Row added (`{me, M, F, Y}`, no X, nothing invented).
- `rings.ts` `ring('me', …)` … `ring('hop2', …)` id literals → `""` (five) — **real gap**: `Ring.id` was never read. `expect(r[id].id).toBe(id)` for every ring.

## Supply-chain rung (SUPPLY-CHAIN.md), for the two new devDependencies

`@stryker-mutator/core@10.0.0`, `@stryker-mutator/vitest-runner@10.0.0` — Apache-2.0
(inbound-allowed), exact-pinned, dev-only. `osv-scanner scan --lockfile package-lock.json
--config osv-scanner.toml` after install reported: the pre-existing vitest 2.1.9 /
@vitest/mocker advisory (GHSA-82fw-gwwq-j7x9, dev, already under the repo's dated ignore
posture) and three NEW `qs 6.15.1` advisories (GHSA-4mjr-xmp4-gh2g, GHSA-q8mj-m7cp-5q26,
GHSA-x5fp-wj9c-mxmx; CVSS 6.3; dev-only via `@stryker-mutator/core → typed-rest-client`).
All three are fixed in `qs` 6.16.0, so `package.json` `overrides.qs = "6.16.0"` (a fix,
not an ignore); the re-scan shows no `qs` line. Not on the production path either way —
`croft-pwa` has zero runtime dependencies.

## The gate (full output of the last run, `npm test` at the branch tip)

```

> croft-pwa@0.1.0 test
> npm run build:lib && npm run lint && npm run typecheck && npm run unit && npm run build && npm run e2e


> croft-pwa@0.1.0 build:lib
> tsc -p tsconfig.lib.json


> croft-pwa@0.1.0 lint
> eslint .


> croft-pwa@0.1.0 typecheck
> tsc --noEmit


> croft-pwa@0.1.0 unit
> vitest run


 RUN  v2.1.9 /Users/cpettet/git/chasemp/CroftC/worktrees/pds-walker/croft-pwa

 ✓ tests/unit/measure-store.test.ts (7 tests) 3ms
 ✓ tests/unit/guide-content.test.ts (4 tests) 2ms
 ✓ tests/unit/bridge.test.ts (7 tests) 4ms
 ✓ tests/unit/brand-tokens.test.ts (16 tests) 2ms
 ✓ tests/unit/atproto-read.test.ts (9 tests) 5ms
 ✓ tests/unit/sealedbox.test.ts (5 tests) 14ms
 ✓ tests/unit/pds-walker-rings.test.ts (7 tests) 20ms
 ✓ tests/unit/oauth-crypto.test.ts (7 tests) 10ms
 ✓ tests/unit/oauth-resolve.test.ts (9 tests) 8ms
 ✓ tests/unit/oauth-writes.test.ts (4 tests) 11ms
 ✓ tests/unit/pds-walker-cadence.test.ts (6 tests) 2ms
 ✓ tests/unit/signin-providers.test.ts (11 tests) 4ms
 ✓ tests/unit/oauth-client.test.ts (13 tests) 31ms
 ✓ tests/unit/pds-walker-revgate.test.ts (5 tests) 2ms
 ✓ tests/unit/measure-registry.test.ts (5 tests) 3ms
 ✓ tests/unit/sw-nav.test.ts (5 tests) 2ms
 ✓ tests/unit/brand-nohex.test.ts (2 tests) 2ms
 ✓ tests/unit/tid.test.ts (5 tests) 4ms
 ✓ tests/unit/theme.test.ts (3 tests) 1ms
 ✓ tests/unit/vault.test.ts (4 tests) 272ms
 ✓ tests/unit/feed-parse.test.ts (5 tests) 10ms

> croft-pwa@0.1.0 prepare
> npm run build:lib


> croft-pwa@0.1.0 build:lib
> tsc -p tsconfig.lib.json

 ✓ tests/unit/pds-walker-export.test.ts (2 tests) 938ms
   ✓ croft-pwa/pds-walker — the export path > packs only the built library plus package.json, README and LICENSE 934ms

 Test Files  22 passed (22)
      Tests  141 passed (141)
   Start at  19:12:07
   Duration  1.59s (transform 401ms, setup 0ms, collect 800ms, tests 1.35s, environment 603ms, prepare 2.07s)


> croft-pwa@0.1.0 build
> node build.mjs

sizes(gz): index 4.0K · settings 4.0K · user-guide 5.4K · reference 4.2K · chassis 4.9K · brand 4.6K · pwa 4.5K · agent-method 4.6K · metrics 4.7K · atproto 11.2K · content-fetch 5.4K · reader 5.4K · styles.css 4.1K
built v0 0.1.0+1a06a91 -> dist/  (12 pages, sw + precache 28, CSP+SRI on, budget ok)

> croft-pwa@0.1.0 e2e
> playwright test


Running 107 tests using 7 workers

  ✓    3 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reader.html (light) — no serious/critical violations (983ms)
  ✓    1 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /index.html (light) — no serious/critical violations (1.0s)
  ✓    7 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reference.html (light) — no serious/critical violations (1.0s)
  ✓    4 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reader.html (dark) — no serious/critical violations (1.0s)
  ✓    2 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /index.html (dark) — no serious/critical violations (1.1s)
  ✓    5 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /user-guide.html (light) — no serious/critical violations (1.1s)
  ✓    6 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /user-guide.html (dark) — no serious/critical violations (1.1s)
  ✓    8 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reference.html (dark) — no serious/critical violations (879ms)
  ✓   13 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /pwa.html (light) — no serious/critical violations (854ms)
  ✓   14 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /pwa.html (dark) — no serious/critical violations (869ms)
  ✓   12 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /brand.html (dark) — no serious/critical violations (932ms)
  ✓   10 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /chassis.html (dark) — no serious/critical violations (958ms)
  ✓   11 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /brand.html (light) — no serious/critical violations (955ms)
  ✓    9 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /chassis.html (light) — no serious/critical violations (991ms)
  ✓   15 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /agent-method.html (light) — no serious/critical violations (834ms)
  ✓   16 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /agent-method.html (dark) — no serious/critical violations (856ms)
  ✓   18 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /content-fetch.html (dark) — no serious/critical violations (848ms)
  ✓   17 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /content-fetch.html (light) — no serious/critical violations (854ms)
  ✓   21 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /atproto.html (light) — no serious/critical violations (857ms)
  ✓   19 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /metrics.html (light) — no serious/critical violations (872ms)
  ✓   20 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /metrics.html (dark) — no serious/critical violations (872ms)
  ✓   26 [chromium] › tests/e2e/atproto.spec.ts:33:1 › sealed-box demo seals a message and opens it (real WebCrypto) (138ms)
  ✓   27 [chromium] › tests/e2e/atproto.spec.ts:42:1 › atproto demo shows a friendly error when resolution fails (170ms)
  ✓   29 [chromium] › tests/e2e/atproto.spec.ts:122:3 › OAuth sign-in (PKCE + PAR + DPoP) › a normal load is not treated as a callback (61ms)
  ✓   25 [chromium] › tests/e2e/atproto.spec.ts:5:1 › atproto demo resolves a handle and shows DID/PDS/profile (234ms)
  ✓   28 [chromium] › tests/e2e/atproto.spec.ts:61:3 › OAuth sign-in (PKCE + PAR + DPoP) › signs in with a handle and completes the token exchange (286ms)
  ✓   30 [chromium] › tests/e2e/atproto.spec.ts:128:3 › OAuth sign-in (PKCE + PAR + DPoP) › the write demo asks you to sign in first (110ms)
  ✓   31 [chromium] › tests/e2e/atproto.spec.ts:135:1 › vault demo wraps a key behind a passphrase and unlocks it (real WebCrypto) (280ms)
  ✓   22 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /atproto.html (dark) — no serious/critical violations (821ms)
  ✓   23 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /settings.html (light) — no serious/critical violations (781ms)
  ✓   24 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /settings.html (dark) — no serious/critical violations (780ms)
  ✓   32 [chromium] › tests/e2e/csp.spec.ts:19:3 › /index.html: no CSP violations, no cross-origin scripts (556ms)
  ✓   34 [chromium] › tests/e2e/csp.spec.ts:19:3 › /settings.html: no CSP violations, no cross-origin scripts (554ms)
  ✓   33 [chromium] › tests/e2e/csp.spec.ts:19:3 › /reader.html: no CSP violations, no cross-origin scripts (555ms)
  ✓   35 [chromium] › tests/e2e/csp.spec.ts:19:3 › /user-guide.html: no CSP violations, no cross-origin scripts (583ms)
  ✓   36 [chromium] › tests/e2e/csp.spec.ts:19:3 › /reference.html: no CSP violations, no cross-origin scripts (552ms)
  ✓   38 [chromium] › tests/e2e/csp.spec.ts:19:3 › /brand.html: no CSP violations, no cross-origin scripts (565ms)
  ✓   37 [chromium] › tests/e2e/csp.spec.ts:19:3 › /chassis.html: no CSP violations, no cross-origin scripts (574ms)
  ✓   39 [chromium] › tests/e2e/csp.spec.ts:19:3 › /pwa.html: no CSP violations, no cross-origin scripts (554ms)
  ✓   45 [chromium] › tests/e2e/metrics.spec.ts:3:1 › metrics page shows the registry, local counts, and the wire preview (91ms)
  ✓   41 [chromium] › tests/e2e/csp.spec.ts:19:3 › /content-fetch.html: no CSP violations, no cross-origin scripts (556ms)
  ✓   46 [chromium] › tests/e2e/metrics.spec.ts:35:1 › a flush writes the payload to the console and nothing else leaves (84ms)
  ✓   40 [chromium] › tests/e2e/csp.spec.ts:19:3 › /agent-method.html: no CSP violations, no cross-origin scripts (565ms)
  ✓   44 [chromium] › tests/e2e/metrics.spec.ts:25:1 › sharing consent is opt-in, persists, and defaults off (152ms)
  ✓   49 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 320px (94ms)
  ✓   47 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 320px (101ms)
  ✓   48 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 320px (95ms)
  ✓   50 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 320px (101ms)
  ✓   51 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 320px (65ms)
  ✓   42 [chromium] › tests/e2e/csp.spec.ts:19:3 › /metrics.html: no CSP violations, no cross-origin scripts (557ms)
  ✓   56 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 320px (90ms)
  ✓   53 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 320px (117ms)
  ✓   54 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 320px (118ms)
  ✓   52 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 320px (117ms)
  ✓   55 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 320px (106ms)
  ✓   60 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 360px (127ms)
  ✓   61 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 360px (128ms)
  ✓   57 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 320px (130ms)
  ✓   59 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 360px (128ms)
  ✓   58 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 360px (131ms)
  ✓   62 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 360px (127ms)
  ✓   43 [chromium] › tests/e2e/csp.spec.ts:19:3 › /atproto.html: no CSP violations, no cross-origin scripts (564ms)
  ✓   65 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 360px (142ms)
  ✓   64 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 360px (146ms)
  ✓   69 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 390px (135ms)
  ✓   66 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 360px (144ms)
  ✓   63 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 360px (148ms)
  ✓   67 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 360px (145ms)
  ✓   68 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 360px (145ms)
  ✓   76 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 390px (145ms)
  ✓   75 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 390px (148ms)
  ✓   71 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 390px (149ms)
  ✓   74 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 390px (148ms)
  ✓   70 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 390px (152ms)
  ✓   72 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 390px (149ms)
  ✓   73 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 390px (152ms)
  ✓   82 [chromium] › tests/e2e/signin-sheet.spec.ts:40:1 › the registry carries both postures, or this spec proves nothing (54ms)
  ✓   79 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 390px (161ms)
  ✓   78 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 390px (161ms)
  ✓   77 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 390px (164ms)
  ✓   81 [chromium] › tests/e2e/settings.spec.ts:3:1 › settings shows an Update control, About, and the Croft attribution (167ms)
  ✓   80 [chromium] › tests/e2e/settings.spec.ts:21:1 › every page carries the Croft attribution in the footer (202ms)
  ✓   83 [chromium] › tests/e2e/signin-sheet.spec.ts:45:1 › closed until asked; the trigger opens a native dialog titled for an atmo provider (233ms)
  ✓   84 [chromium] › tests/e2e/signin-sheet.spec.ts:57:1 › front page = open providers with Create + Sign in; invite-only sit behind Another provider (205ms)
  ✓   86 [chromium] › tests/e2e/signin-sheet.spec.ts:80:1 › fits the narrowest phone: no sideways scroll at 320px and every control ≥44px (284ms)
  ✓   89 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › blacksky: Sign in clears the CSP and reaches PAR at https://blacksky.app (248ms)
  ✓   88 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › bsky: Sign in clears the CSP and reaches PAR at https://bsky.social (294ms)
  ✓   90 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › eurosky: Sign in clears the CSP and reaches PAR at https://eurosky.social (232ms)
  ✓   91 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › northsky: Sign in clears the CSP and reaches PAR at https://northsky.social (252ms)
  ✓   94 [chromium] › tests/e2e/signin-sheet.spec.ts:199:1 › the four probed providers are in the registry (62ms)
  ✓   95 [chromium] › tests/e2e/smoke.spec.ts:3:1 › home renders the shell, wordmark, and build stamp (101ms)
  ✓   98 [chromium] › tests/e2e/standards.spec.ts:20:1 › the standards index links to every chapter (93ms)
  ✓   97 [chromium] › tests/e2e/smoke.spec.ts:17:1 › theme toggle flips the document theme (143ms)
  ✓   96 [chromium] › tests/e2e/smoke.spec.ts:10:1 › tabs navigate to settings (real link, real document) (168ms)
  ✓   85 [chromium] › tests/e2e/signin-sheet.spec.ts:101:3 › a11y: the OPEN sheet has no serious/critical violations (dark) (537ms)
  ✓   87 [chromium] › tests/e2e/signin-sheet.spec.ts:101:3 › a11y: the OPEN sheet has no serious/critical violations (light) (542ms)
  ✓   93 [chromium] › tests/e2e/signin-sheet.spec.ts:185:1 › a handle on any other provider reaches the same seam, leading @ stripped (286ms)
  ✓  100 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter agent-method.html renders its heading, entries, and TOC (153ms)
  ✓  101 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter brand.html renders its heading, entries, and TOC (152ms)
  ✓  102 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter pwa.html renders its heading, entries, and TOC (151ms)
  ✓  103 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter content-fetch.html renders its heading, entries, and TOC (154ms)
  ✓   99 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter chassis.html renders its heading, entries, and TOC (181ms)
  ✓  104 [chromium] › tests/e2e/user-guide.spec.ts:3:1 › the guide renders every entry, and the TOC links to each (123ms)
  ✓   92 [chromium] › tests/e2e/signin-sheet.spec.ts:167:1 › Create account starts OAuth at that provider in the CREATE intent; Sign in sends no prompt (485ms)
  ✓  105 [chromium] › tests/e2e/user-guide.spec.ts:23:1 › guide screenshots load (not broken references) (99ms)
  ✓  106 [subpath] › tests/e2e/subpath.spec.ts:6:1 › renders under a subpath with no failed requests (577ms)
  ✓  107 [subpath] › tests/e2e/subpath.spec.ts:17:1 › relative nav stays within the subpath (630ms)

  107 passed (8.8s)
```

Counts: 22 unit files / 141 tests; 107 e2e; exit 0.

## Files touched

| file | new / changed | phase |
|---|---|---|
| `src/pds-walker/core/rings.ts` | new | 2a (M1 simplification) |
| `src/pds-walker/core/revgate.ts` | new | 2b (M1 simplification) |
| `src/pds-walker/core/cadence.ts` | new | 2c |
| `src/pds-walker/index.ts` | changed (re-exports) | 2a, 2b, 2c |
| `tests/unit/pds-walker-rings.test.ts` | new | 2a (+M1 rows) |
| `tests/unit/pds-walker-revgate.test.ts` | new | 2b |
| `tests/unit/pds-walker-cadence.test.ts` | new | 2c (+M1 row) |
| `stryker.config.json`, `vitest.stryker.config.ts` | new | M1 |
| `package.json`, `package-lock.json` | changed (two devDeps; `overrides.qs`) | M1 |
| `.gitignore` (`.stryker-tmp/`), `tsconfig.json` (`include`) | changed | M1 |
| `CHANGELOG.md`, `plans/…`, this file | changed / new | landing |

## Verify-in-run ledger

- M1 round outputs: `npx stryker run` twice (round 1 `/tmp/pdsw/m1-round1.txt`, round 2
  `/tmp/pdsw/m1-round2.txt` on the session machine); scores above are the tool's `All files` rows.
- The lint regression the M1 config commit introduced (`vitest.stryker.config.ts was not
  found by the project service`) was caught by `npm run lint` before the triage commit and
  never reached a push.
