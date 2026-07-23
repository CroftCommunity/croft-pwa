# RUN P1 — user-guide generator

Scope: extract arecipe's data-driven user-guide pattern into a reusable
generator, add a screenshot-regeneration tool, and author the site's own "How to
build a Croft PWA" guide with it. Branch: main (continues P0). Plan:
`plans/2026-07-23-1-plan-croft-pwa.md`.

## What shipped

- **Pure guide data** (`src/pages/guide-content.ts`): `GuideEntry[]` where each
  entry is an ordered list of typed `GuideBlock`s (`prose` · `steps` · `note` ·
  `shot`). Node-testable, no DOM. Six entries covering the shape, the gate, the
  chassis, brand, the working method, and starting your own.
- **Browser renderer** (`src/pages/user-guide-view.ts`): pure DOM builder that
  turns entries into an intro + a table of contents + one section per entry.
- **Page** (`user-guide.html` + `src/pages/user-guide.ts`): a new destination in
  the shell; added to nav as the "Guide" tab.
- **Regeneration tool** (`tools/guide-shots.mjs`, `npm run guide:shots`): serves
  the built `dist/`, drives real Chrome, and writes `assets/guide/<name>.jpg`
  (light + dark home). Rerun after any visual change so the guide never shows a
  stale UI.
- **Guide styles** appended to `styles.css` (TOC chips, steps, note rule, fluid
  captioned screenshots) — token-only, no hex.

## Evidence — the gate is green

```
lint       ESLint: No issues found
typecheck  tsc --noEmit (0 errors)
unit       Test Files 5 passed (5) · Tests 30 passed (30)   (+4 guide-content)
build      built v0 0.1.0+81d56b0 -> dist/  (3 pages, sw + precache 10, CSP+SRI on)
e2e        17 passed (3.0s)   (+ guide render/TOC, + screenshots load, + guide mobile-fit/csp)
```

TDD: the guide-content spec (unique testids, non-empty copy, and **every `shot`
names a file that exists on disk**) was written before the content and drove it;
the render and screenshot-load behaviour is proven by the e2e specs in real
Chrome. The shot-existence test is the enforcement that keeps `npm run guide:shots`
honest — a guide referencing a missing screenshot fails the unit gate.

## The reusable pattern (the P1 deliverable)

A new Croft PWA gets its guide by keeping this shape and replacing content:
edit `guide-content.ts` (data only), keep `user-guide-view.ts`/`user-guide.ts`
unchanged, list the page in `build.mjs` PAGES and the nav tab, and run
`npm run build && npm run guide:shots` to capture fresh screenshots. Copy is
unit-tested; screenshots are regenerated, never hand-managed.

## Verify-in-run ledger

- **Screenshots captured headless in this environment** (400px viewport, 2x,
  full-page). A human eyeball pass in real Chrome (light+dark) is still owed
  before treating the visuals as final.
- **Only home light/dark are shot so far.** Settings/guide screenshots can be
  added to the tool's SHOTS list when a chapter references them.

## Scoped out (with reason)

Standards content as fully-authored live chapters (P2 — this guide is the
generator proof, not the full chapter set), atproto/PDA module (P3), telemetry
(P4).

## Files touched

New: `src/pages/{guide-content,user-guide-view,user-guide}.ts`, `user-guide.html`,
`tools/guide-shots.mjs`, `tests/unit/guide-content.test.ts`,
`tests/e2e/user-guide.spec.ts`, `assets/guide/{home-light,home-dark}.jpg`,
`RUN-P1-SUMMARY.md`.
Changed: `build.mjs` (guide page + assets copy), `package.json` (guide:shots),
`src/nav.ts` (Guide tab), `styles.css` (guide styles),
`tests/e2e/{mobile-fit,csp}.spec.ts` (cover /user-guide.html).
