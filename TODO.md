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

## Device queue — a note for the next session in this repo (2026-08-30)

The device-testing needs in this file are **registered in the workspace device queue**
(`CroftC/.claude/TESTBED.md` § The device queue; `CroftC/.claude/DEVICE-QUEUE.md` is
generated from the `[device: …]` tags). Nothing here was removed or reworded: a tag was
appended to the line that records each need, or a pointer bullet was added below where the
need sits inside a longer item. Going forward:

- a new item that needs a phone carries a tag — `[device: android]`, `[device: android x2, ios]`,
  `[device: android=samsung]` when the check is about that unit (tokens: TESTBED's table);
- a run that fulfils one turns its tag into `[device done YYYY-MM-DD: …]` in the same commit as
  the evidence;
- when you next touch an item registered by a pointer bullet, fold the tag into the item and
  drop the pointer — the pointer is scaffolding for the migration, not the shape.

`bash CroftC/.claude/bin/device-queue.sh --have samsung` shows what a phone in hand can seat.

Registered by pointer (the need sits inside item 1 above):

- (since 2026-08-07) **Install/offline behaviour tested on a real iPhone** — item 1's "do it
  when": the moment this repo claims install or offline behaviour a reader would expect to
  have been tested on iOS (the atproto/PDA module, the telemetry chapter). No iOS device is
  registered in the workspace yet; this row is what argues for one. [device: ios]

## 3. Become the package — reference AND library (`CroftC/.claude/SHARED-CODE.md` rule 2)

Plan: `plans/2026-09-08-plan-pds-walker.md` (Phases 1a–1c of that plan are this section's first three boxes; landed as G1).

Owner decision 2026-09-08: croft-pwa is the library home for shared PWA code, and **the
repo root is the package** (npm installs from a git commit and runs `prepare`, but cannot
install a subfolder). Until this lands, audit check 47e NOTEs the repo every run.

- [x] `package.json`: an `exports` map naming the public modules, a `files` list naming only
      library code (the site stays here as the reference app but is not what a consumer
      installs), and a `prepare` script that builds what `exports` points at. *Landed 2026-09-08
      (G1: 1a–1d-ii). `private: true` stays: it blocks `npm publish` only; a git install at a
      pinned commit is unaffected (plan V6).*
- [x] The reference site imports the library through its own export path, not a relative
      `./src/...` import — that is what proves the export works (rule 2's last clause;
      uncheckable by script, so it is review). *Done 2026-09-08 (G6): `src/pages/rings.ts`
      imports from `croft-pwa/pds-walker`.*
- [x] First export: the rev-gated ring walker
      (`discovery/alpha/research/ring-walk-sans-relay-2026-09.md` § 6–7). Consumers pin
      `github:CroftCommunity/croft-pwa#<sha>`: forage, pdsview, the social-tree site. *Done
      2026-09-08 (G2–G5); first release `pds-walker-v0.1.0` (G7). No consumer has pinned it
      yet — forage's adoption is Phase 7 of the plan, under forage's own plan.*
- [x] **Phase 7 done 2026-09-08 in forage** (`forage/plans/2026-09-08-plan-beta-pds-walker.md`: a Beta features switch; the tree vendored whole). ~~Deferred from the plan (2026-09-08): Phase 7 — forage adopts the package (pin
      `github:CroftCommunity/croft-pwa#6005f12c7c22f7807d54f587ef8960da1825638c`, the
      `pds-walker-v0.1.0` commit; the library is a tree with `.js` imports, so forage's
      `vendor:sync` copies `lib/` whole or the package grows a single-file bundle — decide in
      forage's plan); Phase 8 — a Jetstream tier for ring 1, once a measured poll cost exists.
- [ ] The eight `Ported from skylite` files (`src/atproto/oauth/*`, `src/atproto/read.ts`,
      `src/crypto/vault.ts`, `src/crypto/sealedbox.ts`) are register rows in SHARED-CODE.md
      § Register of copies. Once the package exists they become the canonical home and
      bluebird + fun consume them; flip the register rows in the same landing.
