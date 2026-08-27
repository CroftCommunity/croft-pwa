# TODO — croft-pwa

> Known work only — items whose shape is already decided, and which may therefore be
> proposed as work. Anything still an open question (decide / verify / investigate /
> reconcile) belongs in the backlog of record, `discovery/alpha/ROADMAP_TODO.md`,
> however small or operational it is. Tracking scheme: `CroftC/.claude/TRACKING.md`;
> the two piles and why: its § "Two piles". Cross-reference E-numbers where an item
> here implements a backlog row.

Backlog for the repo that is both the **standards** and the **reference
implementation** that proves them. Dated plans live in `plans/`; per-run evidence
in `RUN-*-SUMMARY.md`. This file is the running list of things known and deferred.

---

## 1. The gate runs Chrome only — including the "mobile" tests

**Decided 2026-08-07: chromium-only stands for now.** Recorded here so the gap is
a choice with a known cost rather than an oversight.

`playwright.config.ts` has two projects, `chromium` and `subpath`, and **both are
`devices['Desktop Chrome']`**. There is no WebKit and no device profile anywhere
in the gate. That has a consequence worth stating plainly, because the config
reads as if mobile is covered:

> `tests/e2e/mobile-fit.spec.ts` guards horizontal overflow at 320/360/390px — but
> under Desktop Chrome with a narrow viewport. It tests **layout width**, not the
> **engine** a phone actually runs.

**Why that matters more here than in most repos.** On iOS, every browser is
WebKit — Safari, Chrome, Firefox alike, by App Store rule. So a WebKit-only defect
reaches 100% of iPhone users while this gate stays green. And the areas where
WebKit has historically diverged are precisely this repo's subject matter:

- service worker lifecycle and cache behaviour,
- `manifest.json` handling and the install path,
- storage eviction (iOS clears aggressively),
- CSS features that ship at different times in Blink and WebKit.

A repo whose whole premise is *how to build a Croft PWA* currently proves it on
the one platform where PWA support is least fussy.

**What closing it looks like.** The sibling `fun` repo runs a `mobile-webkit`
project — `devices['iPhone 13']`, which is WebKit engine + touch input + phone
viewport, a genuinely different thing from Chrome at 390px. Adding the same here
is a few lines of config plus `webkit` in the CI browser install. Budget honestly:
a runner gives Playwright 2 workers against a laptop's 7, and a second project
roughly doubles the suite's test count (measured in `fun`: 418 tests, ~55s local,
4.5 min on CI).

**Do it when** the repo starts making claims about install/offline behaviour that
a reader would reasonably expect to have been tested on iOS — the atproto/PDA
module (P3) and the telemetry chapter (P4) both head that way.

## 2. Audit the rest of the workspace against CI rules 8 and 9

`docs/CI.md` gained §7 (`timeout-minutes` on every job) and §8 (a manual path that
can actually publish) on 2026-08-07. They are implemented in **this repo and
`fun` only**. Every other repo with a workflow is unaudited against them — the
blanks in `.claude/CI-PATTERN.md`'s table mean *unchecked*, not *known-bad*.

Order of work: the repos that **deploy** matter most, since §8 is about being able
to publish when webhook delivery is throttled. A repo whose workflow only lints
loses much less by lacking a manual path.

**`croft-stack` is not a PWA** — its outstanding gap is the CI *shape* (it fails
the original rules 1–5), and that is all this item covers for it. The PWA
standards in this repo — chassis, brand tokens, mobile-fit, CSP/SRI, service
worker — do not apply to it and should not be pushed onto it. Worth keeping
straight: `.claude/CI-PATTERN.md` is a **workspace-wide CI** convention that
applies to anything that builds and deploys; this repo's *other* chapters are
PWA-specific and travel only to PWAs.
