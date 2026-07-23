# RUN P0 — chassis + gate

Scope: stand up the croft-pwa repo — the atproto-agnostic PWA chassis, the brand
token system, the service worker, two page shells (home + settings), the full
test gate, CI, and the standards docs. Branch: (uncommitted local scaffold).
Plan: `plans/2026-07-23-1-plan-croft-pwa.md`.

## What shipped

- **Build** (`build.mjs`): esbuild bundle per page entry with content-hashed
  names; `tokens.css`+`styles.css` concatenated; build-time `default-src 'none'`
  CSP (inline theme script admitted by sha256) + `sha384` SRI on the stylesheet
  and every module script; a version-stamped service worker generated from
  `src/sw.ts` with a per-build precache manifest.
- **Brand** (`tokens.css`, `styles.css`): PWA-UI-tuned tectonic palette, light +
  dark, hex confined to `tokens.css`, every text/UI pair clearing WCAG AA with
  the ratio recorded inline.
- **Chassis** (`src/`): `nav` (shared shell: topbar, tabs, build stamp), `theme`
  (pure resolver + no-flash pre-paint + toggle), `log` (leveled, flag-gated),
  `version`, `sw` + pure `sw-nav` routing decision, `sw-register`.
- **Pages**: `index.html` (the meta-site front door) and `settings.html` (theme
  control + build stamp), each with its `src/pages/*.ts` entry.
- **Docs**: `CLAUDE.md`, `AGENTS.md`, `llms.txt`, `README.md`, and
  `docs/DESIGN.md` / `docs/SECURITY.md` / `docs/PRACTICES.md`.
- **CI**: `.github/workflows/ci.yml` runs the gate and deploys `dist/` to Pages
  on main.

## Evidence — the gate is green

```
lint       ESLint: No issues found
typecheck  tsc --noEmit (0 errors)
unit       Test Files 4 passed (4) · Tests 26 passed (26)
build      built v0 0.1.0+nogit -> dist/  (2 pages, sw + precache 8, CSP+SRI on)
e2e        11 passed (2.3s)   [smoke ×3, mobile-fit ×6, csp ×2]
```

Tests written before/with their implementation and confirmed RED first: the
`sw-nav` routing table, `theme` resolver, brand-token WCAG ratios (both themes),
the no-hex guard, plus hermetic e2e (shell render, real-link navigation, theme
toggle, 320/360/390 overflow, CSP-zero-violations + no cross-origin script).

## Verify-in-run ledger (filed, not hidden)

- **Screenshot/a11y pass not yet done in real Chrome** (light+dark, mobile) — P0
  was built headless via the gate; a visual pass is owed before P2 ships pages.
- **Service worker not exercised under the SW-enabled Playwright project** — the
  hermetic specs block SWs by default; a dedicated SW spec (offline serve,
  update flow) is owed, likely in P1/P2.
- **CI unrun** — the workflow is written but has not executed (repo uncommitted);
  the local gate mirrors it. First push will validate the Pages deploy path.
- **`git` SHA is the `nogit` sentinel** in the build stamp because the repo is
  not yet a git repo; the real stamp appears on first commit.
- **PNG icon set / apple-touch splash** deferred — P0 ships a single maskable
  SVG icon; the brand asset pipeline is a later pass.

## Scoped out (with reason)

User-guide generator (P1), content chapters as live pages (P2), atproto/PDA
module + `@live` tier (P3), telemetry (P4), production domain/CNAME. No commit or
push — awaiting go-ahead.

## Files touched

All new (greenfield): `package.json`, `tsconfig.json`, `eslint.config.js`,
`vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `build.mjs`,
`tokens.css`, `styles.css`, `manifest.webmanifest`, `index.html`,
`settings.html`, `icons/icon.svg`, `tools/serve.mjs`,
`src/{version,log,theme,sw-nav,sw,sw-register,nav}.ts`,
`src/pages/{index,settings}.ts`,
`tests/unit/{sw-nav,theme,brand-nohex,brand-tokens}.test.ts`,
`tests/e2e/{smoke,mobile-fit,csp}.spec.ts`, `.github/workflows/ci.yml`,
`CLAUDE.md`, `AGENTS.md`, `llms.txt`, `README.md`,
`docs/{DESIGN,SECURITY,PRACTICES}.md`, `LICENSE`,
`plans/2026-07-23-1-plan-croft-pwa.md`, `RUN-P0-SUMMARY.md`.
