# croft-pwa

A meta-site about **building Croft SPA/PWAs** — the standards and a reference
implementation, in one repo. The site you would deploy from here is itself a
Croft PWA, built to the standards it documents. Nothing here is a claim the code
cannot back up.

## What this is

Two things at once:

1. **The standards** — how a Croft PWA is built: chassis (build, service worker,
   design tokens, navigation, the test gate), brand system, agent working
   method, a reusable user-guide generator, atproto/PDA integration, a telemetry
   posture, and **content fetch** (how a backendless PWA reaches cross-origin
   content via a companion browser extension). Each is a real page in the site.
2. **A reference implementation** — the smallest working app that exercises
   every standard and proves it against the gate. Its chassis is what a new
   Croft PWA copies to start.

It supersedes the older, generic `peadoubleueh` PWA notes, and distills the
conventions proven in [arecipe](https://arecipe.app/) (the working method and
brand-token discipline) and [skylite](https://github.com/CroftCommunity/skylite)
(the atproto/PDA integration and provenance discipline).

## Quick start

```
npm install         # refuses on the wrong Node — see .nvmrc + .npmrc
npm run test        # the gate: lint · typecheck · unit · build · e2e
npm run build       # → dist/  (self-contained static site)
npm run serve       # serve dist/ at http://localhost:4173
```

**Node is pinned to `.nvmrc`** and the pin is enforced, not merely declared:
`engine-strict=true` makes `npm` refuse a mismatched runtime rather than print a
warning you scroll past. Use a version manager that reads the pin —
`brew install fnm && fnm install`, plus `eval "$(fnm env --use-on-cd)"` in your
shell — and Node switches when you `cd` here. The reasoning, and the day this
cost in a sibling repo, is in [`docs/CI.md`](./docs/CI.md) §6.

Agents: read [`CLAUDE.md`](./CLAUDE.md) first — it is the operating manual
(the gate, the conventions, the local e2e gotcha).

Backlog: [`TODO.md`](./TODO.md) — what is known and deferred, with the reasoning
(including why the gate runs Chrome only, on purpose, for now).

**[`docs/CI.md`](./docs/CI.md) is the canonical writeup of the CI shape for every
repo in this workspace**, not just this one — eight rules, each with the specific
failure it prevents, plus a checklist for auditing a repo against it. This repo is
the reference implementation, so `.github/workflows/ci.yml` and that document are
meant to be read together.

[`docs/PWA-INSTALL.md`](./docs/PWA-INSTALL.md) covers what an installed PWA does
between the tap and the first frame — manifest, icons, and the three different
things people call "the splash screen". The short version: **the splash you
actually control is a page you write, not a manifest field.** It also records
two gaps in this repo's own manifest, named so they are not mistaken for
decisions.

## Starting a new Croft PWA from this

The chassis is the template. Copy `build.mjs`, `tokens.css`, `styles.css`,
`tsconfig.json`, `eslint.config.js`, `playwright.config.ts`, `vitest.config.ts`,
`tools/serve.mjs`, and `src/{nav,theme,log,version,sw,sw-nav,sw-register}.ts`,
then replace the page shells and `src/pages/*` with your app. Retune the palette
in `tokens.css` (keep hex confined there; keep the WCAG ratios recorded) and the
brand chapter's guidance applies unchanged.

## The Croft Bridge extension (content fetch)

A backendless Croft PWA cannot read most of the open web directly — the
same-origin policy blocks cross-origin responses that lack CORS headers. The
**Croft Bridge** extension (`extension/`) grants that read, per source, on the
user's approval. The Atmosphere reader (the **Reader** tab) dogfoods it against
real Bluesky/atproto ecosystem feeds. Full rationale: [`docs/CONTENT-FETCH.md`](./docs/CONTENT-FETCH.md)
and the site's *Content fetch* chapter.

Load it for local development (Chrome/Chromium; Firefox/Safari are not supported yet):

```
1. chrome://extensions  →  enable Developer mode
2. "Load unpacked"       →  select this repo's extension/ folder
3. Open the Reader tab; the extension's options page lists the sources —
   approve one, then reload. Un-approved sources are refused by the extension.
```

Its end-to-end tests are a **separate tier**, not part of the default gate
(they drive real Chromium with the extension loaded):

```
npm run e2e:ext     # node tests/ext/run-ext.mjs — see tests/ext/README.md
```

## Status

Phase 0 (chassis + gate + CI) is complete and green. See
[`plans/`](./plans/) for the phased roadmap and `RUN-*-SUMMARY.md` for per-run
evidence.

## Licence

AGPL-3.0 — see [`LICENSE`](./LICENSE).
