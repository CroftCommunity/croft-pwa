# RUN-PDS-WALKER-01-SUMMARY — G1: croft-pwa is now also a package

date: 2026-09-08 · plan: `plans/2026-09-08-plan-pds-walker.md` · phases 1a, 1b, 1c, 1d, 1d-ii ·
branch `claude/pds-walker-plan` · session https://claude.ai/code/session_01HEcsAGKMs6PdtboTFsh1id

## Scope

The repo root becomes an installable package (`croft-pwa/pds-walker`) per
`CroftC/.claude/SHARED-CODE.md` rule 2, with the release plumbing the owner's D3 requires
(tags from the first landing). No walker code yet: the export is `VERSION` alone. Scoped out,
by the plan: everything from Phase 2a on (the pure core is G2).

## Red → green evidence, per phase

| phase | RED predicted | RED observed | GREEN |
|---|---|---|---|
| 1a | `Missing script: "build:lib"`; then `TS18003: No inputs were found` | both, verbatim (`/tmp/pdsw/1a-red1.txt`, `1a-red2.txt`) | `lib/pds-walker/index.{js,d.ts}` emitted; `import('./lib/pds-walker/index.js')` → `VERSION 0.1.0`, exit 0 |
| 1b | `?? lib/`; eslint errors in `lib/pds-walker/index.js` | `?? lib/` yes; **eslint RED did not fire** — the flat config lints only its `files:` globs, `lib/*.js` was never opened (V11 corrected) | status quiet, lint exit 0 |
| 1c | `ERR_PACKAGE_PATH_NOT_EXPORTED` (or vite's "Failed to resolve import"); pack lists `src/**` | a third shape: vitest `Failed to load url croft-pwa/pds-walker … Does the file exist?`; pack case RED on `src/**` | `exports` alone → import case GREEN (V23 holds, no fallback); `files: ["lib"]` + `prepare` → pack case GREEN; lint + typecheck exit 0 with `lib/` built; `shared-code.sh` prints no 47e line |
| 1d | `Contexts:` alone → one check-40 FLAG per entry; verify block exit 1 / exit 0 | 12 FLAGs (12 entries); `tag says 9.9.9, VERSION says 0.1.0` exit 1; `tag 0.1.0 == VERSION 0.1.0` exit 0 | finder quiet; workflow written, 3 actions SHA-pinned |
| 1d-ii | parity grep prints 2 files | 2 (`README.md`, `CLAUDE.md`) | 3 |

## The gate (full output of the last run, `npm test` after 1d-ii)

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

 ✓ tests/unit/atproto-read.test.ts (9 tests) 5ms
 ✓ tests/unit/oauth-resolve.test.ts (9 tests) 7ms
 ✓ tests/unit/guide-content.test.ts (4 tests) 2ms
 ✓ tests/unit/oauth-crypto.test.ts (7 tests) 26ms
 ✓ tests/unit/oauth-writes.test.ts (4 tests) 44ms
 ✓ tests/unit/measure-registry.test.ts (5 tests) 8ms
 ✓ tests/unit/signin-providers.test.ts (11 tests) 3ms
 ✓ tests/unit/measure-store.test.ts (7 tests) 3ms
 ✓ tests/unit/bridge.test.ts (7 tests) 5ms
 ✓ tests/unit/sealedbox.test.ts (5 tests) 46ms
 ✓ tests/unit/oauth-client.test.ts (13 tests) 108ms
 ✓ tests/unit/brand-tokens.test.ts (16 tests) 3ms
 ✓ tests/unit/sw-nav.test.ts (5 tests) 3ms
 ✓ tests/unit/tid.test.ts (5 tests) 2ms
 ✓ tests/unit/brand-nohex.test.ts (2 tests) 2ms
 ✓ tests/unit/theme.test.ts (3 tests) 1ms
 ✓ tests/unit/vault.test.ts (4 tests) 258ms
 ✓ tests/unit/feed-parse.test.ts (5 tests) 10ms

> croft-pwa@0.1.0 prepare
> npm run build:lib


> croft-pwa@0.1.0 build:lib
> tsc -p tsconfig.lib.json

 ✓ tests/unit/pds-walker-export.test.ts (2 tests) 945ms
   ✓ croft-pwa/pds-walker — the export path > packs only the built library plus package.json, README and LICENSE 923ms

 Test Files  19 passed (19)
      Tests  123 passed (123)
   Start at  18:52:24
   Duration  1.56s (transform 444ms, setup 0ms, collect 1.04s, tests 1.48s, environment 489ms, prepare 2.25s)


> croft-pwa@0.1.0 build
> node build.mjs

sizes(gz): index 4.0K · settings 4.0K · user-guide 5.4K · reference 4.2K · chassis 4.9K · brand 4.6K · pwa 4.5K · agent-method 4.6K · metrics 4.7K · atproto 11.2K · content-fetch 5.4K · reader 5.4K · styles.css 4.1K
built v0 0.1.0+a5c5f52 -> dist/  (12 pages, sw + precache 28, CSP+SRI on, budget ok)

> croft-pwa@0.1.0 e2e
> playwright test


Running 107 tests using 7 workers

  ✓    7 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reader.html (dark) — no serious/critical violations (950ms)
  ✓    1 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /index.html (dark) — no serious/critical violations (997ms)
  ✓    4 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reader.html (light) — no serious/critical violations (998ms)
  ✓    6 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /index.html (light) — no serious/critical violations (1.0s)
  ✓    3 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reference.html (light) — no serious/critical violations (1.0s)
  ✓    2 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /user-guide.html (light) — no serious/critical violations (1.1s)
  ✓    5 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /user-guide.html (dark) — no serious/critical violations (1.1s)
  ✓    8 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /reference.html (dark) — no serious/critical violations (834ms)
  ✓   12 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /brand.html (dark) — no serious/critical violations (877ms)
  ✓    9 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /chassis.html (light) — no serious/critical violations (899ms)
  ✓   11 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /brand.html (light) — no serious/critical violations (885ms)
  ✓   13 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /pwa.html (light) — no serious/critical violations (835ms)
  ✓   10 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /chassis.html (dark) — no serious/critical violations (914ms)
  ✓   14 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /pwa.html (dark) — no serious/critical violations (851ms)
  ✓   15 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /agent-method.html (light) — no serious/critical violations (828ms)
  ✓   16 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /agent-method.html (dark) — no serious/critical violations (826ms)
  ✓   18 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /content-fetch.html (dark) — no serious/critical violations (834ms)
  ✓   17 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /content-fetch.html (light) — no serious/critical violations (838ms)
  ✓   21 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /atproto.html (light) — no serious/critical violations (818ms)
  ✓   19 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /metrics.html (light) — no serious/critical violations (855ms)
  ✓   20 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /metrics.html (dark) — no serious/critical violations (863ms)
  ✓   26 [chromium] › tests/e2e/atproto.spec.ts:33:1 › sealed-box demo seals a message and opens it (real WebCrypto) (139ms)
  ✓   27 [chromium] › tests/e2e/atproto.spec.ts:42:1 › atproto demo shows a friendly error when resolution fails (164ms)
  ✓   25 [chromium] › tests/e2e/atproto.spec.ts:5:1 › atproto demo resolves a handle and shows DID/PDS/profile (231ms)
  ✓   29 [chromium] › tests/e2e/atproto.spec.ts:122:3 › OAuth sign-in (PKCE + PAR + DPoP) › a normal load is not treated as a callback (65ms)
  ✓   30 [chromium] › tests/e2e/atproto.spec.ts:128:3 › OAuth sign-in (PKCE + PAR + DPoP) › the write demo asks you to sign in first (112ms)
  ✓   28 [chromium] › tests/e2e/atproto.spec.ts:61:3 › OAuth sign-in (PKCE + PAR + DPoP) › signs in with a handle and completes the token exchange (280ms)
  ✓   31 [chromium] › tests/e2e/atproto.spec.ts:135:1 › vault demo wraps a key behind a passphrase and unlocks it (real WebCrypto) (277ms)
  ✓   22 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /atproto.html (dark) — no serious/critical violations (806ms)
  ✓   23 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /settings.html (light) — no serious/critical violations (783ms)
  ✓   24 [chromium] › tests/e2e/a11y.spec.ts:29:5 › a11y: /settings.html (dark) — no serious/critical violations (778ms)
  ✓   32 [chromium] › tests/e2e/csp.spec.ts:19:3 › /index.html: no CSP violations, no cross-origin scripts (553ms)
  ✓   33 [chromium] › tests/e2e/csp.spec.ts:19:3 › /settings.html: no CSP violations, no cross-origin scripts (548ms)
  ✓   34 [chromium] › tests/e2e/csp.spec.ts:19:3 › /reader.html: no CSP violations, no cross-origin scripts (551ms)
  ✓   35 [chromium] › tests/e2e/csp.spec.ts:19:3 › /user-guide.html: no CSP violations, no cross-origin scripts (560ms)
  ✓   36 [chromium] › tests/e2e/csp.spec.ts:19:3 › /reference.html: no CSP violations, no cross-origin scripts (548ms)
  ✓   39 [chromium] › tests/e2e/csp.spec.ts:19:3 › /pwa.html: no CSP violations, no cross-origin scripts (549ms)
  ✓   37 [chromium] › tests/e2e/csp.spec.ts:19:3 › /chassis.html: no CSP violations, no cross-origin scripts (586ms)
  ✓   38 [chromium] › tests/e2e/csp.spec.ts:19:3 › /brand.html: no CSP violations, no cross-origin scripts (582ms)
  ✓   40 [chromium] › tests/e2e/csp.spec.ts:19:3 › /agent-method.html: no CSP violations, no cross-origin scripts (550ms)
  ✓   41 [chromium] › tests/e2e/csp.spec.ts:19:3 › /content-fetch.html: no CSP violations, no cross-origin scripts (547ms)
  ✓   44 [chromium] › tests/e2e/metrics.spec.ts:3:1 › metrics page shows the registry, local counts, and the wire preview (92ms)
  ✓   46 [chromium] › tests/e2e/metrics.spec.ts:35:1 › a flush writes the payload to the console and nothing else leaves (94ms)
  ✓   45 [chromium] › tests/e2e/metrics.spec.ts:25:1 › sharing consent is opt-in, persists, and defaults off (136ms)
  ✓   47 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 320px (96ms)
  ✓   49 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 320px (87ms)
  ✓   50 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 320px (68ms)
  ✓   48 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 320px (88ms)
  ✓   51 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 320px (80ms)
  ✓   42 [chromium] › tests/e2e/csp.spec.ts:19:3 › /metrics.html: no CSP violations, no cross-origin scripts (544ms)
  ✓   55 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 320px (114ms)
  ✓   52 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 320px (115ms)
  ✓   56 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 320px (62ms)
  ✓   54 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 320px (115ms)
  ✓   53 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 320px (117ms)
  ✓   61 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 360px (113ms)
  ✓   57 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 320px (144ms)
  ✓   59 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 360px (114ms)
  ✓   60 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 360px (114ms)
  ✓   62 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 360px (116ms)
  ✓   58 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 360px (120ms)
  ✓   43 [chromium] › tests/e2e/csp.spec.ts:19:3 › /atproto.html: no CSP violations, no cross-origin scripts (550ms)
  ✓   64 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 360px (144ms)
  ✓   69 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /index.html at 390px (129ms)
  ✓   68 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 360px (137ms)
  ✓   63 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 360px (148ms)
  ✓   65 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 360px (145ms)
  ✓   67 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 360px (147ms)
  ✓   66 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 360px (148ms)
  ✓   74 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /chassis.html at 390px (141ms)
  ✓   70 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /settings.html at 390px (143ms)
  ✓   73 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reference.html at 390px (142ms)
  ✓   71 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /reader.html at 390px (145ms)
  ✓   76 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /pwa.html at 390px (144ms)
  ✓   72 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /user-guide.html at 390px (147ms)
  ✓   75 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /brand.html at 390px (144ms)
  ✓   82 [chromium] › tests/e2e/signin-sheet.spec.ts:40:1 › the registry carries both postures, or this spec proves nothing (61ms)
  ✓   78 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /metrics.html at 390px (157ms)
  ✓   79 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /atproto.html at 390px (157ms)
  ✓   77 [chromium] › tests/e2e/mobile-fit.spec.ts:19:5 › no horizontal overflow: /agent-method.html at 390px (161ms)
  ✓   81 [chromium] › tests/e2e/settings.spec.ts:3:1 › settings shows an Update control, About, and the Croft attribution (166ms)
  ✓   80 [chromium] › tests/e2e/settings.spec.ts:21:1 › every page carries the Croft attribution in the footer (201ms)
  ✓   83 [chromium] › tests/e2e/signin-sheet.spec.ts:45:1 › closed until asked; the trigger opens a native dialog titled for an atmo provider (229ms)
  ✓   84 [chromium] › tests/e2e/signin-sheet.spec.ts:57:1 › front page = open providers with Create + Sign in; invite-only sit behind Another provider (175ms)
  ✓   85 [chromium] › tests/e2e/signin-sheet.spec.ts:80:1 › fits the narrowest phone: no sideways scroll at 320px and every control ≥44px (291ms)
  ✓   88 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › bsky: Sign in clears the CSP and reaches PAR at https://bsky.social (290ms)
  ✓   89 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › blacksky: Sign in clears the CSP and reaches PAR at https://blacksky.app (258ms)
  ✓   90 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › eurosky: Sign in clears the CSP and reaches PAR at https://eurosky.social (234ms)
  ✓   91 [chromium] › tests/e2e/signin-sheet.spec.ts:156:3 › northsky: Sign in clears the CSP and reaches PAR at https://northsky.social (236ms)
  ✓   94 [chromium] › tests/e2e/signin-sheet.spec.ts:199:1 › the four probed providers are in the registry (47ms)
  ✓   95 [chromium] › tests/e2e/smoke.spec.ts:3:1 › home renders the shell, wordmark, and build stamp (164ms)
  ✓   96 [chromium] › tests/e2e/smoke.spec.ts:10:1 › tabs navigate to settings (real link, real document) (182ms)
  ✓   87 [chromium] › tests/e2e/signin-sheet.spec.ts:101:3 › a11y: the OPEN sheet has no serious/critical violations (dark) (517ms)
  ✓   86 [chromium] › tests/e2e/signin-sheet.spec.ts:101:3 › a11y: the OPEN sheet has no serious/critical violations (light) (519ms)
  ✓   97 [chromium] › tests/e2e/smoke.spec.ts:17:1 › theme toggle flips the document theme (174ms)
  ✓   93 [chromium] › tests/e2e/signin-sheet.spec.ts:185:1 › a handle on any other provider reaches the same seam, leading @ stripped (299ms)
  ✓  101 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter pwa.html renders its heading, entries, and TOC (91ms)
  ✓  100 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter brand.html renders its heading, entries, and TOC (93ms)
  ✓   99 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter chassis.html renders its heading, entries, and TOC (102ms)
  ✓   98 [chromium] › tests/e2e/standards.spec.ts:20:1 › the standards index links to every chapter (142ms)
  ✓  102 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter agent-method.html renders its heading, entries, and TOC (87ms)
  ✓  103 [chromium] › tests/e2e/standards.spec.ts:31:3 › chapter content-fetch.html renders its heading, entries, and TOC (110ms)
  ✓  105 [chromium] › tests/e2e/user-guide.spec.ts:23:1 › guide screenshots load (not broken references) (110ms)
  ✓  104 [chromium] › tests/e2e/user-guide.spec.ts:3:1 › the guide renders every entry, and the TOC links to each (117ms)
  ✓   92 [chromium] › tests/e2e/signin-sheet.spec.ts:167:1 › Create account starts OAuth at that provider in the CREATE intent; Sign in sends no prompt (475ms)
  ✓  107 [subpath] › tests/e2e/subpath.spec.ts:6:1 › renders under a subpath with no failed requests (584ms)
  ✓  106 [subpath] › tests/e2e/subpath.spec.ts:17:1 › relative nav stays within the subpath (648ms)

  107 passed (8.5s)
```

Counts: 19 unit files / 123 tests; 107 e2e; exit 0. (One earlier run in 1c had a single
image-load race in `user-guide.spec.ts` › "guide screenshots load"; the spec passed alone
and the full re-run was green — a flake in an untouched spec, recorded, not this change.)

## Files touched

| file | new / changed | phase |
|---|---|---|
| `tsconfig.lib.json` | new | 1a |
| `src/pds-walker/index.ts` | new | 1a |
| `package.json` | changed (`build:lib`, gate order; then `exports`, `files`, `prepare`) | 1a, 1c |
| `.gitignore` | changed (`lib/`) | 1b |
| `eslint.config.js` | changed (`lib/**` ignore, defensive) | 1b |
| `CLAUDE.md` | changed (§ The gate; § Identity Provides; § Structure) | 1b, 1c |
| `tests/unit/pds-walker-export.test.ts` | new | 1c |
| `.github/workflows/release-pds-walker.yml` | new | 1d |
| `CHANGELOG.md` | changed (`Contexts:`; 12 entries prefixed `**site:**`; `## 2026-09` entry) | 1d |
| `README.md` | changed (package sentence; gate line) | 1d |
| `.github/workflows/ci.yml` | changed (comment only) | 1d-ii |
| `TODO.md` | changed (§ 3 box 1, why-line, pointer) | 1d-ii |
| `plans/2026-09-08-plan-pds-walker.md` | changed (shipped markers, V11 correction, Outcome Summary) | each |

No phase exceeded three files (1b's `CLAUDE.md` and 1c's `CLAUDE.md` were the doc carries the plan named).

## Verify-in-run ledger (what no hermetic test reaches)

- **Tarball install** (proves `files` + `exports`): `npm pack` → `croft-pwa-0.1.0.tgz`; in a
  scratch dir `npm install <tgz>` → `import('croft-pwa/pds-walker')` printed `0.1.0`; the
  installed package holds `lib/`, `LICENSE`, `README.md`, `package.json` and nothing else.
- **git install at the phase commit** (proves the consumer path incl. `prepare`):
  `npm install git+file:///…/croft-pwa#11694f9b464b2c76d284deb5b415b135bf610fe9` → 5 s,
  `lib/pds-walker/index.{js,d.ts}` present, lockfile `resolved` carries the sha, import printed
  `0.1.0`. A first attempt resolved `main` instead because the sha was read from a non-repo
  cwd and came back empty — recorded so nobody repeats it.
- **Dry tag** (proves the refusal path of the release workflow before the first real tag):
  `pds-walker-v0.0.0-dry` pushed at `fbbf7af`; run 34292595469
  (https://github.com/CroftCommunity/croft-pwa/actions/runs/34292595469) stopped at
  "verify tag matches VERSION" with `tag says 0.0.0-dry, VERSION says 0.1.0`, exit 1; every
  later step **skipped**; `gh release list` unchanged (no pds-walker release); tag deleted
  both sides the same session (`git ls-remote --tags` shows none).
- **Audit check 47e**: `bash CroftC/.claude/bin/shared-code.sh <this worktree>` prints no
  `check 47e` line (was the NOTE "in the library register but its package.json has no exports").
