# RUN-PDS-WALKER-07-SUMMARY — G7: the first release, `pds-walker-v0.1.0`

date: 2026-09-08 · plan: `plans/2026-09-08-plan-pds-walker.md` · phase 6c ·
branches `claude/pds-walker-g7` (the section) and `claude/pds-walker-closeout` (this file) ·
session https://claude.ai/code/session_01HEcsAGKMs6PddtboTFsh1id

## What happened, in order

1. PR #27 landed the `## [pds-walker 0.1.0] — 2026-09-08` section and TODO § 3 ticks on
   `main` as `6005f12` (check 38 NOTEd "section with no tag" for the minutes between).
2. `git tag pds-walker-v0.1.0 6005f12…` and `git push origin pds-walker-v0.1.0`.
3. `release-pds-walker.yml` run **34297765711**: every step `success` — resolve tag ·
   verify tag matches VERSION · setup-node · `npm ci` (ran `prepare`) · Playwright cache +
   chromium · `npm test` (the full gate on the tagged commit) · pack + checksum · create
   release.
4. Release `pds-walker-v0.1.0` with two assets: `pds-walker-v0.1.0.tgz` (28,173 B) and
   `pds-walker-v0.1.0.tgz.sha256` (88 B).

## Verify-in-run ledger

- **Checksum:** the downloaded asset hashes to
  `91008928141a1580a41091e8f24ced97ba6b4124be7025181d2b55c8b0617d34`, equal to the `.sha256`
  asset. The tarball holds `package/lib/**` (the walker tree + `lib/atproto/read.js`),
  `package.json`, `README.md`, `LICENSE` — nothing from `src/`, `tests/` or the site.
- **Consumer install from GitHub at the tagged sha** (the path consumers will use):
  `npm install github:CroftCommunity/croft-pwa#6005f12c7c22f7807d54f587ef8960da1825638c` in
  a scratch directory → 15 s (clone, devDependencies, `prepare`), `node_modules/croft-pwa`
  holds `lib/`, `LICENSE`, `README.md`, `package.json`; `import('croft-pwa/pds-walker')` →
  `0.1.0` with `createWalker`, `createFetchTransport`, `indexedDbStore` all functions; the
  lockfile's `resolved` carries the sha.
- **Finders after the tag** (from the CroftC audit): `changelog-shape.sh` quiet (tag ↔
  section both ways); `shared-code.sh` prints only the registered-copies NOTE, no 47e.
- The dry-tag refusal proof from G1 (`RUN-PDS-WALKER-01-SUMMARY.md`) is the other half of
  this workflow's evidence: it refuses a mismatched tag before any release step runs.

## Files touched

| file | new / changed | phase |
|---|---|---|
| `CHANGELOG.md` | changed (the release section) | 6c (PR #27) |
| `TODO.md` | changed (ticks; the deferred items) | 6c, close-out |
| `plans/2026-09-08-plan-pds-walker.md` | changed (6c shipped; 7/8 deferred; Status CLOSED; close-out) | close-out |
| this file | new | close-out |
