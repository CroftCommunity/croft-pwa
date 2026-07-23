# RUN P2 — standards content as live chapters

Scope: promote the standards from `docs/` prose into live, in-site chapters,
authored with the P1 guide generator. Branch: main. Plan:
`plans/2026-07-23-1-plan-croft-pwa.md`.

## What shipped

- **Chapter content** (`src/pages/standards-content.ts`): four `GuideEntry[]`
  chapters — `CHASSIS`, `BRAND`, `PWA`, `AGENT_METHOD` — distilled from
  `docs/DESIGN.md`, `docs/SECURITY.md`, `docs/PRACTICES.md`, and `CLAUDE.md`.
- **Generalised renderer**: `renderGuide(entries, heading)` now takes a
  `{ title, lede }` heading instead of a hardcoded one, so the same generator
  renders the user guide and every chapter. `mountChapter()` (`src/pages/chapter.ts`)
  is the shared three-line wiring.
- **Pages**: a Standards index (`reference.html` / `src/pages/reference.ts`)
  linking the four chapters, plus one page each for `chassis`, `brand`, `pwa`,
  `agent-method`. Nav gains a single "Standards" tab that stays current across
  the index and every chapter.
- **Home** now points at the guide and the standards instead of a "coming next"
  placeholder.

## Evidence — the gate is green

```
lint       ESLint: No issues found
typecheck  tsc --noEmit (0 errors)
unit       Tests 30 passed (30)
build      built v0 0.1.0+dcee72f -> dist/  (8 pages, sw + precache 20, CSP+SRI on)
e2e        42 passed (3.2s)
```

New e2e (`tests/e2e/standards.spec.ts`): the index links to all four chapters;
each chapter renders its heading, a TOC matching its entry count, and shows the
Standards tab as current. All eight pages are covered by the CSP and mobile-fit
specs.

## The dogfood payoff

Every chapter is rendered by the same generator P1 shipped, so the site claiming
"colour lives in one file / test first / security baked in" is itself built that
way and proven by the gate. The `docs/` files remain the long-form source; the
chapters are the live, navigable form.

## Verify-in-run ledger

- **Chapters are prose distilled from the docs, not yet a 1:1 port** — deeper
  material (the full palette table, the exact CSP string) stays in `docs/` and is
  linked, not duplicated, to avoid drift.
- **Real-Chrome eyeball pass still owed** across the new pages (light + dark).
- **Chapters reuse the two home screenshots** as illustrations; per-chapter shots
  can be added to `guide-shots` later if a chapter needs its own.

## Scoped out (with reason)

Telemetry (P4) — but see the next run: the plan is to trial the arecipe
telemetry approach (PR #58) here on croft-pwa first, as the reference testbed.
atproto/PDA module (P3).

## Files touched

New: `src/pages/{standards-content,chapter,reference,chassis,brand,pwa,agent-method}.ts`,
`{reference,chassis,brand,pwa,agent-method}.html`, `tests/e2e/standards.spec.ts`,
`RUN-P2-SUMMARY.md`.
Changed: `build.mjs` (five pages), `src/nav.ts` (Standards tab),
`src/pages/user-guide-view.ts` (heading param), `src/pages/user-guide.ts`
(pass heading), `src/pages/index.ts` (real links), `tests/e2e/{mobile-fit,csp}.spec.ts`.
