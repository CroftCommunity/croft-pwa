# Plan — croft-pwa: a meta-site on building Croft PWAs

Date: 2026-07-23 · Status: P0 + P1 + P2 + telemetry (local trial) complete (green);
atproto/PDA (P3) in progress — public reads + sealed-box + OAuth sign-in shipped
(RUN-ATPROTO-01/02/03); DPoP writes, the key-at-rest vault, and lexicon
conventions remain. Telemetry was pulled forward from P4 to trial arecipe
PR #58's counter-based design on croft-pwa; see RUN-TELEMETRY-01-SUMMARY.md and
docs/TELEMETRY.md. A real receiver/endpoint remains a later explicit step.

## Problem statement

The older `peadoubleueh` repo tried to be both a PWA template and a
best-practices library for humans and agents. It went stale and over-built: ~6k
lines of emoji-prose, committed `node_modules`, a duplicated/diverged doc tree,
a real service-worker bug, and zero atproto/telemetry content — advice not
proven by running code. Meanwhile two working Croft PWAs (arecipe, skylite)
converged on a strong, consistent standard (TDD-first, one gate, page-per-
destination, token-only brand with recorded WCAG, build-time CSP+SRI,
version-stamped SW, atproto/PDA integration, plan+RUN-summary method) — but that
standard lives implicitly across two app repos, not anywhere reusable.

We need a single place that codifies the Croft PWA standard for coding agents
(with human oversight) and cannot drift into fiction.

## Approach

One repo that is **both** the standards **and** a reference implementation, and
is itself a Croft PWA built to those standards (a meta-site on building Croft
PWAs). Self-demonstrating: every standard is provable by pointing at this repo's
own source passing the gate; the chassis is what a new PWA clones.

Locked decisions:

- **D1** One repo: standards (the product) + reference implementation (proves them).
- **D2** Framing: a meta-site on building SPA/PWAs, itself a Croft PWA (dogfood).
- **D3** Home: CroftCommunity org; local path `CroftC/croft-pwa`.
- **D4** atproto/PDA baked in by default (Phase 3 ships the full stack).
- **D5** Palette: a PWA-UI-tuned variant of the tectonic palette, WCAG ratios recorded.
- **D6** Reference implementation = the meta-site itself (the clonable chassis).

Phasing (each phase leaves the gate green):

- **P0 — chassis + gate (done).** Repo, `build.mjs` (esbuild + content hash +
  CSP + SRI + generated SW), `tokens.css`/`styles.css`, `nav`/`theme`/`log`/`sw`
  cores, `index`+`settings` shells, the gate (lint·typecheck·unit·build·e2e),
  CI, and the standards docs (DESIGN/SECURITY/PRACTICES).
- **P1 — user-guide generator.** Extract arecipe's data-driven `GuideEntry[]`
  pattern + a `guide-shots` screenshot-regeneration tool + copy unit tests; the
  site's own guide is authored with it.
- **P2 — standards content pages.** chassis/brand/pwa-mechanics/agent-method
  chapters authored via the generator (docs become live pages).
- **P3 — atproto/PDA module.** OAuth (PKCE+PAR+DPoP), public reads, custom
  lexicons, sealed-box; `signin` page; `@live` tier; connect-src widened.
- **P4 — telemetry posture chapter.** Accountability-to-a-human, not vendor
  analytics; documented, code later.

## Reasoning

- **Why one repo, not two.** A separate docs repo and template repo are the exact
  drift trap that bloated peadoubleueh (two things to keep in sync). Co-locating
  and making the docs' claims executable means CI catches drift.
- **Why a meta-site that is a Croft PWA.** Dogfooding is the strongest proof: if
  the standard can't build its own site, the standard is wrong. It also gives
  new authors a real, gate-passing artifact to copy rather than prose.
- **Why esbuild + zero runtime deps, no framework/router.** Matches both
  reference apps; keeps the chassis small, legible, and portable, and makes the
  build itself (hashing, CSP, SRI, SW generation) the teaching surface.
- **Why the pure SW decision core and the brand-ratio test.** They turn two
  historically fragile areas (SW routing, colour contrast) into unit-tested
  invariants, so the standard is enforced, not just described.
- **Why atproto is baked in (D4) but arrives in P3.** Croft's substrate is
  atproto; the standard should assume it. But P0's job is the atproto-agnostic
  chassis, so the PDA stack lands as its own phase against a proven base.

## Not in this run (P0)

The user-guide generator, the content chapters as live pages, the atproto/PDA
module and `@live` tier, telemetry, PNG icon set / brand asset pipeline, and a
production domain/CNAME. No commit or push (awaiting the go-ahead).
