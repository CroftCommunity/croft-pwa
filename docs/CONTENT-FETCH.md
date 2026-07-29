# Content fetch — how a backendless PWA reaches the open web

This is the long-form rationale behind the *Content fetch* standard (the site's
chapter is the short form) and the reference that implements it: the **Croft
Bridge** extension (`extension/`) and the **Atmosphere reader** (`src/pages/reader.ts`).

## The problem

A Croft PWA is backendless by design — a static site, no server of its own. That
is the whole value: nothing to run, pay for, or trust operationally. But it draws
a hard line: **the browser will not let a static page read most of the open web.**
When the page calls `fetch()` on an RSS feed, a public API, or a page to reader-ify,
the same-origin policy blocks reading the response unless the far server sends
`Access-Control-Allow-Origin` — and most of the web does not. A static site cannot,
by itself, be a reader of arbitrary content. This is a browser property, not a bug.

For atproto/Bluesky *records* this does not arise — the AppView is CORS-friendly, so
the atproto page reads records directly. Content fetch is for **everything beyond
that**: ordinary websites (blogs, newsletters, feeds) that the AppView cannot serve
and that do not opt into CORS.

## The decision: an extension grants the read, not a proxy

Two shapes were considered:

- **A local proxy** the user runs (`npx …`) on `localhost`, which the page fetches.
  Rejected — see below.
- **A browser extension** (chosen) that holds the permission to fetch the source and
  relays the bytes to the page. The page never makes the cross-origin request itself.

The user-friendly workflow is **install an extension**, not **run a shell command**.

### Why not a proxy — the mixed-content / PNA argument

A local proxy forces an HTTPS page to `fetch('http://localhost:PORT')` — the exact
request browsers scrutinise: **mixed content** (HTTPS page → HTTP resource) and
**Private Network Access** (a public page reaching localhost, now gated by
preflights). The extension model **sidesteps that surface entirely**: the page makes
no cross-origin or insecure request; the extension's service worker does, and hands
content back in-process via `postMessage`. So being a secure context never gates the
read, and a real public→public read does not trigger PNA at all. Preferring the
extension is not only nicer UX — it is a **smaller browser-policy surface**, which is
why it ages better. (Both halves are demonstrated in the experiment below.)

Other rejected options: a hosted proxy / Cloudflare Worker (adds infrastructure and
trust — the thing to avoid); a Tauri/packaged webview (removes CORS but is no longer
a PWA).

## How it works

```
┌──────────────────────────────┐   ✗ page.fetch(B)   ┌──────────────────────────┐
│  Croft PWA  (origin A, HTTPS) │ ── CORS-blocked ──► │  source (origin B)        │
│  1. page.postMessage(req) ────┼─► content script    │  no ACAO header (typical) │
│  4. ◄── postMessage(bytes) ───┼─  (isolated world)  │                          │
└───────────────────────────────┘        │            └──────────────────────────┘
                                          │ 2. chrome.runtime.sendMessage
                                          ▼
                          ┌──────────────────────────────┐  3. fetch(B) — allowed only if
                          │ extension background (SW)     │     chrome.permissions.contains
                          │  per-source host permission   │     holds the source's permission
                          └──────────────────────────────┘
```

The page and the extension are **separate trust domains**. The page can *ask*; only
the extension can *read*, and only a source the user has approved.

- `extension/content.js` — the page↔background bridge (same-window messages only;
  responses posted back scoped to the page origin, never `*`). Answers a `__croftPing`
  so the page can detect presence without racing the initial announce.
- `extension/background.js` — the fetch, gated by `chrome.permissions.contains`.
- `extension/options.html` + `options.js` — the per-source consent surface.
- `src/reader/bridge.ts` — the page-side client: `detectBridge`, `fetchVia` (a
  discriminated `BridgeResult`), and `windowTransport`. Pure protocol, unit-tested.
- `src/reader/feed-parse.ts` — RSS/Atom → items, dialect-agnostic, safe by
  construction (http(s)-only links; plain-text excerpts, markup stripped).
- `src/pages/reader.ts` — composes the above; renders items as **text only** (no
  source HTML), so the strict page CSP is unchanged and no `connect-src` widening is
  needed. `?src=<feed>` adds a source (still permission-gated).

## Consent, not a blanket bridge

Approval is a **real browser permission**, not a JS list. Feed origins are declared
`optional_host_permissions` and granted at runtime from the options page
(`chrome.permissions.request`); the background checks `chrome.permissions.contains`
before every fetch. Any page matching the content-script glob can only *ask* — the
extension is the gate, and it refuses (distinguishably from a network error) any
origin the user has not approved. The reader degrades to an install / approve prompt
rather than failing when the extension is absent or a source is unapproved.

## What is proven, and what is deferred

Validated in `discovery/alpha/experiments/extension-content-fetch/` and, in this
repo, by `npm run e2e:ext` (a node-driven tier — see `tests/ext/README.md` for why
node and not the Playwright test-runner):

- A page blocked by CORS receives the content through the extension.
- The secure-context **mixed-content sidestep** holds (an HTTPS page reads an HTTP
  source via the extension).
- The **consent gate** refuses an unapproved origin and permits an approved one.
- **Presence detection** works; the reader shows the install CTA without the extension.
- A live run read a real remote RSS feed the page could not.

Deferred / manual:

- The native `chrome.permissions.request` **grant prompt** cannot be driven headless,
  so the real grant flow is validated manually in Chrome (the refusal and
  permitted branches are automated).
- **Firefox/Safari** parity is parked — Chromium first.
- **Chrome Web Store publication** is out of scope; the reference is load-unpacked.
- Folding `e2e:ext` into CI waits on confirming headless-extension reliability on the
  CI runner.
