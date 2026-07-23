# CLAUDE.md — notes for agents working in this repo

croft-pwa is a **meta-site about building Croft SPA/PWAs**, and it is itself a
Croft PWA — built to the standards it documents. The repo is two things at once:
the **standards** (the chapters of the site) and a **reference implementation**
that proves them. If a standard cannot be demonstrated by this repo's own code
passing the gate, the standard is wrong.

Vanilla TypeScript + esbuild, one static HTML shell per destination, no
framework, no router, zero runtime dependencies. Static `dist/` deployed to
GitHub Pages.

## The gate

One command runs the full check, the same way CI does:

```
npm run test          # lint · typecheck · unit (vitest) · build · e2e (playwright)
```

Sub-parts: `npm run lint`, `npm run typecheck`, `npm run unit`, `npm run build`,
`npm run e2e`. There is no `@live` tier yet (it arrives with the atproto module
in Phase 3, gated behind `npm run e2e:live`).

**Local e2e gotcha — stale reused server.** Playwright starts its own static
server on port 4173 and, locally (`reuseExistingServer` is true off-CI), will
**reuse** one that is already running. If a server from a previous run is still
bound to 4173 while serving an older `dist/`, the page's Subresource Integrity
hash won't match the stale bundle, the module script is silently blocked, and
the smoke specs fail while csp/mobile-fit still pass (the tell-tale shape). It
is not a code defect. Fix: `lsof -ti :4173 | xargs kill -9` before re-running.
CI is immune (it never reuses a server).

## Conventions

- **TDD first, always.** Write the test before the implementation — unit
  (vitest) for pure logic (`sw-nav`, `theme` resolution, brand tokens), hermetic
  e2e (playwright, against the built bundle) for page wiring — and confirm it is
  RED before making it green. A behaviour change starts by rewriting the test
  that pins the old behaviour. No production code lands without a failing test
  that demanded it. No category is exempt — tokens and config included.
- **Hex lives only in `tokens.css`.** Components (`styles.css`) and app code
  reference semantic tokens via `var()`, never a literal colour. Enforced by
  `tests/unit/brand-nohex.test.ts`. New colours are added to `tokens.css` with a
  recorded WCAG ratio (asserted by `tests/unit/brand-tokens.test.ts`), never
  invented inline. See `docs/DESIGN.md`.
- **Relative paths, always.** No absolute-root paths (`/assets/…`, `/sw.js`,
  `/x.html`) — every asset ref, nav href, the manifest, and the SW registration
  are relative, so the same build runs at a domain root or under a subpath (a
  GitHub project page, and the `/pr-preview/pr-N/` preview workflow). The build
  throws on an absolute-root asset path, and `tests/e2e/subpath.spec.ts` serves
  the site under a subpath to prove it. Match the active tab by page basename,
  not by absolute pathname.
- **Pages, not modals.** Navigation is real links between real documents (native
  back button). No client router, no focus-trapping overlays — inline reveals
  and transient toasts only.
- **Mobile-first, tap-first.** `tests/e2e/mobile-fit.spec.ts` guards horizontal
  overflow at 320/360/390px — run it after any layout change. Touch targets ≥40px.
- **Fail loud, degrade soft in the right places.** A programming error throws
  (a missing `#app` is a bug). A denied cosmetic capability (storage in private
  mode) degrades to a default rather than bricking the page.
- **Build-time CSP + SRI.** The build injects a `default-src 'none'` meta CSP
  (the inline pre-paint theme script is admitted by its sha256, never
  `unsafe-inline`) and Subresource Integrity on the stylesheet and every module
  script. `tests/e2e/csp.spec.ts` asserts zero violations and no cross-origin
  script. See `docs/SECURITY.md`.
- **The console is the debugger of a backendless app** (`src/log.ts`): leveled
  `[croft]` logs, debug/info gated behind `?debug=1` or `localStorage`
  `croft-debug`, warn/error always emit.
- **Plans and RUN summaries.** Non-trivial work gets a dated plan in `plans/`
  (Problem / Approach / Reasoning, locked decisions, RED→GREEN order, explicit
  "not in this run"). Each run records a `RUN-*-SUMMARY.md` at the repo root with
  red→green evidence, the gate output, and a files-touched ledger.

## Structure

- `build.mjs` — the whole build: esbuild bundle + content hash, tokens+styles
  concat, CSP+SRI injection, generated version-stamped service worker.
- `tokens.css` / `styles.css` — brand tokens (only place with hex) / components.
- `*.html` — one shell per destination; the page's entry bundle is `src/pages/<name>.ts`.
- `src/nav.ts` `theme.ts` `log.ts` `version.ts` — shared shell chrome and cores.
- `src/sw.ts` + `src/sw-nav.ts` — service worker; the routing decision is a pure,
  unit-tested function separate from the worker shell.
- `tools/serve.mjs` — the zero-dep static server the e2e gate drives.
- `docs/` — DESIGN (brand), SECURITY (CSP/SRI/threat posture), PRACTICES.
- `plans/` — dated phase plans. `RUN-*-SUMMARY.md` — per-run evidence.

## Roadmap (phases)

P0 chassis + gate (done) · P1 user-guide generator + guide-shots tool ·
P2 standards content pages (chassis/brand/pwa/agent-method) · P3 atproto/PDA
module (OAuth/DPoP/lexicons/sealed-box) + `@live` tier · P4 telemetry posture
chapter. Each phase leaves the gate green.

Git identity here is chasemp (`chase@owasp.org`, `github-personal`). Do not
commit or push unless asked.
