# Plan: content-fetch reference — the Croft Bridge extension + an atmosphere reader

date: 2026-07-29
identity: chasemp (`chase@owasp.org`, `github-personal`), repo `CroftCommunity/croft-pwa`
status: **Pass 1 + Pass 2 complete.** Phase 0 (Discovery) present; BLOCKING questions must
resolve before Phase 1.

## Problem Statement

croft-pwa now documents a "Content fetch" standard (Standards chapter, shipped): a backendless
Croft PWA reaches cross-origin content the same-origin policy blocks by using a **browser
extension** that grants the read, not a bundled/user-run proxy. The mechanism is proven in the
discovery spike (`discovery/alpha/experiments/extension-content-fetch/`, mechanism 3/3, edges 6/6,
@live GREEN). What does not yet exist is a **reference implementation**: a real, loadable,
shippable-quality Chrome extension plus a live feature in the meta-site that **dogfoods** it, so
the standard is demonstrated the way every other croft-pwa standard is (self-demonstrating).

Goal: build (1) the **Croft Bridge** reference extension (Chrome MV3) and (2) an **atmosphere
reader** page in croft-pwa that uses it to aggregate real, CORS-blocked RSS/Atom feeds about the
Bluesky/atproto ecosystem — with graceful states when the extension is absent or a source is not
yet approved.

Constraints:
- **Chrome/Chromium only now.** Firefox and Safari parity go to the TODO (ROADMAP_TODO E72 already
  parks Firefox). Do not build cross-browser abstractions speculatively.
- **The one gate stays green.** croft-pwa's `npm test` (lint·typecheck·unit·build·e2e) runs in CI
  on ubuntu. Extension e2e must not destabilize that gate — mirror the existing `e2e:live` pattern
  (a separate Playwright config, not in the default gate) until CI-headless-extension is verified.
- **No new runtime deps.** croft-pwa is vanilla TS + esbuild, zero runtime deps. RSS parsing uses
  the built-in `DOMParser`. The extension is plain JS, no build step of its own.
- **Reference, not necessarily published.** "Reference version" = a complete, load-unpacked,
  shippable-quality extension in the repo + docs. Chrome Web Store publication is a separate
  decision (Open Question / TODO), not in this plan's scope.

## Reasoning

**Why an extension and not a proxy** — settled in the prior session and the Content-fetch chapter:
a local proxy forces the HTTPS page to fetch `http://localhost` (mixed content + Private Network
Access preflights); the extension model sidesteps that surface entirely because the page never
makes the cross-origin/insecure request — the extension service worker does. This plan implements
that decided model; it does not re-litigate it.

**Why dogfood with a reader of ecosystem feeds** — croft-pwa is self-demonstrating: every standard
is a rule the repo keeps by passing its own checks, and the interactive `atproto.html` page already
demonstrates the AppView read path. The reader completes the picture: **AppView reads records
(CORS-free); the extension reads the open web (CORS-blocked).** Feeds *about* the Bluesky/atproto
ecosystem are the honest use case precisely because they are ordinary websites (company blogs,
newsletters) that the AppView cannot serve and that do not send permissive CORS — so the extension
is genuinely required, and the demo is not hollow.

**Why the reader renders text-only** — feed items carry arbitrary HTML. Rendering it as `innerHTML`
is an XSS surface, and croft-pwa's CSP is strict (no inline). The reference renders title, source,
date, and a plain-text excerpt as `textContent`, with links validated to http/https and opened
`rel="noopener noreferrer"`. This keeps the page CSP unchanged (the page makes no cross-origin
fetch — the extension does — so no `connect-src` widening is needed either; a second elegance of the
extension model worth demonstrating).

**Why per-host consent via `optional_host_permissions`** (pending Phase 0 verification) — the spike
used a static in-extension allowlist as a stand-in. A shippable reference should use the strongest
consent available: the extension requests the browser-level host permission for a reader origin only
when the user approves it (a user-gesture-triggered `chrome.permissions.request`), and the
background checks `chrome.permissions.contains` before fetching. That makes "consent, not a blanket
bridge" a browser-enforced property, not just JS discipline — the right thing for a reference to
model. Broad `host_permissions: ["*://*/*"]` is rejected: it is the pattern that draws (justified)
Web Store scrutiny and is exactly the over-broad grant the consent model exists to avoid.

**Alternatives considered and rejected:**
- **Broad host permissions + JS allowlist only** — rejected: over-broad grant, weaker than
  browser-enforced per-host consent, worse Web Store posture.
- **`externally_connectable` (page talks to the extension by its published ID)** — deferred, not
  rejected: cleaner for a published extension but needs a stable extension ID (a pinned manifest
  `key` or the Web-Store-assigned ID). The content-script `postMessage` bridge (spike pattern) needs
  no ID and works load-unpacked, so it is the reference default; `externally_connectable` is a noted
  future option once/if the extension is published (Phase 0 D3 confirms the choice).
- **A hosted proxy / Cloudflare Worker** — rejected upstream (infra + trust; the thing to avoid).
- **Rendering feed HTML with a sanitizer library** — rejected: adds a runtime dep and XSS risk for
  marginal gain; text-only rendering is safe, dependency-free, and sufficient for a reader.

## Verified Assumptions

Confirmed firsthand this session (spike + reading croft-pwa):
- The extension mechanism works **headless** via Playwright `channel: 'chromium'` with
  `--load-extension`; MV3 background service worker registers; content-script `postMessage` bridge
  relays fetches. (Spike `run-spike.mjs`/`run-edges.mjs`, GREEN.)
- A page's cross-origin `fetch` of a no-CORS origin fails with `TypeError`; the extension SW fetch
  with the host permission succeeds — including **@live** against a real remote host
  (`news.ycombinator.com/rss`, 200, real bytes). (Spike `run-live.mjs`, GREEN.)
- croft-pwa page/chapter wiring: `build.mjs` `PAGES` array maps `html`/`entry`/`jsToken`/`sriToken`;
  each page has an HTML shell with `%…_JS%`/`%CSP%`/`%STYLES%` placeholders; `src/nav.ts` `TABS`
  lists Standards `active` basenames; `src/pages/reference.ts` `CHAPTERS` is the index; metrics are
  declared in `src/measure/registry.ts` (`MetricName = keyof typeof META`; undeclared = compile
  error); `measure.record('page_…')` is called per page. (Read directly.)
- The gate is `npm test` = lint·typecheck·unit·build·e2e; e2e enumerates pages in
  `tests/e2e/a11y.spec.ts`, `csp.spec.ts`, `mobile-fit.spec.ts`, `standards.spec.ts`; a11y runs axe
  on every page × both themes; `build.mjs` fails a page >20K gz or styles.css >12K gz. (Read.)
- CI: `.github/workflows/ci.yml` — ubuntu-latest, node 22, `npx playwright install --with-deps
  chromium`, then `npm test`. A separate `e2e:live` config exists and is NOT in the gate (precedent
  for a separate extension-e2e config). (Read.)
- No existing `extension/` or `ext/` dir in croft-pwa. (Confirmed.)
- **ESLint flat config** (`eslint.config.js`) applies rules only to `src/**/*.ts`, `tests/**/*.ts`,
  `*.config.ts` (type-checked) and `eslint.config.js`/`build.mjs`/`tools/**/*.mjs` (plain). It
  ignores `dist`/`node_modules`/`test-results`/`playwright-report`/`.claude`. **`extension/*.js`
  matches no block** → currently un-linted, and adding `js.configs.recommended` naively would flag
  `chrome`/service-worker globals as `no-undef`. A dedicated `extension/**/*.js` block with
  webextension + serviceworker globals is required (Phase 3). (Read.)
- **`tsconfig.json` include = `["src","tests","playwright.config.ts","playwright.live.config.ts",
  "vitest.config.ts"]`** — `extension/` is excluded, so `tsc --noEmit` will not choke on the
  extension's plain JS. (Read.)
- `a11y.spec.ts`, `csp.spec.ts`, `mobile-fit.spec.ts` each carry their **own inline** page list (no
  shared page-list module) — three edits in Phase 8. `standards.spec.ts` derives `INDEX_CHAPTERS =
  [...GUIDE_CHAPTERS, atproto]`; the reader is an **interactive page like atproto**, so it joins
  `INDEX_CHAPTERS` (and its count assertion), NOT `GUIDE_CHAPTERS`. (Read.)

Verified in Phase 0 (D1 executed 2026-07-29 — egress via `curl`, headers inspected):
- **Seed feeds (all Atmosphere/Bluesky, all confirmed 200 + no `Access-Control-Allow-Origin` → CORS-
  blocked → the extension is genuinely required):**
  - `https://atproto.com/rss.xml` — "AT Protocol Blog", `application/rss+xml`. Also
    `https://atproto.com/feed.xml` (Atom) — the site advertises both via `<link rel=alternate>`.
    **This single source gives both RSS 2.0 and Atom for the parser (D4 fixtures).**
  - `https://docs.bsky.app/blog/rss.xml` — Bluesky docs blog, RSS 2.0, `application/xml`.
  - `https://bsky.app/profile/<handle>/rss` — **Atmosphere-native, every public account.** Resolves
    the handle to a DID (302→200) and returns RSS 2.0, `application/xml`, no ACAO. Verified with
    `bsky.app` (official) and `jay.bsky.team`. The reader can let the user add any handle.
  Non-qualifiers seen: `bsky.social/about/blog/rss.xml` sends `ACAO: *` (would not need the
  extension); several guessed paths 404'd. Recorded so we don't re-probe.

Verified in Phase 0 (D2 executed 2026-07-29 — throwaway MV3 probe + Playwright):
- **MV3 per-host consent — the interactive grant is NOT automatable.** With `optional_host_permissions`
  and a user-gesture click calling `chrome.permissions.request({origins:['http://localhost/*']})`, the
  callback **never fires headless** (a native permission prompt Playwright can't reach; the same
  native UI can't be clicked headful either). BUT: the **consent gate's refusal path works and is
  automatable** — before any grant, `permissions.contains` is `false` and the background SW `fetch` of
  the host is blocked (`TypeError`). And grant→fetch-allowed is already proven by the spike (a granted
  host permission fetches through). **Design implication (does not threaten the model):** keep
  `optional_host_permissions` + `permissions.request` as the real consent UX (real users click the
  prompt in real Chrome); test the refusal path automatically, test the allowed branch via a
  test-only manifest that pre-declares the host in `host_permissions`, and verify the real grant flow
  **manually** in Phase 4 validation. (Probe: scratchpad, throwaway — deleted.)

NOT yet verified — see Phase 0 / Open Questions:
- `DOMParser` extraction of RSS 2.0 **and** Atom fields — low risk; fixtures now in hand
  (atproto.com RSS + Atom), probe folds into Phase 1.
- Whether extension e2e (persistent context, `channel: 'chromium'`, new-headless) runs green in the
  ubuntu CI, or must stay a local-only job (D5).

## Documentation Impact

- `README.md` — add the extension to the repo contents; a short "load the Croft Bridge extension
  (unpacked)" section. Phase 8.
- `docs/CONTENT-FETCH.md` (**new**) — long-form rationale for the Content-fetch standard + how the
  reference extension and reader implement it (the shipped Standards chapter is the short form; this
  is the docs/ long form, matching `ATPROTO.md`/`PRACTICES.md`). Phase 8. (Grepped: `docs/` has
  ATPROTO/DESIGN/PRACTICES/PREVIEWS/SECURITY/TELEMETRY — no CONTENT-FETCH yet.)
- `src/pages/reference.ts` — add a "Reader (content fetch)" card linking `reader.html`. Phase 8.
- `src/pages/standards-content.ts` — the Content-fetch chapter gains one line pointing at the live
  reader demo (the chapter exists; add the demo pointer). Phase 8.
- `AGENTS.md` / `CLAUDE.md` (croft-pwa) — grep for a page/standard registry that enumerates pages;
  if the reader must be listed, update. Phase 8. (Phase 0 D-item confirms whether these enumerate
  pages.)
- The discovery-side `ROADMAP_TODO.md` E72 and the scratchpad walkthrough are **discovery-repo**
  artifacts, updated separately (not in this croft-pwa plan) once the reference lands.

## Concurrency Map

```
Sequential spine:
  Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8

Parallel candidate {Phase 1 || Phase 2} (surfaced, user decides; default sequential):
- Disjoint write-sets: Phase 1 writes src/reader/feed-parse.ts + tests/unit/feed-parse.test.ts +
  tests/fixtures/feeds/*; Phase 2 writes playwright.ext.config.ts + tests/ext/helpers.ts +
  package.json. No overlap.
- Shared-state contract: both run in the same working tree with no git/branch/port/daemon
  mutation; each only creates its own files. package.json edit (Phase 2) is a script addition,
  untouched by Phase 1.
- Re-entry verification: `git status` shows only the expected new files per phase; `npm run
  typecheck` clean after merge; no port bound by either.
```

Everything else is sequential: each extension phase edits the prior's files (manifest, options),
the reader composes the parser + bridge, and integration/enumeration edits depend on the reader
page existing. Parallelism beyond {1||2} is not worth the coordination for a single-developer build;
default sequential.

## Phases

### Phase 0: Discovery
**Goal:** Resolve the unknowns that could invalidate later phases before committing to them.
**Discovery tasks:**
- [x] **D1 (RESOLVED 2026-07-29): Which real feeds are live, RSS/Atom, and genuinely CORS-blocked?**
  Found: `atproto.com/rss.xml` (+`/feed.xml` Atom), `docs.bsky.app/blog/rss.xml`,
  `bsky.app/profile/<handle>/rss` — all 200, no ACAO. Evidence + non-qualifiers in Verified
  Assumptions. atproto.com's dual RSS/Atom become the parser fixtures.
  - **Probe:** For 6–8 candidate ecosystem sources (Bluesky company blog, `atproto.com`/`bsky.social`
    news, notable atproto ecosystem blogs/newsletters), fetch the feed URL and record: HTTP status,
    content-type, whether an `Access-Control-Allow-Origin` header is present. Use the spike's
    `run-live.mjs` (extension read) plus a plain `curl -sI` for the ACAO header. A feed qualifies
    only if it is reachable, parseable as RSS/Atom, and lacks ACAO (so the extension is genuinely
    required).
  - **Success criteria:** A shortlist of **3–5 qualifying feed URLs**, each with recorded
    status/content-type/ACAO-absent evidence, plus one captured sample response per feed.
  - **Disposition:** `keep-as-fixture` — the captured samples become `tests/fixtures/feeds/*.xml`;
    the URL list becomes the reader's default source set. Do NOT hardcode any feed URL before this.
- [x] **D2 (RESOLVED 2026-07-29): Does MV3 per-host runtime consent work as designed?** Finding: the
  interactive `permissions.request` grant is NOT automatable (native prompt); the refusal path IS
  automatable and works; grant→allowed is spike-proven. Phase 4 adjusted accordingly (below). Details
  in Verified Assumptions.
  - **Probe:** A throwaway minimal extension with `optional_host_permissions` for one host and a
    button that calls `chrome.permissions.request({origins:['https://host/*']})`; confirm (a) the
    request requires/consumes a user gesture, (b) after grant, the background SW `fetch` of that host
    succeeds, (c) before grant / after `chrome.permissions.remove`, the SW fetch is blocked, (d)
    `chrome.permissions.contains` reports state correctly.
  - **Success criteria:** Observed grant→fetch-allowed, no-grant→fetch-blocked, and the gesture
    requirement, firsthand.
  - **Disposition:** `throwaway` — findings inform Phase 4's design; the probe extension is deleted.
- [ ] **D3: Page↔extension channel for the reference — content-script bridge vs `externally_connectable`.**
  - **Probe:** Confirm the content-script `postMessage` bridge (spike pattern) works for an
    unpacked extension with a page origin matching the reader; decide whether the reference ships
    that (no stable ID needed) or `externally_connectable` (needs a pinned `key`). Read Chrome docs
    on `externally_connectable` + manifest `key` to record the trade-off.
  - **Success criteria:** A recorded decision with rationale. Default expectation: content-script
    bridge for the reference; `externally_connectable` noted as a post-publication option.
  - **Disposition:** `throwaway` — decision recorded in Reasoning/Verified Assumptions.
- [ ] **D4: `DOMParser` on RSS 2.0 and Atom.**
  - **Probe:** Parse one captured RSS 2.0 and one Atom sample with `DOMParser('text/xml')`; confirm
    extraction of title, link, published-date, and description/summary for both dialects, and how
    parse errors surface (`<parsererror>`).
  - **Success criteria:** A confirmed field-extraction mapping for both dialects + the error signal.
  - **Disposition:** `keep-as-fixture` — the samples are reused as parser test fixtures.
- [ ] **D5: Can extension e2e run in CI, or is it local-only?**
  - **Probe:** Read `.github/workflows/ci.yml` (done: installs chromium). Determine whether
    `channel: 'chromium'` new-headless extension loading is available after `npx playwright install
    --with-deps chromium` on ubuntu. If uncertain, plan the extension-e2e as a separate `e2e:ext`
    job/script excluded from the `npm test` gate (mirroring `e2e:live`), and note a follow-up to try
    folding it into CI.
  - **Success criteria:** A decision: extension-e2e in the gate, or a separate job. Default: separate
    `e2e:ext`, not in `npm test`, until proven in CI.
  - **Disposition:** `throwaway` — decision recorded; config built in Phase 2.
**Done when:** D1 yields 3–5 verified feeds with fixtures; D2 and D4 are confirmed firsthand; D3 and
D5 have recorded decisions. Verified Assumptions updated; any invalidated later phase adjusted with a
Review Log entry before execution proceeds.
**Validation:** Discovery Exemption applies (no TDD on probes). Evidence recorded in this doc.

### Phase 1: Feed parser (pure)
**Goal:** A pure, tested function turning feed XML into a typed item list, dialect-agnostic.
**Changes:**
- [ ] **Test env (deviation, see Review Log):** vitest is `node` with no `DOMParser`. Add **`jsdom`
  as a devDependency** (dev/test only — never in the runtime bundle, so "no new runtime deps" holds)
  and mark the parser test `// @vitest-environment jsdom`. Verified jsdom parses both RSS and the
  namespaced Atom fixture via `getElementsByTagName`.
- [ ] `src/reader/feed-parse.ts` — `parseFeed(xml: string): FeedResult` using `DOMParser`; supports
  RSS 2.0 + Atom; returns `{ source, items: {title, link, published, excerpt}[] }` or a typed parse
  error; links validated to http/https; excerpt is plain text (strip tags via `textContent`).
- [ ] `tests/unit/feed-parse.test.ts` — table-driven: RSS + Atom fixtures → expected items; malformed
  XML → typed error; a feed item with embedded HTML → excerpt is plain text (no tags); a
  `javascript:` link → dropped/neutralised.
- [ ] `tests/fixtures/feeds/*.xml` — the D1/D4 captured samples (RSS + Atom).
**Call chain:** (library-level this phase) `src/pages/reader.ts` (Phase 6) → `parseFeed()`. Named
here; wired in Phase 6.
**Wiring test:** Deferred to Phase 6 (parser is a pure lib consumed by the page). Phase 1's own gate
is the unit suite.
**Depends on:** Phase 0 (D1 feeds, D4 mapping).
**Read-set:** `tests/fixtures/feeds/*` (own fixtures).
**Write-set:** `src/reader/feed-parse.ts`, `tests/unit/feed-parse.test.ts`, `tests/fixtures/feeds/`.
**Shared-state contract:** No shared mutable state beyond the file write-set.
**Risks:** Atom vs RSS field differences; timezone/date parsing. Keep dates as raw strings +
best-effort `Date` parse, never throw on a bad date.
**Done when:**
1. Behavioral: `parseFeed()` turns a real captured RSS and Atom sample into the correct item list,
   and neutralises embedded HTML and dangerous link schemes.
2. Verification: `npx vitest run tests/unit/feed-parse.test.ts`.
**Validation:** Narrow — wiring (Phase 6) + unit tests sufficient. Include a property/edge case for
malformed XML and hostile content.

### Phase 2: Extension e2e harness
**Goal:** The ability to load a Chrome MV3 extension in Playwright and drive a page against local
origins, as a **separate** config outside the default gate.
**Changes:**
- [ ] `playwright.ext.config.ts` — a project using `channel: 'chromium'`, persistent context with
  `--load-extension`, `testDir: tests/ext`.
- [ ] `tests/ext/helpers.ts` — start local origin servers (PWA origin + a no-CORS reader origin),
  launch the persistent context with a given extension path, teardown. (Ports the spike's proven
  harness into the repo.) **Also serves a minimal static test page** (`tests/ext/fixtures/page/`) so
  Phases 3–4 have a page for the content script to inject into *before* `reader.html` exists (Phase
  6). Phase 7 swaps in the real `dist/reader.html`.
- [ ] `package.json` — add `"e2e:ext": "playwright test --config playwright.ext.config.ts"`.
**Call chain:** `npm run e2e:ext` → playwright.ext.config → tests/ext/*.spec.ts (Phases 3/4/7).
**Wiring test:** `tests/ext/harness.ext.spec.ts` — loads a minimal inline test extension, asserts the
MV3 service worker registers. RED before the config exists, GREEN after.
**Depends on:** Phase 0 (D5 decision).
**Read-set:** none beyond own files.
**Write-set:** `playwright.ext.config.ts`, `tests/ext/helpers.ts`, `tests/ext/harness.ext.spec.ts`,
`package.json`.
**Shared-state contract:** Binds two loopback ports during the test only (helpers pick free/fixed
ports and release them on teardown); no git/daemon mutation. Not in the `npm test` gate, so it does
not affect CI unless separately invoked.
**Risks:** Port collisions with a stale server (the spike's `:4173` gotcha) — helpers must pick and
release ports and not rely on `reuseExistingServer`.
**Done when:**
1. Behavioral: `npm run e2e:ext` loads an extension and confirms its SW registered.
2. Verification: `npm run e2e:ext` (harness spec green).
**Validation:** Moderate — run `e2e:ext` locally; confirm it does NOT run under `npm test`.
**SHIPPED (2026-07-29), then REVISED in Phase 3 — see below.** Initial Phase 2 built a Playwright
*test-runner* harness (`playwright.ext.config.ts` + `tests/ext/helpers.ts` `extensionTest()` fixture +
`*.ext.spec.ts`). It passed for a no-content-script extension but proved **intermittently unreliable for
the real content-script extension** in Phase 3 (see Phase 3 note). Pivoted to a **node runner** — the
reliable channel. `startOrigins` (origin A test page + origin B no-ACAO reader, ephemeral ports),
`fixtures/min-ext/`, `fixtures/page/` all carried over.

### Phase 3: Croft Bridge extension — core bridge
**Goal:** The reference MV3 extension can fetch an allowed origin the page cannot, load-unpacked.
**Changes:**
- [ ] `extension/manifest.json` — MV3; name "Croft Bridge"; background SW; content script matched to
  the reader page origin(s); minimal permissions (host permissions come in Phase 4 via
  `optional_host_permissions`). For the hermetic test, the local reader origin is allowed.
- [ ] `extension/background.js` — `croft-fetch` message handler; fetch + return `{ok,status,body}`;
  refuse non-approved origins with `{ok:false, refused:true}` (Phase 4 makes approval dynamic).
- [ ] `extension/content.js` — the page↔background `postMessage` bridge + a ready-ping (spike
  pattern, hardened: origin checks on messages).
- [ ] `eslint.config.js` (edit) — add an `extension/**/*.js` block (`js.configs.recommended` +
  `globals.browser`/`globals.serviceworker`/webextension `chrome` global) so the extension is linted
  and `chrome`/SW globals don't trip `no-undef`. Without this the gate either skips linting the
  extension or fails on undefined globals. (Confirm `globals` exports a webextensions set; else
  declare `chrome: 'readonly'`.)
- [ ] `content_scripts.matches` covers **both** the production reader origin
  (`https://croftcommunity.github.io/croft-pwa/*`) **and** the local test origin the harness serves
  (e.g. `http://localhost:*/*`) so the same unpacked extension works live and in e2e. Record the
  exact production origin/subpath at build time; revisit if a custom domain is adopted.
**Call chain:** reader page → `content.js` (postMessage) → `background.js` (fetch) → back to page.
**Wiring test:** `tests/ext/bridge.ext.spec.ts` — page's direct fetch of the local no-CORS origin
fails; via the loaded extension it succeeds (the spike's core assertion, now against the repo
extension).
**Depends on:** Phase 2 (harness), Phase 0 (D3 channel decision).
**Read-set:** `tests/ext/helpers.ts`.
**Write-set:** `extension/manifest.json`, `extension/background.js`, `extension/content.js`,
`eslint.config.js` (additive block), `tests/ext/bridge.ext.spec.ts`. **(5 files — exceeds the 4-file
rule; the 3 extension files are one cohesive artifact and the eslint edit is a small additive block.
If executed strictly, split the eslint block into a tiny pre-step. Flagged in Review Log.)**
**Shared-state contract:** No shared mutable state beyond the write-set; test uses the Phase-2 harness
ports. `eslint.config.js` edit is additive (new block) and does not change existing scopes.
**Risks:** Content-script match patterns; message-origin validation (only accept messages from the
page's own window). Harden against arbitrary senders.
**Done when:**
1. Behavioral: with the extension loaded, a page receives content from a no-CORS origin it cannot
   fetch directly.
2. Verification: `npm run e2e:ext` (bridge spec green).
**Validation:** Moderate — hermetic e2e + manual load-unpacked smoke in a real Chrome.
**SHIPPED GREEN (2026-07-29):** `extension/manifest.json` + `background.js` (host-approval gate:
static `APPROVED_HOSTS` set mirroring static `host_permissions`; Phase 4 swaps to runtime
`chrome.permissions`, gate shape unchanged) + `content.js` (page↔bg `postMessage` bridge, hardened:
same-window only, responses posted to the page origin not `*`). `content_scripts` match the production
origin (`https://croftcommunity.github.io/croft-pwa/*`) + local (`http://localhost/*`); host_permissions
cover localhost + the three D1 feed origins. eslint gained an `extension/**/*.js` block (browser +
serviceworker + webextensions globals). **RED observed** (no `extension/` dir → page probes never
attach). **Test-runner pivot (important):** the Phase-2 Playwright *test-runner* harness intermittently
**wedged the content-script extension's page context ~20–30s** through all retries in this environment;
warmup/globalSetup/profile-isolation/commit-navigation/bounded-timeouts all failed. A node driver of the
identical scenario is **100% reliable** (proved 8/8, then the tier 5/5 on 3 cold runs) — the same channel
the discovery spike and `@live` use. So the tier is now a **node runner**: `tests/ext/harness.mjs`
(startOrigins, launchExtension, check/summarise) + `tests/ext/run-ext.mjs` (scenarios), `e2e:ext` =
`node tests/ext/run-ext.mjs`. Removed: `playwright.ext.config.ts`, `helpers.ts`, `*.ext.spec.ts`,
`global-setup.ts`, `page-globals.d.ts` (+ tsconfig include entry). Gate isolation intact: `npm test`
still **94 unit + 88 e2e**; lint + typecheck clean. `tests/ext/README.md` records the rationale.

### Phase 4: Croft Bridge extension — per-host consent
**Goal:** The extension fetches only user-approved origins, enforced at the browser-permission level.
**Changes:**
- [ ] `extension/manifest.json` (edit) — add `optional_host_permissions` (and an options page ref).
- [ ] `extension/options.html` — list the reader's candidate source origins with approve/revoke.
- [ ] `extension/options.js` — `chrome.permissions.request/remove({origins})` on a user gesture;
  reflect state via `chrome.permissions.contains`; background checks `contains` before fetching.
**Call chain:** options page toggle → `chrome.permissions.request` → background `contains` gate →
fetch allowed/blocked.
**Wiring test:** `tests/ext/consent.ext.spec.ts` — **adjusted per D2 (the live grant prompt is not
automatable):** (a) automated — with no grant, `permissions.contains` is false and the background
refuses the fetch (`refused:true`), not a CORS error; (b) automated — the **allowed branch** is
exercised with a test-only manifest variant (`extension/manifest.test.json`) that pre-declares the
reader host in `host_permissions`, proving the `contains`-gate lets a granted host through; (c)
**manual** (Phase 4 validation) — the real options-page `permissions.request` grant flow in real
Chrome, since the native prompt can't be driven by Playwright.
**Depends on:** Phase 3, Phase 0 (D2 verified — grant prompt not automatable).
**Read-set:** `tests/ext/helpers.ts`, `extension/background.js`.
**Write-set:** `extension/manifest.json`, `extension/options.html`, `extension/options.js`,
`extension/manifest.test.json` (test-only pre-granted variant, per D2), `tests/ext/consent.ext.spec.ts`.
**(5 files — cohesive consent unit; the test manifest is a small fixture. Flagged.)**
**Shared-state contract:** Test grants/removes a permission inside its own persistent-context profile
(disposable, per-test); no persistence outside the temp profile.
**Risks:** `permissions.request` gesture requirement in a test context — the spec must trigger it via
a real click; if headless blocks the prompt, fall back to seeding the grant in the profile and
testing the `contains` gate (record which, per D2). Surface if D2 shows the prompt can't be driven
headless.
**Done when:**
1. Behavioral: approving a source in the options page lets the extension read it; un-approved sources
   are refused by the extension itself.
2. Verification: `npm run e2e:ext` (consent spec green).
**Validation:** Moderate — e2e + manual: open the options page in real Chrome, approve a host, watch
the reader start working.
**SHIPPED GREEN (2026-07-29):** background gate is now `chrome.permissions.contains({origins:[origin+'/*']})`
— a **real browser permission**, not a JS list. `manifest.json`: feed origins moved to
`optional_host_permissions` (granted at runtime), `http://localhost/*` kept as a static `host_permission`
(dev/e2e), `options_page` added. `options.html` + `options.js` = the per-source consent surface
(`permissions.request`/`remove`, state via `contains`). **Probe first** (no assumed behavior): confirmed
`contains` for a specific-port origin matches a port-agnostic `http://localhost/*` grant (`has:true`), and
`127.0.0.1`/`atproto.com`/`evil.com` are `has:false`. **RED→GREEN:** the consent scenario ("an ungranted
feed origin is refused") FAILED against the old static-`APPROVED_HOSTS` code (it approved atproto.com),
PASSED after the switch. Consent e2e (hermetic): ungranted feed origin refused (no network call),
permitted localhost passes the same gate, non-permitted `127.0.0.1` (same server, other host) refused.
**Not automatable (D2), so manual:** the real `permissions.request` grant prompt — validated by opening
the options page in real Chrome. `manifest.test.json` deemed unnecessary (localhost-static covers the
permitted branch). Tier **8/8 on 3 cold runs**; default gate still 94 unit + 88 e2e; lint + typecheck clean.

### Phase 5: Reader bridge client (PWA side)
**Goal:** A typed PWA-side client that detects the extension, requests a fetch, and reports state.
**Changes:**
- [ ] `src/reader/bridge.ts` — `detectBridge(): Promise<boolean>` (ready-ping + timeout);
  `fetchVia(url): Promise<BridgeResult>` where `BridgeResult` distinguishes ok / not-installed /
  not-approved / network-error / timeout. Pure message-protocol logic, DOM-injectable for tests.
- [ ] `tests/unit/bridge.test.ts` — protocol unit tests with a fake `window`/message channel:
  request/response correlation by id, timeout → not-installed, refusal → not-approved.
**Call chain:** `src/pages/reader.ts` (Phase 6) → `detectBridge()` / `fetchVia()` → content-script.
**Wiring test:** Deferred to Phase 7 (needs the real extension + page). Phase 5's gate is the unit
suite over the message protocol.
**Depends on:** Phase 3 (message shape must match `content.js`).
**Read-set:** none beyond own files.
**Write-set:** `src/reader/bridge.ts`, `tests/unit/bridge.test.ts`.
**Shared-state contract:** No shared mutable state beyond the write-set.
**Risks:** Message-shape drift between `bridge.ts` and `content.js` — a shared constant/comment names
the protocol in both; Phase 7's e2e is the real cross-check.
**Done when:**
1. Behavioral: `fetchVia` resolves to the correct discriminated state for ok/refused/absent/timeout.
2. Verification: `npx vitest run tests/unit/bridge.test.ts`.
**Validation:** Narrow — unit sufficient; Phase 7 provides the live cross-check.

### Phase 6: Reader page + build/metric registration
**Goal:** A `reader.html` page that composes bridge + parser + render, registered so it builds.
**Changes:**
- [ ] `reader.html` — page shell (copy of the chapter shell pattern; `%READER_JS%`/`%CSP%`; strict
  CSP unchanged — the page makes no cross-origin fetch).
- [ ] `src/pages/reader.ts` — compose `detectBridge`/`fetchVia` (Phase 5) + `parseFeed` (Phase 1) +
  a text-only renderer for items; the default source list from Phase 0 D1; graceful states:
  not-installed → install CTA; source not-approved → "approve in the Croft Bridge extension" CTA;
  loading/empty/error.
- [ ] `build.mjs` (edit) — add `reader.html`/`src/pages/reader.ts`/`%READER_JS%` to `PAGES`.
- [ ] `src/measure/registry.ts` (edit) — declare `page_reader` (type page, disclosure, expires).
**Call chain:** `reader.html` → `src/pages/reader.ts` → `detectBridge`/`fetchVia`/`parseFeed` →
text-only DOM render.
**Wiring test:** Phase 7 (the extension-loaded e2e). Phase 6's gate: `npm run build` includes
`reader.html`, `npm test` stays green (a11y/csp not yet enumerating reader — added Phase 8; page
builds and renders its no-extension state).
**Depends on:** Phases 1, 5.
**Read-set:** `src/reader/feed-parse.ts`, `src/reader/bridge.ts`, existing page shell for reference.
**Write-set:** `reader.html`, `src/pages/reader.ts`, `build.mjs`, `src/measure/registry.ts`.
**Shared-state contract:** `build.mjs` and `registry.ts` are shared with the wider build; edits are
additive (a PAGES entry, a metric key) and do not alter other pages. No parallel phase touches these.
**Risks:** Bundle budget (page must stay <20K gz — text-only render + small logic is well within);
`page_reader` must be declared before `reader.ts` compiles (same edit-set, ordered within the phase).
**Done when:**
1. Behavioral: `reader.html` builds and, opened without the extension, shows the install CTA (no
   crash, no cross-origin fetch from the page).
2. Verification: `npm run build` (reader in the manifest) + `npx playwright test tests/e2e/... `
   smoke of the no-extension state (add a minimal case or reuse a11y once Phase 8 enumerates it).
**Validation:** Moderate — build + open the page locally in the no-extension state.

### Phase 7: Reader ↔ extension end-to-end (the dogfood)
**Goal:** The reader, with the Croft Bridge extension, renders real (fixture) feed items; degrades
gracefully without it.
**Changes:**
- [ ] `tests/ext/reader.ext.spec.ts` — load the extension + serve local fixture feeds; assert the
  reader renders items (text-only, correct titles/links); assert the not-installed state (context
  without the extension → install CTA); assert not-approved state if a source is not granted.
- [ ] `src/pages/reader.ts` (edit, if needed) — finalise graceful-state transitions surfaced by the
  e2e.
**Call chain:** full path: reader page → bridge → extension SW → fixture feed → parser → render.
**Wiring test:** This phase *is* the wiring test for the whole feature — the end-to-end reader e2e.
**Depends on:** Phases 3, 4, 5, 6.
**Read-set:** `tests/ext/helpers.ts`, `extension/*`, `src/pages/reader.ts`, `src/reader/*`.
**Write-set:** `tests/ext/reader.ext.spec.ts`, `src/pages/reader.ts`.
**Shared-state contract:** Uses the Phase-2 harness (local ports, disposable profile). No shared
mutation beyond that.
**Risks:** Flaky first-launch SW timing (the spike's cold-launch caveat) — allow a warm retry; keep
`e2e:ext` out of the CI gate until D5/CI is confirmed.
**Done when:**
1. Behavioral: with the extension + an approved source, the reader shows fixture feed items; without
   the extension it shows the install CTA.
2. Verification: `npm run e2e:ext` (reader spec green).
**Validation:** Broad — e2e + manual: load the extension in real Chrome, approve a real D1 feed, see
live items render.

### Phase 8: Site integration, enumerations, and docs
**Goal:** The reader is a first-class, discoverable page held to every site-wide check; docs land.
**Changes (grouped; mechanical single-line enumeration edits + docs):**
- [ ] `src/nav.ts` — add `reader.html` to the Standards tab `active` list (or a top-level slot — see
  Open Question).
- [ ] `src/pages/reference.ts` + `src/pages/standards-content.ts` — a "Reader (content fetch)" index
  card + a demo pointer in the Content-fetch chapter.
- [ ] `tests/e2e/a11y.spec.ts`, `tests/e2e/csp.spec.ts`, `tests/e2e/mobile-fit.spec.ts` — add
  `/reader.html` to each **separate inline** PAGES list (axe both themes, no CSP violations,
  320/360/390 fit). These default-gate specs run **without** the extension, so they exercise the
  reader's install-CTA state — that state must be accessible (labelled focusable CTA). The
  loaded-items state's a11y is checked in the Phase 7 `e2e:ext` reader spec (run axe there too).
- [ ] `tests/e2e/standards.spec.ts` — the reader is an interactive page like atproto → add it to
  `INDEX_CHAPTERS` (and the index count assertion), **not** `GUIDE_CHAPTERS`.
- [ ] `README.md` + `docs/CONTENT-FETCH.md` (new) — load-unpacked instructions + long-form rationale.
**Call chain:** nav/index → `reader.html`; enumerations exercise the page in the gate.
**Wiring test:** `tests/e2e/standards.spec.ts` (if the reader is a Standards entry) or a smoke case
asserting the page is reachable from the index; a11y/csp/mobile-fit now cover `reader.html`.
**Depends on:** Phase 6 (page exists), Phase 7 (behaviour proven).
**Read-set:** `src/nav.ts`, `src/pages/reference.ts`, `src/pages/standards-content.ts`, the e2e page
lists, `README.md`, `docs/`.
**Write-set:** `src/nav.ts`, `src/pages/reference.ts`, `src/pages/standards-content.ts`,
`tests/e2e/a11y.spec.ts`, `tests/e2e/csp.spec.ts`, `tests/e2e/mobile-fit.spec.ts`,
`tests/e2e/standards.spec.ts`, `README.md`, `docs/CONTENT-FETCH.md`. **(9 files — far exceeds the
4-file rule; all edits are mechanical enumeration one-liners + two doc files, low stubbing risk.
Recommended split at execution: 8a = nav/index/chapter-link + the four e2e enumerations; 8b = README
+ docs/CONTENT-FETCH.md. See Open Question.)**
**Shared-state contract:** Additive enumeration edits; no behavioural change to other pages.
**Risks:** a11y on the reader's dynamic states (loading/empty/error must be accessible — labels,
roles); the CTA must be a real focusable control. Bundle budget re-checked.
**Done when:**
1. Behavioral: the reader is linked from the site, passes axe on both themes, has no CSP violations,
   fits mobile widths; README/docs explain loading the extension.
2. Verification: `npm test` (full gate green, reader enumerated) + `npm run e2e:ext`.
**Validation:** Broad — full gate + manual walk of the linked page and the docs' load steps.

## Open Questions

- [CONFIRMED: BLOCKING] **Which real feeds seed the reader?** D1 must yield 3–5 live, RSS/Atom,
  CORS-blocked feeds. **Decision (user 2026-07-29): find Atmosphere / Bluesky / atproto-related
  feeds specifically.** Executing D1 now; findings recorded in Verified Assumptions + Phase 0.
- [CONFIRMED: BLOCKING] **Does MV3 per-host runtime consent work headless (D2)?** **Decision (user):
  treat as an experiment** — run the D2 probe; if `permissions.request` can't be driven headless,
  Phase 4 uses the seed-grant fallback (recorded from the probe).
- [CONFIRMED: FEATURE + STANDARD (Phase 8a)] **Is the reader a Standards entry or a top-level page?**
  **Decision (user): both.** The reader is a first-class *feature* (its own reachable page — a
  nav slot or a prominent Home entry) **and** a *standard* (Standards index card + a live-demo
  pointer in the Content-fetch chapter). Nav placement detail (new "Reader" tab vs Home CTA — mind
  the mobile 5-tab bar) decided in Phase 8a; both surfaces are in scope.
- [CONFIRMED: SPLIT (Phase 8 → 8a + 8b)] **Split Phase 8?** **Decision (user): yes.** 8a =
  nav/index/chapter-link + the four e2e enumerations (`a11y`/`csp`/`mobile-fit`/`standards`); 8b =
  README + `docs/CONTENT-FETCH.md`. Keeps each under the 4-file rule.
- [CONFIRMED: ADVISORY — deferred] **Chrome Web Store publication?** **Decision (user): not now.**
  Reference = load-unpacked + docs. Tracked as a follow-up TODO, not built.
- [CONFIRMED: ADVISORY — planned] **`e2e:ext` in the CI gate eventually?** **Decision (user): yes,
  once D5 proves it green on ubuntu CI.** Ship it as a separate `e2e:ext` first; fold into the `npm
  test`/CI gate after D5 confirms headless-extension works in CI (a Phase 8a follow-up step).

## Review Log

### Pass 1 — 2026-07-29
Initial plan. Grounded in the shipped Content-fetch chapter, the discovery spike, and a read of
croft-pwa's build/nav/reference/registry/test wiring and CI. Phase 0 included (feeds, MV3 consent,
channel choice, DOMParser, CI-e2e are all unverified). Sequential spine with one surfaced parallel
candidate {Phase 1 || Phase 2}. Six open questions recorded (2 BLOCKING).

### Pass 2: Gap Analysis — 2026-07-29
**Found:**
- **Gate integrity (highest):** `extension/*.js` matches no ESLint block → un-linted, and a naive
  `js.configs.recommended` add would fail on `chrome`/service-worker globals. `tsconfig` excludes
  `extension/` so typecheck is safe. → Phase 3 now adds a scoped `extension/**/*.js` eslint block.
- **Wiring gap:** Phases 3–4 e2e need a page for the content script *before* `reader.html` exists
  (Phase 6). → Phase 2 helpers now serve a minimal test page fixture (`tests/ext/fixtures/page/`).
- **Extension reach:** `content_scripts.matches` must cover the production croft-pwa origin
  (`https://croftcommunity.github.io/croft-pwa/*`) **and** the local test origin. → added to Phase 3.
- **Test enumeration facts:** confirmed three *separate* inline page lists (a11y/csp/mobile-fit) and
  that the reader belongs in `standards.spec` `INDEX_CHAPTERS` (interactive, like atproto), not
  `GUIDE_CHAPTERS`. → Phase 8 sharpened; `standards.spec.ts` added to its write-set.
- **a11y coverage nuance:** default-gate specs run without the extension → they cover the reader's
  install-CTA state only; the loaded-items state's a11y must be checked in the Phase 7 `e2e:ext`
  spec. → noted in Phases 7/8.
**Concurrency:**
- No changes — map confirmed. {Phase 1 || Phase 2} write-sets remain disjoint after the Phase-2
  helpers gained a fixture page (still under `tests/ext/`, no overlap with Phase 1's `src/reader/`).
**Changed:**
- Verified Assumptions extended (eslint scoping, tsconfig exclusion, three page lists, reader→INDEX).
- Phase 2 (+minimal test page), Phase 3 (+eslint block, +content_scripts prod/local matches; write-set
  now 5 files — flagged), Phase 8 (+standards.spec, a11y-state nuance; write-set now 9 files — split
  recommended, tracked as an Open Question).
**Confirmed:**
- The extension-model core (spike-proven), the page/chapter/build/metric wiring pattern, the CI shape,
  and the strict-CSP-unchanged claim (page makes no cross-origin fetch) all hold under review.
- No new BLOCKING questions surfaced; the two Pass-1 BLOCKINGs (feeds D1, MV3 consent D2) stand.

### Open-question resolution + Phase 0 D1 — 2026-07-29
**Decisions (user):** feeds = Atmosphere/Bluesky-specific (D1 executed); MV3 consent = experiment
(D2); reader = **both a feature and a standard**; **split Phase 8 → 8a (wiring) + 8b (docs)**; Web
Store = not now; `e2e:ext` → fold into CI once D5 proves it. Open Questions section updated to
`[CONFIRMED]`.
**D1 executed + RESOLVED:** three verified CORS-blocked Atmosphere feeds (atproto.com RSS+Atom,
docs.bsky.app blog RSS, bsky.app profile RSS). BLOCKING #1 cleared. Verified Assumptions updated.
**Still Phase 0:** D2 (consent experiment) is the next probe; D4 folds into Phase 1 (fixtures in
hand); D5 decided (separate `e2e:ext`, CI-fold after proof).

### Phase 0 D2 — 2026-07-29
**D2 executed + RESOLVED (BLOCKING #2 cleared).** Throwaway MV3 probe + Playwright. Finding: the
interactive `chrome.permissions.request` host grant is **not automatable** (native prompt; callback
never fires headless, unreachable headful). The **refusal path works and is automatable** (no grant
→ `contains:false` → SW fetch blocked). Grant→allowed is spike-proven.
**Changed:** Verified Assumptions record the finding; Phase 0 D2 marked resolved; **Phase 4 adjusted**
— consent e2e now tests (a) automated refusal, (b) automated allowed-branch via a test-only
`extension/manifest.test.json` that pre-declares the host, (c) manual real-grant validation in Chrome.
Phase 4 write-set +1 (manifest.test.json).
**Status:** Both BLOCKING questions (D1 feeds, D2 consent) now resolved. The plan is execution-ready
from Phase 1; D4 folds into Phase 1, D5 is decided.

### Phase 1 execution — 2026-07-29
**Deviation (user-approved):** vitest's environment is `node` (no `DOMParser`; no jsdom/happy-dom
installed). Added **`jsdom` as a devDependency** and set the parser test to `// @vitest-environment
jsdom`. Consistent with "no new *runtime* deps" — jsdom never enters the shipped bundle. Verified
firsthand that jsdom's `DOMParser` + `getElementsByTagName` parse both the RSS and the namespaced
Atom fixtures (`parsererror` false, 45 entries, title/link extracted). `npm audit` flags jsdom's
transitive dev deps only; not addressed (dev-only, no runtime exposure).
**Phase 1 SHIPPED GREEN (2026-07-29):** `src/reader/feed-parse.ts` (`parseFeed` → typed `FeedResult`,
RSS 2.0 + Atom via local-name matching, http(s)-only links, script/style-and-tag-stripped plain-text
excerpts, never throws) + `tests/unit/feed-parse.test.ts` (5 cases incl. malformed→error, escaped-HTML
and CDATA-script excerpt stripping, `javascript:` link dropped) + trimmed real fixtures
`tests/fixtures/feeds/sample-{rss,atom}.xml`. Gate: parser 5/5, full unit suite **94/94**, lint +
typecheck clean. Fixture loading uses `path.join` not `new URL(template)` (Vite globs the latter and
fails). Not yet wired to a page — wiring test is Phase 6/7. Vitest via `rtk proxy` (the RTK hook
mangles bare `npx`).
