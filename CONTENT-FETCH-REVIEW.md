# Content fetch — build review & discussion

date: 2026-07-29 · status: Phases 0–8b complete, on `main` (`48ace72`). A review artifact for
discussion — not a standard. The standard is the site's *Content fetch* chapter; the long-form is
[`docs/CONTENT-FETCH.md`](./docs/CONTENT-FETCH.md); the plan is
[`plans/2026-07-29-1-plan-content-fetch-reference.md`](./plans/2026-07-29-1-plan-content-fetch-reference.md).

This walks through **what we built, how it works, and why each load-bearing choice was made** — with
real demonstrations you can reproduce.

---

## 1. What this solves, in one paragraph

A Croft PWA is backendless: a static site with no server of its own. That is the point — nothing to run
or trust operationally — but it means the browser will not let the page read most of the open web (the
same-origin policy blocks cross-origin responses without CORS headers, and most sites, including RSS
feeds, send none). We wanted the reference PWA to be able to *read the atmosphere* — feeds and pages about
Bluesky/atproto — anyway. The answer: a small companion **browser extension** grants the read, per source,
on the user's approval. The page asks; the extension reads.

## 2. The shape of the build

Ten commits, TDD throughout, each a working checkpoint:

```
e12dc75 Phase 1: RSS/Atom feed parser (pure, TDD)
e4bc75b Phase 2: extension e2e harness (separate e2e:ext tier)
11ecf05 Phase 3: Croft Bridge extension + node-driven e2e tier (supersedes Phase 2 runner)
a7c20f1 Phase 4: per-host consent via chrome.permissions (browser-enforced, not a list)
4f093ba Phase 5: reader bridge client (pure protocol, TDD)
4bd098d Phase 6: atmosphere reader page (composes bridge + parser, text-only render)
a227ca6 Phase 7: reader <-> extension end-to-end dogfood (hermetic)
548c2ac Phase 8a: integrate the reader into the site (feature + standard)
48ace72 Phase 8b: docs — README extension section + docs/CONTENT-FETCH.md
```

The artifacts:

```
extension/                      the Croft Bridge extension (MV3, Chrome)
  manifest.json                 optional_host_permissions per source; localhost static (dev)
  background.js                 the fetch, gated by chrome.permissions.contains
  content.js                    page <-> background bridge (hardened)
  options.html / options.js     the per-source consent surface
src/reader/
  feed-parse.ts                 RSS 2.0 + Atom -> items (pure, safe by construction)
  bridge.ts                     detectBridge / fetchVia / windowTransport (pure protocol)
src/pages/reader.ts + reader.html   the Atmosphere reader (composes the above)
tests/ext/                      the node-driven e2e tier (harness.mjs + run-ext.mjs + fixtures)
docs/CONTENT-FETCH.md           long-form rationale
```

## 3. How it works

```
┌──────────────────────────────┐   ✗ page.fetch(B)   ┌──────────────────────────┐
│  Reader page (origin A, HTTPS)│ ── CORS-blocked ──► │  source (origin B)        │
│  1. postMessage(request) ─────┼─► content.js         │  no ACAO header (typical) │
│  4. ◄── postMessage(bytes) ───┼─  (isolated world)  │                          │
└───────────────────────────────┘        │            └──────────────────────────┘
                                          │ 2. chrome.runtime.sendMessage
                                          ▼
                          ┌──────────────────────────────┐  3. fetch(B) — only if
                          │ background service worker     │     chrome.permissions.contains
                          │  holds B's host permission    │     says B is approved
                          └──────────────────────────────┘
```

Two **separate trust domains**. The page can *ask*; only the extension can *read*, and only a source the
user approved. The reader parses the returned feed and renders it as **plain text** (titles, links, dates,
excerpts) — never source HTML — so the page's strict CSP is unchanged and it never executes foreign markup.

## 4. Demonstrations (reproducible)

### 4a. The mechanism, the consent gate, and the dogfood — all green

`npm run e2e:ext` (a node-driven tier that loads the real extension in real Chromium):

```
PASS  harness: extension loads and its service worker registers  — ipboakpmnkfpidpohobbjfjglpgabiel
PASS  harness: serves the test page  — marker=croft-ext-test-page
PASS  harness: test page exposes the probes
PASS  bridge: direct page fetch of a no-CORS origin is blocked  — TypeError: Failed to fetch
PASS  bridge: the extension delivers the cross-origin content  — status 200
PASS  consent: an ungranted feed origin is refused by the permission gate  — origin not approved: https://atproto.com
PASS  consent: a permitted origin passes the same gate  — status 200
PASS  consent: a non-permitted host is refused  — origin not approved: http://127.0.0.1:50704
PASS  reader: renders a feed item fetched via the extension  — reader-dogfood-item…
PASS  reader: shows the install CTA without the extension
GREEN — extension e2e: 10/10 checks
```

Read the lines as a story: the page's own fetch is **blocked** (line 4), the extension **delivers** the
same content (line 5), an **ungranted** source is **refused before any network call** (line 6), a
**permitted** source passes the same gate (line 7), and the real reader page **renders an item via the
extension** (line 9) yet **degrades to an install prompt without it** (line 10).

### 4b. The default gate is untouched

The extension tier is deliberately separate. `npm test` (lint · typecheck · unit · build · e2e) stays:

```
Tests  101 passed (101)      # vitest unit (incl. feed-parse 5, bridge 7)
88→94 passed                 # playwright e2e (reader added to a11y/csp/mobile-fit/standards)
```

### 4c. It's a real page, within budget

```
sizes(gz): … content-fetch 5.5K · reader 5.4K …   (budget 20K/page)
built v0 0.1.0+48ace72 -> dist/  (12 pages, sw + precache 28, CSP+SRI on, budget ok)
```

### 4d. Try it by hand

```
chrome://extensions → Developer mode → Load unpacked → this repo's extension/
→ open the Reader tab → approve a source in the extension's options → reload
```

## 5. What works, how, and why — the load-bearing decisions

**Extension, not a local proxy — and the reason is browser policy, not taste.** A proxy forces the HTTPS
page to `fetch('http://localhost')`: mixed content + Private Network Access preflights. The extension
model sidesteps that surface entirely — the page makes no cross-origin/insecure request; the service
worker does, returning content in-process. We proved the secure-context half (an HTTPS page reads an HTTP
source via the extension) and the public→public half (a live read of real HN/atproto RSS) in the discovery
spike. So the extension is a *smaller browser-policy surface*, not just a nicer install story.

**Consent is a real permission, not a JS allowlist.** The background gates every fetch on
`chrome.permissions.contains`. Feed origins are `optional_host_permissions` granted at runtime from the
options page; nothing is readable until the user approves it, and approval is enforced by the browser, not
by our code. Any page that matches the content-script glob can only *ask* — the extension is the gate.
This is why the "ungranted → refused" and "non-permitted host → refused" checks pass without touching the
network.

**The page renders text, never markup.** Feed items carry arbitrary HTML; rendering it would be an XSS
surface and would fight the strict CSP. `feed-parse.ts` strips markup and validates links to http(s), and
`reader.ts` sets `textContent`. A second benefit falls out: the page makes no cross-origin fetch, so no
`connect-src` widening — the CSP is identical to every other page.

**Pure cores, thin edges.** The two hardest bits — feed parsing and the message protocol — are pure
functions (`feed-parse.ts`, `bridge.ts`), unit-tested with fakes (12 tests), no browser. The DOM/extension
wiring is verified by the e2e tier. This is why the unit suite is fast and the risky parts are the
best-covered.

## 6. Two decisions made mid-build worth surfacing

**The Playwright test-runner could not reliably drive the MV3 extension here.** Phase 2 built a Playwright
*test-runner* harness; in Phase 3 it began intermittently wedging the content-script extension's page
context for 20–30s, and survived every fix (warmup, per-test profiles, commit-navigation, bounded timeouts,
retries). A plain **node** driver of the identical scenario was 100% reliable. So `e2e:ext` is node-driven
(`tests/ext/run-ext.mjs`) — the same channel the discovery spike and the `@live` tier already use. The
rationale is recorded in [`tests/ext/README.md`](./tests/ext/README.md). *Discussion point: this is a
sandbox/runner quirk, not the extension; worth re-checking on a real CI runner (D5) before folding into the
gate.*

**The native permission prompt cannot be automated.** `chrome.permissions.request` shows native browser UI
Playwright cannot click (verified in Phase 0). So the e2e proves the **refusal** branch and a
**permitted** branch (via a static localhost grant), and the real **grant** flow is a documented manual
check. *Discussion point: acceptable for a reference; a published extension would want a manual QA note or
a Chrome-for-Testing automation path.*

## 7. Open items for discussion

- **Publish the extension?** Currently load-unpacked only (deferred by decision). A Web Store listing needs
  a dev account, a privacy policy, and review — and would let the reader work without developer mode.
- **CI for `e2e:ext`.** Gated on confirming headless-extension reliability on the ubuntu runner (D5). Until
  then it's a local tier, out of `npm test`.
- **Firefox/Safari.** Parked (Chromium-first). Firefox MV3 + `web-ext` is the likely path.
- **Source management UX.** Today: two default feeds + `?src=` and the extension's options page. A real
  "add/remove sources" UI in the reader (persisted) is a natural next feature.
- **The `localhost` static host permission.** Kept for dev/e2e. Harmless, but a published build might drop
  it so the extension's permissions are *only* the approved feeds.
- **Scope of content.** We deliberately read ecosystem *websites* (the AppView already serves atproto
  *records* CORS-free). Worth confirming that framing is the one we want the reader to embody.

## 8. Where to look

| Concern | File |
|---|---|
| Why an extension, full rationale | `docs/CONTENT-FETCH.md` |
| The plan + every decision + the mid-build pivots | `plans/2026-07-29-1-plan-content-fetch-reference.md` |
| The extension | `extension/` |
| Parser / protocol (pure, unit-tested) | `src/reader/feed-parse.ts`, `src/reader/bridge.ts` |
| The reader page | `src/pages/reader.ts` |
| e2e tier + why node | `tests/ext/` (`README.md`, `run-ext.mjs`, `harness.mjs`) |
| The standard, as a live chapter | the *Content fetch* + *Reader* tabs on the site |
