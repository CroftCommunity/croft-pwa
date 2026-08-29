#!/usr/bin/env python3
"""The workspace dependency gate.

Rule and why: CroftC/.claude/SUPPLY-CHAIN.md rules 3, 5 and 9. Rollout Phase 2 of
discovery/alpha/plans/2026-08-29-plan-supply-chain-rollout.md.

WHAT THIS ADDS OVER `osv-scanner; echo $?`. Three things, each one a measured failure
of the naive form:

1. **It applies rule 5 rung 2 — "is it in the production path of a SHIPPED ARTIFACT".**
   croft's Android scan reports 43 advisories, 19 of them rated High, and ZERO of them
   reach the APK: every one sits in an AGP `_internal-unified-test-platform-*`
   configuration or a unit-test classpath. A severity-only gate blocks a client release
   on netty CVEs in the emulator-control plugin. Rungs 1, 3 and 4 (not-compiled,
   wrong-target, dead-function) are per-advisory judgements and stay in each repo's
   osv-scanner.toml, where they are dated and expire; rung 2 is the one rung a machine
   can decide from the lockfile, so it is the one mechanised here.

2. **It resolves the exceptions file itself.** Measured 2026-08-29: osv-scanner
   discovers `osv-scanner.toml` in the lockfile's OWN directory and does not walk up.
   `croft/osv-scanner.toml` therefore never applied to
   `croft/android/app/gradle.lockfile`. This gate walks up to the repo root and passes
   the nearest config explicitly with --config.

3. **It refuses to grade an empty set.** Measured 2026-08-29 on osv-scanner 2.3.5:
   `osv-scanner scan source -r .` walks `/`, visits one inode and reports "No package
   sources found" — a directory scan that finds nothing at all. Add
   `--allow-no-lockfiles` to that and you have a green gate that scanned zero files.
   This gate enumerates lockfiles from `git ls-files` and fails if a repo with a
   dependency manifest yields none.

Exit codes: 0 = no blocking findings; 1 = at least one blocking finding; 2 = the gate
itself could not run (no lockfiles, scanner failure, unparseable output).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass

# The scope of the gate IS this tuple, so it is tested rather than assumed.
# requirements.txt is here despite being a manifest rather than a true lockfile: it is
# the only thing standing between discovery's `site/` build dependency and no scanning
# at all, and an unscannable ecosystem is not a clean one (SUPPLY-CHAIN.md rule 6). An
# unpinned entry in one weakens the resolution, which is a finding about the file, not
# a reason to leave the file unread.
LOCKFILE_NAMES = (
    "Cargo.lock",
    "package-lock.json",
    "uv.lock",
    "poetry.lock",
    "requirements.txt",
    "gradle.lockfile",
    "go.sum",
)

MANIFEST_NAMES = ("Cargo.toml", "package.json", "pyproject.toml", "go.mod", "build.gradle.kts")

# A Gradle configuration that actually packages code into an installable artifact.
# Anchored on purpose: an unanchored match on "RuntimeClasspath" also matches
# debugAndroidTestRuntimeClasspath and releaseUnitTestRuntimeClasspath, which is how a
# gate ends up blocking a release on the test harness's dependencies.
SHIPPED_GRADLE_CONFIG = re.compile(r"^(debug|release)RuntimeClasspath$")


def is_lockfile(path: str) -> bool:
    """Whether a repo-relative path is one of the lockfiles this gate reads."""
    return os.path.basename(path) in LOCKFILE_NAMES


@dataclass(frozen=True)
class Verdict:
    verdict: str  # "block" | "note"
    rung: str  # "production" | "not-production"
    why: str


def gradle_configs_for(lockfile_text: str, name: str, version: str) -> list[str]:
    """The configurations a Gradle lockfile records for one exact package version.

    Lines are `group:artifact:version=config1,config2,...`; comments start with `#`.
    """
    prefix = f"{name}:{version}="
    for line in lockfile_text.splitlines():
        if line.startswith(prefix):
            rest = line[len(prefix):]
            return [c for c in rest.split(",") if c]
    return []


def nearest_config(lockfile: str, exists) -> str | None:
    """The osv-scanner.toml that governs `lockfile`, searching its directory then each
    parent up to (and including) the repo root. Returns a repo-relative path or None.

    `exists` takes a repo-relative path and returns whether that file is present; it is
    a parameter so this is testable without a filesystem.
    """
    parts = lockfile.split("/")[:-1]
    while True:
        candidate = "/".join(parts + ["osv-scanner.toml"]) if parts else "osv-scanner.toml"
        if exists(candidate):
            return candidate
        if not parts:
            return None
        parts.pop()


def _under_advisory_path(lockfile: str, advisory_paths) -> str | None:
    for p in advisory_paths:
        prefix = p if p.endswith("/") else p + "/"
        if lockfile.startswith(prefix):
            return prefix
    return None


def classify(*, ecosystem, name, version, lockfile, dependency_groups, advisory_paths,
             gradle_configs=None) -> Verdict:
    """Rule 5 rung 2 for one finding: does this package reach a shipped artifact?

    The default on every unknown is `block`. Absent evidence is not evidence of
    absence, and a gate that resolves its own ignorance in the passing direction is
    the failure this whole dimension exists to prevent.
    """
    declared = _under_advisory_path(lockfile, advisory_paths)
    if declared:
        return Verdict("note", "not-production",
                       f"under {declared}, which the caller declares ships nothing")

    if lockfile.endswith("gradle.lockfile"):
        if not gradle_configs:
            return Verdict("block", "production",
                           f"{lockfile} records no configuration list for {name}:{version} "
                           "— the gate could not establish that it is unshipped")
        shipped = [c for c in gradle_configs if SHIPPED_GRADLE_CONFIG.match(c)]
        if shipped:
            return Verdict("block", "production", f"on {', '.join(shipped)}")
        return Verdict("note", "not-production",
                       f"only on build/test configurations ({gradle_configs[0]}"
                       + (f" and {len(gradle_configs) - 1} more" if len(gradle_configs) > 1 else "")
                       + ")")

    if ecosystem == "npm":
        groups = dependency_groups or []
        if groups and all(g == "dev" for g in groups):
            return Verdict("note", "not-production", "npm devDependencies only")
        return Verdict("block", "production",
                       f"npm dependency groups {groups or '[]'} include a shipped path")

    if ecosystem == "crates.io":
        return Verdict("block", "production",
                       "Cargo.lock records no dev/normal distinction, so rung 2 cannot be "
                       "decided mechanically — settle it in osv-scanner.toml with "
                       "`cargo tree -i <crate> --edges normal` per shipped binary")

    if ecosystem == "PyPI":
        return Verdict("block", "production",
                       f"{os.path.basename(lockfile)} records no dev/production distinction, "
                       "so rung 2 cannot be decided mechanically — settle it in "
                       "osv-scanner.toml, or move the dependency into a declared group")

    return Verdict("block", "production",
                   f"ecosystem {ecosystem} has no rung-2 rule in this gate yet")


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def tracked_lockfiles(root: str) -> list[str]:
    out = subprocess.run(["git", "-C", root, "ls-files"], capture_output=True, text=True, check=True)
    return sorted(p for p in out.stdout.splitlines() if is_lockfile(p))


def has_manifest(root: str) -> bool:
    out = subprocess.run(["git", "-C", root, "ls-files"], capture_output=True, text=True, check=True)
    names = set(MANIFEST_NAMES)
    return any(os.path.basename(p) in names for p in out.stdout.splitlines())


def scan(root: str, lockfiles: list[str], config: str | None, scanner: str):
    """One osv-scanner invocation for a group of lockfiles sharing one config."""
    cmd = [scanner, "scan", "source", "--format", "json"]
    if config:
        cmd += ["--config", os.path.join(root, config)]
    for lf in lockfiles:
        cmd += ["-L", os.path.join(root, lf)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    # 0 = clean, 1 = vulnerabilities found. Anything else is the gate failing to run.
    if proc.returncode not in (0, 1):
        sys.stderr.write(f"osv-scanner exited {proc.returncode} for {lockfiles}\n{proc.stderr}\n")
        return None
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        sys.stderr.write(f"osv-scanner produced unparseable output for {lockfiles}\n{proc.stderr}\n")
        return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", default=".")
    ap.add_argument("--scanner", default="osv-scanner")
    ap.add_argument("--advisory-path", action="append", default=[],
                    help="repo-relative prefix whose findings are NOTE, never BLOCK, "
                         "because nothing under it is shipped (spikes, proofs, archives)")
    ap.add_argument("--enforce", action="store_true",
                    help="exit non-zero on blocking findings; without it they are warnings")
    args = ap.parse_args()

    root = os.path.abspath(args.root)
    lockfiles = tracked_lockfiles(root)

    if not lockfiles:
        if has_manifest(root):
            print("::error title=Dependency gate could not run::This repo has a dependency "
                  "manifest but no tracked lockfile, so nothing can be scanned. An "
                  "unscannable ecosystem is not a clean one (SUPPLY-CHAIN.md rule 6). "
                  "Commit a lockfile, or record the exemption.")
            return 2
        print("no dependency manifest and no lockfiles — nothing to scan")
        return 0

    print(f"scanning {len(lockfiles)} tracked lockfile(s)")

    def exists(rel: str) -> bool:
        return os.path.isfile(os.path.join(root, rel))

    groups: dict[str | None, list[str]] = {}
    for lf in lockfiles:
        groups.setdefault(nearest_config(lf, exists), []).append(lf)

    blocks, notes = [], []
    for config, group in sorted(groups.items(), key=lambda kv: (kv[0] or "")):
        print(f"  config {config or '(none)'}: {len(group)} lockfile(s)")
        data = scan(root, group, config, args.scanner)
        if data is None:
            return 2
        for result in data.get("results", []):
            source = os.path.relpath(result["source"]["path"], root)
            for pkg in result.get("packages", []):
                p = pkg["package"]
                ids = sorted({i for g in pkg.get("groups", []) for i in g.get("ids", [])})
                gradle_configs = None
                if source.endswith("gradle.lockfile"):
                    with open(os.path.join(root, source), encoding="utf-8") as fh:
                        gradle_configs = gradle_configs_for(fh.read(), p["name"], p["version"])
                v = classify(
                    ecosystem=p.get("ecosystem", ""), name=p["name"], version=p["version"],
                    lockfile=source, dependency_groups=pkg.get("dependency_groups"),
                    advisory_paths=args.advisory_path, gradle_configs=gradle_configs,
                )
                row = (", ".join(ids), p["name"], p["version"], source, v)
                (blocks if v.verdict == "block" else notes).append(row)

    # Every line names the advisory, the package, the lockfile AND the rung that
    # decided it. A finding suppressed without naming its rung is an exception nobody
    # can re-audit at expiry (SUPPLY-CHAIN.md rule 9).
    for label, rows in (("NOTE", notes), ("BLOCK", blocks)):
        for ids, name, version, source, v in rows:
            print(f"{label}  rung2={v.rung:15s} {ids}  {name} {version}  [{source}]  — {v.why}")

    print(f"\n---- {len(blocks)} blocking, {len(notes)} advisory")

    if blocks:
        first = blocks[0]
        print(f"::error title=Vulnerable dependency on a shipped path::"
              f"{first[0]} in {first[1]} {first[2]} ({first[3]}) — {first[4].why}. "
              f"{len(blocks)} blocking finding(s). Rule: CroftC/.claude/SUPPLY-CHAIN.md "
              f"rule 3. Fix by upgrading, or clear it against rule 5's ladder and record "
              f"a DATED, expiring entry in osv-scanner.toml naming the rung (rule 9). "
              f"Never widen the gate.")
        return 1 if args.enforce else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
