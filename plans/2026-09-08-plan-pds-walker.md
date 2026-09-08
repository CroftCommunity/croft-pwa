# Plan: pds-walker — the rev-gated ring walker, as croft-pwa's first library export

date: 2026-09-08
identity: chasemp (`chase@owasp.org`, `github-personal`), repo `CroftCommunity/croft-pwa`
**Status:** Pass 2 complete (gap analysis against the code, 2026-09-08 — V16–V30 added, gate
order and `files` corrected, 6b split into 6b/6b-ii/6b-iii, OQ4 resolved, OQ6–OQ9 raised);
**Pass 3 complete (quality gates, 2026-09-08 — V31–V37 added; OQ6–OQ9 decided by the owner
and folded in; RED→GREEN order on every phase; logging via an injected `Logger`; mutation
checkpoints M1–M3; file counts corrected — 1d-ii, 6a-ii, 6a-iii inserted; landing groups
G1–G7 with RUN summaries and claims) — ready to execute at Phase 1a.** D1–D3 decided by the
owner (§ Decisions); OQ1–OQ9 severities confirmed by the owner 2026-09-08. Phase-gated items
still open at their phase: OQ1 (2a, generator vs `fast-check`), OQ2 (M1, stryker), OQ3 (3d,
the live account) — dependency approvals and an account choice, none blocking 1a.

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

Pass 3 rows (read 2026-09-08 at worktree commit `23a7bcf`; the quality gates below cite
them):

| # | Assumption | How verified |
|---|---|---|
| V31 | `src/log.ts` is browser-shaped: `debugEnabled()` reads `location.search` and `localStorage` inside a `try/catch` (false when either throws, so in Node `debug`/`info` never emit); `warn`/`error` always emit with the `[croft]` tag. It compiles under `tsconfig.lib.json` (root `lib` has `DOM`), but the library must **not** import it: it would emit `lib/log.js` and bind the package's debug switch to a page URL. `src/atproto/read.ts` imports nothing from it, so 3a's emit adds no `lib/log.js`. Hence the injected `Logger` (§ Phase 2a types, § Phase 5) | `src/log.ts` § `debugEnabled`, § `export const log`; `read.ts` import lines (none); `tsconfig.json` `lib` |
| V32 | Test discovery needs no config edit for a new file: `vitest.config.ts` `include: ['tests/unit/**/*.test.ts']`; `playwright.config.ts` `testDir: './tests/e2e'`; `playwright.live.config.ts` `testDir: './tests/live'` (the live tier runs `fullyParallel: false`, `retries: 0`, its own `webServer` on 4173) | the three configs |
| V33 | **No e2e spec discovers pages by glob.** `smoke.spec.ts` names `/index.html`; `subpath.spec.ts` goes to `./`; `user-guide.spec.ts`/`standards.spec.ts` name their pages; the three sweeps are hand lists (V19). So a new page has **no test at all** until a spec names it — the reason 6a cannot be both three files and RED-first (§ Phase 6a) | the specs' heads |
| V34 | RUN summaries here are numbered per run within a name: `RUN-ATPROTO-01…04-SUMMARY.md`, `RUN-P0…P2-SUMMARY.md`, `RUN-TELEMETRY-01-SUMMARY.md`. Required contents (`docs/PRACTICES.md` § RUN summaries): scope, red→green evidence, the **full gate output with counts**, a screenshot/a11y note, what was scoped out and why, a files-touched table (new vs changed), and a verify-in-run ledger for anything a hermetic test cannot reach. Never rewritten after the fact | `ls RUN-*-SUMMARY.md`; `docs/PRACTICES.md` lines 131–137 |
| V35 | The claim protocol for landing on `main`: check `CroftC/.coordination/claims/` + `ListAgents`; write `CroftC/.coordination/claims/croft-pwa--<scope-slug>.md` with the required `# Claim: croft-pwa — …` header line, `session:`, `scope:`, `intent:`, `started:` (ISO), `expected:`; delete it when done. The directory is gitignored runtime state; today it holds only `README.md` | `CroftC/.claude/COORDINATION.md` § "Claims + messaging" (protocol steps 1–4); `ls .coordination/claims/` |
| V36 | `ci.yml`'s gate job: `timeout-minutes: 20`; Playwright cache at `~/.cache/ms-playwright` keyed on `package-lock.json`; `npx playwright install --with-deps chromium`; the comment `# lint · typecheck · unit · build · e2e.` sits on line 43 directly above `- run: npm test`. `tools/serve.mjs` answers a missing path with `404 Not Found` (text/plain) — the RED text for a page that is not built yet | `ci.yml` lines 25, 39–44; `tools/serve.mjs` lines 38–39, 51–52 |
| V37 | `build.mjs` § 4 derives the service-worker precache from `PAGES` (`...PAGES.map((p) => p.html)` and the hashed entries), so a new `PAGES` entry joins the precache with no further edit; a page entry is thin (`src/pages/chassis.ts` is nine lines: `measure.record`, `mountChapter`) | `build.mjs` § "4. Precache manifest"; `src/pages/chassis.ts` |

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

Added in Pass 3 (coverage check: every phase that makes a doc stale schedules it; phase
moves recorded here rather than by rewriting the rows above):

- `CLAUDE.md` § The gate — **moves from 1a to 1b** (1a is three files without it; 1b is two
  with room). Same landing group, so the doc is stale for one commit on the branch, never on
  `main`.
- `CLAUDE.md` § Structure — the file map (`src/nav.ts theme.ts log.ts version.ts …`) gains
  a `src/pds-walker/` line ("the library — core · transport · store · walker; exported as
  `croft-pwa/pds-walker`, built to `lib/` by `build:lib`"); **Phase 1c** (already editing
  `CLAUDE.md` § Identity — same file, one touch).
- `TODO.md` § 3 — **all edits move to 1d-ii** (boxes 1–3 tick, the `private: true` why-line
  from 1c, and the stale pointer "Phase 0 is this section's first three boxes" → "Phases
  1a–1c" — there is no Phase 0 in this plan). The Pass 1 row "boxes tick as Phases 1a–1c land
  (each phase)" is superseded: one edit, one phase.
- `.github/workflows/ci.yml` line 43 comment — **moves from 1d to 1d-ii** (1d is three files
  without it).
- `docs/SECURITY.md` § CSP — **Phase 6a-ii** (with the `cspFor` mechanism, same commit);
  `docs/ATPROTO.md` § CSP — **Phase 6a-iii** (with the code that reads from arbitrary hosts).
  Corrects the "Phase 6a" above.
- `discovery/alpha/research/ring-walk-sans-relay-2026-09.md` § 7 — a one-line "as decided"
  note: the library's `hop` is forage's (mutuals' follows) and `hop2` is the research's ring
  2 (all followees' follows), OQ6 (c); discovery PR, **Phase 2a**.
- `CroftC/.claude/SHARED-CODE.md` § Register of copies — the `src/atproto/read.ts` row gains
  "ships inside the `croft-pwa/pds-walker` tarball from 3a (emitted as `lib/atproto/read.js`;
  unreachable to consumers — `exports` names only `./pds-walker`)"; CroftC PR, **Phase 3a**.
- `RUN-*-SUMMARY.md` — one **per landing group**, numbered per V34:
  `RUN-PDS-WALKER-01-SUMMARY.md` (G1) … `RUN-PDS-WALKER-07-SUMMARY.md` (G7); see § Landing
  groups. Supersedes the single-file name in the Pass 2 row above.
- `tests/fixtures/pds/*` — **not created** (Pass 3): 3a's DID document and 3b's five response
  bodies are harvested **inline** in their test files, each behind a `// source: <URL>
  (2026-09-08)` comment, to hold the three-file count. `tests/fixtures/` keeps only the feeds.
- No doc names the 4b driver mechanism (`route.fulfill` of an esbuild-built module); the
  spec's header comment is its record. `docs/WEB-TESTING.md`/`docs/PRACTICES.md` are not
  stale by it — grepped both for "addScriptTag", "route.fulfill": no hits.

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

Pass 3 audit: map re-confirmed sequential after the file moves below (1d-ii, 6a-ii, 6a-iii
inserted; `csp.spec.ts` moved from 6b-ii to 6a-ii; `index.ts` re-exports now land in 3a, 3b,
4a as well). Write-sets re-read phase by phase: `src/pds-walker/index.ts` is in 1a, 2a, 2b,
2c, 3a, 3b, 3d, 4a, 4b, 5 and 6c; `package.json` in 1a, 1c, 6c and M1; `build.mjs` in 6a and
6a-ii; `src/pages/rings.ts` and `tests/e2e/rings.spec.ts` in 6a, 6a-iii and 6b; `CLAUDE.md`
in 1b and 1c. The Pass 2 opt-in candidate {6b, 6b-ii, 6b-iii} still has disjoint write-sets
(`rings.spec.ts` + `nav.ts` + `guide-content.ts` / `a11y.spec.ts` + `mobile-fit.spec.ts` /
`reference.ts` + `standards.spec.ts`) — unchanged, still opt-in. The mutation checkpoints
M1–M3 (stryker) run in stryker's own sandbox copy (`.stryker-tmp/`, gitignored at M1) and
bind no port; they are sequential with their phase. Contract invariants hold as written; the
re-entry check gains one line: `ls .coordination/claims/` shows no `croft-pwa--*` file of
ours after each landing (claims are released on merge, V35).

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
- [ ] ~~`CLAUDE.md` § The gate~~ — *Pass 3: moved to 1b.* Counted honestly this phase was four
      files; "doc carry" is not a category the count recognises. 1b has room.
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
**Validation:** Narrow — the wiring command + the gate. *Pass 3:* Narrow stands — no
network, no CSP, no workflow; the change to the gate's order is proven by the gate itself,
and 1c's install proofs cover the consumer side.
**RED→GREEN order (Pass 3):** (1) run `npm run build:lib` before any edit — expected
`npm ERR! Missing script: "build:lib"`; record it. (2) Add the script + `tsconfig.lib.json`
only, run again — expected `error TS18003: No inputs were found in config file` (no
`src/pds-walker` yet); that is the second RED and it proves `include` is read. (3) Add
`index.ts` — GREEN: `lib/pds-walker/index.js` + `index.d.ts` exist and the `node
--input-type=module -e …` line above exits 0. (4) Reorder `test`; run `npm test` end to end
and read the gate's full output (VERIFICATION.md: read the count, not the tick).
**Logging:** none — build-time only.

### Phase 1b: the emitted tree is ignored where it must be

**Goal:** `lib/` never enters git and never trips lint.
**Changes:**
- [ ] `.gitignore` — add `lib/` under "Node / build".
- [ ] `eslint.config.js` — add `'lib/**'` to `ignores` (V11).
- [ ] `CLAUDE.md` § The gate — *Pass 3, moved here from 1a:* the sub-step line reads
      `build:lib · lint · typecheck · unit · build · e2e`; the `Sub-parts:` sentence names
      `npm run build:lib`.
**Call chain:** `npm test` → `eslint .` (skips `lib/`); `git status` after `build:lib`.
**Wiring test:** after `npm run build:lib`: `git status --porcelain lib` prints nothing AND
`npm run lint` exits 0. RED before (lib/ shows as untracked; eslint parses `lib/*.js` under
the TS rules), GREEN after.
**Depends on:** 1a.
**Read-set:** `.gitignore`, `eslint.config.js`. **Write-set:** the same two files + `CLAUDE.md` (three).
**Shared-state contract:** none beyond the write-set.
**Risks:** none material.
**Done when:** (1) Behavioral: a build leaves the tree clean and lint-green. (2) Verification:
the two commands above; `npm test` exits 0.
**Validation:** Narrow.
**RED→GREEN order (Pass 3):** (1) `npm run build:lib && git status --porcelain lib` —
expected one line, `?? lib/`; (2) `npm run lint` — expected eslint errors in `lib/pds-walker/
index.js` (the type-checked rule set parses it; record the first rule name printed). Then
the two edits; both commands go quiet. The `CLAUDE.md` wording has no test — read the diff.
**Logging:** none.

### Phase 1c: the export path exists, and the audit stops noting it

**Goal:** `import 'croft-pwa/pds-walker'` resolves inside the repo and for a git consumer;
check 47e is silent.
**Changes:**
- [ ] `package.json` — `exports: { "./pds-walker": { "types": "./lib/pds-walker/index.d.ts", "default": "./lib/pds-walker/index.js" } }`, **`files: ["lib"]`** (*Pass 2 correction:* Pass 1 said `lib/pds-walker`; Phase 3a imports `src/atproto/read.ts`, which `tsc` emits as `lib/atproto/read.js` — a tarball that omits it ships a `resolve.js` whose import is missing. `exports` is the public boundary, `files` is the shipping boundary; they need not coincide, and `exports` encapsulation keeps `lib/atproto/*` unreachable to consumers), `prepare: "npm run build:lib"`. `private: true` stays (V6) — with a comment-line in `TODO.md` § 3 saying why, since JSON has no comments (*Pass 3: the `TODO.md` line is written in 1d-ii with the rest of § 3's edits — this phase does not touch `TODO.md`*). Note (V22): `prepare` runs on every `npm ci`/bare `npm install` from now on, so an emit error in `src/pds-walker` breaks install, not just the gate — intended.
- [ ] `tests/unit/pds-walker-export.test.ts` — (i) `await import('croft-pwa/pds-walker')` resolves and `VERSION === '0.1.0'` (V1); (ii) `npm pack --dry-run --json` (via `child_process.execFileSync`) lists **`package.json`, `README.md`, `LICENSE`, and otherwise only paths under `lib/`** — nothing from `src/`, `tests/`, `dist/`, no `*.html` (*Pass 2 correction, V22:* npm always packs README and LICENSE regardless of `files`, so Pass 1's "exactly `package.json` + `lib/pds-walker/*`" would fail in this repo; V4's scratch package had neither file).
- [ ] `CLAUDE.md` § Identity — "Provides:" gains the package (Documentation Impact); *Pass 3:*
      and § Structure gains the `src/pds-walker/` line (same file, same touch).
**Call chain:** consumer `import { … } from 'croft-pwa/pds-walker'` → Node/esbuild `exports` resolution → `lib/pds-walker/index.js` (built by `prepare` on install, by `build:lib` in the gate).
**Wiring test:** `npx vitest run tests/unit/pds-walker-export.test.ts` — RED before (ERR_PACKAGE_PATH_NOT_EXPORTED), GREEN after. Plus the workspace check: `bash ../../../.claude/bin/shared-code.sh "$PWD"` prints no line containing `check 47e`.
**Depends on:** 1a (the files exist, and the gate order already has `build:lib` first), 1b (lint ignores them).
**Read-set:** `package.json`, `lib/pds-walker/*`. **Write-set:** `package.json`, `tests/unit/pds-walker-export.test.ts` (+ `CLAUDE.md`, doc carry).
**Shared-state contract:** the test shells out to `npm pack --dry-run` (no files written; `--json` to stdout). Vitest runs with the built `lib/` present because 1a put `build:lib` first — *Pass 2:* the reorder Pass 1 planned for this phase is done in 1a (and was itself wrong, see 1a); nothing to reorder here.
**Risks:** vitest's module resolution of a self-reference — V1 proved Node; vite has no self-reference support, but V23 (read, not run) says vite-node passes the unresolved bare id through and vitest externalizes it to a native `import()`, which is Node's path. To be confirmed by the RED→GREEN run. If it does not hold, the fallback is a native import that bypasses vite's transform — `const nativeImport = new Function('s', 'return import(s)') as (s: string) => Promise<unknown>; await nativeImport('croft-pwa/pds-walker')` — which loads the module through Node's own `exports` resolution (Pass 1's `createRequire(...).resolve` fallback only proves resolution, not loading). Decision recorded in the Review Log at execution.
**Done when:** (1) Behavioral, two proofs from a scratch directory outside the repo (*Pass 2 correction, V22:* `npm install <folder>` creates a symlink and runs no `prepare`, so Pass 1's proof proved neither `prepare` nor `files`): (a) `npm pack` in the worktree, then `npm install <path>/croft-pwa-0.1.0.tgz` — proves `files` + `exports`; (b) `npm install "git+file:///Users/cpettet/git/chasemp/CroftC/croft-pwa#<sha of the phase commit>"` — proves the git path consumers will use: clone, devDependencies, `prepare`, pack (slow: it installs the devDependencies in a temp clone; no browser download). After each: `node -e "import('croft-pwa/pds-walker').then(m => console.log(m.VERSION))"` prints `0.1.0`. (2) Verification: the vitest command; the 47e check; `npm test`.
**Validation:** Moderate — the two scratch-directory installs are the "outside the harness" run.
**RED→GREEN order (Pass 3):** (1) write `tests/unit/pds-walker-export.test.ts` with both
cases; `npm run build:lib && npx vitest run tests/unit/pds-walker-export.test.ts` — expected
RED text: `Error: Package subpath './pds-walker' is not defined by "exports"` (Node's
`ERR_PACKAGE_PATH_NOT_EXPORTED`, surfaced through vitest's externalize path — V23; if instead
vitest reports `Failed to resolve import "croft-pwa/pds-walker"`, that is V23 failing, take
the recorded `new Function` fallback and log the decision in the Review Log). The pack case
fails on `files` being absent (the dry-run lists `src/**`). (2) Add `exports` — the import
case goes GREEN, the pack case stays RED. (3) Add `files: ["lib"]` + `prepare` — GREEN. (4)
`npm run lint && npm run typecheck` — proves V29 (the self-name resolves through
`exports` → `index.d.ts` with `lib/` built). (5) The two scratch installs; then `npm test`.
**Test-import rule for every later `pds-walker-*.test.ts` (Pass 3):** import through the
export path (`from 'croft-pwa/pds-walker'`), never `../../src/pds-walker/...` — so every
unit test is an entry-point test and no phase needs to touch this file again to prove its
wiring (the 4th-file problem Pass 2's "export test gains…" lines created). The dev loop is
`npm run build:lib && npx vitest run <file>`: the test runs against the emitted `lib/`, which
is what a consumer gets. If V23 fails and the fallback fires, later tests import
`../../src/pds-walker` (the surface file `index.ts`, so re-export presence is still what is
exercised) and this file alone keeps the native-import proof of the map.
**Logging:** none.

### Phase 1d: release plumbing (D3) and the docs that name the shape

**Goal:** a tag `pds-walker-vX.Y.Z` can only release when it equals `VERSION`, the changelog
is ready for two clocks, and the README says the repo is a package.
**Changes:**
- [ ] `.github/workflows/release-pds-walker.yml` — mirrors CISS's `release.yml` (V12): `on: push: tags: ["pds-walker-v*"]` **plus `workflow_dispatch` with an `inputs.tag` (an existing tag to rebuild — CISS's escape hatch, and `docs/CI.md` § 8's manual path)**; derive `version=${TAG#pds-walker-v}`; read `VERSION` from `src/pds-walker/index.ts` with `grep -oE "VERSION = '[0-9.]+'"`; `exit 1` on mismatch; `actions/setup-node` with `node-version-file: .nvmrc` + `cache: npm`; `npm ci`; **the Playwright cache step and `npx playwright install --with-deps chromium` exactly as `ci.yml`'s `gate` job (V21 — `npm test` runs e2e; without the browser the gate fails on a runner)**; `npm test`; `npm pack`; `gh release create "$TAG" --title … --notes-file <(sed -n "/^## \[pds-walker $version\]/,/^## /p" CHANGELOG.md)`; upload the tarball + its sha256. **`permissions: contents: read` at workflow level, `contents: write` on the job** (V28 — CI.md rule 5; do not copy CISS's workflow-level write); `timeout-minutes` on the job (rule 7). Actions SHA-pinned with the version comment (SUPPLY-CHAIN rule; check 33). Tag pushes reach no other workflow (V21), so there is no interplay with `ci.yml`/`preview.yml` to guard.
- [ ] `CHANGELOG.md` — a `Contexts: site · pds-walker` line under the intro (it must START its line — the finder matches `^\**Contexts:\**`); existing entries gain `- **site:**` prefixes in the form `- 2026-08-30 **site:** Sign in …` (*Pass 2 confirms, V20:* check 40 grades every entry line once `Contexts:` is declared, the date-then-prose form FLAGs, the date-then-bold-context form passes; the intro paragraph above the first `## ` is not graded); a `- 2026-09-DD **pds-walker:** croft-pwa is now also a package …` entry under `## 2026-09`.
- [ ] `README.md` — the "copies to start" sentence (Documentation Impact) and the Quick start line `npm run test # the gate: …` gains `build:lib`.
- [ ] ~~`ci.yml` — the comment~~ *Pass 3: moved to 1d-ii, with the `TODO.md` § 3 edits (this
      phase was five files counted honestly: workflow, changelog, README, `ci.yml`, `TODO.md`).*
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
**Validation:** Moderate now (local shell runs); Broad at Phase 6c (the real tag). *Pass 3
— challenged, raised:* a release workflow is a deploy surface, and "the real proof is the
first tag" leaves its refusal path unproven until the day it matters. Add one **Broad**
step at the G1 landing: push a deliberately mismatched tag `pds-walker-v0.0.0-dry` at the
landed commit (`VERSION` is `0.1.0`, so the compare step must `exit 1` before any release
step runs — a push-event workflow runs from the file at the pushed ref, so this works
whether or not `main` has landed), read the run log (`gh run list --workflow
release-pds-walker.yml`, `gh run view <id> --log`) and confirm it stopped at "verify tag
matches VERSION" with no release created (`gh release list` unchanged); then delete the tag
both sides (`git tag -d pds-walker-v0.0.0-dry && git push --delete origin
pds-walker-v0.0.0-dry`) **the same session**, because check 37 (V20) FLAGs any dated tag
with no changelog section for as long as the tag exists. Record both outputs in
`RUN-PDS-WALKER-01-SUMMARY.md`'s verify-in-run ledger.
**RED→GREEN order (Pass 3):** (1) `bash ../../../.claude/bin/changelog-shape.sh "$PWD"`
before any edit — expected quiet (no `Contexts:` declared yet); add the `Contexts:` line
alone and run again — expected one FLAG per existing entry (~20 lines: the date-then-prose
form fails check 40) — that is the RED, and it proves the finder grades the lines the
retro-prefix will fix; prefix them — quiet. (2) Write the workflow's shell block into the
file; `TAG=pds-walker-v9.9.9 bash -c '<block>'` — expected `tag 9.9.9 != VERSION 0.1.0`
and exit 1; `TAG=pds-walker-v0.1.0 …` — exit 0. (3) `README.md`: read the diff. (4) `npm test`.
**Logging:** the workflow's compare step `echo`s both values on mismatch (the failure must be
readable from the Actions log without re-running).

### Phase 1d-ii: the gate's wording and the TODO ledger (inserted in Pass 3)

**Goal:** the three places that describe the gate say the same thing, and `TODO.md` § 3
records what the G1 landing did and why `private: true` stays.
**Changes:**
- [ ] `.github/workflows/ci.yml` line 43 (V36) — the comment `# lint · typecheck · unit ·
      build · e2e.` gains `build:lib` first (comment only; `ci.yml` is the documented
      standard, `docs/CI.md` § 6 — say in the commit that the wording moved, nothing else).
- [ ] `TODO.md` § 3 — box 1 ticks (`exports`/`files`/`prepare` landed in 1c). Boxes 2 (the
      site imports through the export path — true only when 6a-iii lands) and 3 (the walker
      is the first export — true when G5 lands) tick in **6c**, which already writes
      `TODO.md`; ticking them here would claim what has not happened. Also here: the
      `private: true` why-line ("stays: it blocks `npm publish` only, V6; a git install is
      unaffected") and the pointer line "Phase 0 is this section's first three boxes" →
      "Phases 1a–1c of that plan" (there is no Phase 0).
**Call chain:** none — documentation of what 1a–1d built.
**Wiring test:** parity, not behaviour: `grep -l 'build:lib' CLAUDE.md README.md
.github/workflows/ci.yml` prints **three** paths (RED: two, before the `ci.yml` edit); `git
diff --stat` shows exactly two files.
**Depends on:** 1d. **Read-set:** the two files. **Write-set:** `.github/workflows/ci.yml`,
`TODO.md`. **Shared-state contract:** none.
**Risks:** none. **Done when:** the grep prints three; `npm test` exits 0 (the comment is
inert, but the gate is the boundary).
**Validation:** Narrow. **Logging:** none.

---

### Phase 2a: the pure core — rings and "as of"

**Goal:** given snapshots, compute `me`/`mut`/`fol`/`hop`/`hop2` with the containment chain
and the honest `asOf`. *(Pass 3 — OQ6 decided (c) by the owner 2026-09-08: two ids.)*
**Changes:**
- [ ] `src/pds-walker/core/rings.ts` — types `Did`, `Rev`, `RepoSnapshot`, `RingId`, `Ring`; `rings({ me, snapshots }) → Record<RingId, Ring>`: `mut` = followees whose snapshot lists `me`; `fol` = me's follows; **`hop` = the union of the MUTUALS' follows** (forage's shipped definition, V24); **`hop2` = the union of ALL followees' follows** (the research's ring 2); every ring includes the tighter ones (V15's rule), so the chain is `me ⊂ mut ⊂ fol ⊂ hop ⊂ hop2` (mutuals ⊂ followees, so it nests); `asOf` = the OLDEST `fetchedAt` among the ring's sources; `complete` = every source present. `RingId = 'me' | 'mut' | 'fol' | 'hop' | 'hop2'`. *Pass 3:* this file also declares the public **`Logger`** type — `{ debug(...a: unknown[]): void; info(...): void; warn(...): void; error(...): void }`, the shape of `src/log.ts`'s `log` (V31) — a pure type, so the core stays I/O-free; consumers of it arrive in 3c and 5.
- [ ] `tests/unit/pds-walker-rings.test.ts` — imports through `croft-pwa/pds-walker` (1c's rule). Table cases from the research (mutual/non-mutual followee; a followee with no snapshot → `hop2.complete=false`, `hop2` still includes what is known; `asOf` is the minimum); a property test over random small graphs: `me ⊂ mut ⊂ fol ⊂ hop ⊂ hop2` always holds (see OQ1 for the generator). *Pass 3 — the distinguishing rows (mutation resistance):* (i) a **non-mutual** followee F with follows {X}: X ∈ `hop2`, X ∉ `hop` — this is the row that separates the two definitions and kills a `hop`↔`hop2` swap; (ii) a **mutual** M with follows {Y}: Y ∈ `hop` and Y ∈ `hop2`; (iii) `asOf` with three sources at t=1, 5, 9 → 1 for the ring that uses all three, 5 for a ring whose sources are the last two — a `Math.max` mutation dies; (iv) `complete`: one missing source of many → `false`, none missing → `true`, and membership identical in both cases (pins "unknown is not empty").
- [ ] `src/pds-walker/index.ts` — re-exports (`rings`, the types, `Logger`).
**Call chain:** `createWalker().ring(id)` (Phase 5) → `rings()`; until then, the export path.
**Wiring test:** *Pass 3:* the phase's own test file, imported through the export path — no
touch of `pds-walker-export.test.ts` (that made this phase four files). RED → GREEN.
**RED→GREEN order (Pass 3):** write the test file first; `npm run build:lib && npx vitest run
tests/unit/pds-walker-rings.test.ts` — expected `SyntaxError: The requested module
'croft-pwa/pds-walker' does not provide an export named 'rings'`; then `rings.ts` + the
re-export; rebuild; GREEN. Then `npm test`.
**Logging:** none — pure.
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
*Pass 3 — decided (c), both under two ids; the paragraph above is history.* No extra
requests: mutuality is learned by listing every followee's follows, and those same listings
are `hop2`'s material, so `hop` and `hop2` grow from one walk and `hop2.complete` implies
`hop.complete`. "`hop2` fills after `hop`" (the owner's phrasing) is therefore an emit/render
order in Phase 5 and 6a, not a second walk.
**Done when:** (1) Behavioral: the export computes rings for the research's worked example. (2) Verification: `npx vitest run tests/unit/pds-walker-rings.test.ts`; `npm test`.
**Validation:** Narrow.

### Phase 2b: the pure core — the rev gate

**Goal:** decide, from a stored snapshot and a fresh rev, whether to re-list.
**Changes:**
- [ ] `src/pds-walker/core/revgate.ts` — `decide({ snapshot, latestRev, now, refreshMs }) → 'keep' | 'relist' | 'unknown'`: `latestRev` unknown → `'unknown'` (keep the snapshot); equal revs → `'keep'`; moved → `'relist'`; no snapshot → `'relist'`. `refreshMs` is when to even ask (see 2c).
- [ ] `tests/unit/pds-walker-revgate.test.ts` — the four branches; a case with two well-formed TIDs that differ only in their last character (the gate compares revs for **equality** — *Pass 2 correction, V25:* V14 carries no TID note and the research doc never says revs compare lexically; ordering is not needed, `getLatestCommit` gives the current rev and the gate asks "moved or not". TID shape facts, if a test wants them, come from `src/atproto/tid.ts` `isTid()`); the unknown branch never returns `'relist'`.
- [ ] `src/pds-walker/index.ts` — re-export.
**Call chain:** `walker.refresh()` (Phase 5) → `decide()`.
**Wiring test:** *Pass 3:* `pds-walker-revgate.test.ts` imports `decide` through the export
path (no export-test touch); RED → GREEN.
**Depends on:** 2a. **Read-set:** `core/rings.ts` types. **Write-set:** the three files.
**Shared-state contract:** none. **Risks:** none material.
**Done when:** (1) the export decides the four cases; (2) `npx vitest run tests/unit/pds-walker-revgate.test.ts`; `npm test`.
**Validation:** Narrow.
**RED→GREEN order (Pass 3):** test file first; `npm run build:lib && npx vitest run
tests/unit/pds-walker-revgate.test.ts` — expected `does not provide an export named
'decide'`; then `revgate.ts` + re-export; GREEN. *Edges named (mutation resistance):* the
equal-rev case and the last-character case are two rows, not one; `latestRev: undefined`
with a snapshot → `'unknown'` and with no snapshot → `'relist'` (the branch order matters —
a swap of the first two checks dies here).
**Logging:** none — pure. (The walker logs the verdicts, Phase 5.)

### Phase 2c: the pure core — cadence

**Goal:** per-ring refresh intervals and "which repos are due now".
**Changes:**
- [ ] `src/pds-walker/core/cadence.ts` — `Policy` type + `defaultPolicy` (research § 4: me 60 s, ring-1 10 min, hop daily, **`hop2` daily — the same cadence as `hop`, OQ6 (c)**; `perHostConcurrency: 4`, `ring2Parallel: 10`); `due({ snapshots, now, policy, ring }) → Did[]`; `ring2Targets({ moved }) → Did[]` (only followees whose rev moved are re-walked — for `hop` and `hop2` alike, since both derive from the followees' listings).
- [ ] `tests/unit/pds-walker-cadence.test.ts` — through the export path. Due-ness at boundaries; `ring2Targets` returns exactly the movers; policy overrides merge. *Pass 3 — edges named:* for `refreshMs = R`, a snapshot with `now − fetchedAt` of `R − 1` is **not** due, `R` **is** due, `R + 1` is due (three rows; an `<`↔`<=` mutation dies); an override `{ refreshMs: { hop: 1 } }` leaves `hop2`, `me`, `mut`, `fol` at defaults (a shallow-merge mutation dies); `defaultPolicy.refreshMs` has exactly the five `RingId` keys (a missing `hop2` entry is a compile error under `Record<RingId, number>`, and the test pins the value equals `hop`'s).
- [ ] `src/pds-walker/index.ts` — re-export.
**Call chain:** `walker.refresh()` → `due()` → `decide()` per due repo → `ring2Targets()`.
**Wiring test:** *Pass 3:* the phase's test file through the export path; RED → GREEN.
**Depends on:** 2b. **Write-set:** the three files. **Shared-state contract:** none.
**Risks:** none material.
**Done when:** (1) the export computes due sets; (2) the vitest file; `npm test`.
**Validation:** Narrow. **After 2c:** mutation testing on `core/` (OQ2) before Phase 3 starts; survivors triaged in the Review Log.
**RED→GREEN order (Pass 3):** test file first; `npm run build:lib && npx vitest run
tests/unit/pds-walker-cadence.test.ts` — expected `does not provide an export named
'defaultPolicy'`; then `cadence.ts` + re-export; GREEN.
**Logging:** none — pure.

### Checkpoint M1 (after 2c): mutation testing of `core/` — inserted in Pass 3

Not a phase: a periodic audit per the house rules (global `CLAUDE.md` § Testing Principles,
"Mutation testing — the check on the check"), expected on a rules engine like this trio.
- **Files (counted honestly):** `package.json` + `package-lock.json` (generated) —
  `@stryker-mutator/core` + `@stryker-mutator/vitest-runner` as devDependencies, **after**
  they pass SUPPLY-CHAIN.md's rung (OQ2: this is where the owner's approval is spent);
  `stryker.config.json` (`mutate: ["src/pds-walker/core/**/*.ts"]`, `testRunner: "vitest"`,
  `vitest.configFile: "vitest.config.ts"`); `.gitignore` gains `.stryker-tmp/`. Four paths,
  one generated; recorded, not split — a config commit and an ignore commit would be theatre.
- **Commit before you mutate — before EVERY round.** The 2c green state is committed first
  (`git status --porcelain src/pds-walker tests/unit` prints nothing), then `npx stryker run`.
  Stryker mutates its own sandbox copy, so the working tree is never edited by the tool;
  the rule still stands for the round-two trap the house file records — any fix made to a
  test after round one is committed before round two.
- **Note on `lib/`:** stryker runs vitest against `src/` mutants, but 1c's test-import rule
  makes the tests import `croft-pwa/pds-walker` → `lib/` (the emitted copy), which stryker
  does not mutate — so every mutant would survive. Two honest options, decided at M1's
  first run and recorded in the Review Log: (a) a stryker-only vitest config that aliases
  `croft-pwa/pds-walker` → `src/pds-walker/index.ts` (`resolve.alias` in a
  `vitest.stryker.config.ts`, one more file), or (b) if V23's fallback fired and tests
  already import `../../src/pds-walker`, nothing to do. Read the first run's score: a
  survival rate near 100% means the tests never touched a mutant — a config defect, not a
  test gap.
- **Read the survivors, not the score.** Each survivor is triaged *equivalent* or *real gap*
  in the Review Log; a real gap gets a test that names its boundary (the 2a–2c "edges"
  lists are the expected shape), never an assertion that mirrors the line.
- **Done when:** the run completes, the triage is in the Review Log, and `npm test` is green
  after any test added; the dependency's rung verdict is quoted in
  `RUN-PDS-WALKER-02-SUMMARY.md`.

---

### Phase 3a: transport — identity resolution

**Goal:** `did:plc` and `did:web` → PDS endpoint, or `unknown`.
**Changes:**
- [ ] `src/pds-walker/transport/resolve.ts` — `resolveDid(did, { fetchImpl })`. *Pass 2 (V16):* `src/atproto/read.ts` `resolvePds(did, { fetchImpl })` already does all of this — `did:plc` via `plc.directory`, `did:web` via `.well-known/did.json` (the path form too), the `#atproto_pds` / `AtprotoPersonalDataServer` pick via `pdsEndpointFromDoc(doc: DidDocument): string | null`, trailing slash trimmed — and throws `AtprotoReadError` (non-2xx with `status`; no endpoint; unsupported method). So `resolveDid` is a **wrapper, not a re-implementation**: `try { return { pds: await resolvePds(did, { fetchImpl }) } } catch (e) { return { unknown: reasonOf(e) } }`, where `reasonOf` names the `AtprotoReadError` message/status, a `SyntaxError` from `res.json()` as "bad JSON", and anything else by its message. Pass 1's "reuse `pdsEndpointFromDoc`, re-do the URLs" would have copied `resolvePds`'s URL logic — rule 4 applies inside a repo too. Import with `import { resolvePds, AtprotoReadError } from '../../atproto/read'`; declare the deps type locally (`{ fetchImpl?: typeof fetch }`) so the emitted `resolve.d.ts` imports nothing from `read.ts`.
- [ ] ~~`tests/fixtures/pds/plc-did-doc.json`~~ — *Pass 3:* the harvested `did:plc:z72i7hdynmk6r22z27h6tvur` doc (2026-09-08 probe) lives **inline in the test file** as a `const`, behind a `// source: https://plc.directory/did:plc:… (2026-09-08)` comment. Harvested is harvested; a file of its own was the fourth touch that pushed the re-export out of this phase.
- [ ] `tests/unit/pds-walker-resolve.test.ts` — through the export path. Fake fetch (V10 pattern): plc happy path; did:web; 404 → unknown; a doc with no PDS service → unknown; a 200 with a non-JSON body → unknown (not a throw). *Pass 3 — edges:* the `unknown` reason for a 404 names the status (`"404"` appears in it) and for the no-service doc names the cause — two distinguishable strings, so a mutation that collapses `reasonOf` to one message dies; the returned `pds` has no trailing slash (one row with a slash in the doc).
- [ ] `src/pds-walker/index.ts` — *Pass 3, moved back from 3d:* re-export `resolveDid` (the fixture file's slot).
**Call chain:** `walker.walk()` → `transport.resolve()` → `resolveDid()` → `resolvePds()` (read.ts).
**Wiring test:** *Pass 3:* the phase's test through the export path; RED → GREEN.
**RED→GREEN order (Pass 3):** test first; `npm run build:lib && npx vitest run
tests/unit/pds-walker-resolve.test.ts` — expected `does not provide an export named
'resolveDid'`; then `resolve.ts` + the re-export; **read the `build:lib` output and `ls lib/`**
— this is the run that proves the reasoned-not-probed emit consequence (`lib/atproto/read.js`
appears); record the listing in the RUN summary. GREEN.
**Logging:** none in the wrapper — it returns `{ unknown: reason }`; the walker (5) is the
one place that logs a host going unknown, with the reason string this phase builds. So the
reason must be human-readable on its own (the test's two rows above pin that).
**Depends on:** 2c; **1c's `files: ["lib"]`** (see the emit consequence below).
**Read-set:** `src/atproto/read.ts`. **Write-set:** `resolve.ts`, the test, `index.ts` — three (Pass 3; the fixture file is gone and the re-export is back).
**Shared-state contract:** none (fetch injected).
**Risks:** *Emit consequence (reasoned from tsc's documented behavior — `include` seeds the program, imports extend it — not probed; the first `npm run build:lib` of this phase confirms):* importing `../../atproto/read` makes `tsc -p tsconfig.lib.json` emit `lib/atproto/read.js` + `.d.ts` beside `lib/pds-walker/`. That is why 1c ships `files: ["lib"]`, and why the 1c pack assertion is "under `lib/`", not "under `lib/pds-walker/`". `read.ts` uses only DOM-lib types (`fetch`, `Response`), so `types: []` holds. `read.ts` is a registered copy from skylite (SHARED-CODE § Register of copies) — shipping it inside the package is the register's own intended direction ("this copy becomes the canonical home"), and it remains unreachable to consumers because `exports` names only `./pds-walker`.
**Done when:** (1) resolution through the export with an injected fetch; (2) the vitest file; `npm test`.
**Validation:** Narrow.

### Phase 3b: transport — the PDS calls

**Goal:** `latestRev` and `listFollows` (paged) against a PDS, honest on failure.
**Changes:**
- [ ] `src/pds-walker/transport/pds.ts` — `latestRev(pds, did, deps)` → `com.atproto.sync.getLatestCommit` → `rev` or unknown; `listFollows(pds, did, deps)` → `com.atproto.repo.listRecords?collection=app.bsky.graph.follow&limit=100`, follows `cursor` until absent, returns `subject` DIDs or unknown (a failure mid-way returns unknown, never a partial list — a partial list would shrink a ring).
- [ ] ~~`tests/fixtures/pds/listRecords-page1.json`, `…-last.json`, `getLatestCommit.json`, `pds-502.txt`, `pds-403-opendns.html`~~ — *Pass 3:* five files is five files, not "one data set". The harvested bodies live **inline in the test** as consts, each behind its `// source: <URL> (2026-09-08)` comment; the two `listRecords` pages trimmed to two records each (shape preserved: `records[].value.subject`, `cursor` present on page 1, absent on the last), the 403 HTML trimmed to its first lines (enough to fail `JSON.parse`). 6a-iii's e2e spec defines its own routed bodies — different shape (full URLs), no sharing needed.
- [ ] `tests/unit/pds-walker-pds.test.ts` — through the export path. Two-page walk; last page without cursor; 502 mid-walk → unknown; the 403 HTML body → unknown (not a JSON parse crash); `getLatestCommit` shape. *Pass 3 — edges:* the 502 arrives on page **2** of two and the result is `{ unknown }` with **no** subjects from page 1 (pins "never a partial list"); a page with `cursor: ""` (empty string) is treated as the last page (the real API omits it; a mutation from `!== undefined` to truthiness must not change behaviour — say which the code does and test that); `limit=100` appears in the request URL (a query-string mutation dies).
- [ ] `src/pds-walker/index.ts` — *Pass 3:* re-export `latestRev`, `listFollows`.
**Call chain:** `walker.walk()`/`refresh()` → `transport.listFollows()`/`latestRev()`.
**Wiring test:** *Pass 3:* the phase's test through the export path; RED → GREEN.
**RED→GREEN order (Pass 3):** test first; `npm run build:lib && npx vitest run
tests/unit/pds-walker-pds.test.ts` — expected `does not provide an export named
'listFollows'`; then `pds.ts` + the re-exports; GREEN.
**Logging:** none in the transport calls — `{ unknown: reason }` carries `host` + `status`
(e.g. `"pds 502 at page 2"`) so the walker's single `warn` (Phase 5) is diagnosable.
**Depends on:** 3a. **Write-set:** `pds.ts`, the test, `index.ts` — three. **Shared-state contract:** none.
**Risks:** none material.
**Done when:** (1) a two-page walk through the export yields both pages' subjects; (2) the vitest file; `npm test`.
**Validation:** Narrow.

### Phase 3c: transport — the per-host limiter

**Goal:** never more than N in flight per PDS host; back off when `RateLimit-Remaining` is low.
**Changes:**
- [ ] `src/pds-walker/transport/limiter.ts` — `hostLimiter({ perHost, now?, sleep?, log? })` returning `run(host, fn)`; reads `RateLimit-Remaining`/`RateLimit-Reset` from responses via a hook and pauses that host until reset when remaining < 10. *Pass 3:* `log?: Logger` (the 2a type) — the limiter is the first component with something to say that the walker cannot see: **`log.warn('pds-walker: host paused', host, remaining, resetSeconds)`** when it pauses, **`log.info('pds-walker: host resumed', host)`** when the pause ends. Hosts, never DIDs. Also home of **`defaultLogger()`** — `warn`/`error` → `console.warn`/`console.error` tagged `[pds-walker]`, `debug`/`info` silent — the posture of `src/log.ts` without its browser switch (V31); used when a caller passes no logger.
- [ ] `src/pds-walker/transport/pds.ts` — calls go through the limiter (deps gain `limiter`).
- [ ] `tests/unit/pds-walker-limiter.test.ts` — *Pass 3:* constructs `hostLimiter` from the module (it is internal — not re-exported; `createFetchTransport` builds it in 3d) and **observes it through the exported `listFollows`/`latestRev`** (the export path). With a fake clock: N+1 calls to one host → the last waits; a low `RateLimit-Remaining` header pauses until reset; two hosts do not block each other. *Edges named:* `perHost = 2`, three concurrent calls → at most 2 in flight at any instant (a recorded max, not "the last waits"); `RateLimit-Remaining: 10` → **no** pause, `9` → pause (the threshold is `< 10`, two rows); a paused host resumes at exactly `reset`, not `reset − 1` (two rows with the fake clock); a recording logger sees exactly one `warn` on the pause and one `info` on resume, both naming the host and neither containing a `did:` string.
**Call chain:** `listFollows()` → `limiter.run(host, …)` → `fetch`.
**Wiring test:** *Pass 3:* the case "with `perHost: 1`, two page fetches of one `listFollows` are serialized" lives in `pds-walker-limiter.test.ts` (tests are not 1:1 with files — house rule), through the export path — no touch of `pds-walker-pds.test.ts`; RED → GREEN.
**RED→GREEN order (Pass 3):** test first; `npm run build:lib && npx vitest run
tests/unit/pds-walker-limiter.test.ts` — expected `Cannot find module '../../src/pds-walker/
transport/limiter'` (the module import) and, once the module exists but `pds.ts` ignores
`deps.limiter`, the serialization case fails with the recorded max in flight `2`, expected
`1` — that second RED is the one that proves the limiter is *in the path*; then wire
`pds.ts`; GREEN.
**Depends on:** 3b. **Write-set:** the three files. **Shared-state contract:** none (clock injected).
**Risks:** timer-based tests — use injected `now`/`sleep`, never real timers.
**Done when:** (1) concurrency observed ≤ N per host in the test; (2) the vitest file; `npm test`.
**Validation:** Narrow.
**Logging:** as above (pause/resume at warn/info, host only).

### Checkpoint M2 (after 3c): mutation testing of `transport/limiter.ts` — inserted in Pass 3

Same tool, same rules as M1 (commit the 3c green state first; read survivors; triage in
the Review Log). `stryker.config.json` `mutate` widens to `src/pds-walker/transport/
limiter.ts` (one file edit; `pds.ts`/`resolve.ts` are thin I/O wrappers whose mutants are
mostly URL strings the 3a/3b edges already pin — include them only if the run is cheap).
The limiter is threshold-and-boundary code (`< 10`, `perHost`, `reset`), exactly where a
green suite hides a hole. Done when the triage is recorded and `npm test` is green.

### Phase 3d: transport — the export, and one live journey

**Goal:** the transport is reachable through the export path, and one real PDS answers.
**Changes:**
- [ ] `src/pds-walker/index.ts` — `createFetchTransport({ fetchImpl?, perHost?, log? }) : Transport` composing 3a–3c (*Pass 3:* `log` defaults to `defaultLogger()` and is handed to the limiter); re-exports.
- [ ] `tests/live/pds-walker.live.spec.ts` — under `e2e:live` (never the default gate; V32: discovered by `testDir` with no config edit): resolve a stable public account (OQ3), `latestRev` returns a TID, `listFollows` returns ≥ 1 DID; asserts shape, not values.
- [ ] ~~`tests/unit/pds-walker-export.test.ts`~~ → *Pass 3:* **`tests/unit/pds-walker-transport.test.ts`** (new; the export test is not touched) — `createFetchTransport` present; through injected fetch, **one chain case per 3a–3c behaviour** so nothing built in this group is reachable only from its own unit test: resolve → `{ pds }`; resolve 404 → `{ unknown }`; a two-page `listFollows`; a 502 → `{ unknown }`; `perHost: 1` serializes; a low `RateLimit-Remaining` pauses (recording logger sees the `warn`). This is the group's Isolation-Trap defence — `createFetchTransport` is the entry point consumers get.
**Call chain:** consumer → `createFetchTransport()` → 3a–3c.
**Wiring test:** the transport test's chain cases; RED → GREEN. Live: `npm run e2e:live -- tests/live/pds-walker.live.spec.ts`.
**RED→GREEN order (Pass 3):** transport test first — expected `does not provide an export
named 'createFetchTransport'`; then the composition; GREEN. Then the live spec, run once,
its full `list` reporter output pasted into the Review Log and the RUN summary (the
account chosen under OQ3 named there).
**Logging:** `createFetchTransport` passes `log` to the limiter (3c's messages). No new
messages here.
**Depends on:** 3c. **Write-set:** the three files. **Shared-state contract:** the live spec reads the network (one public account, ~3 requests); TESTBED.md needs no claim (no shared credential or device).
**Risks:** live flake is not a gate failure by construction (`:live` suffix is the recorded reason, VERIFICATION.md).
**Done when:** (1) a consumer can build a transport from the export and reach a real PDS; (2) the vitest export test; the live spec once, output pasted into the Review Log; `npm test`.
**Validation:** Broad for the live half (one real run, recorded).

---

### Phase 4a: the store — interface and memory

**Goal:** `Store` as the persistence seam; a memory implementation for tests and Node.
**Changes:**
- [ ] ~~`src/pds-walker/store/types.ts`~~ — *Pass 3:* the `Store { get, put, all }` type is declared in `store/memory.ts` and exported from there (4b's `indexeddb.ts` imports it from `./memory`). A types file of its own cost this phase its re-export, which left the store reachable only from its own test — the Isolation Trap by construction.
- [ ] `src/pds-walker/store/memory.ts` — `type Store` + `memoryStore()`.
- [ ] `src/pds-walker/index.ts` — *Pass 3, moved here from 4b:* re-export `memoryStore`, `Store`.
- [ ] `tests/unit/pds-walker-store.test.ts` — through the export path. put/get/all; overwrite keeps the newer; `all()` returns copies (immutability). *Edges:* "keeps the newer" is decided by `fetchedAt`, two rows (newer replaces; **older does not** replace a newer — a `>`↔`>=`/direction mutation dies); mutating a returned array/object does not change the next `get` (the immutability row).
**Call chain:** `createWalker({ store })` (Phase 5) → `store.get/put`.
**Wiring test:** *Pass 3:* the phase's test through the export path (`memoryStore` is exported this phase); RED → GREEN. The Pass 2 wording ("the store test itself plus a tsc run") is retired — that was a module test.
**RED→GREEN order (Pass 3):** test first; `npm run build:lib && npx vitest run
tests/unit/pds-walker-store.test.ts` — expected `does not provide an export named
'memoryStore'`; then `memory.ts` + the re-export; GREEN.
**Logging:** none — the store is silent; the walker reports what it read.
**Depends on:** 3d. **Write-set:** `memory.ts`, `index.ts`, the test — three. **Shared-state contract:** none.
**Done when:** (1) the memory store round-trips through the export; (2) the vitest file; `npm test`.
**Validation:** Narrow.

### Phase 4b: the store — IndexedDB, proven in a browser

**Goal:** the same `Store` over IndexedDB, proven in Playwright (not a fake).
**Changes:**
- [ ] `src/pds-walker/store/indexeddb.ts` — `indexedDbStore(name)`; one object store keyed by `did`.
- [ ] `src/pds-walker/index.ts` — re-exports `indexedDbStore` (*Pass 3:* `memoryStore` and `Store` moved to 4a).
- [ ] `tests/e2e/pds-walker-store.spec.ts` — opens `index.html`, then loads a driver bundle **by URL, not by inline content** (*Pass 2, OQ4 resolved — V17:* the page's `script-src` is `'self'` + one sha256, so `page.addScriptTag({ content })` is refused; a same-origin URL is admitted by `'self'`). Mechanism: in the spec, build the driver with the esbuild API — `esbuild.build({ stdin: { contents: "import { indexedDbStore } from 'croft-pwa/pds-walker'; window.__store = indexedDbStore('pds-walker-e2e');", resolveDir: repoRoot }, bundle: true, format: 'esm', write: false })` (V2: esbuild resolves the self-reference) — then `page.route('**/pds-walker-driver.js', (r) => r.fulfill({ contentType: 'text/javascript', body }))` and `page.addScriptTag({ url: 'pds-walker-driver.js', type: 'module' })`. `route.fulfill` answers before the network, so no file is written to `dist/`; the SW is blocked in this project (V26) so nothing intercepts the route; no `integrity` attribute is set, so SRI does not apply. Then put/get/all via `page.evaluate` against the real IndexedDB; `page.reload()` in the same context proves persistence (the IndexedDB origin is `http://localhost:4173`). Fallback if the route path surprises: `test.use({ bypassCSP: true })` for this spec only — it proves the store equally, it just stops proving the page's CSP, which `csp.spec.ts` proves anyway.
**Call chain:** rings page (Phase 6) → `indexedDbStore()`; until then, the e2e driver.
**Wiring test:** the e2e spec; RED (no export) → GREEN.
**Depends on:** 4a. **Write-set:** the three files. **Shared-state contract:** the browser's IndexedDB under the test origin (cleared per Playwright context). The spec imports `esbuild` (a devDependency already present) — no new dependency.
**Risks:** resolved — see the mechanism above (was OQ4).
**Done when:** (1) snapshots survive a reload in a real browser; (2) `npx playwright test tests/e2e/pds-walker-store.spec.ts`; `npm test`.
**Validation:** Moderate. *Pass 3:* stands — a real browser's IndexedDB is the "outside the
harness" run, and the spec is hermetic (no network, no SW). If the `bypassCSP` fallback is
taken, say so in the Review Log: the spec then proves the store and not the page's policy.
**RED→GREEN order (Pass 3):** spec first, with the driver importing `indexedDbStore`;
`npm run build && npx playwright test tests/e2e/pds-walker-store.spec.ts` — expected the
esbuild step inside the spec to fail: `No matching export in "lib/pds-walker/index.js" for
import "indexedDbStore"` (esbuild resolves the self-reference, V2, and finds no such
export); then `indexeddb.ts` + the re-export + `build:lib`; GREEN. *Edges:* a `put` of the
same `did` twice then `all()` has length 1 (keyed by `did`); a reload between `put` and
`get` returns the value (persistence); a second, differently-named store does not see the
first's rows (the `name` argument is honoured — a mutation that ignores it dies).
**Logging:** none in the store. The spec asserts the page's console shows no `[croft]`
`error` line during the round-trip (`page.on('console')`) — the one observability check
worth having on a storage seam that degrades soft elsewhere in this repo.

---

### Phase 5: the walker

**Goal:** `createWalker()` wires core + transport + store + clock into the public surface.
**Changes:**
- [ ] `src/pds-walker/walker.ts` — `createWalker({ transport, store, policy?, now?, log? })`: `walk(me)` resolves and lists ring 1 (parallel across followees under the limiter), computes `me`/`fol` at once, then fills `mut`/`hop`/`hop2` in the background at `ring2Parallel` as each followee's follows are listed (*Pass 3, OQ6 (c):* one walk feeds all three — a followee that lists `me` joins `mut` and its follows join `hop`; every followee's follows join `hop2`; **`hop` events are emitted before `hop2` events** for the same listing, which is what "`hop2` fills after `hop`" means here), emitting `progress`; `refresh()` asks `latestRev` for due ring-1 repos, re-lists movers, re-walks only their ring-2 subtrees; `hosts()` lists unknown hosts with `since`; `on()`; `stop()` cancels background work. *Pass 3 — logging, through the injected `log` (default `defaultLogger()`; the page passes `src/log.ts`'s `log`, V31):* **`warn('pds-walker: host unknown', host, reason)`** when a host first goes unknown (once per host, not per call — a host with 200 followees on it must not print 200 lines); **`info('pds-walker: ring', id, size, asOf, complete)`** when a ring's `complete` flips or a background fill finishes; **`info('pds-walker: refresh', { due, moved, kept, unknown })`** — counts only — at the end of each `refresh()`; **`debug('pds-walker: rev moved', did, from, to)`** and **`debug('pds-walker: walk', me)`** — the only lines that carry a DID, at debug; `info('pds-walker: stopped')`. Rule: **no DID at info or warn** (a shared console, a pasted screenshot, a bug report — none should carry identities by default).
- [ ] `src/pds-walker/index.ts` — re-export `createWalker` and the public types (the surface below).
- [ ] `tests/unit/pds-walker-walker.test.ts` — through the export path. Scripted fake transport + memory store + fake clock + **recording logger**: (i) unknown-is-not-empty (a host failing on refresh leaves the ring and marks the host); (ii) refresh touches only movers; (iii) `asOf` is the oldest source; (iv) containment after every event (all five rings); (v) `stop()` halts the background fill; (vi) `progress` counts up to the followee count; *Pass 3:* (vii) a host going unknown produces **exactly one** `warn` naming the host, however many followees live on it (two followees on the failing host); (viii) **no `info`/`warn` call argument matches `/^did:/`** across a full walk + refresh (the privacy invariant; it also kills any "log the DID for convenience" mutation); (ix) `debug` records the moved DID with both revs; (x) the `ring` events for one listing arrive `hop` before `hop2`. *Edges:* `progress` reaches exactly `followees.length`, not `+1` for `me`; `stop()` after k of n listings leaves `hop2.complete === false` and `hop2.members` at what k listings gave.
**Public surface (fixed):**
```ts
type Did = `did:${string}`; type Rev = string;
type RepoSnapshot = { did: Did; pds: string; rev: Rev; follows: readonly Did[]; fetchedAt: number };
type HostState = { host: string; state: 'ok' | 'unknown'; since: number; reason?: string };
type RingId = 'me' | 'mut' | 'fol' | 'hop' | 'hop2';   // Pass 3: hop2 added (OQ6 c)
type Ring = { id: RingId; members: ReadonlySet<Did>; asOf: number; complete: boolean };
type Logger = { debug(...a: unknown[]): void; info(...a: unknown[]): void;   // Pass 3
                warn(...a: unknown[]): void; error(...a: unknown[]): void };  // = shape of src/log.ts `log`
type Transport = { resolve(did: Did): Promise<{ pds: string } | { unknown: string }>;
                   latestRev(pds: string, did: Did): Promise<Rev | { unknown: string }>;
                   listFollows(pds: string, did: Did): Promise<readonly Did[] | { unknown: string }> };
type Store = { get(did: Did): Promise<RepoSnapshot | null>; put(s: RepoSnapshot): Promise<void>; all(): Promise<RepoSnapshot[]> };
type Policy = { refreshMs: Record<RingId, number>; perHostConcurrency: number; ring2Parallel: number };
type Walker = { ring(id: RingId): Ring; walk(me: Did, opts?: { rings?: RingId[] }): Promise<void>;
                refresh(): Promise<void>; hosts(): HostState[];
                on(event: 'ring' | 'host' | 'progress', fn: (e: unknown) => void): () => void; stop(): void };
declare function createWalker(deps: { transport: Transport; store: Store; policy?: Partial<Policy>; now?: () => number; log?: Logger }): Walker;
declare function createFetchTransport(opts?: { fetchImpl?: typeof fetch; perHost?: number; log?: Logger }): Transport;   // Pass 3: log added
```
`Policy.refreshMs` is `Record<RingId, number>`, so it carries a `hop2` entry (2c: daily, same
as `hop`).
**Call chain:** rings page (6a-iii) → `createWalker()`; forage (Phase 7) → the same.
**Wiring test:** *Pass 3:* the phase's test through the export path — `createWalker` with fake deps walks a three-node graph and `ring('mut')` is right; RED → GREEN.
**RED→GREEN order (Pass 3):** test first; `npm run build:lib && npx vitest run
tests/unit/pds-walker-walker.test.ts` — expected `does not provide an export named
'createWalker'`; then `walker.ts` in the order the test cases are numbered (i → x), each
case RED before its code, rebuild between; GREEN. Then `npm test`.
**Depends on:** 4b. **Write-set:** the three files. **Shared-state contract:** none (all deps injected).
**Risks:** the background fill and `stop()` — use an injected scheduler (`queueMicrotask`-free, explicit `tick()` in tests) so tests are deterministic.
**Done when:** (1) the ten behaviors above hold through the export; (2) the vitest file; `npm test`.
**Validation:** Moderate — plus one manual Node run against the real transport for a small public account (recorded in the Review Log). *Pass 3:* the Node run passes a console-backed logger and the recorded output is the first real look at the message set — read it for noise (a line per followee is a defect) and for any DID at info/warn (a defect the unit test should have caught; if it appears, the test's regex is wrong first).
**Logging:** as itemised in the `walker.ts` bullet.

### Checkpoint M3 (after 5): mutation testing of `walker.ts` — inserted in Pass 3

Same rules as M1 (commit the 5 green state first; every round; read survivors; triage in
the Review Log). `stryker.config.json` `mutate` gains `src/pds-walker/walker.ts`. The walker
is a state machine over events (`ring`/`host`/`progress`, `stop`), which is the shape the
house rule names as where a green suite most easily hides a hole. Expect the `once per host`
guard and the `hop`-before-`hop2` ordering to be the first survivors if their rows are weak.
Done when the triage is recorded and `npm test` is green; this is G5's last step before
landing.

---

### Phase 6a: the rings page — the shell exists, hermetically

*Pass 3 restructure of the 6a group (additive; 6b–6c keep their numbers):* Pass 2's 6a was
three files with **no test until 6b** — a page with no RED. Counted honestly with its test it
is four, and V33 says no existing spec would pick a new page up. The group is now **6a** (the
shell + its smoke spec — four files, the one deliberate exception in this plan, reasoned
below), **6a-ii** (the per-page CSP, OQ7 (a), with its RED in `csp.spec.ts`), **6a-iii** (the
walker wired through the export path, with its behaviour spec). Each later step has an
observable RED; only the first cannot, in this repo, be both three files and tested.

**Goal:** `rings.html` builds, serves, and renders its cards with no network — idle until a
handle is entered.
**Changes:**
- [ ] `rings.html` — the page shell (chassis tokens; handle field; **five** ring cards — `mut`, `fol`, `global` shown by default and `hop`, `hop2` as optional cards behind a "more rings" disclosure (OQ6 (c); a native `<details>`, not a modal — `CLAUDE.md` § Conventions "Pages, not modals") — each with count + "as of"; a hosts panel; a live region for progress).
- [ ] `src/pages/rings.ts` — **shell only** in this phase (V37: a page entry is nine lines): mounts the nav, renders the cards with placeholder counts ("—") and "as of —", `log.info('shell mounted', 'rings')` per the repo's pattern; no library import yet (6a-iii).
- [ ] `build.mjs` — `PAGES` entry for `rings.html` (V9: `{ html: 'rings.html', entry: 'src/pages/rings.ts', jsToken: '%RINGS_JS%', sriToken: '%RINGS_JS_SRI%' }`; the shell uses those two tokens plus `%CSP%`, `%THEME_INIT%`, `%STYLES%`, `%STYLES_SRI%` exactly as `atproto.html` does). The precache follows (V37). ~~And, if OQ7 takes (a) …~~ → *the `cspFor` mechanism is 6a-ii.*
- [ ] `tests/e2e/rings.spec.ts` — the smoke half (6a-iii and 6b extend this file): `page.goto('/rings.html')` responds **200**; `h1` "Rings"; five `[data-ring]` cards, three visible and two inside a closed `<details>`; the hosts panel's empty state; **zero non-localhost requests** during load (the `a11y.spec.ts` route-abort pattern, V26 — the shell must be hermetic).
**Why four files, stated rather than hidden:** a page in this repo is a shell, an entry and a
registry line (V9) — three files before any test; and no spec discovers pages (V33). The
only three-file shapes are "page without test" (what Pass 2 had) or "test without page"
(a RED gate at a phase boundary). Four files with the test written first is the honest
one. It is the single exception; every other phase in this plan is ≤ 3.
**Call chain:** browser → `dist/rings.html` → `src/pages/rings.ts` (shell).
**Wiring test:** `npx playwright test tests/e2e/rings.spec.ts`; RED → GREEN.
**RED→GREEN order (Pass 3):** spec first; `npm run build && npx playwright test
tests/e2e/rings.spec.ts` — expected `expect(received).toBe(200) … Received: 404`
(`tools/serve.mjs` answers `404 Not Found` for a page the build did not emit, V36); then
`rings.html` + `rings.ts` + the `PAGES` entry; `npm run build` (watch for the bundle-size
tripwire, V27 — the shell is far under it; the number goes in the RUN summary as the
baseline 6a-iii is measured against); GREEN.
**Logging:** `log.info('shell mounted', 'rings')` (the repo's own line, gated by `?debug=1`).
**Depends on:** 5. **Write-set:** the four files above. **Shared-state contract:** none.
**Risks:** the bundle-size budget and the hermetic-shell rule are 6a-iii's problem now, not
this phase's. **Done when:** (1) the page serves and renders its shell with no network;
(2) the spec; `npm test`. **Validation:** Narrow — no network, no CSP change, no workflow.

### Phase 6a-ii: the page's `connect-src` — the one per-page CSP (OQ7 (a), inserted in Pass 3)

**Goal:** `rings.html` may `fetch` any `https:` origin (any PDS); every other page's policy is
byte-identical to today's.
**Changes:**
- [ ] `build.mjs` — § 7's `csp` string becomes `cspFor(page)`: the same list, with
      `connect-src` extended by `page.connectSrc` when the entry sets it; § 8 calls
      `replaceAll('%CSP%', cspFor(p))`; the `rings.html` entry carries `connectSrc: 'https:'`.
      A comment above the entry names this as the recorded exception and points at
      `docs/SECURITY.md`.
- [ ] `tests/e2e/csp.spec.ts` — `'/rings.html'` joins the list (moved here from 6b-ii — this
      is where the page's policy changes, so this is where its sweep starts), **and a scoped
      assertion in both directions**: read each page's `<meta http-equiv="Content-Security-
      Policy">` `content`, extract `connect-src`; for `/rings.html` it **contains** the bare
      token `https:`; for every other listed page it **does not** (a widening that leaks
      into the shared list dies here). The existing zero-violation + no-cross-origin-script
      checks run for the new page as for the others.
- [ ] `docs/SECURITY.md` § CSP — the exception: "`rings.html` alone carries `connect-src …
      https:` (it reads from arbitrary PDS hosts, signed out, holding no session or secret);
      set per page by `cspFor(page)` in `build.mjs`; every other page keeps the allowlist
      above". The policy block shown in the doc is unchanged (it is every other page's).
**Call chain:** `npm run build` → `cspFor(p)` → `dist/rings.html` `<meta>` → the browser's
fetch gate → (6a-iii) the transport.
**Wiring test:** `npx playwright test tests/e2e/csp.spec.ts`; RED → GREEN.
**RED→GREEN order (Pass 3):** spec first (list + both assertions); `npm run build && npx
playwright test tests/e2e/csp.spec.ts` — expected, for `/rings.html`: `expect(received).
toContain(expected) … Expected substring: "https:"` (the page has today's static list);
the other pages' "does not contain" rows pass already (they are the guard, not the RED);
then `cspFor` + the entry; GREEN. Read the count: **13** page rows in the sweep's output.
**Logging:** none — build-time. **Depends on:** 6a; OQ7 decided (a).
**Write-set:** `build.mjs`, `tests/e2e/csp.spec.ts`, `docs/SECURITY.md` — three.
**Shared-state contract:** none.
**Risks:** `default-src 'none'` still governs every other directive on the page — `script-src`,
`style-src`, `img-src` are untouched, so a widened `connect-src` admits fetches, not code.
Say so in the SECURITY.md sentence.
**Done when:** (1) the built `rings.html` carries the widened `connect-src` and no other page
does; (2) the spec; `npm test`.
**Validation:** Moderate — a CSP change: after the gate, open the built page (`npm run
serve`) with DevTools' console visible and confirm no `securitypolicyviolation` is reported
at load, and read `dist/index.html`'s `<meta>` by eye to confirm it is unchanged from the
previous build (diff the two builds' `<meta>` lines: `grep -o 'connect-src[^;]*' dist/*.html`
— one line differs).

### Phase 6a-iii: the page walks — wired through the export path (inserted in Pass 3)

**Goal:** `rings.html` walks any handle live from PDSs, drawing as it fills, honest about
stale and unknown.
**Changes:**
- [ ] `src/pages/rings.ts` — resolves the handle (via `src/atproto/read.ts` `resolveHandle`), then `import { createWalker, createFetchTransport, indexedDbStore } from 'croft-pwa/pds-walker'` (**the export path**, V2 — `TODO.md` § 3 box 2's clause), passing **`log`** from `src/log.ts` as the walker's and transport's `Logger` (V31: the page's `?debug=1` switch and `[croft]` tag then apply to the library's lines); renders on `ring`/`host`/`progress` events; `hop`/`hop2` shown as they fill with "as of" and "N of M followees" (`hop` before `hop2`, OQ6 (c)); the hosts panel lists unknown hosts with their reason. Page-level logging: `log.warn('rings: resolveHandle failed', err)`; `log.info('rings: walk started')` (no handle/DID at info).
- [ ] `tests/e2e/rings.spec.ts` — the behaviour half: `page.route` mocks for `plc.directory`, `getLatestCommit`, `listRecords` (bodies inline in the spec, own `// source:` comments); asserts the three default counts, the "as of" text, `hop2` growing across two routed followees, a routed 502 host appearing in the hosts panel (unknown, not empty — and its count card unchanged), and — observability — that the page console carried exactly one `[croft]` `warn` line naming the failing host and no console line at any level containing `did:` unless `?debug=1` (two runs of the same route set; `page.on('console')`).
- [ ] `docs/ATPROTO.md` § CSP — the last sentence ("… needs a header-level CSP or a per-host relaxation") gains: "The rings page (`rings.html`) is that app, and takes the per-page relaxation — `docs/SECURITY.md` § CSP".
**Call chain:** browser → `rings.html` → `src/pages/rings.ts` → `croft-pwa/pds-walker` → PDSs.
**Wiring test:** `npx playwright test tests/e2e/rings.spec.ts`; RED → GREEN.
**RED→GREEN order (Pass 3):** spec cases first; `npm run build && npx playwright test
tests/e2e/rings.spec.ts` — expected `expect(locator).toHaveText(expected) … Expected string:
"2" … Received string: "—"` on the first count (the shell's placeholder from 6a); then the
page code; `npm run build` — **read the bundle-size line** (V27: walker + `read.ts`
`resolveHandle` + shell against the 20 KB gz budget; if over, raise the constant in this
commit with the measured number in the message, never silently); GREEN.
**Logging:** as above — the library's lines arrive through the injected `log`.
**Depends on:** 6a-ii (the fetches must be admitted before the page makes them). **Write-set:**
`src/pages/rings.ts`, `tests/e2e/rings.spec.ts`, `docs/ATPROTO.md` — three.
**Shared-state contract:** none (routes mocked); the manual run below reads the network.
**Risks:** *Hermetic shell (V26):* `a11y.spec.ts` (6b-ii) aborts every cross-origin request —
the page must stay idle until a handle is entered, never auto-walk a stored one at load.
*Bundle budget (V27)* — above.
**Done when:** (1) the built page, given a handle, shows rings filling with "as of", and an
unreachable host as unknown; (2) the spec; `npm test`.
**Validation:** Broad — *Pass 3, raised from Moderate:* this phase touches the network, the
CSP it just widened, and a public deploy path. After the gate: (a) `npm run serve` and walk
a real handle **that follows at least one account off `bsky.network`** (a `did:web` or a
self-hosted PDS — the reason for 6a-ii) with DevTools open: the off-bsky host is reached
(no `securitypolicyviolation`, no red network row), the `[croft]` lines appear under
`?debug=1` and only `warn`s without it, and no DID is visible in the console without
`?debug=1`; (b) walk a handle whose PDS is down or fictional and see the host in the panel
with its reason; (c) after the G6 PR opens, repeat (a) on the **PR preview deploy**
(`preview.yml`, V13 — served from Pages under a subpath, the same shape as production); (d)
paste the console excerpt and the preview URL into `RUN-PDS-WALKER-06-SUMMARY.md`'s
verify-in-run ledger. The `e2e:live` page run the Pass 2 6b Validation names happens here.

*Historical (Pass 2 text of 6a, kept for the record):* the `PAGES`-entry shape, the OQ7
mechanism and the CSP/budget/hermetic risks below were written when 6a was one phase.
**Risks:** *CSP `connect-src` — Pass 2 answer (V17):* the build composes ONE policy for every page and its `connect-src` is a static allowlist (`plc.directory`, `*.host.bsky.network`, `bsky.social`, the AppView, the three provider entryways). There is no per-page CSP today. Under it the page reaches `plc.directory` and every bsky-hosted PDS shard (the wildcard covers the "25–29 distinct hosts" the research measured, which are mostly shards), and a `fetch` to any other PDS (a self-hosted `*.bluesky.page`, a `did:web` host, a non-bsky provider's data hosts) is refused by the browser before the network — the transport sees a `TypeError` and reports the host `unknown`, which is honest but makes ring 2 structurally incomplete for every followee off bsky.network. The decision is OQ7. `docs/ATPROTO.md` § CSP already names the two ways out ("a header-level CSP or a per-host relaxation"); Pages cannot send headers, so the per-page relaxation in `build.mjs` is the available one. *Bundle budget (V27):* the page's gzipped bundle must stay under `PAGE_JS_GZ_BUDGET` (20 KB) — walker + `read.ts` `resolveHandle` + the shell; measure at the first build and, if over, raise the constant deliberately in the same commit with the number, never silently. *Hermetic shell (V26):* the page must render its cards with no network and no SW (idle until a handle is entered) — `a11y.spec.ts` aborts every cross-origin request, and 6b-ii adds this page to it.
**Done when:** (1) the built page loads and, given a handle, shows rings filling; (2) `npm run build` + a manual browser run against a real handle (Validation: Moderate); `npm test`.
**Validation:** Moderate. *(Superseded by 6a / 6a-ii / 6a-iii above.)*

### Phase 6b: the rings page — gated

**Goal:** the page is proven hermetically, accessibly, and on a phone-sized viewport.
**Changes:**
- [ ] `tests/e2e/rings.spec.ts` — *Pass 3:* the routed behaviour cases moved to 6a-iii; this phase adds the **gating** half: axe scan in both themes (ACCESSIBILITY.md — hermetic, cross-origin aborted); 390 px viewport, no horizontal overflow; every tap target ≥ 44 px (MOBILE-FIRST.md — measure the `<details>` summary and the handle field's button, the two new targets); and **the Standards tab is `aria-current="page"` on this page** (the RED for the `nav.ts` edit).
- [ ] `src/nav.ts` — the page joins the nav. *Pass 2 (V18):* the nav is `TABS` in `src/nav.ts`; each tab lists the basenames on which it is current. Per OQ8's recommendation, `rings.html` is added to the **Standards** tab's `active` list (no seventh tab on a 320 px bar); the card that makes it reachable is 6b-iii.
- [ ] `src/pages/guide-content.ts` — a user-guide chapter: what a ring is, what "as of" means, what "unknown host" means. (`tests/unit/guide-content.test.ts` pins shape, not count — a new entry with a `guide-` testid and non-empty blocks passes without a test edit; a `shot` block would need its jpg on disk, so use none.)
**Call chain:** as 6a.
**Wiring test:** `npx playwright test tests/e2e/rings.spec.ts`; RED → GREEN.
**Depends on:** 6a; OQ8 decided. **Write-set:** the three files. **Shared-state contract:** none (routes mocked).
**Risks:** *Pass 2 — the split happened (V18, V19):* `a11y.spec.ts`, `mobile-fit.spec.ts` and `csp.spec.ts` each enumerate pages by a hard-coded list, and `standards.spec.ts` asserts the index's card count against its own list. Counted honestly, "the page is gated" is seven files. This phase keeps its three; the page-list specs are **6b-ii** and the index card + its spec are **6b-iii**, both inserted below without renumbering 6c.
**Done when:** (1) the page passes its hermetic behavior test (rings, "as of", growth, the unknown host — 6a-iii's half) and the axe + 390 px + 44 px + current-tab checks inside `rings.spec.ts`; (2) the spec; `npm test`.
**Validation:** Moderate; ~~plus one `e2e:live` run of the page against a real handle, recorded~~ *(Pass 3: the live run is 6a-iii's Broad step)*. Moderate stands: an axe + width sweep on one page with mocked routes; the manual half is opening the page at 390 px in DevTools' device mode and tapping the disclosure and the submit — recorded as a line in the RUN summary.
**RED→GREEN order (Pass 3):** the four gating cases first; `npm run build && npx playwright
test tests/e2e/rings.spec.ts` — expected the current-tab case RED: `expect(locator).
toHaveText(expected) … Expected string: "Standards"` with no `aria-current` tab found (the
nav does not know the page yet); the axe/width/target cases may already pass — if all four
are green before any edit, the RED is proven per 6b-ii's rule (a deliberate break, once,
recorded) or the case is not testing anything; then `nav.ts`; GREEN. `guide-content.ts` has
its shape pinned by `tests/unit/guide-content.test.ts` (Pass 2) — add the entry, run `npm
run unit`, read that the guide test's count went up by one.
**Logging:** none new.

### Phase 6b-ii: the page joins the site's page-list gates

**Goal:** the three sweeps that grade every page grade this one — without a list edit they
silently do not (V19). *Pass 3:* two of the three here; the CSP sweep starts in 6a-ii.
**Changes:**
- [ ] `tests/e2e/a11y.spec.ts` — `'/rings.html'` in `PAGES` (both themes; the hermetic shell must pass with every cross-origin request aborted — V26).
- [ ] `tests/e2e/mobile-fit.spec.ts` — `'/rings.html'` in the width list (320/360/390).
- [ ] ~~`tests/e2e/csp.spec.ts`~~ — *Pass 3: moved to 6a-ii*, where the page's policy changes (its sweep starts the commit the policy does). This phase is two files.
**Call chain:** `npm test` → `playwright test` → the two sweeps → `dist/rings.html`.
**Wiring test:** each spec RED on the list edit if the page fails its sweep, GREEN when it passes — the RED is proven by running the three specs with the page temporarily broken (an `overflow` at 320 px, a contrast token) once, recorded in the RUN summary, then restored. (A list edit that only ever passes is VERIFICATION.md shape 3; the deliberate break is the proof the sweep reaches the page.)
**Depends on:** 6a (the page builds). **Read-set:** `dist/rings.html`. **Write-set:** the three spec files.
**Shared-state contract:** none. **Risks:** none material.
**Done when:** (1) `rings.html` appears in both sweeps' test titles in the gate's output (read the count — CI.md's checklist: "read the count, not the tick": a11y **+2** rows (two themes), mobile-fit **+3** rows (three widths)); (2) `npx playwright test tests/e2e/a11y.spec.ts tests/e2e/mobile-fit.spec.ts`; `npm test`.
**Validation:** Narrow — stands (list edits; the sweeps are the validation).
**RED→GREEN order (Pass 3):** the deliberate break is the RED and it is done **first**: add
the two list entries, then in `rings.html` temporarily set a fixed `width: 400px` on a card
and a `color` token pair that fails contrast; run the two specs — expected
`no horizontal overflow: /rings.html at 320px` fails (`expect(received).toBe(false) …
Received: true`) and `a11y: /rings.html (light)` fails with `color-contrast`; **restore
the shell** (`git diff rings.html` empty — the break never enters a commit); run again —
GREEN. Record both failure lines in the RUN summary as the proof the sweeps reach the page.
**Logging:** none.

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
**Validation:** Narrow — stands.
**RED→GREEN order (Pass 3):** `standards.spec.ts`'s `INDEX_CHAPTERS` entry first; `npm run
build && npx playwright test tests/e2e/standards.spec.ts` — expected `expect(received).toBe
(expected) … Expected: 8 Received: 7` on the card count; then the `CHAPTERS` entry in
`reference.ts`; GREEN (and the reverse — card without list — is the same assertion the
other way, so one RED suffices).
**Logging:** none.

### Phase 6c: the first release — `pds-walker-v0.1.0`

**Goal:** the first tag, gated by 1d's workflow.
**Changes:**
- [ ] `CHANGELOG.md` — `## [pds-walker 0.1.0] — <date>` section above the month sections (V7). Its entries carry the `**pds-walker:**` prefix like every other line (check 40 grades version sections too).
- [ ] `TODO.md` — *Pass 2 correction:* § 3 is **not** removed; boxes 1–3 are ticked (*Pass 3:* box 1 already ticked in 1d-ii; boxes 2 and 3 tick here — 6a-iii and G5 made them true) and box 4 (the eight skylite-ported files become the canonical home; bluebird + fun consume them) stays under a re-headed § 3 — no phase here does it, and deleting the box would delete the debt's only TODO (SHARED-CODE rule 4 requires the copying repo to carry one).
- [ ] `src/pds-walker/index.ts` — `VERSION` confirmed `0.1.0` (no change expected; the tag must equal it).
**Call chain:** `git tag pds-walker-v0.1.0 && git push origin pds-walker-v0.1.0` → 1d's workflow.
**Wiring test:** the workflow run itself: release created with the tarball asset and its sha256; `changelog-shape.sh` prints no FLAG for the new tag.
**Depends on:** 6b, 6b-ii, 6b-iii landed on `main` (the tag is cut from `main`), **and this phase's `CHANGELOG.md` section landed on `main` before the tag is pushed** — check 37 fires for any tag dated on or after 2026-08-29 with no matching section (V20's finder), so the order is section → landing → tag, never tag first.
**Write-set:** the three files. **Shared-state contract:** GitHub: a tag and a release.
**Risks:** first run of the two-clock changelog under checks 38/40 — the workspace audit after the tag is the proof.
**Done when:** (1) `gh release view pds-walker-v0.1.0` shows the asset; (2) `bash CroftC/.claude/bin/workspace-audit.sh` shows no croft-pwa changelog FLAG and no 47e NOTE.
**Validation:** Broad — stands. *Pass 3 adds the consumer-side proof:* from a scratch
directory, `npm install "github:CroftCommunity/croft-pwa#<sha of the tag>"` then `node -e
"import('croft-pwa/pds-walker').then(m => console.log(m.VERSION))"` prints `0.1.0` — the
exact command Phase 7 will run, against the exact commit; and download the release tarball,
check its sha256 against the uploaded `.sha256`, `npm install ./croft-pwa-0.1.0.tgz`, same
one-liner. Both outputs in `RUN-PDS-WALKER-07-SUMMARY.md`.
**RED→GREEN order (Pass 3):** this phase's RED is the ordering rule itself: `bash
../../../.claude/bin/changelog-shape.sh "$PWD"` after writing the `[pds-walker 0.1.0]`
section but **before** the tag — quiet (a section with no tag is fine); the tag pushed
**before** the section landed would FLAG (check 37) — do not produce that RED, it costs a
tag deletion; the section → landing → tag order is the GREEN. The workflow run is the
verification (read its log end to end, `gh run view <id> --log`, not the tick).
**Logging:** the workflow's log is the record; nothing in code.

---

### Phase 7: first consumer — forage (shaped here, executed under a forage plan)

- `package.json`: `"croft-pwa": "github:CroftCommunity/croft-pwa#<sha of pds-walker-v0.1.0>"`.
- `npm run vendor:sync` copies `node_modules/croft-pwa/lib/pds-walker/index.js` → `js/vendor/pds-walker.js`; `test/vendor.test.js` gains byte-equality against the installed file.
- One call site: `ringGraph()` takes follows from the walker; mutuals from the walker once ring 2 has filled, AppView until then. *Pass 2 (V24):* forage's `hop` is the mutuals' follows (`rings.js` § `chain()`), so if OQ6 keeps the research definition in the core, forage's call site must compute its own `hop` from the walker's snapshots (it can — `hopFollows` per mutual is a subset of what the walker stores), and its `test/rings.test.js` containment counterexample must keep passing. *Pass 3 — OQ6 (c):* forage's `hop` **is** the walker's `hop` now, one-to-one; `ringGraph()` reads `walker.ring('hop')` and computes nothing; `hop2` is available to forage as a new optional scope if it wants one (its own decision, its own plan).
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

### Landing groups, RUN summaries and claims (Pass 3; OQ9 confirmed grouped)

| group | phases | landing subject (`scope: sentence`, CHANGELOGS.md) | RUN summary |
|---|---|---|---|
| G1 | 1a, 1b, 1c, 1d, 1d-ii | `package: croft-pwa is now also a package (croft-pwa/pds-walker)` | `RUN-PDS-WALKER-01-SUMMARY.md` |
| G2 | 2a, 2b, 2c, M1 | `pds-walker: the pure core — rings, the rev gate, cadence` | `RUN-PDS-WALKER-02-SUMMARY.md` |
| G3 | 3a, 3b, 3c, M2, 3d | `pds-walker: the fetch transport — resolve, PDS calls, per-host limiter` | `RUN-PDS-WALKER-03-SUMMARY.md` |
| G4 | 4a, 4b | `pds-walker: the store — memory and IndexedDB` | `RUN-PDS-WALKER-04-SUMMARY.md` |
| G5 | 5, M3 | `pds-walker: the walker` | `RUN-PDS-WALKER-05-SUMMARY.md` |
| G6 | 6a, 6a-ii, 6a-iii, 6b, 6b-ii, 6b-iii | `site: the rings page — the library's reference page` | `RUN-PDS-WALKER-06-SUMMARY.md` |
| G7 | 6c | `release: pds-walker-v0.1.0 — …` (the bump commit renames the section) | `RUN-PDS-WALKER-07-SUMMARY.md` |

Every phase still commits at its own stable point on the branch (the commit-per-phase rule
is untouched); a group is how often `main` deploys. Each landing's deliverables, in order:

1. **The RUN summary** (`CLAUDE.md` § Conventions; contents per V34): scope; the **red→green
   evidence per phase** — the exact RED text each phase's "RED→GREEN order" line predicts,
   as observed, and the GREEN run; **the full gate output with counts** (`npm test`, not a
   `| tail`); a screenshot/a11y note where a page changed (G6); what was scoped out and why;
   a files-touched table (new vs changed) — which is also the check that no phase exceeded
   its count; and the **verify-in-run ledger** for anything a hermetic test could not reach
   (G1: the two scratch installs and the dry-tag run; G3: the live spec's output; G5: the
   Node run; G6: the real-handle and preview-deploy runs; G7: the consumer-side install).
   Mutation rounds (M1–M3) paste their survivor triage here as well as in the Review Log.
   Never rewritten after the fact — a later group writes its own file.
2. **The `CHANGELOG.md` line** under the month, `- YYYY-MM-DD **<ctx>:** …` (1d's
   `Contexts:` line makes check 40 grade it); every group touches a run path (`package.json`
   or `src/`), so none may skip it (check 39, V20).
3. **The claim** — landing on `main` is a contested surface (`CLAUDE.md` § Concurrent
   sessions: `docs/CI.md` changes ripple workspace-wide; V35): before opening the PR, check
   `ls CroftC/.coordination/claims/` and `ListAgents`; write
   `CroftC/.coordination/claims/croft-pwa--land-pds-walker-G<n>.md` from the COORDINATION
   template (the `# Claim: croft-pwa — land G<n> on main` header line is required — audit
   check 1 greps it); `expected:` the merge, typically under an hour. Delete the file when
   the PR is merged or abandoned. G1 and G7 additionally touch the CroftC docs (SHARED-CODE,
   ARCHITECTURE, CHANGELOGS) — a second claim, `croftc--pds-walker-docs.md`, for that PR.
4. **The PR** — rebase onto `origin/main`, `git push`, `gh pr create` (identity: `gh auth
   switch --user chasemp` first; `--repo CroftCommunity/croft-pwa`), **ask before merging**
   unless already told; merge with a merge commit, subject `land: …`, body carrying
   `Claude-Session` (COORDINATION rule 2). Then the workspace audit
   (`bash .claude/bin/workspace-audit.sh`) as the group's checkpoint: G1 must silence 47e;
   G7 must show no changelog FLAG for the tag.

**Debugging readiness (Pass 3):** if a later group is found broken, the RUN summaries are
the bisection — each names the gate output at its landing, so `git log --first-parent
main` between two `land:` commits bounds the regression to one group, and the per-phase
commits inside it bound it to one phase. In the running page, `?debug=1` (or
`localStorage['croft-debug']='1'`, which survives a redirect — `src/log.ts` header) turns
on the library's `debug`/`info` lines through the injected logger; the hosts panel is the
user-visible half of the same record.

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

Raised in Pass 2; **decided by the owner 2026-09-08, after Pass 2** (recorded in Pass 3 —
each decision is appended to its question and folded into the phases it gates):

- [CONFIRMED: PHASE-GATED (2a)] **OQ6** Which set is `hop`? (a) the research doc's ring 2
  — the union of all followees' follows (~440 k for the measured account); (b) forage's
  shipped `hop` — the union of the **mutuals'** follows (V24: `rings.js` § `chain()`, the
  first consumer's definition, and what research § 7 means by "matches forage's shipped
  `DEFAULT_STOPS`"); (c) both, under two ids. *Both satisfy the containment chain and both
  come from the same snapshots, so the walk is unchanged either way; only `rings()` and one
  test row differ. Recommend (b): the first consumer defines the ring, and a library whose
  `hop` disagrees with its consumer's `hop` is the kind of drift the whole plan exists to
  stop. (a) stays available to a consumer as a derived set from `store.all()`. Phase 7's
  call site is written against (b).*
  **Decision (owner, 2026-09-08): (c) — both, under two ids.** `RingId` gains a fifth id:
  `hop` = the union of the **mutuals'** follows (forage's shipped definition); `hop2` = the
  union of **all** followees' follows (the research's ring 2). Containment chain
  `me ⊂ mut ⊂ fol ⊂ hop ⊂ hop2` (mutuals ⊂ follows, so it nests). Folded into 2a
  (`rings()`, the distinguishing test rows, the property test), 2c (`Policy.refreshMs.hop2`,
  daily like `hop`), 5 (the surface; `hop` emitted before `hop2`; one walk feeds both — no
  extra requests), 6a (five cards: the default three plus `hop` and `hop2` as optional
  cards) and Phase 7 (forage's `hop` maps one-to-one).
- [CONFIRMED: PHASE-GATED (6a)] **OQ7** The rings page's `connect-src`: (a) per-page
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
  **Decision (owner, 2026-09-08): (a) — widen this page's `connect-src` to `https:`** via
  the `cspFor(page)` mechanism. Folded into **6a-ii** (the mechanism + the both-directions
  `csp.spec.ts` assertion + `docs/SECURITY.md`) and **6a-iii** (`docs/ATPROTO.md`); the
  Documentation Impact rows stand, with the phase corrected.
- [CONFIRMED: PHASE-GATED (6b)] **OQ8** Where the page lives in the nav: (a) under the
  Standards tab (`src/nav.ts` `active` list) with a card in `src/pages/reference.ts`
  `CHAPTERS` (6b + 6b-iii as written); (b) its own top-level tab (a seventh on the 320 px
  bar; `TABS` + `smoke.spec.ts` instead of `reference.ts` + `standards.spec.ts`). *V18: both
  registries exist and both are gated by a spec that counts. Recommend (a): the repo's own
  rule is "keeps the top nav to four tabs while the chapters live one level down"
  (`reference.ts` header), the page is the library standard's chapter (D1's reasoning), and
  the mobile tab bar has no room the owner has not already spent.*
  **Decision (owner, 2026-09-08): (a) as recommended** — the Standards tab's `active` list
  (6b) + a card in `reference.ts` `CHAPTERS` (6b-iii). 6b-iii's alternative branch is moot.
- [CONFIRMED: ADVISORY] **OQ9** Landing cadence: one PR per phase (17 landings, each
  deploying the site), or grouped — 1a–1d as one landing ("croft-pwa is now also a
  package"), 2a–2c, 3a–3d, 4a–4b, 5, 6a–6b-iii, 6c? *Each landing must carry its
  `CHANGELOG.md` line when it touches a run path (`package.json` counts, V20 — check 39
  NOTEs otherwise), and each must leave the gate green regardless. Grouping does not change
  the commit-per-phase rule (every phase still commits at its stable point on the branch);
  it changes how often `main` deploys and how many `land:` messages exist. Recommend the
  grouped shape: the first landing is the one consumers can pin, and a landing per
  sub-phase publishes seventeen sites that differ by a build stamp.*
  **Decision (owner, 2026-09-08): grouped, as recommended.** The groups, their subjects,
  RUN summaries and claims are the table under § Deployment › Landing groups (G1–G7).

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

### Pass 3: Quality Gates — 2026-09-08

Read at worktree commit `23a7bcf` (`claude/pds-walker-plan`), fresh context; analysis only,
the plan file the only edit. Read alongside it: `src/log.ts`, `package.json`, `build.mjs`
§§ 4, 7, 8, `tsconfig.json`, `eslint.config.js`, both Playwright configs, `vitest.config.ts`,
every `tests/e2e/*.spec.ts` head, `tools/serve.mjs`, `docs/SECURITY.md`, `docs/ATPROTO.md`
§ CSP, `docs/CI.md`, `docs/PRACTICES.md` § RUN summaries, `TODO.md` § 3, `CHANGELOG.md`,
`ci.yml`, `CroftC/.claude/COORDINATION.md` § Claims, and global `CLAUDE.md` § Testing
Principles / § Development Workflow. V31–V37 added with anchors.

**Owner decisions recorded first** (arrived after Pass 2): OQ6 → (c) two ids (`hop` =
mutuals' follows, `hop2` = all followees' follows; chain `me ⊂ mut ⊂ fol ⊂ hop ⊂ hop2`);
OQ7 → (a) per-page `connect-src: https:` via `cspFor(page)`; OQ8 → (a); OQ9 → grouped. All
four `[RECOMMENDED]` → `[CONFIRMED]` with the decision appended; folded into 2a, 2c, 5, 6a
(five cards), 6a-ii/6a-iii, 6b, 6b-iii and Phase 7.

**TDD ordering:**
- Every phase now carries a **RED→GREEN order** line: the first failing command and its
  expected failure text (`Missing script`, `TS18003`, `ERR_PACKAGE_PATH_NOT_EXPORTED`, `does
  not provide an export named '…'`, `Received: 404`, `Expected substring: "https:"`,
  `Expected: 8 Received: 7`, the sweep failures), then the minimal GREEN.
- **The 4th-file pattern removed.** Pass 2's "export test gains …" wiring lines made 2a, 2b,
  2c, 3a, 3b, 3c, 3d, 4a and 5 four files each when counted honestly. Fix: a test-import rule
  in 1c — every `pds-walker-*.test.ts` imports through `croft-pwa/pds-walker`, so each
  phase's own test is an entry-point test (dev loop `npm run build:lib && npx vitest run`),
  with the V23-fallback branch stated. Re-exports now land in the phase that adds the
  symbol (3a, 3b, 4a — no longer deferred to 3d/4b). 3c's limiter case lives in the
  limiter test (tests are not 1:1 with files). 3d gets a `pds-walker-transport.test.ts`
  with one chain case per 3a–3c behaviour — the group's Isolation-Trap defence.
- **Mutation resistance:** edges named per phase — the `hop`/`hop2` distinguishing rows and
  the `asOf` min-vs-max row (2a); branch order in the rev gate (2b); `R−1`/`R`/`R+1` due-ness
  and shallow-vs-deep policy merge (2c); two distinguishable `unknown` reasons (3a); the 502
  on page 2 yielding no partial list (3b); `Remaining: 10` vs `9`, `reset` vs `reset−1`,
  max-in-flight recorded (3c); newer-does-not-lose-to-older and store-name isolation (4a,
  4b); once-per-host warn, no-DID-at-info/warn regex, `hop`-before-`hop2`, `progress` exactly
  `n` (5); `connect-src` widened on one page and **not** on the others (6a-ii).
- **Mutation checkpoints M1 (after 2c), M2 (after 3c), M3 (after 5)** with the house rules
  stated: commit the green state before EVERY round; read survivors, triage
  equivalent-vs-gap in the Review Log; the `lib/`-vs-`src/` aliasing trap for stryker named
  with two honest options.
- **File counts corrected without renumbering:** 1a→3 (`CLAUDE.md` § The gate to 1b); 1c→3
  (`TODO.md` out); 1d→3 (`ci.yml` + `TODO.md` → new **1d-ii**); 3a/3b fixtures inlined;
  4a's `types.ts` folded into `memory.ts`; 6b-ii→2 (`csp.spec.ts` → 6a-ii). **6a is the one
  phase left at four** (shell + entry + registry line + its spec): V33 shows no spec would
  find a new page, so three files means either an untested page (Pass 2's shape) or a RED
  gate at a phase boundary; the exception is reasoned in place and is the only one.

**Observability:**
- The library must not import `src/log.ts` (browser-shaped, V31), so logging is an injected
  **`Logger`** (the `log` shape; type in 2a's `rings.ts`, `defaultLogger()` in 3c's
  `limiter.ts` — warn/error to `console` tagged `[pds-walker]`, debug/info silent — and
  `log?` on `createWalker` and `createFetchTransport`). The page passes `src/log.ts`'s `log`,
  so `?debug=1` and `[croft]` apply to the library's lines for free.
- Message set and levels: `warn` host paused/resumed (3c, host only), `warn` host unknown
  **once per host** (5), `info` ring `id/size/asOf/complete`, `info` refresh counts, `debug`
  rev moved / walk start (the only lines carrying a DID). **No DID at info or warn** — pinned
  by a unit regex (5 viii) and an e2e console check (6a-iii). Page-level lines follow the
  repo's `shell mounted` pattern.

**Debugging readiness:**
- Landing groups G1–G7 each write a numbered `RUN-PDS-WALKER-0n-SUMMARY.md` (V34 contents:
  per-phase RED text as observed, full gate output, files-touched ledger, verify-in-run
  ledger) — the bisection record between `land:` commits; the workspace audit is each
  group's checkpoint (G1 silences 47e; G7 shows no changelog FLAG). The claim protocol
  (V35) is a numbered deliverable of every landing.

**Validation calibration:**
- Challenged every Narrow on a phase touching network, CSP or the workflow: **1d raised** —
  a Broad dry-tag run (`pds-walker-v0.0.0-dry`, mismatch → the compare step fails, no
  release; tag deleted the same session because check 37 sees it); **6a-iii raised to
  Broad** (real handle with an off-bsky followee, DevTools console, the PR preview deploy);
  **6a-ii Moderate** (the CSP diff read by eye); 6c gains the consumer-side install at the
  tagged sha. 1a/1b/1d-ii/2x/3a–3c/4a/6a/6b-ii/6b-iii stay Narrow with the reason stated;
  1c, 4b, 5, 6b Moderate stand.

**Concurrency honesty:**
- Map re-confirmed sequential after the file moves; write-sets re-read per phase and listed;
  the opt-in {6b, 6b-ii, 6b-iii} candidate still disjoint; contract already in invariants
  (Pass 2); one re-entry line added (no `croft-pwa--*` claim of ours left after a landing).

**Discovery:** no Phase 0 (unchanged); the three reasoned-not-probed items each have the
phase and the exact command that proves them (1a step 2, 1c step 1 and 4, 3a's `ls lib/`).

**Coherence:** the plan still solves the stated problem (package shape → walker → reference
page → consumer); scope grew by exactly the owner's decisions (`hop2`, the CSP exception) and
by the quality layer (logging, checkpoints, RUN/claim deliverables) — nothing else. Every
open question is tagged and every severity confirmed by the owner.

**Documentation impact:** every stale-making phase schedules its doc in the same phase, with
Pass 3 corrections listed under Documentation Impact (`CLAUDE.md` § The gate → 1b, §
Structure → 1c; `TODO.md` → 1d-ii and 6c, including its stale "Phase 0" pointer; `ci.yml` →
1d-ii; SECURITY.md → 6a-ii, ATPROTO.md → 6a-iii; the research doc § 7 note → 2a; the
SHARED-CODE copies row → 3a; RUN summaries per group; the fixtures directory not created).

**Could not gate:** (1) whether stryker can be pointed at `src/` while tests import `lib/`
— named as M1's first decision with both options, not assumed; (2) whether a
`workflow_dispatch` on a branch-only workflow file is accepted by GitHub — avoided rather
than assumed: the dry-tag run uses the push trigger, which runs the file at the pushed ref;
(3) OQ1–OQ3 remain the owner's approvals at their phases.

**Confirmed ready:** yes — execute at Phase 1a. **Plan file:**
`plans/2026-09-08-plan-pds-walker.md` (this worktree; absolute path
`/Users/cpettet/git/chasemp/CroftC/worktrees/pds-walker/croft-pwa/plans/2026-09-08-plan-pds-walker.md`).
