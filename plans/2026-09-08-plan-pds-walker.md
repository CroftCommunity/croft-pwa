# Plan: pds-walker — the rev-gated ring walker, as croft-pwa's first library export

date: 2026-09-08
identity: chasemp (`chase@owasp.org`, `github-personal`), repo `CroftCommunity/croft-pwa`
**Status:** DRAFT for owner review — decisions D1–D3 open (§ Decisions); no phase started.

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

## Approach

Seven phases, each RED-first, each leaving `npm test` (the one gate: lint · typecheck ·
unit · build · e2e) green, each with its `CHANGELOG.md` entry written on the branch.
Phases 0–5 are this repo; phase 6 is the first consumer (forage) and is executed under a
forage plan that this one only shapes; phase 7 is optional and later.

```
 Phase 0   the root becomes a package            exports · files · prepare · lib/
 Phase 1   the pure core (no I/O)                 rings · rev-gate · cadence · as-of
 Phase 2   the transport                          resolve · listRecords · getLatestCommit
 Phase 3   the store                              Store interface · memory · IndexedDB
 Phase 4   the walker                             orchestration · background ring 2 · events
 Phase 5   the reference page (dogfood)           rings.html · imports via the export path
 Phase 6   first consumer: forage (its own plan)  pin · vendor-sync · one call site
 Phase 7   optional: Jetstream for ring 1         live tier when signed in, ≤10k DIDs
```

The library's public surface, fixed here so every phase builds toward the same thing:

```ts
// import { createWalker } from 'croft-pwa/pds-walker';
type Did = `did:${string}`;
type Rev = string;                       // a TID; compares lexically
type RepoSnapshot = { did: Did; pds: string; rev: Rev; follows: readonly Did[]; fetchedAt: number };
type HostState    = { host: string; state: 'ok' | 'unknown'; since: number; reason?: string };
type RingId       = 'me' | 'mut' | 'fol' | 'hop';
type Ring         = { id: RingId; members: ReadonlySet<Did>; asOf: number; complete: boolean };

type Transport = {
  resolve(did: Did): Promise<{ pds: string } | { unknown: string }>;
  latestRev(pds: string, did: Did): Promise<Rev | { unknown: string }>;
  listFollows(pds: string, did: Did): Promise<readonly Did[] | { unknown: string }>;
};
type Store = { get(did: Did): Promise<RepoSnapshot | null>; put(s: RepoSnapshot): Promise<void>; all(): Promise<RepoSnapshot[]> };
type Policy = { refreshMs: Record<RingId, number>; perHostConcurrency: number; ring2Parallel: number };

type Walker = {
  ring(id: RingId): Ring;                              // current answer, never throws, never empty-by-accident
  walk(me: Did, opts?: { rings?: RingId[] }): Promise<void>;  // ring 0–1 awaited; 'hop' fills in the background
  refresh(): Promise<void>;                            // rev-gated: only repos whose rev moved are re-listed
  hosts(): HostState[];                                // what is unknown right now, and since when
  on(event: 'ring' | 'host' | 'progress', fn: (e: unknown) => void): () => void;
  stop(): void;
};
declare function createWalker(deps: { transport: Transport; store: Store; policy?: Partial<Policy>; now?: () => number }): Walker;
```

Two invariants every phase's tests assert: **unknown is not empty** (a failed host leaves
the previous answer in place and marks the host, it never shrinks a ring), and **the
containment chain holds** (`me ⊂ mut ⊂ fol ⊂ hop`, forage's `rings.js` rule, now as a
property test).

## Reasoning

**Why a package first, walker second (Phase 0 before Phase 1).** SHARED-CODE.md rule 2's
last clause is that the reference app imports the library through its own export path,
which is uncheckable by script and therefore must be true from the first commit — a walker
built as `src/pds-walker/` and imported relatively would be a copy waiting to happen. The
package shape is also what turns check 47e from a NOTE into silence, which is the first
measurable step.

**Why the core is pure and the transport is a parameter.** croft's client ADR says the same
thing for Rust ("no I/O, no async, no clock" in the core); here it is what makes the tests
hermetic and the walker portable to a service worker or a Node script. The transport is the
only place `fetch` appears; the clock is injected so "as of" and cadence are testable.

**Why re-list rather than diff (owner decision 3).** Follows are a small share of a repo's
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

## Phases

### Phase 0 — the root becomes a package (SHARED-CODE.md rule 2; closes check 47e)

- `package.json`: `"exports": { "./pds-walker": { "types": "./lib/pds-walker/index.d.ts", "default": "./lib/pds-walker/index.js" } }`, `"files": ["lib/pds-walker"]`, `"prepare": "npm run build:lib"`. `private` stays `true` (it blocks `npm publish`, not a git install) — recorded so nobody "fixes" it.
- `tsconfig.lib.json` extends the root config with `noEmit: false`, `declaration: true`, `outDir: lib`, `rootDir: src`, `include: ["src/pds-walker"]`. `lib/` is gitignored — `prepare` produces it on install.
- RED first: a unit test that does `import('croft-pwa/pds-walker')` (Node resolves a package's own name through `exports`) and fails because nothing is there; GREEN with an empty `index.ts` exporting `VERSION`.
- Gate: `build:lib` joins `npm test`; CI runs it on a fresh clone (the smoke shape that catches "green here, broken from a tarball").
- Measure: `bash CroftC/.claude/bin/shared-code.sh croft-pwa` no longer prints the 47e NOTE.
- Changelog: "croft-pwa is now also a package: `croft-pwa/pds-walker` …".

### Phase 1 — the pure core

Files under `src/pds-walker/core/`: `rings.ts` (set math + containment), `revgate.ts`
(`decide(snapshot, latestRev, now, policy) → 'keep' | 'relist'`), `cadence.ts` (per-ring
refresh intervals; which followees are due), `asof.ts` (a ring's `asOf` is the OLDEST
`fetchedAt` among its sources — the honest number).

- Tests are hermetic and table-driven; the containment chain is a property test over
  random small graphs (`fast-check` is a new devDependency → SUPPLY-CHAIN.md rung before
  adding; if refused, a seeded generator in the test).
- **Mutation testing** on this module before the phase closes (`stryker`, dev-only; commit
  the green state before every round — global rule). Survivors triaged in the Review Log.

### Phase 2 — the transport

`src/pds-walker/transport/fetch.ts`: DID resolution (`plc.directory` for `did:plc`,
`/.well-known/did.json` for `did:web`), `com.atproto.sync.getLatestCommit`,
`com.atproto.repo.listRecords` paged over `app.bsky.graph.follow` (cursor-chained, 100 per
page), a per-host limiter that reads `RateLimit-Remaining` and caps in-flight requests per
host (the limit is per PDS host per IP), and the failure rule: any non-2xx, network error,
or malformed body → `{ unknown: reason }`, never `[]`.

- Fixtures are HARVESTED: the probe responses recorded on 2026-09-08 (DID doc, a
  `listRecords` page with cursor, a final page without, `getLatestCommit`, a 502 body, the
  OpenDNS-intercept 403 HTML) go under `tests/fixtures/pds/` with the URL they came from.
- Unit tests run against an injected `fetch`. One `e2e:live` journey hits a real PDS for a
  known public account and asserts shape, not values (values move).

### Phase 3 — the store

`Store` interface; `memoryStore()` for tests and Node; `indexedDbStore(name)` for the
browser. Unit tests cover the memory store fully; the IndexedDB store is proven in
Playwright (a real browser, in the default gate, hermetic — no PDS involved), because
faking IndexedDB in Node tests what the fake does.

### Phase 4 — the walker

`createWalker` wires core + transport + store + clock: `walk()` resolves and lists ring 1
(parallel across followees, capped per host), computes `me`/`mut`/`fol` from it, then fills
`hop` in the background at `ring2Parallel`, emitting `progress`; `refresh()` asks
`latestRev` for every ring-1 repo and re-lists only the movers, then re-walks only those
followees' ring-2 subtrees; `hosts()` reports every unknown host with its `since`;
`stop()` cancels background work. Tests drive a fake transport with scripted revs and
failures and assert: unknown-is-not-empty, refresh touches only movers, `asOf` is the
oldest source, containment after every event.

### Phase 5 — the reference page (D1)

`rings.html` + `src/pages/rings.ts`: a handle field (no sign-in — every call is public),
then the three default rings with counts and "as of", ring 2 drawing as it fills, and a
hosts panel listing what is unknown. Imports `createWalker` from **`croft-pwa/pds-walker`**
(the export path; esbuild resolves the self-reference through `exports`). Gated like every
page: a11y (axe, hermetic), mobile-first (44 px, no overflow), a hermetic e2e that routes
PDS calls to the Phase 2 fixtures, and a `mock-baseline` capture per MOCKS.md if the page
gets a mock. A user-guide chapter describes what the page shows and what "as of" means.

### Phase 6 — first consumer: forage (shaped here, executed under a forage plan)

- `package.json`: `"croft-pwa": "github:CroftCommunity/croft-pwa#<sha>"` (rule 1).
- `npm run vendor:sync` copies `node_modules/croft-pwa/lib/pds-walker/index.js` to
  `js/vendor/pds-walker.js`; `test/vendor.test.js` gains a case asserting the served copy is
  byte-equal to the installed one (never hand-edited).
- One call site: `ringGraph()`'s follows come from the walker; mutuals from the walker once
  ring 2 has filled, with the AppView answer kept until then (D3).
- Check 47c will NOTE forage whenever its pin is behind croft-pwa main — that is the
  reminder, by design.

### Phase 7 — optional, later: Jetstream for ring 1

When signed in and following ≤ 10,000 accounts, a Jetstream socket
(`wantedCollections=app.bsky.graph.follow`, `wantedDids=<ring 1>`) replaces the ring-1
poll. Not before the walker has a measured poll cost to compare against.

## Deployment

- **The library:** a landed commit on `main` is the artifact; consumers pin its sha. No
  tag namespace until a consumer outside the workspace exists (VERSIONING.md would then
  ask for `pds-walker-vX.Y.Z` as a multi-artifact scheme) — recorded in D3.
- **The page:** croft-pwa's existing `deploy` job (needs the gate, `main` only, Pages).
- **The record:** `CHANGELOG.md` entry per landing under the current month; consumers'
  changelogs record each pin bump ("pds-walker pinned to <sha>: …").
- **Verification of the deploy:** the `e2e:live` journey against the deployed page, once,
  after the first landing; and `.claude/DEPLOYED.md` does not track Pages sites, so the
  page's own footer version stamp (`build.mjs` computeVersion) is the deployed-version
  register for this artifact.

## Decisions

| id | question | options | recommendation | status |
|---|---|---|---|---|
| D1 | Does the library get a reference page on the site? | (a) yes, `rings.html`, public handle input; (b) library only, consumers prove it | (a) — every croft-pwa standard is a page, and the page is the deploy | **open** |
| D2 | How does forage, which has no bundler, consume the package? | (a) pin + `vendor:sync` copy from `node_modules` + byte-equality test; (b) give forage a build step | (a) — rule 1 and rule 3 together, forage ships as it does today | **open** |
| D3 | Versioning of the library | (a) sha pins only, no tags, until an external consumer; (b) `pds-walker-vX.Y.Z` tags from the first landing | (a) — a tag nobody consumes is a clock nobody winds | **open** |

Settled upstream, not re-opened here: TypeScript not wasm; croft-pwa as home; default
rings; re-list on rev change; outer ring draws as it fills (research doc § 7).

## Review Log

- 2026-09-08 — drafted from the research doc and SHARED-CODE.md; D1–D3 put to the owner.
