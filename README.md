# croft-pwa

A meta-site about **building Croft SPA/PWAs** — the standards and a reference
implementation, in one repo. The site you would deploy from here is itself a
Croft PWA, built to the standards it documents. Nothing here is a claim the code
cannot back up.

## What this is

Two things at once:

1. **The standards** — how a Croft PWA is built: chassis (build, service worker,
   design tokens, navigation, the test gate), brand system, agent working
   method, a reusable user-guide generator, atproto/PDA integration, and a
   telemetry posture. Each is (or will be) a real page in the site.
2. **A reference implementation** — the smallest working app that exercises
   every standard and proves it against the gate. Its chassis is what a new
   Croft PWA copies to start.

It supersedes the older, generic `peadoubleueh` PWA notes, and distills the
conventions proven in [arecipe](https://arecipe.app/) (the working method and
brand-token discipline) and [skylite](https://github.com/CroftCommunity/skylite)
(the atproto/PDA integration and provenance discipline).

## Quick start

```
npm install
npm run test        # the gate: lint · typecheck · unit · build · e2e
npm run build       # → dist/  (self-contained static site)
npm run serve       # serve dist/ at http://localhost:4173
```

Agents: read [`CLAUDE.md`](./CLAUDE.md) first — it is the operating manual
(the gate, the conventions, the local e2e gotcha).

## Starting a new Croft PWA from this

The chassis is the template. Copy `build.mjs`, `tokens.css`, `styles.css`,
`tsconfig.json`, `eslint.config.js`, `playwright.config.ts`, `vitest.config.ts`,
`tools/serve.mjs`, and `src/{nav,theme,log,version,sw,sw-nav,sw-register}.ts`,
then replace the page shells and `src/pages/*` with your app. Retune the palette
in `tokens.css` (keep hex confined there; keep the WCAG ratios recorded) and the
brand chapter's guidance applies unchanged.

## Status

Phase 0 (chassis + gate + CI) is complete and green. See
[`plans/`](./plans/) for the phased roadmap and `RUN-*-SUMMARY.md` for per-run
evidence.

## Licence

MIT — see [`LICENSE`](./LICENSE).
