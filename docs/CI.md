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

## Auditing another repo against this

- [ ] `on:` includes `pull_request`
- [ ] the publish job has `needs:` on the gate
- [ ] the publish job has `if: github.ref == 'refs/heads/main'`
- [ ] `concurrency` cannot let a PR cancel a production deploy
- [ ] `permissions:` is read-only at workflow level, elevated only where needed
- [ ] one gate command, identical locally and in CI
- [ ] every toolchain the gate uses is pinned in-repo, and resolved explicitly
      rather than off `PATH`

Reference implementations: this repo (`ci.yml`, Node/Playwright) and
`fun` (`deploy.yml`, Node + Rust — see its `rust-toolchain.toml` and
`tools/rust-gate.sh` for the pinning half).
