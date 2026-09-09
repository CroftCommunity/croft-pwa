# RUN-PDS-WALKER-05-SUMMARY — G5: the walker + M3

date: 2026-09-08 · plan: `plans/2026-09-08-plan-pds-walker.md` · phases 5, M3 ·
branch `claude/pds-walker-g5` · session https://claude.ai/code/session_01HEcsAGKMs6PdtboTFsh1id

## Scope

`createWalker({ transport, store, policy?, now?, log? })`: `walk(me)` resolves and lists ring
1 (awaited) and fills `mut`/`hop`/`hop2` in the background as each followee is listed;
`refresh()` is rev-gated (due repos' revs are read; only movers are re-listed; a new
followee's subtree is walked; a root with no snapshot is retried); `ring(id)`, `hosts()`,
`on()`, `stop()`, plus `load(me)` (warm start, no network) and `idle()`. Mutation-tested (M3).

## Red → green evidence

RED: `createWalker is not a function`. First green: 7/10 — one real defect (a host whose rev
could not be read before any snapshot existed was not marked unknown) and one test defect
(a constant clock made nothing ever due). Then 10/10; after M3, 20 cases.

## M3 — mutation testing of `walker.ts`

| round | walker.ts | killed | survived | no coverage | all files |
|---|---|---|---|---|---|
| 1 | 68.60% | 165 | 61 | 15 | 85.00% |
| 2 | 91.16% | 195 | 17 | 2 | 95.32% |
| 3 | 97.06% | 197 | 6 | 0 | 97.81% |
| 4 | **99.02%** | 201 | 2 | 0 | **98.61%** |

Round 1's survivors were mostly ONE gap: the ring-event sequence was never asserted (that
explained ~20). Rows added: the exact sequence under a sequential fill and the info count
per complete flip; `on()` unsubscribe (a stronger case in round 2); the exact warn and
stopped lines; a clean walk emits no host event; host recovery emits unknown then ok; a
listing that fails after its rev was read; did:web directory naming (host and path forms)
and a non-URL pds; `ring2Parallel` bounds the listings actually in flight (2 and 1);
refresh before any walk does nothing; refresh counts with an unknown host, with a followee
never listed, and with a followee unresolvable at refresh; a same-size member swap emits;
kept repos log no "rev moved". Structure: `RevCheck` is a discriminated union; movers carry
their pds/rev; `compute`/`fill`/`followeesOf` take `who`; the listing's redundant `markOk`
and fill's trailing `compute` are gone; verdict counting is exhaustive. The two survivors
are recorded equivalents (`stopped`'s initial value; the exhaustive last `else if`).

## Discovery outside the tests — extensionless ESM imports

The emitted `lib/pds-walker/index.js` imported `./core/rings` with no extension. vitest and
esbuild resolve that; plain Node (and a browser serving the tree unbundled, which is
forage's shape) reports `ERR_MODULE_NOT_FOUND`. Found by the manual Node run this phase
requires. Fix: every relative import inside `src/pds-walker` carries `.js`
(`moduleResolution: bundler` maps it to the `.ts` source); guard: the export test now spawns
plain Node to import the package. Consequence recorded for Phase 7.

## The Node run against the real transport (Phase 5 validation)

```
DEBUG pds-walker: walk did:plc:z72i7hdynmk6r22z27h6tvur
INFO  pds-walker: ring me 1 1788914684680 true
INFO  pds-walker: ring fol 15 1788914684680 true
ring 1 after 551 ms: fol 15
INFO  pds-walker: ring mut 13 1788914684680 true
INFO  pds-walker: ring hop 2627 1788914684680 true
INFO  pds-walker: ring hop2 2631 1788914684680 true
idle after 2486 ms
me        1 complete asOf 2026-09-09T00:44:44.680Z
mut      13 complete asOf 2026-09-09T00:44:44.680Z
fol      15 complete asOf 2026-09-09T00:44:44.680Z
hop    2627 complete asOf 2026-09-09T00:44:44.680Z
hop2   2631 complete asOf 2026-09-09T00:44:44.680Z
hosts: plc.directory:ok puffball.us-east.host.bsky.network:ok reishi.us-east.host.bsky.network:ok morel.us-east.host.bsky.network:ok chanterelle.us-west.host.bsky.network:ok auriporia.us-west.host.bsky.network:ok enoki.us-east.host.bsky.network:ok verpa.us-west.host.bsky.network:ok losers.club:ok russula.us-west.host.bsky.network:ok lionsmane.us-east.host.bsky.network:ok pds.pckt.cafe:ok yellowfoot.us-west.host.bsky.network:ok stropharia.us-west.host.bsky.network:ok
```

Read for noise: one `debug` (the walked DID), five `info` lines (one per ring reaching
complete), zero per-followee lines, no DID at info/warn. 14 followees across 13 hosts, all
`ok`; ring 1 in 551 ms; every ring complete in 2.5 s.

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

 ✓ tests/unit/bridge.test.ts (7 tests) 4ms
 ✓ tests/unit/oauth-resolve.test.ts (9 tests) 6ms
 ✓ tests/unit/atproto-read.test.ts (9 tests) 5ms
 ✓ tests/unit/signin-providers.test.ts (11 tests) 4ms
 ✓ tests/unit/oauth-crypto.test.ts (7 tests) 7ms
 ✓ tests/unit/pds-walker-resolve.test.ts (7 tests) 4ms
 ✓ tests/unit/oauth-client.test.ts (13 tests) 25ms
 ✓ tests/unit/pds-walker-transport.test.ts (5 tests) 5ms
 ✓ tests/unit/pds-walker-pds.test.ts (11 tests) 6ms
 ✓ tests/unit/pds-walker-walker.test.ts (17 tests) 9ms
 ✓ tests/unit/oauth-writes.test.ts (4 tests) 13ms
 ✓ tests/unit/pds-walker-rings.test.ts (7 tests) 17ms
 ✓ tests/unit/pds-walker-limiter.test.ts (13 tests) 40ms
 ✓ tests/unit/pds-walker-cadence.test.ts (6 tests) 2ms
 ✓ tests/unit/measure-store.test.ts (7 tests) 2ms
 ✓ tests/unit/pds-walker-store.test.ts (4 tests) 3ms
 ✓ tests/unit/brand-tokens.test.ts (16 tests) 3ms
 ✓ tests/unit/sealedbox.test.ts (5 tests) 14ms
 ✓ tests/unit/guide-content.test.ts (4 tests) 2ms
 ✓ tests/unit/pds-walker-revgate.test.ts (5 tests) 1ms
 ✓ tests/unit/measure-registry.test.ts (5 tests) 3ms
 ✓ tests/unit/sw-nav.test.ts (5 tests) 1ms
 ✓ tests/unit/tid.test.ts (5 tests) 2ms
 ✓ tests/unit/brand-nohex.test.ts (2 tests) 7ms
 ✓ tests/unit/theme.test.ts (3 tests) 1ms
 ✓ tests/unit/vault.test.ts (4 tests) 261ms
 ✓ tests/unit/feed-parse.test.ts (5 tests) 9ms

> croft-pwa@0.1.0 prepare
> npm run build:lib


> croft-pwa@0.1.0 build:lib
> tsc -p tsconfig.lib.json

 ✓ tests/unit/pds-walker-export.test.ts (3 tests) 936ms
   ✓ croft-pwa/pds-walker — the export path > packs only the built library plus package.json, README and LICENSE 875ms

 Test Files  28 passed (28)
      Tests  199 passed (199)
   Start at  19:46:08
   Duration  1.55s (transform 337ms, setup 0ms, collect 918ms, tests 1.39s, environment 498ms, prepare 2.20s)


> croft-pwa@0.1.0 build
> node build.mjs

sizes(gz): index 4.0K · settings 4.0K · user-guide 5.4K · reference 4.2K · chassis 4.9K · brand 4.6K · pwa 4.5K · agent-method 4.6K · metrics 4.7K · atproto 11.2K · content-fetch 5.4K · reader 5.4K · styles.css 4.1K
built v0 0.1.0+c5de570 -> dist/  (12 pages, sw + precache 28, CSP+SRI on, budget ok)

> croft-pwa@0.1.0 e2e
> playwright test


Running 108 tests using 7 workers

  ✓    3 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reader.html (dark) — no serious/critical violations (981ms)
  ✓    5 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reader.html (light) — no serious/critical violations (987ms)
  ✓    6 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /index.html (light) — no serious/critical violations (1.0s)
  ✓    1 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /index.html (dark) — no serious/critical violations (1.0s)
  ✓    7 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reference.html (light) — no serious/critical violations (1.0s)
  ✓    2 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /user-guide.html (light) — no serious/critical violations (1.1s)
  ✓    4 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /user-guide.html (dark) — no serious/critical violations (1.1s)
  ✓    8 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reference.html (dark) — no serious/critical violations (880ms)
  ✓   11 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /brand.html (light) — no serious/critical violations (870ms)
  ✓   12 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /brand.html (dark) — no serious/critical violations (875ms)
  ✓    9 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /chassis.html (light) — no serious/critical violations (913ms)
  ✓   10 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /chassis.html (dark) — no serious/critical violations (908ms)
  ✓   13 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /pwa.html (light) — no serious/critical violations (824ms)
  ✓   14 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /pwa.html (dark) — no serious/critical violations (836ms)
  ✓   15 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /agent-method.html (light) — no serious/critical violations (844ms)
  ✓   16 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /agent-method.html (dark) — no serious/critical violations (846ms)
  ✓   18 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /content-fetch.html (dark) — no serious/critical violations (830ms)
  ✓   17 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /content-fetch.html (light) — no serious/critical violations (856ms)
  ✓   21 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /atproto.html (light) — no serious/critical violations (826ms)
  ✓   19 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /metrics.html (light) — no serious/critical violations (863ms)
  ✓   20 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /metrics.html (dark) — no serious/critical violations (857ms)
  ✓   26 [chromium] › tests/e2e/atproto.spec.ts:33:1 › sealed-box demo seals a message and opens it (real WebCrypto) (209ms)
  ✓   27 [chromium] › tests/e2e/atproto.spec.ts:42:1 › atproto demo shows a friendly error when resolution fails (186ms)
  ✓   25 [chromium] › tests/e2e/atproto.spec.ts:5:1 › atproto demo resolves a handle and shows DID/PDS/profile (266ms)
  ✓   29 [chromium] › tests/e2e/atproto.spec.ts:122:3 › OAuth sign-in (PKCE + PAR + DPoP) › a normal load is not treated as a callback (70ms)
  ✓   30 [chromium] › tests/e2e/atproto.spec.ts:128:3 › OAuth sign-in (PKCE + PAR + DPoP) › the write demo asks you to sign in first (84ms)
  ✓   28 [chromium] › tests/e2e/atproto.spec.ts:61:3 › OAuth sign-in (PKCE + PAR + DPoP) › signs in with a handle and completes the token exchange (315ms)
  ✓   31 [chromium] › tests/e2e/atproto.spec.ts:135:1 › vault demo wraps a key behind a passphrase and unlocks it (real WebCrypto) (277ms)
  ✓   23 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /settings.html (light) — no serious/critical violations (780ms)
  ✓   24 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /settings.html (dark) — no serious/critical violations (787ms)
  ✓   22 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /atproto.html (dark) — no serious/critical violations (818ms)
  ✓   32 [chromium] › tests/e2e/csp.spec.ts:19:3 › /index.html: no CSP violations, no cross-origin scripts (555ms)
  ✓   33 [chromium] › tests/e2e/csp.spec.ts:19:3 › /settings.html: no CSP violations, no cross-origin scripts (563ms)
  ✓   34 [chromium] › tests/e2e/csp.spec.ts:19:3 › /reader.html: no CSP violations, no cross-origin scripts (558ms)
  ✓   35 [chromium] › tests/e2e/csp.spec.ts:19:3 › /user-guide.html: no CSP violations, no cross-origin scripts (573ms)
  ✓   36 [chromium] › tests/e2e/csp.spec.ts:19:3 › /reference.html: no CSP violations, no cross-origin scripts (559ms)
  ✓   37 [chromium] › tests/e2e/csp.spec.ts:19:3 › /chassis.html: no CSP violations, no cross-origin scripts (578ms)
  ✓   38 [chromium] › tests/e2e/csp.spec.ts:19:3 › /brand.html: no CSP violations, no cross-origin scripts (572ms)
  ✓   39 [chromium] › tests/e2e/csp.spec.ts:19:3 › /pwa.html: no CSP violations, no cross-origin scripts (558ms)
  ✓   40 [chromium] › tests/e2e/csp.spec.ts:19:3 › /agent-method.html: no CSP violations, no cross-origin scripts (549ms)
  ✓   45 [chromium] › tests/e2e/metrics.spec.ts:3:1 › metrics page shows the registry, local counts, and the wire preview (86ms)
  ✓   41 [chromium] › tests/e2e/csp.spec.ts:19:3 › /content-fetch.html: no CSP violations, no cross-origin scripts (555ms)
  ✓   44 [chromium] › tests/e2e/metrics.spec.ts:25:1 › sharing consent is opt-in, persists, and defaults off (141ms)
  ✓   47 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 320px (92ms)
  ✓   48 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 320px (75ms)
  ✓   49 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 320px (60ms)
  ✓   46 [chromium] › tests/e2e/metrics.spec.ts:35:1 › a flush writes the payload to the console and nothing else leaves (132ms)
  ✓   53 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 320px (91ms)
  ✓   51 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 320px (101ms)
  ✓   52 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 320px (98ms)
  ✓   54 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 320px (75ms)
  ✓   50 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 320px (123ms)
  ✓   42 [chromium] › tests/e2e/csp.spec.ts:19:3 › /metrics.html: no CSP violations, no cross-origin scripts (564ms)
  ✓   58 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 360px (129ms)
  ✓   59 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 360px (130ms)
  ✓   60 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 360px (64ms)
  ✓   56 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 320px (131ms)
  ✓   55 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 320px (131ms)
  ✓   57 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 320px (132ms)
  ✓   43 [chromium] › tests/e2e/csp.spec.ts:19:3 › /atproto.html: no CSP violations, no cross-origin scripts (561ms)
  ✓   61 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 360px (131ms)
  ✓   63 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 360px (130ms)
  ✓   62 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 360px (130ms)
  ✓   64 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 360px (130ms)
  ✓   65 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 360px (129ms)
  ✓   66 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 360px (135ms)
  ✓   72 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 390px (138ms)
  ✓   73 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 390px (130ms)
  ✓   67 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 360px (154ms)
  ✓   70 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 390px (142ms)
  ✓   69 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 390px (143ms)
  ✓   68 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 360px (144ms)
  ✓   71 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 390px (143ms)
  ✓   79 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 390px (142ms)
  ✓   76 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 390px (145ms)
  ✓   77 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 390px (147ms)
  ✓   75 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 390px (148ms)
  ✓   74 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 390px (150ms)
  ✓   78 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 390px (148ms)
  ✓   83 [chromium] › tests/e2e/signin-sheet.spec.ts:40:1 › the registry carries both postures, or this spec proves nothing (45ms)
  ✓   80 [chromium] › tests/e2e/pds-walker-store.spec.ts:32:1 › indexedDbStore: put/get/all round-trip, keyed by did, keeps the newer, survives a reload (187ms)
  ✓   82 [chromium] › tests/e2e/settings.spec.ts:3:1 › settings shows an Update control, About, and the Croft attribution (175ms)
  ✓   81 [chromium] › tests/e2e/settings.spec.ts:21:1 › every page carries the Croft attribution in the footer (212ms)
  ✓   86 [chromium] › tests/e2e/signin-sheet.spec.ts:45:1 › closed until asked; the trigger opens a native dialog titled for an atmo provider (280ms)
  ✓   85 [chromium] › tests/e2e/signin-sheet.spec.ts:80:1 › fits the narrowest phone: no sideways scroll at 320px and every control ≥44px (296ms)
  ✓   84 [chromium] › tests/e2e/signin-sheet.spec.ts:57:1 › front page = open providers with Create + Sign in; invite-only sit behind Another provider (304ms)
  ✓   89 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › bsky: Sign in clears the CSP and reaches PAR at https://bsky.social (158ms)
  ✓   90 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › blacksky: Sign in clears the CSP and reaches PAR at https://blacksky.app (185ms)
  ✓   95 [chromium] › tests/e2e/signin-sheet.spec.ts:199:1 › the four probed providers are in the registry (43ms)
  ✓   91 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › eurosky: Sign in clears the CSP and reaches PAR at https://eurosky.social (234ms)
  ✓   96 [chromium] › tests/e2e/smoke.spec.ts:3:1 › home renders the shell, wordmark, and build stamp (73ms)
  ✓   88 [chromium] › tests/e2e/signin-sheet.spec.ts:101:3 › a11y: the OPEN sheet has no serious/critical violations (dark) (475ms)
  ✓   87 [chromium] › tests/e2e/signin-sheet.spec.ts:101:3 › a11y: the OPEN sheet has no serious/critical violations (light) (488ms)
  ✓   92 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › northsky: Sign in clears the CSP and reaches PAR at https://northsky.social (246ms)
  ✓   94 [chromium] › tests/e2e/signin-sheet.spec.ts:185:1 › a handle on any other provider reaches the same seam, leading @ stripped (251ms)
  ✓  100 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter chassis.html renders its heading, entries, and TOC (134ms)
  ✓  101 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter brand.html renders its heading, entries, and TOC (124ms)
  ✓  102 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter pwa.html renders its heading, entries, and TOC (76ms)
  ✓   99 [chromium] › tests/e2e/standards.spec.ts:20:1 › the standards index links to every chapter (145ms)
  ✓   98 [chromium] › tests/e2e/smoke.spec.ts:17:1 › theme toggle flips the document theme (162ms)
  ✓   97 [chromium] › tests/e2e/smoke.spec.ts:10:1 › tabs navigate to settings (real link, real document) (178ms)
  ✓   93 [chromium] › tests/e2e/signin-sheet.spec.ts:167:1 › Create account starts OAuth at that provider in the CREATE intent; Sign in sends no prompt (469ms)
  ✓  104 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter content-fetch.html renders its heading, entries, and TOC (117ms)
  ✓  103 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter agent-method.html renders its heading, entries, and TOC (118ms)
  ✓  106 [chromium] › tests/e2e/user-guide.spec.ts:23:1 › guide screenshots load (not broken references) (113ms)
  ✓  105 [chromium] › tests/e2e/user-guide.spec.ts:3:1 › the guide renders every entry, and the TOC links to each (131ms)
  ✓  107 [subpath] › tests/e2e/subpath.spec.ts:6:1 › renders under a subpath with no failed requests (593ms)
  ✓  108 [subpath] › tests/e2e/subpath.spec.ts:17:1 › relative nav stays within the subpath (645ms)

  108 passed (8.7s)
```

Counts: 28 unit files / 199 tests; 108 e2e; exit 0.

## Files touched

| file | new / changed | phase |
|---|---|---|
| `src/pds-walker/walker.ts` | new | 5 (M3) |
| `src/pds-walker/index.ts` | changed (createWalker, Transport from walker.ts) | 5 |
| `src/pds-walker/**/*.ts` | changed (`.js` on every relative import) | M3 discovery |
| `tests/unit/pds-walker-walker.test.ts` | new | 5 (M3 rows) |
| `tests/unit/pds-walker-export.test.ts` | changed (plain-Node load case) | M3 discovery |
| `stryker.config.json` | changed (mutate gains walker.ts) | M3 |
| `CHANGELOG.md`, `plans/…`, this file | changed / new | landing |
