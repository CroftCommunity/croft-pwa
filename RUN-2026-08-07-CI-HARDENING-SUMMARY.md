# RUN summary — CI hardening from the `fun` build (2026-08-07)

**Problem.** Two days of work in the sibling `fun` repo (a checkers game, a
generalised AI-scoring harness) surfaced four CI failures that this repo — the
reference implementation for the workspace CI pattern — either shared or could
not have recovered from. Since croft-pwa is both the standard and the proof of
the standard, each fix lands here with its reasoning, so other repos inherit the
*why* and not just the YAML.

**Not in this run.** No site chapter for CI (P2 owns standards pages; `docs/CI.md`
is not yet surfaced in the site). No change to the gate's contents, the deploy
mechanism, or the browser matrix — see "Raised, not taken" below.

## What changed, and the failure each one prevents

| Change | Failure it prevents | Evidence |
|---|---|---|
| `.npmrc` `engine-strict=true` | `engines` only **warns**; `fun` had `.nvmrc` + `engines` and a dev ran the whole suite on Node 25 for a day while CI was green, carrying 11 failures as "known, pre-existing" | Verified both ways here: `npm ci` exits 0 on Node 22, and stops with `EBADENGINE … croft-pwa@0.1.0` on Node 24 |
| `workflow_dispatch` on `ci.yml` | A GitHub incident throttled **webhook deliveries** on 2026-08-06; pushes stopped triggering runs for hours and dispatch was the only path to production. This repo had none on the gate | Status page: "Webhook triggers remain throttled … many push and pull request events are not triggering new workflow runs" |
| `timeout-minutes` on all 3 jobs | No timeout inherits GitHub's **6-hour** default. `fun` had a test hang a vitest worker — the run reported *every test passed* and still failed | `Tests 329 passed \| 3 skipped`, `Errors 3 errors` (`Timeout calling "onTaskUpdate"`) |
| Playwright browser cache (lockfile-keyed) | ~300MB re-downloaded per run for binaries that change only with Playwright's version | The cold install step measured 56s in `fun` |
| `playwright-report` artifact on failure | A browser failure without trace/screenshots is unreadable; the next move is pushing `console.log` commits | — |
| `docs/CI.md` §6 extended, §7 and §8 added | The standard did not carry these rules, so no repo could inherit them | — |
| `docs/CI.md` linked from README + CLAUDE.md | **It was referenced from nothing inside its own repo** — the canonical workspace CI writeup was undiscoverable from the repo that owns it | `grep -rn "CI.md" README.md docs/ CLAUDE.md` → no hits before this run |

## The two rules worth reading in full

**§7 — every job gets a `timeout-minutes`.** Generous (≈3× honest runtime): a
backstop, not a budget. A timeout that trips on a slow-but-healthy run teaches
people to raise it without reading.

**§8 — keep a manual path, and make sure it can publish.** Two ways to get this
wrong, both observed in one day: *not having one* (this repo), and *having one
that cannot publish* (`fun` conditioned its Pages upload `if: github.event_name
== 'push'` while guarding `deploy` on the ref alone, so a dispatch skipped the
upload and then failed looking for it). Publish steps are conditioned
`!= 'pull_request'`, never `== 'push'` — and **pull the hatch once**, because an
escape hatch nobody has opened is a comment, not a hatch.

This repo's deploy is dispatch-safe *by construction*: it rebuilds rather than
consuming an artifact, so it has no step conditioned on the event name. That is a
quiet argument for the simpler deploy, now recorded in `ci.yml`.

## Evidence

- Gate green after the changes: `npm test` exit 0 — 101 unit tests across 17
  files, 94 e2e passed (~15.7s total).
- `engine-strict` proven in both directions (table above) before being committed,
  because it also applies to dependencies' declared ranges — nothing objected.
- Both workflows parse (`yaml.safe_load`).
- **Pending:** rule §8 says to pull the hatch once. Dispatching `ci.yml` on `main`
  is the proof, and it can only run once this file is on `main` (a dispatch
  trigger is not usable until then). Until that happens, §8 is documented and
  implemented but **not demonstrated here** — it *was* demonstrated in `fun`,
  where a dispatch published successfully after the equivalent fix.

## Raised, not taken

**Browser matrix.** This repo gates on **chromium only**, while `fun` runs
chromium + mobile-webkit (iPhone 13). croft-pwa is the reference for *PWAs*,
where mobile install and offline are the premise — so the reference arguably
ought to cover the platform it is a reference for. Real wall-clock cost, and a
judgement call about what the gate is for; left for an owner decision rather than
taken unilaterally.

**Budget note for whoever takes it:** a runner gives Playwright **2 workers**
against a laptop's 7. In `fun`, 418 tests ran ~55s locally and **4.5 min** on CI —
predicting from local wall-clock understates by ~5×.
