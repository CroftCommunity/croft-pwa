# Plan: pds-walker — the rev-gated ring walker, as croft-pwa's first library export

date: 2026-09-08
identity: chasemp (`chase@owasp.org`, `github-personal`), repo `CroftCommunity/croft-pwa`
**Status:** Pass 2 complete (gap analysis against the code, 2026-09-08 — V16–V30 added, gate
order and `files` corrected, 6b split into 6b/6b-ii/6b-iii, OQ4 resolved, OQ6–OQ9 raised);
Pass 3 pending; no phase started. D1–D3 decided by the owner (§ Decisions); OQ1–OQ5
severities confirmed by the owner 2026-09-08.

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

Pass 2 rows (read 2026-09-08 at worktree commit `8ff9a1b`, main checkout `edff652` for
`node_modules`; anchors are symbols and headings, per TRACKING.md):

| # | Assumption | How verified |
|---|---|---|
| V16 | `src/atproto/read.ts` exports `pdsEndpointFromDoc(doc: DidDocument): string \| null` (pure; matches `type === 'AtprotoPersonalDataServer'` or an id ending `#atproto_pds`) AND `resolvePds(did, deps: ReadDeps): Promise<string>` which already does the whole of Phase 3a's job — `did:plc` via `plcDirectory`, `did:web` via `.well-known/did.json` (path form included), endpoint pick, trailing slash trimmed — throwing `AtprotoReadError` (with `status`) on non-2xx / no endpoint / unsupported method. `ReadDeps.fetchImpl` is the injection seam | `read.ts` § `pdsEndpointFromDoc`, § `resolvePds`, `interface ReadDeps`; `tests/unit/atproto-read.test.ts` imports both |
| V17 | `build.mjs` composes ONE `csp` string (§ "7. Build-time CSP") and stamps it into every page with `replaceAll('%CSP%', csp)` (§ "8. Render each HTML page") — there is no per-page CSP today. `connect-src` is a static list: `'self'`, `public.api.bsky.app`, `plc.directory`, `bsky.social`, `*.host.bsky.network`, plus the entryways in `src/signin/providers.json` (blacksky.app, eurosky.social, northsky.social). `script-src` is `'self'` + the theme-init sha256 only — an injected inline `<script>` (Playwright `addScriptTag({ content })`) is refused | `build.mjs` § 7 (`const csp = [`), § 8 (`for (const p of PAGES)`); `docs/ATPROTO.md` § CSP says the same in prose ("Arbitrary non-bsky PDS hosts still cannot be statically allowlisted … needs a header-level CSP or a per-host relaxation") |
| V18 | The nav is `TABS` in `src/nav.ts` (six tabs; the Standards tab's `active` list names the chapter basenames). The standards index is `CHAPTERS` in `src/pages/reference.ts` (cards carry `data-chapter`), and `tests/e2e/standards.spec.ts` asserts the card count equals its own `INDEX_CHAPTERS` list — a new card without a spec edit fails the gate | `src/nav.ts` § `const TABS`; `src/pages/reference.ts` § `const CHAPTERS`; `standards.spec.ts` § "the standards index links to every chapter" (`expect(await cards.count()).toBe(INDEX_CHAPTERS.length)`) |
| V19 | Three e2e specs enumerate pages by a hard-coded list — `tests/e2e/a11y.spec.ts` (`const PAGES`), `mobile-fit.spec.ts` (inline array), `csp.spec.ts` (inline array). A new page is not axe-scanned, width-checked or CSP-checked until it is added to each; none is derived from `build.mjs`'s `PAGES` | the three files' heads |
| V20 | Check 40 (`changelog-shape.sh` § "39: declared contexts") grades every `- `/`* ` line after a `## ` heading against `^[-*] (YYYY-MM(-DD)? )?\*\*<ctx>:\*\*`; the file's existing entries are `- 2026-08-30 Sign in at **Bluesky** …` (date, then prose) so **every one FLAGs** once `Contexts:` is declared, and `- 2026-08-30 **site:** …` is the matching form. The `Contexts:` line must start the line (`^\**Contexts:\**`), separators `·`/`,`/`\|`. Check 39 (§ "38: landings") excludes `.md`, dotfiles, `.github/`, `.claude/`, tests, `plans/`, `docs/`, lockfiles — **`package.json` is a run path**, so a landing that changes it without touching `CHANGELOG.md` NOTEs | the script's three sections; `CHANGELOG.md` § 2026-08 |
| V21 | A tag push triggers neither `ci.yml` (`push: branches: [main]`, `pull_request`, `workflow_dispatch`) nor `preview.yml` (`pull_request` types + dispatch) nor `security.yml` (`pull_request`, `push: main`, schedule, dispatch). The release workflow is alone on its trigger and must run the gate itself — including `npx playwright install --with-deps chromium` and the `~/.cache/ms-playwright` cache step `ci.yml`'s `gate` job uses | the three workflows' `on:` blocks; `ci.yml` § gate steps |
| V22 | npm 10.9.8 (Node v22.23.2): `npm install <folder>` outside the project **creates a symlink** and runs nothing (proves neither `prepare` nor `files`); `git+file` is a supported install protocol; `prepare` runs on `npm ci` and on bare `npm install` (§ "Life Cycle Operation Order") and on a git install after its devDependencies are installed; `npm pack` **always** includes `package.json`, `README*`, `LICENSE*` regardless of `files`; when `files` is present the root `.gitignore`/`.npmignore` are not consulted (`lib/` gitignored is still packed) | npm docs `commands/npm-install.md` § "npm install <folder>", § protocols; `using-npm/scripts.md` § prepare, § Life Cycle Operation Order; `configuring-npm/package-json.md` § files ("Certain files are always included"); `npm-packlist/lib/index.js` (`'!/readme{,.*}'`, `'!/license{,.*}'`; "package.json means no .npmignore or .gitignore") |
| V23 | vitest 2.1.9 / vite-node 2.1.9 / vite 5.4.21 (main checkout's `node_modules`; this worktree has none): vite has no package self-reference support, but vite-node's `_resolveUrl` passes an id vite cannot resolve through **unchanged** (only a `vite:alias` `noResolved` throws), and vitest's `fetchModule` then externalizes a non-file id as itself → native `import('croft-pwa/pds-walker')` → Node's self-reference (V1). **Read, not run** — 1c's RED→GREEN is the proof; the recorded fallback stands | `vite-node/dist/client.mjs` § `_resolveUrl`; `vitest/dist/chunks/execute.*.js` § externalize map |
| V24 | forage's `hop` is **the union of the MUTUALS' follows**, not follows-of-follows: `rings.js` § `chain()` — `add('hop', mutualsOf(graph).flatMap((m) => graph.hopFollows.get(m)))`; `lens.js` § `ringGraph(needsHop)` fetches `hopFollows` for `computeMutuals(follows, followers)` only. The research doc's ring 2 (440 k edges) is follows-of-follows. The two are different sets; see OQ6 | the two functions |
| V25 | TID facts live in `src/atproto/tid.ts` (13 base32-sortable chars; `isTid()` validates shape). The research doc has no "revs compare lexically" note — V14 was mis-cited in 2b; the rev gate needs **equality** only (`getLatestCommit` returns `{cid, rev}`, research § 3.1) | `tid.ts` header; research § 3.1 table |
| V26 | The hermetic e2e project blocks service workers (`playwright.config.ts` `serviceWorkers: 'block'`) and `a11y.spec.ts` aborts every non-localhost request — a new page must render its shell with no network and no SW | `playwright.config.ts` § use; `a11y.spec.ts` § `page.route('**/*')` |
| V27 | `build.mjs` fails the build when any page's gzipped bundle exceeds `PAGE_JS_GZ_BUDGET` (20 KB) — a tripwire raised deliberately, per its comment | `build.mjs` § "9. Bundle-size budget" |
| V28 | `docs/CI.md` § "Auditing another repo against this" is the checklist any workflow here must meet: `permissions:` read-only at workflow level and elevated per job, `timeout-minutes` on every job, `workflow_dispatch` present, toolchain pinned via `.nvmrc`. CISS's `release.yml` (V12) has dispatch with an `inputs.tag` (an existing tag to rebuild) but sets `contents: write` at **workflow** level — copy the shape, not that line | `docs/CI.md` § 5, § 7, § 8, the checklist; `CISS/.github/workflows/release.yml` § `on:`/`permissions:` |
| V29 | Root `tsconfig.json` (`moduleResolution: bundler`, `include: ["src","tests",…]`) and `eslint.config.js` (type-checked rules over `src/**/*.ts`, `tests/**/*.ts` via `projectService`) both resolve a `croft-pwa/pds-walker` import through `exports` → `./lib/pds-walker/index.d.ts`. So **`lint` and `typecheck` need `lib/` built first** once anything imports the self-name (1c's test; 6a's page). TS self-name resolution under `bundler` is documented TS behavior, not probed here | the two configs; TS handbook § "Package self-name resolution" (unprobed) |
| V30 | The repo's run convention: every run writes `RUN-<name>-SUMMARY.md` at the root with red→green evidence, gate output and a files-touched ledger | `CLAUDE.md` § Conventions ("Plans and RUN summaries"); `docs/PRACTICES.md` § RUN summaries |

Not verified (captured as Open Questions): whether `fast-check` and `stryker` pass the
supply-chain rung; a stable public account for the live journey. Reasoned from docs but
**not probed** (confirm at the named phase's first run): that `tsc -p tsconfig.lib.json`
emits `lib/atproto/read.js` when `src/pds-walker` imports it (tsc compiles the import
closure, `include` only seeds — Phase 3a's first `build:lib`); V23's vitest path (1c);
V29's TS self-name resolution (1c).

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

Added in Pass 2 (each is a reference that goes stale at the named phase):

- `CLAUDE.md` § The gate, `README.md` § Quick start, and the `ci.yml` comment "lint ·
  typecheck · unit · build · e2e" — the gate's sub-steps gain `build:lib` (and its order
  changes, see 1a). **Phase 1a** for `CLAUDE.md` (a doc-impact carry, same convention as
  `TODO.md` in 1d); `README.md` in **1d** (already in its write-set); the `ci.yml` comment
  in **1d** with the workflow (a comment-only edit, but `ci.yml` is the documented
  standard — say so in the commit).
- `CLAUDE.md` § Identity — "Provides: CI reference, standards pages" gains "the
  `croft-pwa/pds-walker` package"; **Phase 1c**.
- `CroftC/.claude/ARCHITECTURE.md` croft-pwa card — research § 7: "Its ARCHITECTURE card
  should say so when the package lands"; same CroftC PR as the SHARED-CODE flip, **Phase 1c**.
- `CroftC/.claude/CHANGELOGS.md` rule 2 — describes tagged repos (`[X.Y.Z]` sections) and
  continuously-deployed repos (month sections) but not a repo that is both; this plan's
  "two clocks" file (month sections for `site`, `[pds-walker X.Y.Z]` sections for the
  library) is a third shape the rule should name so check 38/40 readers do not read it as
  drift. CroftC PR, **Phase 1d** (when the `Contexts:` line lands).
- `docs/SECURITY.md` § CSP and `docs/ATPROTO.md` § CSP — both state that arbitrary PDS hosts
  cannot be allowlisted; if OQ7 takes (a), both gain the one recorded exception
  (`rings.html`, per-page `connect-src`); **Phase 6a**.
- `TODO.md` § 3 — correction to the Pass 1 line above: only boxes 1–3 are this plan's;
  box 4 (the eight `Ported from skylite` files become the canonical home; bluebird + fun
  consume them) is **not** done by any phase here, so § 3 is not removed at 6c — boxes 1–3
  tick and box 4 stays under a re-headed § 3 ("the OAuth/crypto modules as the next
  export"). Phase 6c's change list is corrected to match.
- `RUN-PDS-WALKER-SUMMARY.md` (repo root) — the repo's per-run evidence file (V30); written
  during execution, not by a phase. Recorded so the convention is not missed because the
  plan template has no slot for it.
- `CroftC/.claude/CI-PATTERN.md` § Current state — croft-pwa's row says "2 workflows" and
  four exist today; the table is not maintained per workflow, so the release workflow adds
  no obligation there. Grepped `CI-PATTERN.md` for "croft-pwa": rows 102, 117, 147–152, 171.

## Concurrency Map

All phases sequential. Reason: `src/pds-walker/index.ts` (the export surface) is in the
write-set of nearly every phase from 1a on, and each phase's wiring test imports through
it; `package.json` is written by 1a, 1c and 6c. No parallel set is declared. Every phase
runs in this worktree (`worktrees/pds-walker/croft-pwa`, branch `claude/pds-walker-plan`
→ phase branches off it); no phase invokes `git checkout`/`stash`/`rebase` in any shared
checkout; the only ambient state touched is `lib/` (gitignored build output) and, in
Phase 3d and 6b live runs, the network.

Pass 2 audit: map confirmed sequential. One missed-parallelism candidate surfaced by the
6b split — {6b, 6b-ii, 6b-iii} have disjoint write-sets (`rings.spec.ts` + `nav.ts` +
`guide-content.ts` / the three page-list specs / `reference.ts` + `standards.spec.ts`), no
shared state beyond the gate, and all depend only on 6a. Left sequential by default (each
is under an hour; three worktrees to save two of them is not a trade) — the owner may opt
in. Shared-state contract sharpened to invariants: every phase runs in
`worktrees/pds-walker/croft-pwa`; no phase runs `git checkout`/`stash`/`rebase`/`worktree`
against `CroftC/croft-pwa` (main checkout) or any other worktree; no phase binds a port
other than Playwright's 4173/4174 (and `lsof -ti :4173` is cleared before a run, per
`CLAUDE.md` § The gate); no phase writes outside the worktree except the scratch
directory for 1c's install proof. Re-entry verification (sequential, so informational):
`git -C CroftC/croft-pwa rev-parse HEAD` unchanged from `edff652` or later main; `git
status --porcelain` empty in the main checkout.

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
      **`build:lib && lint && typecheck && unit && build && e2e`** — `build:lib` FIRST.
      *Pass 2 correction (V29):* Pass 1 put it after `unit`, and 1c planned to move it
      before `unit`; both are wrong, because `lint` (type-checked rules via
      `projectService`) and `typecheck` resolve `croft-pwa/pds-walker` through `exports`
      to `lib/pds-walker/index.d.ts` the moment anything imports the self-name (1c's test,
      6a's page). `prepare` (1c) makes `npm ci` build `lib/` too, which would mask the
      wrong order in CI and on a fresh clone but not for a developer who edits
      `src/pds-walker` and runs `npm test` — the order is the honest fix, `prepare` is the
      convenience. The reorder lands here so 1c does not touch `package.json` for it.
- [ ] `CLAUDE.md` § The gate — the sub-step line reads `build:lib · lint · typecheck · unit ·
      build · e2e` (doc-impact carry; the plan's own convention from 1d).
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
- [ ] `package.json` — `exports: { "./pds-walker": { "types": "./lib/pds-walker/index.d.ts", "default": "./lib/pds-walker/index.js" } }`, **`files: ["lib"]`** (*Pass 2 correction:* Pass 1 said `lib/pds-walker`; Phase 3a imports `src/atproto/read.ts`, which `tsc` emits as `lib/atproto/read.js` — a tarball that omits it ships a `resolve.js` whose import is missing. `exports` is the public boundary, `files` is the shipping boundary; they need not coincide, and `exports` encapsulation keeps `lib/atproto/*` unreachable to consumers), `prepare: "npm run build:lib"`. `private: true` stays (V6) — with a comment-line in `TODO.md` § 3 saying why, since JSON has no comments. Note (V22): `prepare` runs on every `npm ci`/bare `npm install` from now on, so an emit error in `src/pds-walker` breaks install, not just the gate — intended.
- [ ] `tests/unit/pds-walker-export.test.ts` — (i) `await import('croft-pwa/pds-walker')` resolves and `VERSION === '0.1.0'` (V1); (ii) `npm pack --dry-run --json` (via `child_process.execFileSync`) lists **`package.json`, `README.md`, `LICENSE`, and otherwise only paths under `lib/`** — nothing from `src/`, `tests/`, `dist/`, no `*.html` (*Pass 2 correction, V22:* npm always packs README and LICENSE regardless of `files`, so Pass 1's "exactly `package.json` + `lib/pds-walker/*`" would fail in this repo; V4's scratch package had neither file).
- [ ] `CLAUDE.md` § Identity — "Provides:" gains the package (Documentation Impact).
**Call chain:** consumer `import { … } from 'croft-pwa/pds-walker'` → Node/esbuild `exports` resolution → `lib/pds-walker/index.js` (built by `prepare` on install, by `build:lib` in the gate).
**Wiring test:** `npx vitest run tests/unit/pds-walker-export.test.ts` — RED before (ERR_PACKAGE_PATH_NOT_EXPORTED), GREEN after. Plus the workspace check: `bash ../../../.claude/bin/shared-code.sh "$PWD"` prints no line containing `check 47e`.
**Depends on:** 1a (the files exist, and the gate order already has `build:lib` first), 1b (lint ignores them).
**Read-set:** `package.json`, `lib/pds-walker/*`. **Write-set:** `package.json`, `tests/unit/pds-walker-export.test.ts` (+ `CLAUDE.md`, doc carry).
**Shared-state contract:** the test shells out to `npm pack --dry-run` (no files written; `--json` to stdout). Vitest runs with the built `lib/` present because 1a put `build:lib` first — *Pass 2:* the reorder Pass 1 planned for this phase is done in 1a (and was itself wrong, see 1a); nothing to reorder here.
**Risks:** vitest's module resolution of a self-reference — V1 proved Node; vite has no self-reference support, but V23 (read, not run) says vite-node passes the unresolved bare id through and vitest externalizes it to a native `import()`, which is Node's path. To be confirmed by the RED→GREEN run. If it does not hold, the fallback is a native import that bypasses vite's transform — `const nativeImport = new Function('s', 'return import(s)') as (s: string) => Promise<unknown>; await nativeImport('croft-pwa/pds-walker')` — which loads the module through Node's own `exports` resolution (Pass 1's `createRequire(...).resolve` fallback only proves resolution, not loading). Decision recorded in the Review Log at execution.
**Done when:** (1) Behavioral, two proofs from a scratch directory outside the repo (*Pass 2 correction, V22:* `npm install <folder>` creates a symlink and runs no `prepare`, so Pass 1's proof proved neither `prepare` nor `files`): (a) `npm pack` in the worktree, then `npm install <path>/croft-pwa-0.1.0.tgz` — proves `files` + `exports`; (b) `npm install "git+file:///Users/cpettet/git/chasemp/CroftC/croft-pwa#<sha of the phase commit>"` — proves the git path consumers will use: clone, devDependencies, `prepare`, pack (slow: it installs the devDependencies in a temp clone; no browser download). After each: `node -e "import('croft-pwa/pds-walker').then(m => console.log(m.VERSION))"` prints `0.1.0`. (2) Verification: the vitest command; the 47e check; `npm test`.
**Validation:** Moderate — the two scratch-directory installs are the "outside the harness" run.

### Phase 1d: release plumbing (D3) and the docs that name the shape

**Goal:** a tag `pds-walker-vX.Y.Z` can only release when it equals `VERSION`, the changelog
is ready for two clocks, and the README says the repo is a package.
**Changes:**
- [ ] `.github/workflows/release-pds-walker.yml` — mirrors CISS's `release.yml` (V12): `on: push: tags: ["pds-walker-v*"]` **plus `workflow_dispatch` with an `inputs.tag` (an existing tag to rebuild — CISS's escape hatch, and `docs/CI.md` § 8's manual path)**; derive `version=${TAG#pds-walker-v}`; read `VERSION` from `src/pds-walker/index.ts` with `grep -oE "VERSION = '[0-9.]+'"`; `exit 1` on mismatch; `actions/setup-node` with `node-version-file: .nvmrc` + `cache: npm`; `npm ci`; **the Playwright cache step and `npx playwright install --with-deps chromium` exactly as `ci.yml`'s `gate` job (V21 — `npm test` runs e2e; without the browser the gate fails on a runner)**; `npm test`; `npm pack`; `gh release create "$TAG" --title … --notes-file <(sed -n "/^## \[pds-walker $version\]/,/^## /p" CHANGELOG.md)`; upload the tarball + its sha256. **`permissions: contents: read` at workflow level, `contents: write` on the job** (V28 — CI.md rule 5; do not copy CISS's workflow-level write); `timeout-minutes` on the job (rule 7). Actions SHA-pinned with the version comment (SUPPLY-CHAIN rule; check 33). Tag pushes reach no other workflow (V21), so there is no interplay with `ci.yml`/`preview.yml` to guard.
- [ ] `CHANGELOG.md` — a `Contexts: site · pds-walker` line under the intro (it must START its line — the finder matches `^\**Contexts:\**`); existing entries gain `- **site:**` prefixes in the form `- 2026-08-30 **site:** Sign in …` (*Pass 2 confirms, V20:* check 40 grades every entry line once `Contexts:` is declared, the date-then-prose form FLAGs, the date-then-bold-context form passes; the intro paragraph above the first `## ` is not graded); a `- 2026-09-DD **pds-walker:** croft-pwa is now also a package …` entry under `## 2026-09`.
- [ ] `README.md` — the "copies to start" sentence (Documentation Impact) and the Quick start line `npm run test # the gate: …` gains `build:lib`.
- [ ] `ci.yml` — the comment "lint · typecheck · unit · build · e2e" gains `build:lib` (comment only; a fourth file, counted as the doc carry — say in the commit that the documented standard's wording moved, nothing else).
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
as the doc-impact carry, not a change). *Pass 2:* the two-clock file (month sections +
`[pds-walker X.Y.Z]` sections) is a shape `CHANGELOGS.md` rule 2 does not yet name —
Documentation Impact carries the CroftC edit; until it lands, check 38 reads the version
section correctly (V7) and nothing FLAGs, so the doc edit is for readers, not the finder.
Check 39 counts `package.json` as a run path (V20): whichever landing carries 1a–1c must
also carry a `CHANGELOG.md` entry, or it NOTEs — see OQ9 for the landing cadence.
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
*Pass 2 — the definition of `hop` is an open decision (OQ6, gated on this phase).* Pass 1
wrote `hop` = union of followees' follows (the research doc's ring 2, ~440 k members for the
measured account). forage's shipped `hop` (V24) is the union of the **mutuals'** follows,
the smaller set — and forage is the first consumer (Phase 7) and the research § 7 says the
defaults "match forage's shipped `DEFAULT_STOPS`". Both satisfy the containment chain and
both are computable from the same snapshots (the walker lists every followee's follows
anyway, because mutuality is learned from them), so the decision changes one line of
`rings()` and one table row in the test, not the walk. The property test must run against
whichever definition is chosen, and the export test's two-node example must be a case that
distinguishes them (a non-mutual followee with follows of their own).
**Done when:** (1) Behavioral: the export computes rings for the research's worked example. (2) Verification: `npx vitest run tests/unit/pds-walker-rings.test.ts tests/unit/pds-walker-export.test.ts`; `npm test`.
**Validation:** Narrow.

### Phase 2b: the pure core — the rev gate

**Goal:** decide, from a stored snapshot and a fresh rev, whether to re-list.
**Changes:**
- [ ] `src/pds-walker/core/revgate.ts` — `decide({ snapshot, latestRev, now, refreshMs }) → 'keep' | 'relist' | 'unknown'`: `latestRev` unknown → `'unknown'` (keep the snapshot); equal revs → `'keep'`; moved → `'relist'`; no snapshot → `'relist'`. `refreshMs` is when to even ask (see 2c).
- [ ] `tests/unit/pds-walker-revgate.test.ts` — the four branches; a case with two well-formed TIDs that differ only in their last character (the gate compares revs for **equality** — *Pass 2 correction, V25:* V14 carries no TID note and the research doc never says revs compare lexically; ordering is not needed, `getLatestCommit` gives the current rev and the gate asks "moved or not". TID shape facts, if a test wants them, come from `src/atproto/tid.ts` `isTid()`); the unknown branch never returns `'relist'`.
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
- [ ] `src/pds-walker/transport/resolve.ts` — `resolveDid(did, { fetchImpl })`. *Pass 2 (V16):* `src/atproto/read.ts` `resolvePds(did, { fetchImpl })` already does all of this — `did:plc` via `plc.directory`, `did:web` via `.well-known/did.json` (the path form too), the `#atproto_pds` / `AtprotoPersonalDataServer` pick via `pdsEndpointFromDoc(doc: DidDocument): string | null`, trailing slash trimmed — and throws `AtprotoReadError` (non-2xx with `status`; no endpoint; unsupported method). So `resolveDid` is a **wrapper, not a re-implementation**: `try { return { pds: await resolvePds(did, { fetchImpl }) } } catch (e) { return { unknown: reasonOf(e) } }`, where `reasonOf` names the `AtprotoReadError` message/status, a `SyntaxError` from `res.json()` as "bad JSON", and anything else by its message. Pass 1's "reuse `pdsEndpointFromDoc`, re-do the URLs" would have copied `resolvePds`'s URL logic — rule 4 applies inside a repo too. Import with `import { resolvePds, AtprotoReadError } from '../../atproto/read'`; declare the deps type locally (`{ fetchImpl?: typeof fetch }`) so the emitted `resolve.d.ts` imports nothing from `read.ts`.
- [ ] `tests/fixtures/pds/plc-did-doc.json` — harvested: the `did:plc:z72i7hdynmk6r22z27h6tvur` doc from the 2026-09-08 probe (URL recorded in a `_source` field).
- [ ] `tests/unit/pds-walker-resolve.test.ts` — fake fetch (V10 pattern): plc happy path; did:web; 404 → unknown; a doc with no PDS service → unknown; a 200 with a non-JSON body → unknown (not a throw).
**Call chain:** `walker.walk()` → `transport.resolve()` → `resolveDid()` → `resolvePds()` (read.ts).
**Wiring test:** export test: `resolveDid` present and resolves the fixture through an injected fetch; RED → GREEN.
**Depends on:** 2c; **1c's `files: ["lib"]`** (see the emit consequence below).
**Read-set:** `src/atproto/read.ts`. **Write-set:** the three files (+ `index.ts` re-export — a fourth touch; split: the re-export moves to 3d).
**Shared-state contract:** none (fetch injected).
**Risks:** *Emit consequence (reasoned from tsc's documented behavior — `include` seeds the program, imports extend it — not probed; the first `npm run build:lib` of this phase confirms):* importing `../../atproto/read` makes `tsc -p tsconfig.lib.json` emit `lib/atproto/read.js` + `.d.ts` beside `lib/pds-walker/`. That is why 1c ships `files: ["lib"]`, and why the 1c pack assertion is "under `lib/`", not "under `lib/pds-walker/`". `read.ts` uses only DOM-lib types (`fetch`, `Response`), so `types: []` holds. `read.ts` is a registered copy from skylite (SHARED-CODE § Register of copies) — shipping it inside the package is the register's own intended direction ("this copy becomes the canonical home"), and it remains unreachable to consumers because `exports` names only `./pds-walker`.
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
- [ ] `tests/e2e/pds-walker-store.spec.ts` — opens `index.html`, then loads a driver bundle **by URL, not by inline content** (*Pass 2, OQ4 resolved — V17:* the page's `script-src` is `'self'` + one sha256, so `page.addScriptTag({ content })` is refused; a same-origin URL is admitted by `'self'`). Mechanism: in the spec, build the driver with the esbuild API — `esbuild.build({ stdin: { contents: "import { indexedDbStore } from 'croft-pwa/pds-walker'; window.__store = indexedDbStore('pds-walker-e2e');", resolveDir: repoRoot }, bundle: true, format: 'esm', write: false })` (V2: esbuild resolves the self-reference) — then `page.route('**/pds-walker-driver.js', (r) => r.fulfill({ contentType: 'text/javascript', body }))` and `page.addScriptTag({ url: 'pds-walker-driver.js', type: 'module' })`. `route.fulfill` answers before the network, so no file is written to `dist/`; the SW is blocked in this project (V26) so nothing intercepts the route; no `integrity` attribute is set, so SRI does not apply. Then put/get/all via `page.evaluate` against the real IndexedDB; `page.reload()` in the same context proves persistence (the IndexedDB origin is `http://localhost:4173`). Fallback if the route path surprises: `test.use({ bypassCSP: true })` for this spec only — it proves the store equally, it just stops proving the page's CSP, which `csp.spec.ts` proves anyway.
**Call chain:** rings page (Phase 6) → `indexedDbStore()`; until then, the e2e driver.
**Wiring test:** the e2e spec; RED (no export) → GREEN.
**Depends on:** 4a. **Write-set:** the three files. **Shared-state contract:** the browser's IndexedDB under the test origin (cleared per Playwright context). The spec imports `esbuild` (a devDependency already present) — no new dependency.
**Risks:** resolved — see the mechanism above (was OQ4).
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
- [ ] `build.mjs` — `PAGES` entry for `rings.html` (V9: `{ html: 'rings.html', entry: 'src/pages/rings.ts', jsToken: '%RINGS_JS%', sriToken: '%RINGS_JS_SRI%' }`; the shell uses those two tokens plus `%CSP%`, `%THEME_INIT%`, `%STYLES%`, `%STYLES_SRI%` exactly as `atproto.html` does). **And, if OQ7 takes (a):** the CSP becomes per-page — `csp` is built by a `cspFor(page)` that extends `connect-src` with `page.connectSrc` when set, and the `rings.html` entry carries `connectSrc: 'https:'`; § 8's `replaceAll('%CSP%', cspFor(p))`. Same file, so still three.
**Call chain:** browser → `rings.html` → `src/pages/rings.ts` → `croft-pwa/pds-walker` → PDSs.
**Wiring test:** `tests/e2e/rings.spec.ts` (6b) — this phase lands with the page building and a smoke assertion added to `tests/e2e/smoke.spec.ts`? No — three files. The wiring test lands in 6b; 6a's verification is `npm run build` producing `dist/rings.html` with a hashed, SRI-stamped script (the build fails otherwise).
**Depends on:** 5; OQ7 decided. **Write-set:** the three files. **Shared-state contract:** none.
**Risks:** *CSP `connect-src` — Pass 2 answer (V17):* the build composes ONE policy for every page and its `connect-src` is a static allowlist (`plc.directory`, `*.host.bsky.network`, `bsky.social`, the AppView, the three provider entryways). There is no per-page CSP today. Under it the page reaches `plc.directory` and every bsky-hosted PDS shard (the wildcard covers the "25–29 distinct hosts" the research measured, which are mostly shards), and a `fetch` to any other PDS (a self-hosted `*.bluesky.page`, a `did:web` host, a non-bsky provider's data hosts) is refused by the browser before the network — the transport sees a `TypeError` and reports the host `unknown`, which is honest but makes ring 2 structurally incomplete for every followee off bsky.network. The decision is OQ7. `docs/ATPROTO.md` § CSP already names the two ways out ("a header-level CSP or a per-host relaxation"); Pages cannot send headers, so the per-page relaxation in `build.mjs` is the available one. *Bundle budget (V27):* the page's gzipped bundle must stay under `PAGE_JS_GZ_BUDGET` (20 KB) — walker + `read.ts` `resolveHandle` + the shell; measure at the first build and, if over, raise the constant deliberately in the same commit with the number, never silently. *Hermetic shell (V26):* the page must render its cards with no network and no SW (idle until a handle is entered) — `a11y.spec.ts` aborts every cross-origin request, and 6b-ii adds this page to it.
**Done when:** (1) the built page loads and, given a handle, shows rings filling; (2) `npm run build` + a manual browser run against a real handle (Validation: Moderate); `npm test`.
**Validation:** Moderate.

### Phase 6b: the rings page — gated

**Goal:** the page is proven hermetically, accessibly, and on a phone-sized viewport.
**Changes:**
- [ ] `tests/e2e/rings.spec.ts` — `page.route` mocks for `plc.directory`, `getLatestCommit`, `listRecords` (fixtures from 3b); asserts the three counts, the "as of" text, ring 2 growing across two routed followees, and a routed 502 host appearing in the hosts panel (unknown, not empty); axe scan (ACCESSIBILITY.md); 390 px viewport, no horizontal overflow, 44 px targets (MOBILE-FIRST.md).
- [ ] `src/nav.ts` — the page joins the nav. *Pass 2 (V18):* the nav is `TABS` in `src/nav.ts`; each tab lists the basenames on which it is current. Per OQ8's recommendation, `rings.html` is added to the **Standards** tab's `active` list (no seventh tab on a 320 px bar); the card that makes it reachable is 6b-iii.
- [ ] `src/pages/guide-content.ts` — a user-guide chapter: what a ring is, what "as of" means, what "unknown host" means. (`tests/unit/guide-content.test.ts` pins shape, not count — a new entry with a `guide-` testid and non-empty blocks passes without a test edit; a `shot` block would need its jpg on disk, so use none.)
**Call chain:** as 6a.
**Wiring test:** `npx playwright test tests/e2e/rings.spec.ts`; RED → GREEN.
**Depends on:** 6a; OQ8 decided. **Write-set:** the three files. **Shared-state contract:** none (routes mocked).
**Risks:** *Pass 2 — the split happened (V18, V19):* `a11y.spec.ts`, `mobile-fit.spec.ts` and `csp.spec.ts` each enumerate pages by a hard-coded list, and `standards.spec.ts` asserts the index's card count against its own list. Counted honestly, "the page is gated" is seven files. This phase keeps its three; the page-list specs are **6b-ii** and the index card + its spec are **6b-iii**, both inserted below without renumbering 6c.
**Done when:** (1) the page passes its hermetic behavior test (rings, "as of", growth, the unknown host) and the axe + 390 px checks inside `rings.spec.ts`; (2) the spec; `npm test`.
**Validation:** Moderate; plus one `e2e:live` run of the page against a real handle, recorded.

### Phase 6b-ii: the page joins the site's page-list gates

**Goal:** the three sweeps that grade every page grade this one — without a list edit they
silently do not (V19).
**Changes:**
- [ ] `tests/e2e/a11y.spec.ts` — `'/rings.html'` in `PAGES` (both themes; the hermetic shell must pass with every cross-origin request aborted — V26).
- [ ] `tests/e2e/mobile-fit.spec.ts` — `'/rings.html'` in the width list (320/360/390).
- [ ] `tests/e2e/csp.spec.ts` — `'/rings.html'` in the list (zero `securitypolicyviolation`, no cross-origin `<script src>`; under OQ7 (a) the widened `connect-src` still yields zero violations because the hermetic shell fetches nothing).
**Call chain:** `npm test` → `playwright test` → the three sweeps → `dist/rings.html`.
**Wiring test:** each spec RED on the list edit if the page fails its sweep, GREEN when it passes — the RED is proven by running the three specs with the page temporarily broken (an `overflow` at 320 px, a contrast token) once, recorded in the RUN summary, then restored. (A list edit that only ever passes is VERIFICATION.md shape 3; the deliberate break is the proof the sweep reaches the page.)
**Depends on:** 6a (the page builds). **Read-set:** `dist/rings.html`. **Write-set:** the three spec files.
**Shared-state contract:** none. **Risks:** none material.
**Done when:** (1) `rings.html` appears in all three sweeps' test titles in the gate's output (read the count — CI.md's checklist: "read the count, not the tick"); (2) `npx playwright test tests/e2e/a11y.spec.ts tests/e2e/mobile-fit.spec.ts tests/e2e/csp.spec.ts`; `npm test`.
**Validation:** Narrow.

### Phase 6b-iii: the page is reachable — the standards index card

**Goal:** a reader can find the page from the site (a page only the nav's `active` list
knows is not reachable).
**Changes:**
- [ ] `src/pages/reference.ts` — a `CHAPTERS` entry `{ href: 'rings.html', title: 'Rings', blurb: … }` (V18; wording per DESIGN.md's copy category — what it is FOR: "your social rings, walked from the data servers directly; honest about what is stale and what is unknown").
- [ ] `tests/e2e/standards.spec.ts` — the entry in `INDEX_CHAPTERS` (the card count assertion is the RED: the card without the list, or the list without the card, fails).
**Call chain:** `reference.html` → the card → `rings.html`.
**Wiring test:** `npx playwright test tests/e2e/standards.spec.ts` — RED with only one of the two edits, GREEN with both.
**Depends on:** 6a; OQ8 (if the owner picks a top-level tab instead, this phase edits `src/nav.ts` `TABS` and `tests/e2e/smoke.spec.ts` instead, and 6b's `active` edit is dropped). **Write-set:** the two files.
**Shared-state contract:** none. **Risks:** none material.
**Done when:** (1) the Standards index shows the card and the link lands on the page with the Standards tab current; (2) the spec; `npm test`.
**Validation:** Narrow.

### Phase 6c: the first release — `pds-walker-v0.1.0`

**Goal:** the first tag, gated by 1d's workflow.
**Changes:**
- [ ] `CHANGELOG.md` — `## [pds-walker 0.1.0] — <date>` section above the month sections (V7). Its entries carry the `**pds-walker:**` prefix like every other line (check 40 grades version sections too).
- [ ] `TODO.md` — *Pass 2 correction:* § 3 is **not** removed; boxes 1–3 are ticked and box 4 (the eight skylite-ported files become the canonical home; bluebird + fun consume them) stays under a re-headed § 3 — no phase here does it, and deleting the box would delete the debt's only TODO (SHARED-CODE rule 4 requires the copying repo to carry one).
- [ ] `src/pds-walker/index.ts` — `VERSION` confirmed `0.1.0` (no change expected; the tag must equal it).
**Call chain:** `git tag pds-walker-v0.1.0 && git push origin pds-walker-v0.1.0` → 1d's workflow.
**Wiring test:** the workflow run itself: release created with the tarball asset and its sha256; `changelog-shape.sh` prints no FLAG for the new tag.
**Depends on:** 6b, 6b-ii, 6b-iii landed on `main` (the tag is cut from `main`), **and this phase's `CHANGELOG.md` section landed on `main` before the tag is pushed** — check 37 fires for any tag dated on or after 2026-08-29 with no matching section (V20's finder), so the order is section → landing → tag, never tag first.
**Write-set:** the three files. **Shared-state contract:** GitHub: a tag and a release.
**Risks:** first run of the two-clock changelog under checks 38/40 — the workspace audit after the tag is the proof.
**Done when:** (1) `gh release view pds-walker-v0.1.0` shows the asset; (2) `bash CroftC/.claude/bin/workspace-audit.sh` shows no croft-pwa changelog FLAG and no 47e NOTE.
**Validation:** Broad.

---

### Phase 7: first consumer — forage (shaped here, executed under a forage plan)

- `package.json`: `"croft-pwa": "github:CroftCommunity/croft-pwa#<sha of pds-walker-v0.1.0>"`.
- `npm run vendor:sync` copies `node_modules/croft-pwa/lib/pds-walker/index.js` → `js/vendor/pds-walker.js`; `test/vendor.test.js` gains byte-equality against the installed file.
- One call site: `ringGraph()` takes follows from the walker; mutuals from the walker once ring 2 has filled, AppView until then. *Pass 2 (V24):* forage's `hop` is the mutuals' follows (`rings.js` § `chain()`), so if OQ6 keeps the research definition in the core, forage's call site must compute its own `hop` from the walker's snapshots (it can — `hopFollows` per mutual is a subset of what the walker stores), and its `test/rings.test.js` containment counterexample must keep passing.
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
- **Landing cadence (Pass 2, OQ9):** every landing is a PR onto `main` (COORDINATION
  rule 2); each landing that touches a run path — and `package.json` is one (V20) —
  carries its `CHANGELOG.md` line. Every landing also deploys the site (Pages from
  `main`), so a landing between 1a and 6a publishes a site whose only visible change is the
  build stamp; that is fine, and it is why phases must each leave the gate green.

## Decisions

| id | question | options | recommendation | status |
|---|---|---|---|---|
| D1 | Does the library get a reference page on the site? | (a) yes, `rings.html`, public handle input; (b) library only | (a) | **(a) — owner, 2026-09-08** |
| D2 | How does forage, which has no bundler, consume the package? | (a) pin + `vendor:sync` + byte-equality test; (b) a build step for forage | (a) | **(a) — owner, 2026-09-08** |
| D3 | Versioning of the library | (a) sha pins only, no tags yet; (b) `pds-walker-vX.Y.Z` tags from the first landing | (a) was recommended | **(b) — owner, 2026-09-08**; plumbing in 1d, first tag at 6c |

Settled upstream, not re-opened here: TypeScript not wasm; croft-pwa as home; default
rings; re-list on rev change; outer ring draws as it fills (research doc § 7).

## Open Questions

Severities of OQ1–OQ5 confirmed by the owner 2026-09-08 (all as recommended).

- [CONFIRMED: PHASE-GATED (2a)] **OQ1** Add `fast-check` as a devDependency for the
  containment property test, or write a seeded generator in the test? *A new dependency
  passes SUPPLY-CHAIN.md's rung (osv + licence) first; a 40-line seeded generator avoids the
  question entirely and the property is simple. Recommend the generator unless the owner
  wants property testing as a house tool.*
- [CONFIRMED: PHASE-GATED (after 2c)] **OQ2** Mutation testing tool for the pure core:
  `@stryker-mutator/core` + vitest runner as devDependencies (global CLAUDE.md expects
  mutation testing on non-trivial modules; the rings/revgate/cadence trio qualifies). *Same
  supply-chain rung; stryker is the named TypeScript tool. Recommend adding it, dev-only.*
- [CONFIRMED: PHASE-GATED (3d)] **OQ3** Which public account anchors the live journey?
  *It must be stable and follow ≥ 1 account; the research used `pfrazee.com` and
  `jay.bsky.team`. Recommend the croft test account from TESTBED.md if it follows anyone,
  else `bsky.app` (14 follows, official).*
- [CONFIRMED: PHASE-GATED (4b)] **OQ4** Does the site's build-time CSP admit an injected
  module script in the IndexedDB e2e, or does the spec need a served test page? *Decides the
  spec's mechanism, not the store. Resolve by reading `build.mjs`'s CSP composition in Pass 2.*
  **Resolved (Pass 2, V17):** an inline `addScriptTag({ content })` is refused (`script-src
  'self'` + one sha256); a same-origin URL is admitted by `'self'`. Mechanism written into
  4b: build the driver with the esbuild API in the spec, serve it with `page.route(…).fulfill`
  at a same-origin path, load it with `addScriptTag({ url, type: 'module' })`; fallback
  `test.use({ bypassCSP: true })`. No served test page needed. Nothing left to decide.
- [CONFIRMED: ADVISORY] **OQ5** `package.json` `version` stays the site's clock
  (`0.1.0` today) while `VERSION` in the library is the package's — two `0.1.0`s that mean
  different things. *Acceptable if the README says so; alternatively the site's stamp could
  drop the package version and show only the sha. No phase depends on it.*

Raised in Pass 2 (recommended severities; not yet confirmed):

- [RECOMMENDED: PHASE-GATED (2a)] **OQ6** Which set is `hop`? (a) the research doc's ring 2
  — the union of all followees' follows (~440 k for the measured account); (b) forage's
  shipped `hop` — the union of the **mutuals'** follows (V24: `rings.js` § `chain()`, the
  first consumer's definition, and what research § 7 means by "matches forage's shipped
  `DEFAULT_STOPS`"); (c) both, under two ids. *Both satisfy the containment chain and both
  come from the same snapshots, so the walk is unchanged either way; only `rings()` and one
  test row differ. Recommend (b): the first consumer defines the ring, and a library whose
  `hop` disagrees with its consumer's `hop` is the kind of drift the whole plan exists to
  stop. (a) stays available to a consumer as a derived set from `store.all()`. Phase 7's
  call site is written against (b).*
- [RECOMMENDED: PHASE-GATED (6a)] **OQ7** The rings page's `connect-src`: (a) per-page
  widening — `build.mjs` gains a `cspFor(page)` and `rings.html`'s `PAGES` entry carries
  `connectSrc: 'https:'`, the first per-page CSP in the repo and the one exception recorded
  in `docs/SECURITY.md` and `docs/ATPROTO.md` § CSP; (b) keep the static allowlist, so the
  page reaches only bsky-hosted shards + `plc.directory` and reports every other PDS as an
  unknown host with reason "blocked by this page's policy". *V17: there is no per-page CSP
  today, and the allowlist cannot be widened per host because the hosts are not known at
  build time — `docs/ATPROTO.md` already names "a per-host relaxation" as the way out. (b)
  keeps the posture but makes ring 2 structurally incomplete for every followee off
  bsky.network (self-hosters, non-bsky providers, `did:web`), which the page would have to
  explain on every run. Recommend (a): the page is signed-out, holds no session and no
  secret, so a wide `connect-src` on it alone exposes nothing; the exception is one line
  in `build.mjs` and two sentences in the docs. `csp.spec.ts` stays green either way.*
- [RECOMMENDED: PHASE-GATED (6b)] **OQ8** Where the page lives in the nav: (a) under the
  Standards tab (`src/nav.ts` `active` list) with a card in `src/pages/reference.ts`
  `CHAPTERS` (6b + 6b-iii as written); (b) its own top-level tab (a seventh on the 320 px
  bar; `TABS` + `smoke.spec.ts` instead of `reference.ts` + `standards.spec.ts`). *V18: both
  registries exist and both are gated by a spec that counts. Recommend (a): the repo's own
  rule is "keeps the top nav to four tabs while the chapters live one level down"
  (`reference.ts` header), the page is the library standard's chapter (D1's reasoning), and
  the mobile tab bar has no room the owner has not already spent.*
- [RECOMMENDED: ADVISORY] **OQ9** Landing cadence: one PR per phase (17 landings, each
  deploying the site), or grouped — 1a–1d as one landing ("croft-pwa is now also a
  package"), 2a–2c, 3a–3d, 4a–4b, 5, 6a–6b-iii, 6c? *Each landing must carry its
  `CHANGELOG.md` line when it touches a run path (`package.json` counts, V20 — check 39
  NOTEs otherwise), and each must leave the gate green regardless. Grouping does not change
  the commit-per-phase rule (every phase still commits at its stable point on the branch);
  it changes how often `main` deploys and how many `land:` messages exist. Recommend the
  grouped shape: the first landing is the one consumers can pin, and a landing per
  sub-phase publishes seventeen sites that differ by a build stamp.*

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

### Pass 2: Gap Analysis — 2026-09-08

Read at worktree commit `8ff9a1b` (`claude/pds-walker-plan`), main checkout `edff652` for
`node_modules` (this worktree has none). Analysis only; the plan file is the only edit.
Owner confirmed OQ1–OQ5 at their recommended severities the same day (recorded above).

**Found:**
- **Gate order was wrong twice.** Pass 1 ran `unit` before `build:lib`; 1c planned to move
  `build:lib` before `unit`. Neither is enough: `lint` (type-checked rules) and `typecheck`
  both resolve `croft-pwa/pds-walker` through `exports` to `lib/pds-walker/index.d.ts`
  (V29), so `build:lib` must run **first**. `prepare` would have hidden this in CI and on a
  fresh clone, and shown it to the first developer who edited `src/pds-walker`.
- **`files: ["lib/pds-walker"]` would ship a broken tarball from 3a on.** Reusing
  `src/atproto/read.ts` (which the plan rightly demands) makes `tsc` emit
  `lib/atproto/read.js`; `files` must be `["lib"]`. And `read.ts` `resolvePds` already does
  all of 3a — Pass 1's "reuse `pdsEndpointFromDoc`, redo the URLs" would have copied
  `resolvePds`'s URL logic (V16). 3a is now a try/catch wrapper.
- **1c's install proof proved nothing.** `npm install <folder>` outside a project creates a
  symlink and runs no `prepare` (V22). Replaced by a tarball install (proves `files` +
  `exports`) and a `git+file://…#<sha>` install (proves the consumer path incl. `prepare`).
- **1c's pack assertion would have failed here.** npm always packs `README*` and `LICENSE*`
  (V22); V4's scratch package had neither.
- **`hop` means two different things.** The plan's `hop` is follows-of-follows (research
  ring 2); forage's shipped `hop` is the mutuals' follows (V24). Same snapshots, different
  set — OQ6, gated on 2a; Phase 7's call site annotated.
- **6b was seven files.** `a11y.spec.ts`, `mobile-fit.spec.ts`, `csp.spec.ts` each list
  pages by hand, and `standards.spec.ts` counts index cards (V18, V19). Split into 6b
  (spec + nav + guide), **6b-ii** (the three sweeps), **6b-iii** (index card + its spec).
- **No per-page CSP exists**, and the static `connect-src` refuses every PDS off
  bsky.network (V17) — the rings page's reach is a decision, OQ7 (gated on 6a), with the
  `build.mjs` mechanism written into 6a for option (a).
- **OQ4 resolved from the code**: inline `addScriptTag` is refused by `script-src`; a
  same-origin URL via `page.route(…).fulfill` is admitted. Mechanism in 4b.
- **1d's workflow needed the browser**: `npm test` runs e2e, so the release workflow must
  install Chromium and use the Playwright cache step as `ci.yml`'s gate does (V21); it also
  needed workflow-level read-only `permissions`, a job timeout, and `workflow_dispatch`
  per `docs/CI.md`'s checklist (V28). Tag pushes reach no other workflow — no interplay.
- **1d's retro-prefix is exactly what check 40 needs** (V20): the finder grades every entry
  line after a `## ` once `Contexts:` is declared; `- <date> **site:** …` is the passing
  form. Check 39 counts `package.json` as a run path — landing cadence is OQ9.
- **6c would have deleted TODO § 3 box 4**, which no phase here does (the skylite-ported
  modules becoming canonical); corrected to tick 1–3 and keep 4. And the tag must follow
  the changelog section onto `main`, never precede it (check 37).
- **2b mis-cited V14** for a "revs compare lexically" note that exists nowhere; the gate
  needs equality only (V25). Fixed.
- Documentation gaps: the gate's sub-step wording in `CLAUDE.md`, `README.md` and the
  `ci.yml` comment; `CLAUDE.md` § Identity "Provides:"; the ARCHITECTURE card (research
  § 7 asks for it); `CHANGELOGS.md` rule 2's missing hybrid shape; `SECURITY.md`/`ATPROTO.md`
  § CSP under OQ7 (a); the repo's `RUN-*-SUMMARY.md` convention (V30). All added to
  Documentation Impact with their phases.

**Concurrency:**
- Map confirmed sequential. Shared-state contract rewritten as invariants (no git
  operations against the main checkout or other worktrees; only Playwright's ports;
  writes only in the worktree + the 1c scratch dir) with a re-entry check. One opt-in
  candidate recorded: {6b, 6b-ii, 6b-iii} have disjoint write-sets and could run in
  parallel worktrees; left sequential by default.

**Changed:**
- Status line; V16–V30 added with anchors; three "reasoned, not probed" items named
  explicitly (tsc's import-closure emit, vitest's externalize path, TS self-name
  resolution) with the phase whose first run proves each.
- 1a: gate order `build:lib && lint && typecheck && unit && build && e2e`; `CLAUDE.md`
  § The gate as a doc carry. 1c: `files: ["lib"]`, the pack assertion, the two install
  proofs, the vitest fallback (`new Function` native import, which loads rather than merely
  resolves), the `prepare`-on-`npm ci` note, `CLAUDE.md` § Identity. 1d: browser install +
  cache, permissions shape, timeout, dispatch, the `Contexts:` line-start rule, README Quick
  start and the `ci.yml` comment. 2a: OQ6 note and the distinguishing example. 2b: the TID
  citation. 3a: wrapper over `resolvePds`, local deps type, the emit consequence, the
  register note. 4b: the mechanism. 6a: the `PAGES` entry shape, the per-page CSP
  mechanism under OQ7 (a), the bundle budget, the hermetic shell. 6b: nav placement per
  OQ8, guide test shape, the split. 6b-ii and 6b-iii inserted. 6c: TODO correction,
  section-before-tag ordering, `push origin <tag>` not `--tags`. Phase 7: the hop note.
  Deployment: landing cadence. Documentation Impact: nine rows. OQ1–OQ5 → CONFIRMED; OQ4
  resolved; OQ6–OQ9 raised.

**Confirmed:**
- V1–V15 hold as written except V14's non-existent TID note (V25) and V15's `ringGraph`
  being a method inside the lens factory rather than an export (still the right anchor).
  `build.mjs` `PAGES` shape (V9), the vitest fake-fetch pattern (V10), eslint/gitignore
  state (V11), CISS's release shape (V12), `ci.yml` deploy gating (V13), the audit
  finders' exact patterns (V7, V8), forage's `SCOPES` chain (V15) — all re-read.
- The phase spine, the ≤3-file split, "package first, walker second", the pure core with
  injected transport/clock/store, D1–D3 and their reasoning: unchanged. No phase reordered.
- Phase 0 remains unnecessary: every new unknown surfaced here is a decision (OQ6–OQ9),
  and the three unprobed claims are each confirmed by the first command of the phase that
  depends on them, with a recorded fallback where one is needed (1c).

**Could not resolve from the code** (hence OQ6–OQ9): which `hop`; whether the rings page
gets a per-page `connect-src`; nav placement; landing cadence. Not resolved and not the
plan's to resolve: OQ1–OQ3 (dependency approvals and the live account).
