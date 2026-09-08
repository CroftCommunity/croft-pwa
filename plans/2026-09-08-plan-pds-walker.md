# Plan: pds-walker — the rev-gated ring walker, as croft-pwa's first library export

date: 2026-09-08
identity: chasemp (`chase@owasp.org`, `github-personal`), repo `CroftCommunity/croft-pwa`
**Status:** Pass 1 complete (template form, phases split to the ≤3-file rule); Pass 2 and
Pass 3 pending; no phase started. D1–D3 decided by the owner (§ Decisions).

Format note: this plan follows the `phase-plan` skill's template (Problem · Reasoning ·
Verified Assumptions · Documentation Impact · Concurrency Map · Phases with call chain,
wiring test, read/write-sets, done-when, validation · Open Questions · Review Log) inside
the workspace's plan conventions (`CroftC/.claude/TRACKING.md`: dated name without
ordinal, `Status:` line, Review Log). Where the two disagree the workspace layer wins
(PATTERN.md precedence) — that is why the filename carries no ordinal.

## Problem Statement

forage, pdsview and the coming social-tree site all need the same thing: a user's social
rings — me, mutuals, follows, and follows-of-follows — kept fresh, usable when the Bluesky
AppView is down, and cheap enough to run in a browser tab. Today forage computes rings from
the AppView alone (`forage/js/substrates/lens.js` `ringGraph()`), remembers nothing across
sessions, and has no degraded mode; pdsview has the raw PDS primitives but no graph; the
social-tree site does not exist yet.

The research (`discovery/alpha/research/ring-walk-sans-relay-2026-09.md`, measured
2026-09-08) settled what is possible and the owner settled the shape:

- Rings 0–2 are walkable direct from PDSs, unauthenticated, CORS-open. Ring 3 is not.
- The cost is requests, not CPU (a 14.6 MB repo decodes in JS in 50 ms), so the walker is
  **TypeScript**, not Rust→wasm.
- It lives **in croft-pwa as a package** (`CroftC/.claude/SHARED-CODE.md` rule 2: the repo
  root is the package; consumers pin `github:CroftCommunity/croft-pwa#<sha>`).
- Default rings are **mutuals · follows · global**; mutuals fall out of the ring-2 walk, so
  no follower index is needed.
- On a rev change the walker **re-lists** the follow collection (no CAR decoder yet).
- The outer ring **draws as it fills, with an "as of" stamp**, never as an empty set.

What does not exist: the package shape (croft-pwa is `private: true` with no `exports`;
audit check 47e notes it every run), the walker, a reference use that proves the export,
and a consumer pinned to it.

Constraints: croft-pwa's one gate (`npm test` = lint · typecheck · unit · build · e2e)
stays green at every phase boundary; **no new runtime dependencies** (the repo has none);
every dev dependency added passes SUPPLY-CHAIN.md's rung first; TDD throughout
(RED seen before GREEN); each phase touches at most three files.

## Reasoning

**Why a package first, walker second.** SHARED-CODE.md rule 2's last clause is that the
reference app imports the library through its own export path, which is uncheckable by
script and therefore must be true from the first commit — a walker built as
`src/pds-walker/` and imported relatively would be a copy waiting to happen. The package
shape is also what turns check 47e from a NOTE into silence, the first measurable step.

**Why the core is pure and the transport is a parameter.** croft's client ADR says the same
for Rust ("no I/O, no async, no clock" in the core); here it is what makes the tests
hermetic and the walker portable to a service worker or a Node script. The transport is the
only place `fetch` appears; the clock is injected so "as of" and cadence are testable.

**Why re-list rather than diff (owner decision).** Follows are a small share of a repo's
churn — likes dominate the diffs measured — so re-listing a changed repo's follow collection
is nearly as cheap as a diff and needs no CAR/CBOR decoder in the bundle. The measured
trigger to revisit is when posts join the walker.

**Why ring 2 refreshes through ring 1.** Steady-state polling of ~440 k ring-2 repos is
25 minutes at 30-parallel and burns the per-host budget (3,000 / 5 min). A followee whose
rev has not moved has not changed their follows, so ring 1's rev checks tell the walker
exactly which ring-2 subtrees to re-walk. The cadence table is the research's § 4.

**Why forage vendors the built file rather than gaining a bundler (D2).** forage serves
`js/` as-is with no build step and already vendors one third-party bundle under a
sha-pinned test. The package's built ESM file copied from `node_modules` by a script — and
pinned to the installed package by a test — is rule 1 (pinned dependency) and rule 3's
drift discipline together, without changing how forage ships.

**Why a reference page (D1).** croft-pwa's standards are each "a real page in the site";
a library standard with no page would be the one exception. The page also is the deploy:
croft-pwa deploys from `main` to Pages, so a green landing publishes both the library
commit consumers can pin and the page that proves it.

**Why tags from the first landing (D3, owner, against the recommendation).** The owner
wants a number to talk about from day one. VERSIONING.md then requires a release workflow
that gates the tag against a manifest, and CHANGELOGS.md requires a `[pds-walker X.Y.Z]`
section per tag; both are built in Phase 1d rather than deferred, so the first tag is not
also the first time the plumbing runs.

**Alternatives rejected.** Rust→wasm core (measured: CPU is not the cost; a second
toolchain in three repos). A `packages/` monorepo (npm cannot install a subfolder from
git; GitHub Packages needs a token). Diff CARs from day one (needs a persisted block store
to see unfollows; no measured need yet). A follower index (Constellation) as a dependency
(third party, one machine; not needed for the default rings).

**Why phases are this small.** The `phase-plan` rule — a phase touching four or more
files is split — is the defense against half-done phases. The library's `index.ts`
re-export file is in most write-sets, which is also why nothing runs in parallel.

## Verified Assumptions

All probes run 2026-09-08 from this machine; scratch package under the session scratchpad
(`selfref/`), not in the repo.

| # | Assumption | How verified |
|---|---|---|
| V1 | Node resolves a package's own name through its `exports` map (self-reference), so a test inside croft-pwa can `import('croft-pwa/pds-walker')` | Scratch package `name: croft-pwa`, `exports: {"./pds-walker": …}`; `node tests/self.mjs` printed `node import ok: pds-walker 0.1.0` (Node v22.23.2) |
| V2 | esbuild 0.24.2 (croft-pwa's pinned bundler) bundles that same self-reference for a page entry | `esbuild src/page.ts --bundle --format=esm` on the scratch package; the output ran and printed the VERSION |
| V3 | `tsc -p tsconfig.lib.json` (TypeScript 5.9.3) emits `lib/pds-walker/index.js` + `index.d.ts` from `src/pds-walker` with `noEmit: false`, `declaration: true`, `rootDir: src`, `outDir: lib` | Scratch run; `ls lib/pds-walker` → `index.d.ts index.js` |
| V4 | `npm pack` honors `files: ["lib/pds-walker"]` — the tarball holds only the library + package.json | `npm pack --dry-run`: 3 files (`lib/pds-walker/index.d.ts`, `index.js`, `package.json`) |
| V5 | npm installs a git dependency at a commit-ish, installs its devDependencies and runs `prepare` | `npm help install`: "dependencies and devDependencies will be installed, and the prepare script will be run" (line 258 of the manual, Node 22 npm) |
| V6 | `private: true` blocks `npm publish` only; it does not block a git install | npm docs for `private`; V1/V4 ran with `private: true` set |
| V7 | Audit check 38 wants a heading `## [pds-walker 0.1.0]` for tag `pds-walker-v0.1.0` | `CroftC/.claude/bin/changelog-shape.sh` § 37: `art="${t%v*}"; want="## [$art $ver]"` |
| V8 | Audit check 47e keys on `"exports"` in `package.json` for a repo in the library register | `CroftC/.claude/bin/shared-code.sh` § 47e: `grep -qE '"exports" *:'` |
| V9 | croft-pwa's page registry is the `PAGES` array in `build.mjs` (`html`, `entry`, `jsToken`, `sriToken`); every entry is bundled, hashed, SRI-stamped | `build.mjs` § "Each destination" (`const PAGES = [`) |
| V10 | Unit tests live in `tests/unit/**/*.test.ts` under vitest with `environment: 'node'`; the fake-fetch pattern is `fakeFetch(routes)` in `tests/unit/atproto-read.test.ts` | `vitest.config.ts`; the test file's head |
| V11 | ESLint ignores are `dist/**, node_modules/**, test-results/**, playwright-report/**, .claude/**` — `lib/**` is not ignored yet; `.gitignore` ignores `dist/` not `lib/` | `eslint.config.js` line 10; `.gitignore` |
| V12 | CISS's `release.yml` is the tag-gated template: on `tags: ["v*"]`, derive the version from the tag, compare to the manifest, `exit 1` on mismatch, then `gh release create` + `gh release upload` | `CISS/.github/workflows/release.yml` (steps "verify tag matches workspace version", release upload) |
| V13 | croft-pwa's `ci.yml` deploys only `needs: gate` and `if: github.ref == 'refs/heads/main'`; `preview.yml` deploys PR previews | `.github/workflows/ci.yml` lines 71–72 |
| V14 | PDS-direct calls needed by the transport are unauthenticated with CORS `*`: `listRecords` (0.2 s/page, cursor-chained), `getLatestCommit` (0.13 s), `plc.directory` DID docs; rate limit 3,000 / 5 min per host per IP with `RateLimit-*` headers exposed | research doc § 3.1–3.2 (live probes 2026-09-08) |
| V15 | forage's ring registry is `SCOPES` in `forage/js/rings.js` with the containment chain `me ⊂ mut ⊂ fol ⊂ hop`; its graph reads are `pagedGraph`/`ringGraph` in `forage/js/substrates/lens.js` | read 2026-09-08 |

Not verified (captured as Open Questions): whether `fast-check` and `stryker` pass the
supply-chain rung; a stable public account for the live journey.

## Documentation Impact

- `README.md` — line "Its chassis is what a new Croft PWA copies to start" becomes
  "…consumes as a package (`croft-pwa/pds-walker`) or copies to start"; **Phase 1d**.
- `CHANGELOG.md` — gains `Contexts: site · pds-walker` and its first `pds-walker:` entry in
  **Phase 1d**; the `## [pds-walker 0.1.0] — <date>` section in **Phase 6c**.
- `TODO.md` § 3 — boxes tick as Phases 1a–1c land (**each phase**); the section is removed
  when Phase 6c lands.
- `src/pages/guide-content.ts` — a user-guide chapter for the rings page, **Phase 6b**.
- `docs/PRACTICES.md` / `llms.txt` — grepped for "copies", "private", "package": no
  references beyond README line 19; nothing to change.
- `CroftC/.claude/SHARED-CODE.md` § Register of libraries — croft-pwa's status cell flips
  from "not yet a package" when Phase 1c lands (CroftC PR, **Phase 1c**).
- `CroftC/.claude/VERSIONING.md` § Cross-repo pins — forage's pin row, when forage first
  pins (Phase 7, its own plan).
- `discovery/alpha/ROADMAP_TODO.md` E146 — no change; the research doc already answers it.

## Concurrency Map

All phases sequential. Reason: `src/pds-walker/index.ts` (the export surface) is in the
write-set of nearly every phase from 1a on, and each phase's wiring test imports through
it; `package.json` is written by 1a, 1c and 6c. No parallel set is declared. Every phase
runs in this worktree (`worktrees/pds-walker/croft-pwa`, branch `claude/pds-walker-plan`
→ phase branches off it); no phase invokes `git checkout`/`stash`/`rebase` in any shared
checkout; the only ambient state touched is `lib/` (gitignored build output) and, in
Phase 3d and 6b live runs, the network.

## Phases

### Phase 0: Discovery — not needed

Every assumption the phases depend on is in Verified Assumptions with firsthand evidence
(V1–V15). The two unverified items are dependency-approval questions, not behaviors, and
are gated on the phases that would add the dependency.

---

### Phase 1a: the build emits the library

**Goal:** `npm run build:lib` produces `lib/pds-walker/index.js` + `index.d.ts` from
`src/pds-walker/`, and the gate runs it.
**Changes:**
- [ ] `tsconfig.lib.json` — extends `./tsconfig.json`; `noEmit: false`, `declaration: true`,
      `rootDir: src`, `outDir: lib`, `include: ["src/pds-walker"]`, `types: []` (V3).
- [ ] `src/pds-walker/index.ts` — `export const VERSION = '0.1.0';` (the library's clock,
      separate from `package.json`'s site version — D3).
- [ ] `package.json` — scripts `build:lib: "tsc -p tsconfig.lib.json"`; `test` becomes
      `lint && typecheck && unit && build:lib && build && e2e`.
**Call chain:** `npm test` → `npm run build:lib` → `tsc -p tsconfig.lib.json` → `lib/pds-walker/index.js`.
**Wiring test:** the gate itself: `npm run build:lib` then
`node --input-type=module -e "const m = await import('./lib/pds-walker/index.js'); if (m.VERSION !== '0.1.0') process.exit(1)"`
— RED before (no script, no file), GREEN after. Recorded as a one-line `check:lib` script? No:
keep it as the verification command; a script would be a fourth file's worth of surface.
**Depends on:** nothing.
**Read-set:** `tsconfig.json`, `package.json`.
**Write-set:** `tsconfig.lib.json`, `src/pds-walker/index.ts`, `package.json`.
**Shared-state contract:** creates `lib/` in the worktree (untracked until 1b ignores it);
no git operations; no network.
**Risks:** `verbatimModuleSyntax` + `isolatedModules` inherited from the root config are
fine for emit (V3 ran with both). `types: []` avoids `@types/node` leaking into the
library's `.d.ts`.
**Done when:** (1) Behavioral: a fresh `npm run build:lib` writes the two files and
`npm test` still passes end to end. (2) Verification: the wiring command above exits 0;
`npm test` exits 0.
**Validation:** Narrow — the wiring command + the gate.

### Phase 1b: the emitted tree is ignored where it must be

**Goal:** `lib/` never enters git and never trips lint.
**Changes:**
- [ ] `.gitignore` — add `lib/` under "Node / build".
- [ ] `eslint.config.js` — add `'lib/**'` to `ignores` (V11).
**Call chain:** `npm test` → `eslint .` (skips `lib/`); `git status` after `build:lib`.
**Wiring test:** after `npm run build:lib`: `git status --porcelain lib` prints nothing AND
`npm run lint` exits 0. RED before (lib/ shows as untracked; eslint parses `lib/*.js` under
the TS rules), GREEN after.
**Depends on:** 1a.
**Read-set:** `.gitignore`, `eslint.config.js`. **Write-set:** the same two files.
**Shared-state contract:** none beyond the write-set.
**Risks:** none material.
**Done when:** (1) Behavioral: a build leaves the tree clean and lint-green. (2) Verification:
the two commands above; `npm test` exits 0.
**Validation:** Narrow.

### Phase 1c: the export path exists, and the audit stops noting it

**Goal:** `import 'croft-pwa/pds-walker'` resolves inside the repo and for a git consumer;
check 47e is silent.
**Changes:**
- [ ] `package.json` — `exports: { "./pds-walker": { "types": "./lib/pds-walker/index.d.ts", "default": "./lib/pds-walker/index.js" } }`, `files: ["lib/pds-walker"]`, `prepare: "npm run build:lib"`. `private: true` stays (V6) — with a comment-line in `TODO.md` § 3 saying why, since JSON has no comments.
- [ ] `tests/unit/pds-walker-export.test.ts` — (i) `await import('croft-pwa/pds-walker')` resolves and `VERSION === '0.1.0'` (V1); (ii) `npm pack --dry-run --json` (via `child_process.execFileSync`) lists exactly `package.json` + `lib/pds-walker/*` (V4).
**Call chain:** consumer `import { … } from 'croft-pwa/pds-walker'` → Node/esbuild `exports` resolution → `lib/pds-walker/index.js` (built by `prepare` on install, by `build:lib` in the gate).
**Wiring test:** `npx vitest run tests/unit/pds-walker-export.test.ts` — RED before (ERR_PACKAGE_PATH_NOT_EXPORTED), GREEN after. Plus the workspace check: `bash ../../../.claude/bin/shared-code.sh "$PWD"` prints no line containing `check 47e`.
**Depends on:** 1a (the files exist), 1b (lint ignores them).
**Read-set:** `package.json`, `lib/pds-walker/*`. **Write-set:** `package.json`, `tests/unit/pds-walker-export.test.ts`.
**Shared-state contract:** the test shells out to `npm pack --dry-run` (no files written; `--json` to stdout). Vitest runs with the built `lib/` present — the unit step runs after `build:lib` in the gate order set in 1a? **No:** `test` runs `unit` before `build:lib`. This phase reorders `test` to `lint && typecheck && build:lib && unit && build && e2e` (one more `package.json` edit, same file) so the export test sees the build. Recorded here so Pass 2 checks it.
**Risks:** vitest's module resolution of a self-reference — V1 proved Node; vitest uses vite-node, which honors `exports` (to be confirmed by the RED→GREEN run; if it does not, the test falls back to `createRequire(import.meta.url).resolve('croft-pwa/pds-walker')` which is pure Node — decision recorded in the Review Log at execution).
**Done when:** (1) Behavioral: from a scratch directory, `npm install <path-to-this-worktree>` followed by `node -e "import('croft-pwa/pds-walker').then(m => console.log(m.VERSION))"` prints `0.1.0` (a local path install runs `prepare` the same way a git install does — V5). (2) Verification: the vitest command; the 47e check; `npm test`.
**Validation:** Moderate — the scratch-directory install is the "outside the harness" run.

### Phase 1d: release plumbing (D3) and the docs that name the shape

**Goal:** a tag `pds-walker-vX.Y.Z` can only release when it equals `VERSION`, the changelog
is ready for two clocks, and the README says the repo is a package.
**Changes:**
- [ ] `.github/workflows/release-pds-walker.yml` — mirrors CISS's `release.yml` (V12): `on: push: tags: ["pds-walker-v*"]`; derive `version=${TAG#pds-walker-v}`; read `VERSION` from `src/pds-walker/index.ts` with `grep -oE "VERSION = '[0-9.]+'"`; `exit 1` on mismatch; run `npm ci && npm test`; `npm pack`; `gh release create "$TAG" --title … --notes-file <(sed -n "/^## \[pds-walker $version\]/,/^## /p" CHANGELOG.md)`; upload the tarball + its sha256. `permissions: contents: write`. Actions SHA-pinned (SUPPLY-CHAIN rule; check 33).
- [ ] `CHANGELOG.md` — a `Contexts: site · pds-walker` line under the intro; existing entries gain `- **site:**` prefixes (check 40 flags a declared-contexts file whose entries lack one — V7's finder); a `- **pds-walker:** croft-pwa is now also a package …` entry under `## 2026-09`.
- [ ] `README.md` — the "copies to start" sentence (Documentation Impact).
**Call chain:** `git push origin pds-walker-v0.1.0` → workflow → gate → release with asset.
**Wiring test:** a workflow cannot run locally; the gate logic is a shell block, so the
wiring test is: `TAG=pds-walker-v0.1.0 bash -c '<the same block>'` exits 0 and
`TAG=pds-walker-v9.9.9 …` exits 1 — run locally at phase end, and the real proof is the
first tag (Phase 6c, Validation: broad). `bash ../../../.claude/bin/changelog-shape.sh "$PWD"`
prints no FLAG (contexts declared and used).
**Depends on:** 1a (VERSION exists).
**Read-set:** `CISS/.github/workflows/release.yml`, `CHANGELOG.md`, `README.md`.
**Write-set:** `.github/workflows/release-pds-walker.yml`, `CHANGELOG.md`, `README.md`.
**Shared-state contract:** none locally; on GitHub the workflow needs `contents: write`.
**Risks:** retro-prefixing existing changelog entries is a mechanical edit of ~20 lines —
check 40 is the test. `TODO.md` § 3 also ticks here (a fourth file, one checkbox; counted
as the doc-impact carry, not a change).
**Done when:** (1) Behavioral: the changelog passes check 40 with two contexts; the
release block accepts a matching tag and refuses a mismatched one. (2) Verification: the
two `TAG=…` runs; `changelog-shape.sh`; `npm test`.
**Validation:** Moderate now (local shell runs); Broad at Phase 6c (the real tag).

---

### Phase 2a: the pure core — rings and "as of"

**Goal:** given snapshots, compute `me`/`mut`/`fol`/`hop` with the containment chain and the
honest `asOf`.
**Changes:**
- [ ] `src/pds-walker/core/rings.ts` — types `Did`, `Rev`, `RepoSnapshot`, `RingId`, `Ring`; `rings({ me, snapshots }) → Record<RingId, Ring>`: `mut` = followees whose snapshot lists `me`; `fol` = me's follows; `hop` = union of followees' follows; every ring includes the tighter ones (V15's rule); `asOf` = the OLDEST `fetchedAt` among the ring's sources; `complete` = every source present.
- [ ] `tests/unit/pds-walker-rings.test.ts` — table cases from the research (mutual/non-mutual followee; a followee with no snapshot → `hop.complete=false`, `hop` still includes what is known; `asOf` is the minimum); a property test over random small graphs: `me ⊂ mut ⊂ fol ⊂ hop` always holds (see OQ1 for the generator).
- [ ] `src/pds-walker/index.ts` — re-exports.
**Call chain:** `createWalker().ring(id)` (Phase 5) → `rings()`; until then, the export path.
**Wiring test:** `tests/unit/pds-walker-export.test.ts` gains an assertion that `rings` is exported and computes the two-node example; RED → GREEN.
**Depends on:** 1c.
**Read-set:** `forage/js/rings.js` (the semantics). **Write-set:** the three files above.
**Shared-state contract:** none.
**Risks:** "unknown is not empty" is a walker property (Phase 5), but `complete=false` is what carries it here — the test pins that a missing source lowers `complete`, never the membership.
**Done when:** (1) Behavioral: the export computes rings for the research's worked example. (2) Verification: `npx vitest run tests/unit/pds-walker-rings.test.ts tests/unit/pds-walker-export.test.ts`; `npm test`.
**Validation:** Narrow.

### Phase 2b: the pure core — the rev gate

**Goal:** decide, from a stored snapshot and a fresh rev, whether to re-list.
**Changes:**
- [ ] `src/pds-walker/core/revgate.ts` — `decide({ snapshot, latestRev, now, refreshMs }) → 'keep' | 'relist' | 'unknown'`: `latestRev` unknown → `'unknown'` (keep the snapshot); equal revs → `'keep'`; moved → `'relist'`; no snapshot → `'relist'`. `refreshMs` is when to even ask (see 2c).
- [ ] `tests/unit/pds-walker-revgate.test.ts` — the four branches; a TID comparison case (revs compare lexically, V14's TID note); the unknown branch never returns `'relist'`.
- [ ] `src/pds-walker/index.ts` — re-export.
**Call chain:** `walker.refresh()` (Phase 5) → `decide()`.
**Wiring test:** export test gains `decide` presence + one case; RED → GREEN.
**Depends on:** 2a. **Read-set:** `core/rings.ts` types. **Write-set:** the three files.
**Shared-state contract:** none. **Risks:** none material.
**Done when:** (1) the export decides the four cases; (2) `npx vitest run tests/unit/pds-walker-revgate.test.ts`; `npm test`.
**Validation:** Narrow.

### Phase 2c: the pure core — cadence

**Goal:** per-ring refresh intervals and "which repos are due now".
**Changes:**
- [ ] `src/pds-walker/core/cadence.ts` — `Policy` type + `defaultPolicy` (research § 4: me 60 s, ring-1 10 min, hop daily; `perHostConcurrency: 4`, `ring2Parallel: 10`); `due({ snapshots, now, policy, ring }) → Did[]`; `ring2Targets({ moved }) → Did[]` (only followees whose rev moved are re-walked).
- [ ] `tests/unit/pds-walker-cadence.test.ts` — due-ness at boundaries; `ring2Targets` returns exactly the movers; policy overrides merge.
- [ ] `src/pds-walker/index.ts` — re-export.
**Call chain:** `walker.refresh()` → `due()` → `decide()` per due repo → `ring2Targets()`.
**Wiring test:** export test gains `defaultPolicy` presence; RED → GREEN.
**Depends on:** 2b. **Write-set:** the three files. **Shared-state contract:** none.
**Risks:** none material.
**Done when:** (1) the export computes due sets; (2) the vitest file; `npm test`.
**Validation:** Narrow. **After 2c:** mutation testing on `core/` (OQ2) before Phase 3 starts; survivors triaged in the Review Log.

---

### Phase 3a: transport — identity resolution

**Goal:** `did:plc` and `did:web` → PDS endpoint, or `unknown`.
**Changes:**
- [ ] `src/pds-walker/transport/resolve.ts` — `resolveDid(did, { fetchImpl })`: `did:plc` → `https://plc.directory/<did>`; `did:web` → `https://<host>/.well-known/did.json`; pick the `#atproto_pds` service; any non-2xx / bad JSON / missing service → `{ unknown: reason }`. Pattern: `pdsEndpointFromDoc` already exists in `src/atproto/read.ts` — **reuse it by import**, do not copy (SHARED-CODE rule 4 applies inside a repo too).
- [ ] `tests/fixtures/pds/plc-did-doc.json` — harvested: the `did:plc:z72i7hdynmk6r22z27h6tvur` doc from the 2026-09-08 probe (URL recorded in a `_source` field).
- [ ] `tests/unit/pds-walker-resolve.test.ts` — fake fetch (V10 pattern): plc happy path; did:web; 404 → unknown; a doc with no PDS service → unknown.
**Call chain:** `walker.walk()` → `transport.resolve()` → `resolveDid()`.
**Wiring test:** export test: `resolveDid` present and resolves the fixture through an injected fetch; RED → GREEN.
**Depends on:** 2c. **Read-set:** `src/atproto/read.ts`. **Write-set:** the three files (+ `index.ts` re-export — a fourth touch; split: the re-export moves to 3d).
**Shared-state contract:** none (fetch injected). **Risks:** `read.ts`'s `pdsEndpointFromDoc` signature — read it before use (Pass 2 verifies).
**Done when:** (1) resolution through the export with an injected fetch; (2) the vitest file; `npm test`.
**Validation:** Narrow.

### Phase 3b: transport — the PDS calls

**Goal:** `latestRev` and `listFollows` (paged) against a PDS, honest on failure.
**Changes:**
- [ ] `src/pds-walker/transport/pds.ts` — `latestRev(pds, did, deps)` → `com.atproto.sync.getLatestCommit` → `rev` or unknown; `listFollows(pds, did, deps)` → `com.atproto.repo.listRecords?collection=app.bsky.graph.follow&limit=100`, follows `cursor` until absent, returns `subject` DIDs or unknown (a failure mid-way returns unknown, never a partial list — a partial list would shrink a ring).
- [ ] `tests/fixtures/pds/listRecords-page1.json`, `…-last.json`, `getLatestCommit.json`, `pds-502.txt`, `pds-403-opendns.html` — harvested from the probes (each with its source URL).
- [ ] `tests/unit/pds-walker-pds.test.ts` — two-page walk; last page without cursor; 502 mid-walk → unknown; the 403 HTML body → unknown (not a JSON parse crash); `getLatestCommit` shape.
**Call chain:** `walker.walk()`/`refresh()` → `transport.listFollows()`/`latestRev()`.
**Wiring test:** export test gains one paged walk through injected fetch; RED → GREEN.
**Depends on:** 3a. **Write-set:** the three items above (fixtures counted as one data set). **Shared-state contract:** none.
**Risks:** none material.
**Done when:** (1) a two-page walk through the export yields both pages' subjects; (2) the vitest file; `npm test`.
**Validation:** Narrow.

### Phase 3c: transport — the per-host limiter

**Goal:** never more than N in flight per PDS host; back off when `RateLimit-Remaining` is low.
**Changes:**
- [ ] `src/pds-walker/transport/limiter.ts` — `hostLimiter({ perHost })` returning `run(host, fn)`; reads `RateLimit-Remaining`/`RateLimit-Reset` from responses via a hook and pauses that host until reset when remaining < 10.
- [ ] `src/pds-walker/transport/pds.ts` — calls go through the limiter (deps gain `limiter`).
- [ ] `tests/unit/pds-walker-limiter.test.ts` — with a fake clock: N+1 calls to one host → the last waits; a low `RateLimit-Remaining` header pauses until reset; two hosts do not block each other.
**Call chain:** `listFollows()` → `limiter.run(host, …)` → `fetch`.
**Wiring test:** `pds-walker-pds.test.ts` gains a case proving the limiter is in the path (a call with `perHost: 1` serializes two page fetches); RED → GREEN.
**Depends on:** 3b. **Write-set:** the three files. **Shared-state contract:** none (clock injected).
**Risks:** timer-based tests — use injected `now`/`sleep`, never real timers.
**Done when:** (1) concurrency observed ≤ N per host in the test; (2) the two vitest files; `npm test`.
**Validation:** Narrow.

### Phase 3d: transport — the export, and one live journey

**Goal:** the transport is reachable through the export path, and one real PDS answers.
**Changes:**
- [ ] `src/pds-walker/index.ts` — `createFetchTransport({ fetchImpl?, perHost? }) : Transport` composing 3a–3c; re-exports.
- [ ] `tests/live/pds-walker.live.spec.ts` — under `e2e:live` (never the default gate): resolve a stable public account (OQ3), `latestRev` returns a TID, `listFollows` returns ≥ 1 DID; asserts shape, not values.
- [ ] `tests/unit/pds-walker-export.test.ts` — `createFetchTransport` present; a resolve→list chain through injected fetch.
**Call chain:** consumer → `createFetchTransport()` → 3a–3c.
**Wiring test:** the export test's chain case; RED → GREEN. Live: `npm run e2e:live -- tests/live/pds-walker.live.spec.ts`.
**Depends on:** 3c. **Write-set:** the three files. **Shared-state contract:** the live spec reads the network (one public account, ~3 requests); TESTBED.md needs no claim (no shared credential or device).
**Risks:** live flake is not a gate failure by construction (`:live` suffix is the recorded reason, VERIFICATION.md).
**Done when:** (1) a consumer can build a transport from the export and reach a real PDS; (2) the vitest export test; the live spec once, output pasted into the Review Log; `npm test`.
**Validation:** Broad for the live half (one real run, recorded).

---

### Phase 4a: the store — interface and memory

**Goal:** `Store` as the persistence seam; a memory implementation for tests and Node.
**Changes:**
- [ ] `src/pds-walker/store/types.ts` — `Store { get, put, all }` over `RepoSnapshot`.
- [ ] `src/pds-walker/store/memory.ts` — `memoryStore()`.
- [ ] `tests/unit/pds-walker-store.test.ts` — put/get/all; overwrite keeps the newer; `all()` returns copies (immutability).
**Call chain:** `createWalker({ store })` (Phase 5) → `store.get/put`.
**Wiring test:** export test gains `memoryStore` presence (re-export lands in 4b to hold the three-file rule); so this phase's wiring test is the store test itself plus a `tsc -p tsconfig.lib.json` that includes the files (they are under `src/pds-walker`).
**Depends on:** 3d. **Write-set:** the three files. **Shared-state contract:** none.
**Done when:** (1) the memory store round-trips; (2) the vitest file; `npm test`.
**Validation:** Narrow.

### Phase 4b: the store — IndexedDB, proven in a browser

**Goal:** the same `Store` over IndexedDB, proven in Playwright (not a fake).
**Changes:**
- [ ] `src/pds-walker/store/indexeddb.ts` — `indexedDbStore(name)`; one object store keyed by `did`.
- [ ] `src/pds-walker/index.ts` — re-exports `memoryStore`, `indexedDbStore`, `Store`.
- [ ] `tests/e2e/pds-walker-store.spec.ts` — opens `index.html`, `page.addScriptTag({ type: 'module', content })` where `content` is an esbuild bundle string of a tiny driver importing `croft-pwa/pds-walker` (built in the test with the esbuild API, V2), then put/get/all through the real IndexedDB; a reload proves persistence.
**Call chain:** rings page (Phase 6) → `indexedDbStore()`; until then, the e2e driver.
**Wiring test:** the e2e spec; RED (no export) → GREEN.
**Depends on:** 4a. **Write-set:** the three files. **Shared-state contract:** the browser's IndexedDB under the test origin (cleared per Playwright context).
**Risks:** `addScriptTag` under the site's CSP — the CSP is build-time and allows hashed page scripts only (V9's SRI); an injected module tag may be refused. Mitigation to verify at execution: Playwright's `page.route` to serve the driver as a file under the served origin with a CSP-exempt path, or run the spec against a test-only HTML served by the same `tools/serve.mjs`. Recorded as OQ4 (PHASE-GATED 4b).
**Done when:** (1) snapshots survive a reload in a real browser; (2) `npx playwright test tests/e2e/pds-walker-store.spec.ts`; `npm test`.
**Validation:** Moderate.

---

### Phase 5: the walker

**Goal:** `createWalker()` wires core + transport + store + clock into the public surface.
**Changes:**
- [ ] `src/pds-walker/walker.ts` — `createWalker({ transport, store, policy?, now? })`: `walk(me)` resolves and lists ring 1 (parallel across followees under the limiter), computes `me`/`mut`/`fol`, then fills `hop` in the background at `ring2Parallel` emitting `progress`; `refresh()` asks `latestRev` for due ring-1 repos, re-lists movers, re-walks only their ring-2 subtrees; `hosts()` lists unknown hosts with `since`; `on()`; `stop()` cancels background work.
- [ ] `src/pds-walker/index.ts` — re-export `createWalker` and the public types (the surface below).
- [ ] `tests/unit/pds-walker-walker.test.ts` — scripted fake transport + memory store + fake clock: (i) unknown-is-not-empty (a host failing on refresh leaves the ring and marks the host); (ii) refresh touches only movers; (iii) `asOf` is the oldest source; (iv) containment after every event; (v) `stop()` halts the background fill; (vi) `progress` counts up to the followee count.
**Public surface (fixed):**
```ts
type Did = `did:${string}`; type Rev = string;
type RepoSnapshot = { did: Did; pds: string; rev: Rev; follows: readonly Did[]; fetchedAt: number };
type HostState = { host: string; state: 'ok' | 'unknown'; since: number; reason?: string };
type RingId = 'me' | 'mut' | 'fol' | 'hop';
type Ring = { id: RingId; members: ReadonlySet<Did>; asOf: number; complete: boolean };
type Transport = { resolve(did: Did): Promise<{ pds: string } | { unknown: string }>;
                   latestRev(pds: string, did: Did): Promise<Rev | { unknown: string }>;
                   listFollows(pds: string, did: Did): Promise<readonly Did[] | { unknown: string }> };
type Store = { get(did: Did): Promise<RepoSnapshot | null>; put(s: RepoSnapshot): Promise<void>; all(): Promise<RepoSnapshot[]> };
type Policy = { refreshMs: Record<RingId, number>; perHostConcurrency: number; ring2Parallel: number };
type Walker = { ring(id: RingId): Ring; walk(me: Did, opts?: { rings?: RingId[] }): Promise<void>;
                refresh(): Promise<void>; hosts(): HostState[];
                on(event: 'ring' | 'host' | 'progress', fn: (e: unknown) => void): () => void; stop(): void };
declare function createWalker(deps: { transport: Transport; store: Store; policy?: Partial<Policy>; now?: () => number }): Walker;
```
**Call chain:** rings page (6a) → `createWalker()`; forage (Phase 7) → the same.
**Wiring test:** export test: `createWalker` with fake deps walks a three-node graph and `ring('mut')` is right; RED → GREEN.
**Depends on:** 4b. **Write-set:** the three files. **Shared-state contract:** none (all deps injected).
**Risks:** the background fill and `stop()` — use an injected scheduler (`queueMicrotask`-free, explicit `tick()` in tests) so tests are deterministic.
**Done when:** (1) the six behaviors above hold through the export; (2) the vitest file; `npm test`.
**Validation:** Moderate — plus one manual Node run against the real transport for a small public account (recorded in the Review Log).

---

### Phase 6a: the rings page — wired through the export path

**Goal:** `rings.html` walks any handle live from PDSs, drawing as it fills.
**Changes:**
- [ ] `rings.html` — the page shell (chassis tokens; handle field; three ring cards with count + "as of"; a hosts panel; a live region for progress).
- [ ] `src/pages/rings.ts` — resolves the handle (via `src/atproto/read.ts` `resolveHandle`), then `import { createWalker, createFetchTransport, indexedDbStore } from 'croft-pwa/pds-walker'` (**the export path**, V2), renders on `ring`/`host`/`progress` events; ring 2 shown as it fills with "as of" and "N of M followees".
- [ ] `build.mjs` — `PAGES` entry for `rings.html` (V9).
**Call chain:** browser → `rings.html` → `src/pages/rings.ts` → `croft-pwa/pds-walker` → PDSs.
**Wiring test:** `tests/e2e/rings.spec.ts` (6b) — this phase lands with the page building and a smoke assertion added to `tests/e2e/smoke.spec.ts`? No — three files. The wiring test lands in 6b; 6a's verification is `npm run build` producing `dist/rings.html` with a hashed, SRI-stamped script (the build fails otherwise).
**Depends on:** 5. **Write-set:** the three files. **Shared-state contract:** none.
**Risks:** CSP `connect-src` — the page fetches arbitrary PDS hosts, so `connect-src` must allow `https:` for this page (build-time CSP is per-site; verify how `build.mjs` composes it — Pass 2 checks).
**Done when:** (1) the built page loads and, given a handle, shows rings filling; (2) `npm run build` + a manual browser run against a real handle (Validation: Moderate); `npm test`.
**Validation:** Moderate.

### Phase 6b: the rings page — gated

**Goal:** the page is proven hermetically, accessibly, and on a phone-sized viewport.
**Changes:**
- [ ] `tests/e2e/rings.spec.ts` — `page.route` mocks for `plc.directory`, `getLatestCommit`, `listRecords` (fixtures from 3b); asserts the three counts, the "as of" text, ring 2 growing across two routed followees, and a routed 502 host appearing in the hosts panel (unknown, not empty); axe scan (ACCESSIBILITY.md); 390 px viewport, no horizontal overflow, 44 px targets (MOBILE-FIRST.md).
- [ ] `src/nav.ts` — the page joins the nav (V9's sibling registry — Pass 2 confirms where nav is).
- [ ] `src/pages/guide-content.ts` — a user-guide chapter: what a ring is, what "as of" means, what "unknown host" means.
**Call chain:** as 6a.
**Wiring test:** `npx playwright test tests/e2e/rings.spec.ts`; RED → GREEN.
**Depends on:** 6a. **Write-set:** the three files. **Shared-state contract:** none (routes mocked).
**Risks:** the existing `a11y.spec.ts` may enumerate pages by a list — if so it is a fourth file; Pass 2 checks and, if needed, this phase splits.
**Done when:** (1) the page passes its hermetic behavior, a11y and mobile gates; (2) the spec; `npm test`.
**Validation:** Moderate; plus one `e2e:live` run of the page against a real handle, recorded.

### Phase 6c: the first release — `pds-walker-v0.1.0`

**Goal:** the first tag, gated by 1d's workflow.
**Changes:**
- [ ] `CHANGELOG.md` — `## [pds-walker 0.1.0] — <date>` section above the month sections (V7).
- [ ] `TODO.md` — § 3 removed (done).
- [ ] `src/pds-walker/index.ts` — `VERSION` confirmed `0.1.0` (no change expected; the tag must equal it).
**Call chain:** `git tag pds-walker-v0.1.0 && git push --tags` → 1d's workflow.
**Wiring test:** the workflow run itself: release created with the tarball asset and its sha256; `changelog-shape.sh` prints no FLAG for the new tag.
**Depends on:** 6b landed on `main` (the tag is cut from `main`).
**Write-set:** the three files. **Shared-state contract:** GitHub: a tag and a release.
**Risks:** first run of the two-clock changelog under checks 38/40 — the workspace audit after the tag is the proof.
**Done when:** (1) `gh release view pds-walker-v0.1.0` shows the asset; (2) `bash CroftC/.claude/bin/workspace-audit.sh` shows no croft-pwa changelog FLAG and no 47e NOTE.
**Validation:** Broad.

---

### Phase 7: first consumer — forage (shaped here, executed under a forage plan)

- `package.json`: `"croft-pwa": "github:CroftCommunity/croft-pwa#<sha of pds-walker-v0.1.0>"`.
- `npm run vendor:sync` copies `node_modules/croft-pwa/lib/pds-walker/index.js` → `js/vendor/pds-walker.js`; `test/vendor.test.js` gains byte-equality against the installed file.
- One call site: `ringGraph()` takes follows from the walker; mutuals from the walker once ring 2 has filled, AppView until then.
- VERSIONING.md § Cross-repo pins gains forage's row; check 47c is the reminder.

### Phase 8: optional, later — Jetstream for ring 1

When signed in and following ≤ 10,000 accounts, a Jetstream socket replaces the ring-1
poll. Not before the walker has a measured poll cost to compare against.

## Deployment

- **The library:** released by tag, `pds-walker-vX.Y.Z`, cut from `main` after the landing
  that completes a release's scope; the workflow gates tag == `VERSION` and attaches the
  `npm pack` tarball + sha256. Consumers pin the **sha** of the tagged commit and record the
  tag in their changelog line. First tag at Phase 6c.
- **The page:** croft-pwa's existing `deploy` job (needs the gate, `main` only, Pages).
- **The record:** `CHANGELOG.md` — `pds-walker:`-prefixed entries per landing under the
  month, plus a `[pds-walker X.Y.Z]` section per tag.
- **The pin register:** VERSIONING.md § Cross-repo pins gains forage's row at Phase 7.
- **Verification of the deploy:** the page's `e2e:live` run against the deployed site
  once after 6b lands; `gh release view` after 6c; the workspace audit after both.

## Decisions

| id | question | options | recommendation | status |
|---|---|---|---|---|
| D1 | Does the library get a reference page on the site? | (a) yes, `rings.html`, public handle input; (b) library only | (a) | **(a) — owner, 2026-09-08** |
| D2 | How does forage, which has no bundler, consume the package? | (a) pin + `vendor:sync` + byte-equality test; (b) a build step for forage | (a) | **(a) — owner, 2026-09-08** |
| D3 | Versioning of the library | (a) sha pins only, no tags yet; (b) `pds-walker-vX.Y.Z` tags from the first landing | (a) was recommended | **(b) — owner, 2026-09-08**; plumbing in 1d, first tag at 6c |

Settled upstream, not re-opened here: TypeScript not wasm; croft-pwa as home; default
rings; re-list on rev change; outer ring draws as it fills (research doc § 7).

## Open Questions

- [RECOMMENDED: PHASE-GATED (2a)] **OQ1** Add `fast-check` as a devDependency for the
  containment property test, or write a seeded generator in the test? *A new dependency
  passes SUPPLY-CHAIN.md's rung (osv + licence) first; a 40-line seeded generator avoids the
  question entirely and the property is simple. Recommend the generator unless the owner
  wants property testing as a house tool.*
- [RECOMMENDED: PHASE-GATED (after 2c)] **OQ2** Mutation testing tool for the pure core:
  `@stryker-mutator/core` + vitest runner as devDependencies (global CLAUDE.md expects
  mutation testing on non-trivial modules; the rings/revgate/cadence trio qualifies). *Same
  supply-chain rung; stryker is the named TypeScript tool. Recommend adding it, dev-only.*
- [RECOMMENDED: PHASE-GATED (3d)] **OQ3** Which public account anchors the live journey?
  *It must be stable and follow ≥ 1 account; the research used `pfrazee.com` and
  `jay.bsky.team`. Recommend the croft test account from TESTBED.md if it follows anyone,
  else `bsky.app` (14 follows, official).*
- [RECOMMENDED: PHASE-GATED (4b)] **OQ4** Does the site's build-time CSP admit an injected
  module script in the IndexedDB e2e, or does the spec need a served test page? *Decides the
  spec's mechanism, not the store. Resolve by reading `build.mjs`'s CSP composition in Pass 2.*
- [RECOMMENDED: ADVISORY] **OQ5** `package.json` `version` stays the site's clock
  (`0.1.0` today) while `VERSION` in the library is the package's — two `0.1.0`s that mean
  different things. *Acceptable if the README says so; alternatively the site's stamp could
  drop the package version and show only the sha. No phase depends on it.*

## Review Log

- 2026-09-08 — drafted from the research doc and SHARED-CODE.md; D1–D3 put to the owner.
- 2026-09-08 — owner took D1 (a), D2 (a), D3 (b). D3 against the recommendation: tags
  from the first landing; plumbing folded into Phase 1d, first tag at 6c.
- 2026-09-08 — **Pass 1 (template form).** The first draft met the workspace floor but not
  the `phase-plan` template: no Verified Assumptions, no Documentation Impact, no
  Concurrency Map, no per-phase call chain / wiring test / write-sets, and phases touching
  8–10 files. Rewritten additively: the same seven-phase spine, split into 1a–1d, 2a–2c,
  3a–3d, 4a–4b, 5, 6a–6c under the ≤3-file rule; V1–V15 verified by probes (Node
  self-reference, esbuild, tsc emit, npm pack, npm prepare semantics, the audit finders'
  exact patterns); OQ1–OQ5 raised with recommended severities. Phase 0 discovery judged
  unnecessary because every behavioral assumption is verified firsthand.
