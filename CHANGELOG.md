# Changelog — croft-pwa

What changed for a reader of the site and for the repos that treat it as the reference
(`docs/CI.md`, `docs/WEB-TESTING.md`, `docs/ACCESSIBILITY.md`, `docs/MOBILE-FIRST.md` are
canonical for the workspace). It deploys from `main` (Pages), so landing *is* releasing:
sections are months, each entry dated by its landing. Per `CroftC/.claude/CHANGELOGS.md`,
the branch that changes something a consumer runs adds its entry here before it lands.
Started 2026-08-29; earlier history is in `git log`.

## 2026-08

- 2026-08-30 Sign in at **Bluesky** from the sheet works. The Bluesky row failed with
  "protected-resource failed: 404": `bsky.social` is an entryway — the sign-in server for a
  fleet of data servers — and does not publish the document a single-host provider (Blacksky,
  EuroSky, Northsky) does. Discovery now reads the entryway as the sign-in server when that
  document is missing, the order the reference atproto client uses. This file is the
  reference `fun` ported; fun carries the same fix (fun#78). (signin-entryway)

- 2026-08-29 The atproto page signs in through the workspace **sign-in sheet**: "Choose
  your atmo provider" — Bluesky, Blacksky and EuroSky with Create account + Sign in,
  Northsky (invite only) and a handle field behind **Another provider**. A provider tap
  starts OAuth at that server with no handle; the DID comes from the token. The CSP now
  admits each registered provider. `docs/DESIGN.md` grew into the design standard
  (foundations · components · flows · copy) with this flow as its first pattern.
- 2026-08-29 The dependency gate decides **inbound licences** as well as CVEs, from one
  osv-scanner run and one rung-2 verdict: a licence term attaches on distribution, so
  "does this reach a shipped artifact" answers both. All 40 licence violations here are
  unshipped — the LGPL-2.1 `jna` sits in the test harness while the `jna` that ships
  reports a compatible licence — so no per-package exception was needed anywhere. The
  allowlist is a constant in `dep_gate.py`, not a caller input: one outbound licence
  means one inbound list. Callers get this without editing a line.
- 2026-08-29 The gate no longer reports "could not run" against a lockfile that
  legitimately has no dependencies. osv-scanner exits 128 for "no package sources
  found" and 127 for a rejected argument, both with empty stdout; treating every
  non-zero code as broken conflated them.
- 2026-08-29 The dependency gate reads `requirements.txt` too. It did not, and
  discovery's one pinned Python build dependency was going unscanned — it carried
  GHSA-5wmx-573v-2qwq (CVSS 7.5). An ecosystem nobody scans is not a clean one.
- 2026-08-29 `docs/CI.md` rule 9 — the shared security workflow, and the dependency
  gate beside the secret one. The gate applies SUPPLY-CHAIN rule 5 rung 2 rather than
  a severity threshold: croft's Android scan reports 43 advisories, 19 High, and none
  of them reach the APK. Both scanner binaries are now checksum-verified.
- 2026-08-29 `.github/workflows/security-reusable.yml` — the workspace secret-scanning
  gate every repo calls. It scans the PR's commit range, not its head commit, because
  a secret added and reverted inside one PR is invisible to the head-only form.
- 2026-08-29 Relicensed MIT → AGPL-3.0, matching the rest of the workspace (owner decision).
- 2026-08-29 Accessibility requirement 4: an axe exclusion must match something — a scope
  that matches nothing is a scan that silently grades a different page.
- 2026-08-29 The `ing.croft.croftpwa.*` lexicon register (workspace LEXICONS dimension).
- 2026-08-28 `docs/PWA-INSTALL.md` — what an installed PWA does between the tap and the
  first frame; the splash you control is a page, not a manifest field.
- 2026-08-26 The tap-target floor is 44px (WCAG 2.5.5), and a `scrollWidth` overflow check
  is recorded as unsound under `overflow-x: clip` — measure element geometry instead.
