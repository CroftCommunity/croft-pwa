# CI shape

Two jobs: a **gate** that runs on every PR and every push to `main`, and a
**deploy** that only ever runs on `main` and only if the gate passed.

```
  PR opened ──► gate ──✗──► blocked before it reaches main
       │
       └─ merge ──► push:main ──► gate ──✓──► deploy ──► Pages
                                    └──✗──► no deploy, main flagged
```

`.github/workflows/ci.yml` is the reference. The rules below are what make it a
gate rather than a notification; each is written with the failure it prevents,
because every one of them looks optional until it isn't.

## 1. Trigger on `pull_request`, not only `push: main`

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

Without the second trigger, **nothing runs until the commit is already on
`main`**. The checks still catch the regression, but after the fact — they
protect the deploy, not the branch. Worse, the PR looks *fine*:

```
$ gh pr checks 41
no checks reported on the 'my-branch' branch

$ gh pr view 41 --json mergeable,mergeStateStatus,statusCheckRollup
{"checks": 0, "mergeStateStatus": "CLEAN", "mergeable": "MERGEABLE"}
```

GitHub reports **CLEAN and MERGEABLE with zero checks** — not because anything
passed, but because nothing ran. A PR that breaks every test reports identically.

## 2. `deploy: needs: <gate>`

A failing gate must **block publication**, not merely annotate it. Without
`needs`, the two jobs race and a red gate still ships.

## 3. `deploy: if: github.ref == 'refs/heads/main'`

`workflow_dispatch` can be aimed at **any ref**. Without this guard, dispatching
the workflow against a scratch branch publishes that branch to production. The
guard is also what makes it safe to verify CI changes on a branch at all.

It costs nothing on `pull_request` events either: `github.ref` is
`refs/pull/N/merge` there, so the deploy is skipped automatically.

## 4. Choose `concurrency` so PRs cannot cancel a production deploy

A single global group with `cancel-in-progress: true` means a PR run can cancel
an in-flight deploy. Either scope the group per ref
(`group: pages-${{ github.ref }}`) or scope it to the publishing job only, as
this repo does:

```yaml
deploy:
  concurrency:
    group: gh-pages          # every writer of the gh-pages branch, serialized
    cancel-in-progress: false  # never abandon a half-finished push
```

`cancel-in-progress: false` is deliberate here: the deploy and the per-PR preview
workflow both `git push` to `gh-pages`, and cancelling one mid-push is how that
branch gets corrupted.

## 5. Least privilege, elevated per job

```yaml
permissions:
  contents: read      # workflow-wide floor
jobs:
  deploy:
    permissions:
      contents: write # only the job that actually publishes
```

The gate never needs write access. Fork PRs get read-only tokens regardless, so
a workflow that assumes write in the gate job breaks on exactly the contributions
you least control.

## 6. One gate command, and pin the toolchain it runs on

`npm test` = lint · typecheck · unit · build · e2e — **the same command locally
and in CI** (see `PRACTICES.md` → "One gate"). One command means there is no
"but it passed on my machine" version of the gate to argue with.

That guarantee only holds if the *toolchain* also matches. This is the failure
mode that is easiest to miss, because it produces green locally and red in CI on
code you did not touch:

> In the sibling `fun` repo, a Rust gate failed CI **three times in a row** on
> code that a local `cargo clippy` called clean — including from a scrubbed
> target directory, which ruled out caching. Root cause: Homebrew's `cargo-clippy`
> shadowed rustup's on `PATH` and *lagged* — local 0.1.94, CI 0.1.97. Every
> "clean" local run was a different program. Fixed by pinning the version
> (`rust-toolchain.toml`) **and** resolving the binary through `rustup which`
> rather than trusting `PATH`. You need both halves: pinning fixes the version,
> resolving fixes the shadowing.

Node is pinned the same way: **`.nvmrc` is the single source of truth**, every
`setup-node` reads it via `node-version-file` rather than repeating a literal, and
`package.json` `engines` states the range so `npm` warns on a mismatch.

```yaml
- uses: actions/setup-node@v7
  with:
    node-version-file: .nvmrc   # not `node-version: 22`
    cache: npm
```

This is not theoretical either. In `fun` — same workspace, same shape — CI ran
Node 20 with no `.nvmrc`, and on a local Node 25 eleven tests failed with
`TypeError: localStorage.clear is not a function` while the same commit was green
in CI. The direction is the tell: a local-only *red* is merely annoying, but the
identical setup can produce a local-only *green*, which is how a regression walks
onto `main` past a developer who ran the suite and saw it pass.

### Declaring the pin is not enforcing it

Three halves, not two — and the third was learned the expensive way on
2026-08-06. `fun` had **both** `.nvmrc` (22) and `engines: ">=22 <23"`, and a
developer still ran the entire suite on Node 25 for a day, because
**`engines` only warns**. The warning scrolls past `npm ci` and nothing stops
you. The eleven failures were then carried for hours as "known, pre-existing,
green on CI" — which is what version drift looks like from the inside: not a
loud error, a *category of noise you learn to skip*.

So the pin needs something that refuses:

```
# .npmrc
engine-strict=true    # npm refuses to install, instead of warning
```

Verified in this repo: on the pinned Node, `npm ci` exits 0; on Node 24 it stops
with

```
npm error code EBADENGINE
npm error engine Not compatible with your version of node/npm: croft-pwa@0.1.0
```

...naming the project rather than some transitive dependency, which is what makes
it actionable. (`engine-strict` does apply to dependencies' declared ranges too,
so add it and run `npm ci` once before trusting it — here nothing objected.)

And because refusing to install is only useful if the fix is obvious, the repo
also says how to *resolve* the pin locally. Use a version manager that reads
`.nvmrc`:

```bash
brew install fnm
fnm install                          # reads .nvmrc
eval "$(fnm env --use-on-cd)"        # in ~/.zshrc — switches Node on cd
```

The full ladder, then: **`.nvmrc` declares · `setup-node` reads · `engines` +
`engine-strict` refuse · a version manager resolves.** Skip the third and you get
`fun`'s lost day; skip the fourth and the refusal has no remedy to point at.

## 7. Give every job a `timeout-minutes`

A job without one inherits GitHub's **six-hour** default. That is not a
theoretical waste: a test that *hangs* rather than fails will sit there for all of
it, and hangs are exactly what you cannot predict.

The shape is worth recognising because it does not look like a hang. In `fun`, a
browser-suite test blocked the vitest worker long enough that its RPC heartbeat
timed out, and the run reported:

```
Test Files  33 passed | 1 skipped (35)
     Tests  329 passed | 3 skipped (334)
    Errors  3 errors        ← [vitest-worker]: Timeout calling "onTaskUpdate"
```

**Every test passed and the run failed.** A timeout does not fix that, but it
bounds it — and on a day when runners are scarce (the same week, jobs were being
cancelled after 15 minutes waiting for capacity), an unbounded job is a queue
everybody else waits behind.

```yaml
jobs:
  gate:
    runs-on: ubuntu-latest
    timeout-minutes: 20   # generous vs the ~6 min this actually takes
```

Set it generously — perhaps 3× the honest runtime. The number is a backstop, not
a budget, and a timeout that trips on a slow-but-healthy run teaches people to
raise it without reading.

### It fired for real, two days after it was written

This rule read as prudence until 2026-08-07, when it caught something. `fun` run
**31211892961**: the `e2e` job stalled inside
`npx playwright install --with-deps chromium webkit`, mid-download of an apt
package from `azure.archive.ubuntu.com`:

```
19:57:46  Get:59 .../libflite1 amd64 2.2-6build3 [13.6 MB]
20:02:22  ##[error]The operation was canceled.
```

Four and a half minutes of no progress, then `timeout-minutes: 30` ended it.
Without the rule that job had **six hours** of doing nothing available to it, on a
run whose `rust` and `build` jobs had already gone green.

Three things worth taking from it:

- **The failure was outside the repo entirely.** Nothing in the diff went near
  Playwright or apt. A gate depends on every third party it reaches out to, and
  those are the dependencies nobody lists.
- **A stall is not an error.** The step never failed; it just stopped making
  progress. Anything you build to recover from this — a retry, an alert — has to
  bound *time*, not just catch a non-zero exit. `fun`'s fix wraps each attempt in
  `timeout 300` before retrying, because a bare retry loop would have sat in the
  same hung download.
- **The job timeout is the wrong granularity for recovery, and the right one for
  safety.** It stopped the waste, but it also threw away two passing jobs and a
  successful build. Step-level bounds are what let a run survive; the job-level
  one is what stops a bad day becoming an expensive one. Have both.

The lesson is not "raise the timeout". It is that a green `rust` and a green
`build` were discarded because an unrelated Ubuntu mirror was slow, and the only
reason that cost five minutes instead of six hours was one line of YAML.

## 8. Keep a manual path, and make sure it can publish

`workflow_dispatch` is not a convenience. On **2026-08-06** a GitHub Actions
incident throttled *webhook deliveries*, and the status page said so plainly:

> "Webhook triggers remain throttled to aid recovery, so many push and pull
> request events are not triggering new workflow runs."

Pushes stopped starting runs for hours. Dispatch was exempt, and was the only way
to gate a commit or publish a fix. Two ways to get this wrong, both seen that day:

**Not having one.** This repo's `ci.yml` had no `workflow_dispatch` until
2026-08-07, so during that window there was no path to production at all. The
insight was already in the repo — `preview.yml`'s header calls dispatch "the
RELIABLE path" when events do not fire — just not applied to the gate.

**Having one that cannot publish.** `fun` had dispatch, and it was broken in a way
nobody could see: its Pages upload steps were conditioned

```yaml
- uses: actions/upload-pages-artifact@v3
  if: github.event_name == 'push'        # ← wrong test
```

while the `deploy` job was guarded on the ref alone. A dispatch on `main`
therefore **skipped the upload and then ran deploy anyway**, failing with `No
artifacts named "github-pages" were found`. The intent had been "skip publishing
plumbing on PRs" — so the condition wanted to be `!= 'pull_request'`, not
`== 'push'`. The two guards disagreed about what a publishable run is.

Two rules follow:

- Any step that produces or consumes a publish artifact is conditioned
  **`!= 'pull_request'`**, never `== 'push'`.
- **Pull the hatch once.** An escape hatch nobody has ever opened is not an
  escape hatch; it is a comment. Dispatch the workflow deliberately, watch it
  publish, and only then believe the manual path exists.

A deploy that *rebuilds* rather than consuming an artifact — as this repo's does —
is dispatch-safe by construction, because it has no step conditioned on the event
name at all. That is a quiet argument for the simpler deploy.

## 9. The security gates come from one shared workflow, not eighteen copies

`.github/workflows/security-reusable.yml` in this repo is called by every repo in
the workspace. A caller writes eighteen lines and gets both gates:

```yaml
jobs:
  security:
    uses: CroftCommunity/croft-pwa/.github/workflows/security-reusable.yml@main
```

**Why one file.** Rule 6 wants the toolchain pinned in one place. Eighteen copies
of `gitleaks 8.30.1` is eighteen places to forget when it moves — and the scanner
version is not cosmetic: the dependency gate's classifier reads osv-scanner's JSON
schema, so a version bump can change what the gate *means* while CI stays green.
Five repos here have no CI at all, so per-repo workflows would mean authoring five
files for repos with nothing else to run.

**Why the host is public.** `croft-stack` and `CroftC` are private — exactly the
repos GitHub's own free secret scanning does not reach, and the reason this gate
exists rather than relying on it (GitHub *alerts*; a gate *blocks*). Verified
2026-08-29: `actions/permissions/access` returns HTTP 422 *"Access policy only
applies to internal and private repositories"*, so a public host is callable from
everywhere, private callers included.

**Two jobs, two very different questions.**

- `secrets` — gitleaks over the **commit range**, not the head commit. Measured
  2026-08-29 with a token added in one commit and reverted in the next:
  `--log-opts="HEAD~1..HEAD"` scans 0 commits and finds nothing; `BASE..HEAD`
  finds it. The head-only form is what a naive gate writes, and the reverted
  secret is still in the history it skipped.
- `deps` — osv-scanner over every tracked lockfile, then **rule 5 rung 2**: is the
  vulnerable package on the production path of a shipped artifact? croft's Android
  scan reports 43 advisories, 19 rated High, and zero of them reach the APK — they
  are all in AGP's `_internal-unified-test-platform-*` configurations. A
  severity-only gate blocks a client release on netty CVEs in the emulator-control
  plugin. The classifier and its tests live in `.github/scripts/`, and **the tests
  run inside the workflow**, in every caller, on every run: most callers have no
  Node toolchain, so a suite only this repo runs is a check the other seventeen
  never invoke.

**Extending, never overriding.** A repo with extra secret allowlists adds
`.gitleaks-extra.toml`; the workflow *appends* it to the workspace baseline. A repo
that publishes nothing from a subtree — frozen spikes, proofs — passes
`advisory-paths`, and findings there are reported without blocking. Neither can
switch a base rule off. Both are load-bearing where used: `discovery` reports 0
blocking findings with its three prefixes and 215 without them.

**Both binaries are checksum-verified** against the release's own SHA file. A
supply-chain gate that installs an unverified binary is not one.

## Auditing another repo against this

- [ ] `on:` includes `pull_request`
- [ ] the publish job has `needs:` on the gate
- [ ] the publish job has `if: github.ref == 'refs/heads/main'`
- [ ] `concurrency` cannot let a PR cancel a production deploy
- [ ] `permissions:` is read-only at workflow level, elevated only where needed
- [ ] one gate command, identical locally and in CI
- [ ] every toolchain the gate uses is pinned in-repo, and resolved explicitly
      rather than off `PATH`
- [ ] the pin is **enforced**, not just declared — `engine-strict=true` (or the
      equivalent) refuses a wrong runtime, and the repo says which version
      manager reads the pin
- [ ] every job has a `timeout-minutes`
- [ ] `workflow_dispatch` is present, and publish steps are conditioned
      `!= 'pull_request'` so a dispatch can actually deploy
- [ ] the shared security workflow is called (rule 9), and the caller sets
      `advisory-paths` if any subtree of the repo ships nothing
- [ ] **read the count, not the tick.** A gate that ran zero tests is green.
      Confirm the log states how much it ran — `Running 418 tests using 2
      workers` → `415 passed` — because a green tick over nothing looks exactly
      like a green tick. This is the cheap daily version of the deliberate-
      violation check below; do both.

Reference implementations: this repo (`ci.yml`, Node/Playwright) and
`fun` (`deploy.yml`, Node + Rust — see its `rust-toolchain.toml` and
`tools/rust-gate.sh` for the pinning half).

## Budgeting a browser suite, honestly

Two numbers to have before you argue about whether e2e belongs in CI, both
measured in `fun` on 2026-08-07:

- **A runner gives Playwright 2 workers; a laptop gives 7.** The same 418 tests
  take ~55s locally and **4.5 minutes** on CI. Predicting from local wall-clock
  understates it by roughly 5×, which is how "this will be free" was wrong.
- **Parallel jobs help, but only up to the longest one.** Splitting e2e into its
  own job next to the unit gate took the run from 5.3 → 6.2 minutes rather than
  leaving it flat, because e2e then *became* the longest job. Free would have
  required it to finish inside the job it runs beside.

Neither is a reason to leave the browser suite out. `fun` ran 418 e2e tests —
every game's wiring test, axe in both themes, every share-link round-trip — on
whichever machine the author happened to use, while its checklist claimed they
gated. The claim and the workflow disagreed, and people trust the workflow.

**Budget its fragility too, not just its minutes.** A browser suite is the part of
a gate that reaches furthest outside your repo: browser binaries, and the system
libraries they need. Cache what you can and bound what you cannot.

- **The browser binaries cache cleanly.** `actions/cache` on
  `~/.cache/ms-playwright`, keyed on `package-lock.json`, with
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` on the `npm ci` so the install does not
  happen twice. That is ~300MB that changes only when Playwright's version does.
- **The system libraries do not.** `--with-deps` shells out to apt on a fresh
  runner every time, and nothing you cache in the Playwright directory changes
  that. It is seconds when the mirror is healthy and unbounded when it is not —
  see rule 7's incident, where it stalled 4.5 minutes and took a whole run with
  it. Wrap each attempt in `timeout` and retry it.

Worth being precise about which half is which: it is easy to look at a stalled
`playwright install` and conclude the browsers are not cached, when they are and
the apt call underneath is the uncacheable part.

### When the suite outgrows the runner: shard it, and build once

Measured in `fun` on 2026-08-29, the day its browser suite started failing cheap,
unrelated tests on `page.goto` timeouts — the leg saturating, not any test being
wrong. Two facts decided the remedy:

- **A job's fixed cost is most of a job.** On the last green run the mobile-WebKit job
  spent ~25 s on checkout and toolchains, **110 s** downloading the browser, and then
  279 s on tests — and one to two minutes of that "test" step was Playwright's
  `webServer` building every crate's wasm before the first test ran. Sharding a suite
  without moving the build pays that build per shard: three shards would have saved
  about two of seven minutes and tripled the runner minutes.
- **Playwright's `--shard=i/n` splits the ordered test list into contiguous chunks**, so
  a shard is a run of files in alphabetical order. Measure the chunks before choosing
  `n` (`--shard=i/n --list`, joined to per-test durations); `fun`'s three came out
  79 s / 54 s / 34 s on the slow engine — lopsided, and every one far under the old leg.

The shape that came out: a `wasm` job builds the modules once and uploads them; the
shards (`project × shard`, `fail-fast: false`, the job name carrying both) download
them and tell the `webServer` to skip the build. **Make the missing artifact fatal**
under CI — `fun`'s `build.mjs` only *noted* a missing module, which locally is right
(a developer on one game need not build the others) and on a shard is a shelf with
no engines passing whatever it can. That is the "green over nothing" shape this doc
keeps meeting.

Two things it is not. It is not a longer per-test timeout — `fun`'s workflow records
why: a timeout raised to fix the symptom buried a real hang. And it is not a separate
smoke *job*: a quick `@smoke` subset is worth having as a **command** for the human
(`npm run smoke`, one engine, every wiring test and the a11y matrix, about a minute),
but a smoke job that passes beside a failing shard is a green tick that means less
than what is next to it.

And the per-test convention that came with it: **a browser test over ~20 s is a
smell**, and the fix is a seam, not a timeout. A test that plays a game asserts rules
and wiring, not pacing; `fun`'s games read `?fast=1` and collapse the engine's beats
to a frame, and a full-game test went from 72 s per engine to 5 s.
