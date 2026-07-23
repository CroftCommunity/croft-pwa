# PR previews

Every open pull request gets a live, throwaway copy of the built site at
`https://croftcommunity.github.io/croft-pwa/pr-preview/pr-<N>/`, removed
automatically when the PR closes. This is the Croft standard preview mechanism,
shared with arecipe and skylite.

## How it works

GitHub Pages serves from a single source, so production and previews share one
**`gh-pages` branch**:

- **Production** deploys to the branch **root** (`ci.yml` → `pages-deploy.sh root dist`).
- **Each preview** deploys to **`pr-preview/pr-N/`** (`preview.yml` → `pages-deploy.sh pr-preview/pr-N dist`).
- A production deploy clears the root **except** `pr-preview/`, so it never wipes
  a live preview; previews touch only their own subdirectory. The two own
  disjoint paths and are serialized by a shared `gh-pages` concurrency group.

The deploy is plain git (`scripts/pages-deploy.sh`) — no third-party action holds
write access. The PR gets one sticky comment with the preview URL, updated in
place.

**Pages source setting:** "Deploy from a branch → `gh-pages` / `root`".

## Why it depends on relative paths

A preview runs from a `/pr-preview/pr-N/` subdirectory. Only because every asset
reference, nav href, the manifest scope, and the service-worker registration are
**relative** does the bundle run there unchanged (see `docs/PRACTICES.md` →
"Relative paths"). The build guard and `tests/e2e/subpath.spec.ts` enforce this,
so a preview can't silently break.

## Agents: the workflow_dispatch path

GitHub does **not** start `pull_request`-triggered workflows for a PR opened by a
bot/app token, so an agent-opened PR won't fire `preview.yml` on its own. Use the
`workflow_dispatch` trigger instead (exempt from that rule), which is live once
`preview.yml` is on `main`:

```
# deploy a preview for PR N
gh workflow run preview.yml -f pr=<N>
# tear it down
gh workflow run preview.yml -f pr=<N> -f teardown=true
```

Confirm by polling the URL until it serves, and remove the preview when the PR
merges or closes if the automatic teardown did not fire.
