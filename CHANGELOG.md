# Changelog — croft-pwa

What changed for a reader of the site and for the repos that treat it as the reference
(`docs/CI.md`, `docs/WEB-TESTING.md`, `docs/ACCESSIBILITY.md`, `docs/MOBILE-FIRST.md` are
canonical for the workspace). It deploys from `main` (Pages), so landing *is* releasing:
sections are months, each entry dated by its landing. Per `CroftC/.claude/CHANGELOGS.md`,
the branch that changes something a consumer runs adds its entry here before it lands.
Started 2026-08-29; earlier history is in `git log`.

## 2026-08

- 2026-08-29 Relicensed MIT → AGPL-3.0, matching the rest of the workspace (owner decision).
- 2026-08-29 Accessibility requirement 4: an axe exclusion must match something — a scope
  that matches nothing is a scan that silently grades a different page.
- 2026-08-29 The `ing.croft.croftpwa.*` lexicon register (workspace LEXICONS dimension).
- 2026-08-28 `docs/PWA-INSTALL.md` — what an installed PWA does between the tap and the
  first frame; the splash you control is a page, not a manifest field.
- 2026-08-26 The tap-target floor is 44px (WCAG 2.5.5), and a `scrollWidth` overflow check
  is recorded as unsound under `overflow-x: clip` — measure element geometry instead.
