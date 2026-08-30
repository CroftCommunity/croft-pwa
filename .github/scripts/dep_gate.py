#!/usr/bin/env python3
"""The workspace dependency gate — vulnerabilities AND inbound licences.

Rule and why: CroftC/.claude/SUPPLY-CHAIN.md rules 3, 5, 7 and 9. Rollout Phases 2 and
3 of discovery/alpha/plans/2026-08-29-plan-supply-chain-rollout.md.

Both halves come out of ONE osv-scanner invocation and share one verdict, because they
ask the same question. A CVE matters if the vulnerable code ships; a licence term
attaches if the licensed code is DISTRIBUTED. So rule 5's rung 2 — "is this on the
production path of a shipped artifact" — decides both, and the licence half needed no
machinery of its own beyond resolving two things osv-scanner cannot: the deprecated
`+` suffix, and whether an `UNKNOWN` package is our own code (see is_first_party).

Measured 2026-08-29, and the reason the two are not separate gates: every one of the
40 licence violations in this workspace is unshipped. All 38 Maven ones — including
the LGPL-2.1 JNA — sit in `_internal-unified-test-platform-*` or unit-test
configurations, and the JNA that actually ships is a different version reporting a
compatible licence. A licence gate without rung 2 blocks a client release on the
licence of the emulator-control plugin, which is rule 4's failure wearing a hat.

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

NOTE: the licence half needs the network — osv-scanner resolves licences through
deps.dev. The vulnerability half does not. A deps.dev outage therefore surfaces as a
gate failure (exit 2), not as a silent pass.
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

# The one outbound licence is AGPL-3.0 (SUPPLY-CHAIN.md rule 7), so this is the single
# inbound allowlist for every repo. It is DERIVED FROM MEASUREMENT, not from a generic
# "permissive licences" list: every entry below was observed in a lockfile in this
# workspace on 2026-08-29, across 91 lockfiles and ~19k package versions. It grows one
# named package at a time, by PR — a list widened speculatively is a list nobody can
# say no with.
#
# Denials are by omission, and rule 7 names the ones that matter: SSPL, BUSL-1.1,
# Elastic-2.0, CC-BY-NC-*, and GPL-2.0-only — the last being the one routinely missed,
# because GPL-2.0-ONLY cannot upgrade to GPL-3 and so cannot be absorbed by AGPL-3.0.
# For the same reason LGPL-2.1-or-later is allowed while a bare LGPL-2.1 is not.
#
# Two entries are easy to misread:
#   BSL-1.0 is the Boost Software License (permissive) — NOT BUSL-1.1, the Business
#   Source License, which is denied. One character apart, opposite verdicts.
#   AGPL-3.0-* is our OWN outbound licence; blocking it inbound would be a guaranteed
#   false positive with an absurd message. Unexercised today, included on purpose.
#
# SPDX expression semantics are osv-scanner's, and were measured rather than assumed:
# an OR is satisfied by any single arm (178 `Apache-2.0 OR MIT` packages pass an
# allowlist of just `MIT`), an AND requires all of them.
LICENCE_ALLOWLIST = (
    "0BSD", "AGPL-3.0-only", "AGPL-3.0-or-later", "Apache-2.0", "BSD-1-Clause",
    "BSD-2-Clause", "BSD-3-Clause", "BSL-1.0", "BlueOak-1.0.0", "CC-BY-4.0", "CC0-1.0",
    "CDLA-Permissive-2.0", "ISC", "LGPL-2.1-or-later", "MIT", "MIT-0", "MPL-2.0",
    "OFL-1.1", "Python-2.0", "Unicode-3.0", "Unlicense", "Zlib",
)

# The org whose git-pinned crates are this workspace's own code (see is_first_party).
FIRST_PARTY_ORG = "CroftCommunity"

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


def normalise_licence(lic: str) -> str:
    """An SPDX identifier with its deprecated "or later" `+` suffix stripped.

    Measured on osv-scanner 2.3.5, 2026-08-29: deps.dev REPORTS `MPL-2.0+` for the
    `im` crate family, while `--licenses=...,MPL-2.0+` is REFUSED — "not recognized as
    spdx: MPL-2.0+" — and on that refusal the scanner writes to stderr, emits no JSON
    and **exits 0**. The reporter and the allowlist validator of one tool disagree
    about what SPDX is, so the bridge has to live here. `+` widens the version, never
    the licence family, so this can only ever admit a licence already allowlisted.
    """
    return lic[:-1] if len(lic) > 1 and lic.endswith("+") else lic


# osv-scanner's exit codes, measured on 2.3.5 (2026-08-29). 127 and 128 both emit an
# EMPTY stdout, so only the code separates "your lockfiles hold no packages" from "I
# refused the arguments you gave me" — and treating the first as a failure breaks any
# repo that legitimately has no dependencies.
SCANNER_NO_SOURCES = 128


def scan_outcome(returncode: int) -> str:
    """"ok" (results to read), "empty" (nothing to scan), or "failed" (gate cannot run).

    Fails closed: an exit code this gate has not been taught is a failure, never a pass.
    """
    if returncode in (0, 1):
        return "ok"
    if returncode == SCANNER_NO_SOURCES:
        return "empty"
    return "failed"


def cargo_source_for(lockfile_text: str, name: str, version: str) -> str | None:
    """The `source` recorded for one exact package version in a Cargo.lock, or None.

    None means the package has no source line at all, which in Cargo's format is how a
    path/workspace member is written — i.e. it is code from this repo.
    """
    for block in lockfile_text.split("[[package]]"):
        if not re.search(rf'^name = "{re.escape(name)}"$', block, re.M):
            continue
        if not re.search(rf'^version = "{re.escape(version)}"$', block, re.M):
            continue
        m = re.search(r'^source = "([^"]*)"$', block, re.M)
        return m.group(1) if m else None
    return None


def is_first_party(source: str | None, org: str) -> bool:
    """Whether a package is this workspace's own code, and so carries our outbound
    licence rather than an inbound one.

    Two shapes, both measured: a workspace member has no `source` at all, and a
    cross-repo pin carries the org as a path segment in its git URL over either
    transport (`git+https://github.com/<org>/...`, `git+ssh://git@host/<org>/...`).
    Matching the segment rather than the substring keeps `someone-else/CroftCommunity`
    from passing as ours.
    """
    if source is None:
        return True
    return f"/{org}/" in source


def unresolved_licences(violations, allowlist, *, first_party: bool) -> list[str]:
    """The reported licence violations that survive the gate's own two resolutions.

    Order matters and neither step widens the allowlist: the `+` suffix is a string
    form of a licence already allowed, and provenance resolves IGNORANCE about our own
    code (`UNKNOWN` = deps.dev holds no record of an unpublished crate) — never a
    stated licence. `non-standard` is deliberately excluded: that is deps.dev saying a
    THIRD party's POM carried an unparseable string, which is a different fact.
    """
    out = []
    for v in violations:
        if normalise_licence(v) in allowlist:
            continue
        if v == "UNKNOWN" and first_party:
            continue
        out.append(v)
    return out


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


def scan(root: str, lockfiles: list[str], config: str | None, scanner: str, allowlist):
    """One osv-scanner invocation for a group of lockfiles sharing one config."""
    cmd = [scanner, "scan", "source", "--format", "json"]
    # --all-packages is what makes licence data reachable: without it `packages` holds
    # only the vulnerable ones. Measured 2026-08-29 that it does NOT change which
    # vulnerabilities are reported (identical findings on croft/android, both ways), so
    # the vulnerability half of this gate is unaffected by the licence half.
    cmd += ["--licenses=" + ",".join(allowlist), "--all-packages"]
    if config:
        cmd += ["--config", os.path.join(root, config)]
    for lf in lockfiles:
        cmd += ["-L", os.path.join(root, lf)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    outcome = scan_outcome(proc.returncode)
    if outcome == "empty":
        # Every lockfile in this group holds zero packages. Said out loud rather than
        # passed over: an empty lockfile is legitimate for a dependency-free project and
        # is also what a truncated one looks like.
        print(f"    no packages in {', '.join(lockfiles)} — nothing to grade in this group")
        return {"results": []}
    if outcome == "failed":
        sys.stderr.write(
            f"osv-scanner exited {proc.returncode} for {lockfiles}\n{proc.stderr}\n"
            "Exit 127 means it rejected an argument — most often a --licenses entry its "
            "validator does not accept as SPDX, which it reports on stderr while emitting "
            "no JSON and, in some versions, exiting 0.\n")
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
    ap.add_argument("--licence-allowlist", type=lambda v: [x for x in v.split(",") if x],
                    default=list(LICENCE_ALLOWLIST),
                    help="comma-separated SPDX identifiers permitted inbound; defaults to "
                         "the one workspace allowlist (SUPPLY-CHAIN.md rule 7)")
    ap.add_argument("--org", default=FIRST_PARTY_ORG,
                    help="the org whose git-pinned crates count as first-party code")
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

    # Lockfiles are read for rung-2 evidence once each, not once per package: with
    # --all-packages a Gradle lockfile is consulted for every one of its ~245 entries.
    lock_text_cache: dict[str, str] = {}

    def lock_text(rel: str) -> str:
        if rel not in lock_text_cache:
            with open(os.path.join(root, rel), encoding="utf-8") as fh:
                lock_text_cache[rel] = fh.read()
        return lock_text_cache[rel]

    allowlist = set(args.licence_allowlist)
    blocks, notes = [], []
    scanned_packages = 0
    empty_groups = 0
    for config, group in sorted(groups.items(), key=lambda kv: (kv[0] or "")):
        print(f"  config {config or '(none)'}: {len(group)} lockfile(s)")
        data = scan(root, group, config, args.scanner, args.licence_allowlist)
        if data is None:
            return 2
        if not data.get("results"):
            empty_groups += 1
        for result in data.get("results", []):
            source = os.path.relpath(result["source"]["path"], root)
            for pkg in result.get("packages", []):
                scanned_packages += 1
                p = pkg["package"]
                ids = sorted({i for g in pkg.get("groups", []) for i in g.get("ids", [])})

                # A licence violation is resolved against provenance before it is
                # judged: `UNKNOWN` on our own unpublished crate is deps.dev having no
                # record, not an unlicensed dependency (rule 7, "resolved by name").
                unresolved = []
                if pkg.get("license_violations"):
                    first_party = False
                    if source.endswith("Cargo.lock"):
                        first_party = is_first_party(
                            cargo_source_for(lock_text(source), p["name"], p["version"]),
                            org=args.org,
                        )
                    unresolved = unresolved_licences(
                        pkg["license_violations"], allowlist, first_party=first_party
                    )

                if not ids and not unresolved:
                    continue

                gradle_configs = None
                if source.endswith("gradle.lockfile"):
                    gradle_configs = gradle_configs_for(lock_text(source), p["name"], p["version"])
                # One rung-2 answer serves both halves: a licence obligation attaches to
                # DISTRIBUTION, so "does this reach a shipped artifact" is the same
                # question for a CVE and for a copyleft term.
                v = classify(
                    ecosystem=p.get("ecosystem", ""), name=p["name"], version=p["version"],
                    lockfile=source, dependency_groups=pkg.get("dependency_groups"),
                    advisory_paths=args.advisory_path, gradle_configs=gradle_configs,
                )
                dest = blocks if v.verdict == "block" else notes
                if ids:
                    dest.append(("vuln", ", ".join(ids), p["name"], p["version"], source, v))
                if unresolved:
                    dest.append(("licence", "/".join(unresolved), p["name"], p["version"], source, v))

    # A scan that graded nothing is not a clean scan. osv-scanner exits 0 having emitted
    # no JSON at all when --licenses is handed an identifier its validator rejects
    # (measured: "not recognized as spdx: MPL-2.0+"), which is precisely how a gate
    # reports green without running (VERIFICATION.md, "a check that grades an empty set").
    if scanned_packages == 0 and empty_groups == 0:
        print("::error title=Dependency gate graded an empty set::"
              f"{len(lockfiles)} lockfile(s) were passed to osv-scanner and it returned "
              "parseable output containing zero packages, without reporting that it had "
              "nothing to scan. That is a gate reporting green without reading anything "
              "(VERIFICATION.md). Do not silence this — find out what it read.")
        return 2
    print(f"  graded {scanned_packages} package version(s)")

    # Every line names the advisory, the package, the lockfile AND the rung that
    # decided it. A finding suppressed without naming its rung is an exception nobody
    # can re-audit at expiry (SUPPLY-CHAIN.md rule 9).
    for label, rows in (("NOTE", notes), ("BLOCK", blocks)):
        for kind, ids, name, version, source, v in rows:
            print(f"{label}  {kind:7s} rung2={v.rung:15s} {ids}  {name} {version}  "
                  f"[{source}]  — {v.why}")

    print(f"\n---- {len(blocks)} blocking, {len(notes)} advisory")

    if blocks:
        kind, ids, name, version, source, v = blocks[0]
        if kind == "licence":
            # Names the package, its licence string AND the allowlist it violated —
            # "licence violation" alone tells the reader nothing they can act on.
            print(f"::error title=Inbound licence on a shipped path::"
                  f"{name} {version} ({source}) is {ids}, which is not in the workspace "
                  f"inbound allowlist. Outbound licence is AGPL-3.0; the allowlist is "
                  f"LICENCE_ALLOWLIST in dep_gate.py. {len(blocks)} blocking finding(s). "
                  f"Rule: CroftC/.claude/SUPPLY-CHAIN.md rule 7. Fix by replacing the "
                  f"dependency, or — if it does not reach a shipped artifact — by making "
                  f"that true in the build rather than by widening the allowlist.")
        else:
            print(f"::error title=Vulnerable dependency on a shipped path::"
                  f"{ids} in {name} {version} ({source}) — {v.why}. "
                  f"{len(blocks)} blocking finding(s). Rule: CroftC/.claude/SUPPLY-CHAIN.md "
                  f"rule 3. Fix by upgrading, or clear it against rule 5's ladder and record "
                  f"a DATED, expiring entry in osv-scanner.toml naming the rung (rule 9). "
                  f"Never widen the gate.")
        return 1 if args.enforce else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
