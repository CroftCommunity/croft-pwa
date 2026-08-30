"""Tests for the dependency gate's classifier.

These run as a STEP OF THE REUSABLE WORKFLOW, not in croft-pwa's vitest suite, and
that placement is deliberate. The classifier ships to 17 caller repos, most of which
have no Node toolchain at all; a test suite that only croft-pwa runs is a check the
callers never invoke (VERIFICATION.md, "a check nothing invokes"). Running them at
the top of every gate job means a broken classifier fails loudly on every PR in every
repo instead of quietly waving findings through.
"""

import unittest

from dep_gate import (
    cargo_source_for,
    classify,
    gradle_configs_for,
    is_first_party,
    is_lockfile,
    nearest_config,
    normalise_licence,
    scan_outcome,
    unresolved_licences,
)


def npm(dependency_groups):
    return classify(
        ecosystem="npm", name="vite", version="5.4.21",
        lockfile="package-lock.json", dependency_groups=dependency_groups,
        advisory_paths=[],
    )


class NpmRung2(unittest.TestCase):
    """osv-scanner DOES report dependency groups for npm — measured 2026-08-29."""

    def test_dev_only_is_noted_not_blocked(self):
        v = npm(["dev"])
        self.assertEqual(v.verdict, "note")
        self.assertEqual(v.rung, "not-production")

    def test_no_group_is_a_plain_production_dependency(self):
        self.assertEqual(npm(None).verdict, "block")
        self.assertEqual(npm([]).verdict, "block")

    def test_dev_and_something_else_blocks_because_the_something_else_ships(self):
        self.assertEqual(npm(["dev", "optional"]).verdict, "block")


GRADLE_LOCK = "\n".join([
    "# This is a Gradle generated file for dependency locking.",
    "io.netty:netty-handler:4.1.93.Final=_internal-unified-test-platform-android-test-plugin-host-emulator-control,_internal-unified-test-platform-android-test-plugin-host-retention",
    "org.bouncycastle:bcprov-jdk18on:1.78.1=debugUnitTestRuntimeClasspath,releaseUnitTestRuntimeClasspath",
    "androidx.core:core-ktx:1.13.1=debugRuntimeClasspath,releaseRuntimeClasspath,debugCompileClasspath",
    "com.example:only-instrumented:1.0.0=debugAndroidTestRuntimeClasspath",
    "com.example:only-compile:1.0.0=releaseCompileClasspath",
    "empty:configs:1.0.0=",
])


class GradleRung2(unittest.TestCase):
    """osv-scanner reports NO groups for Maven — dependency_groups is null for every
    package in croft/android/app/gradle.lockfile (measured 2026-08-29). The
    configuration list lives to the right of the `=` in the lockfile itself, so the
    gate reads the lockfile rather than the scan output."""

    def gradle(self, name, version):
        return classify(
            ecosystem="Maven", name=name, version=version,
            lockfile="android/app/gradle.lockfile", dependency_groups=None,
            advisory_paths=[],
            gradle_configs=gradle_configs_for(GRADLE_LOCK, name, version),
        )

    def test_reads_the_configuration_list_off_the_lockfile_line(self):
        self.assertEqual(
            gradle_configs_for(GRADLE_LOCK, "io.netty:netty-handler", "4.1.93.Final"),
            ["_internal-unified-test-platform-android-test-plugin-host-emulator-control",
             "_internal-unified-test-platform-android-test-plugin-host-retention"],
        )

    def test_agp_test_platform_plugins_are_the_build_harness_not_the_apk(self):
        self.assertEqual(self.gradle("io.netty:netty-handler", "4.1.93.Final").verdict, "note")

    def test_unit_test_only_dependency_is_noted(self):
        self.assertEqual(self.gradle("org.bouncycastle:bcprov-jdk18on", "1.78.1").verdict, "note")

    def test_a_shipped_runtime_classpath_blocks(self):
        self.assertEqual(self.gradle("androidx.core:core-ktx", "1.13.1").verdict, "block")

    def test_debug_android_test_runtime_classpath_is_not_debug_runtime_classpath(self):
        # The substring trap: an unanchored match on "RuntimeClasspath" would block
        # every instrumented-test dependency in the tree.
        self.assertEqual(self.gradle("com.example:only-instrumented", "1.0.0").verdict, "note")

    def test_compile_only_is_noted_because_a_compile_classpath_is_not_packaged(self):
        self.assertEqual(self.gradle("com.example:only-compile", "1.0.0").verdict, "note")

    def test_absent_from_the_lockfile_blocks_rather_than_passing(self):
        # A classifier that cannot find its evidence must not read that as "clean".
        v = self.gradle("com.example:absent", "9.9.9")
        self.assertEqual(v.verdict, "block")
        self.assertIn("no configuration list", v.why)

    def test_an_empty_configuration_list_is_absent_evidence_too(self):
        self.assertEqual(self.gradle("empty:configs", "1.0.0").verdict, "block")

    def test_version_must_match_not_merely_the_name(self):
        self.assertEqual(gradle_configs_for(GRADLE_LOCK, "androidx.core:core-ktx", "1.0.0"), [])


class WhatCountsAsALockfile(unittest.TestCase):
    """The set of filenames the gate enumerates IS the scope of the gate, so it gets
    tests of its own. requirements.txt was missing from the first version, and
    discovery's `site/requirements.txt` — one pinned line, `markdown==3.7` — went
    unscanned. It carried GHSA-5wmx-573v-2qwq (CVSS 7.5, fixed in 3.8.1). An
    ecosystem nobody scans is not a clean one (SUPPLY-CHAIN.md rule 6)."""

    def test_the_lockfiles_this_workspace_actually_has(self):
        for p in ("Cargo.lock", "a/b/package-lock.json", "telemetry/uv.lock",
                  "android/app/gradle.lockfile", "site/requirements.txt", "go.sum"):
            self.assertTrue(is_lockfile(p), p)

    def test_a_manifest_is_not_a_lockfile(self):
        for p in ("Cargo.toml", "package.json", "pyproject.toml", "build.gradle.kts"):
            self.assertFalse(is_lockfile(p), p)

    def test_it_matches_the_basename_not_a_substring(self):
        # `my-requirements.txt.bak` and `notes-about-Cargo.lock.md` are not lockfiles.
        for p in ("docs/my-requirements.txt.bak", "notes-about-Cargo.lock.md",
                  "requirements.txt.orig"):
            self.assertFalse(is_lockfile(p), p)


class PyPIRung2(unittest.TestCase):
    def test_pypi_blocks_because_requirements_txt_records_no_distinction(self):
        v = classify(
            ecosystem="PyPI", name="markdown", version="3.7.0",
            lockfile="site/requirements.txt", dependency_groups=None, advisory_paths=[],
        )
        self.assertEqual(v.verdict, "block")


class CargoRung2(unittest.TestCase):
    def test_cargo_blocks_because_the_lockfile_records_no_distinction(self):
        v = classify(
            ecosystem="crates.io", name="h2", version="0.4.11",
            lockfile="Cargo.lock", dependency_groups=None, advisory_paths=[],
        )
        self.assertEqual(v.verdict, "block")
        self.assertIn("Cargo.lock", v.why)


class DeclaredAdvisoryPaths(unittest.TestCase):
    PATHS = ["alpha/Proofs/", "alpha/experiments/"]

    def test_a_finding_under_a_declared_path_is_noted(self):
        v = classify(
            ecosystem="crates.io", name="h2", version="0.4.11",
            lockfile="alpha/experiments/iroh/Cargo.lock",
            dependency_groups=None, advisory_paths=self.PATHS,
        )
        self.assertEqual(v.verdict, "note")
        self.assertIn("alpha/experiments/", v.why)

    def test_a_lockfile_outside_those_paths_still_blocks(self):
        v = classify(
            ecosystem="crates.io", name="h2", version="0.4.11",
            lockfile="site/Cargo.lock",
            dependency_groups=None, advisory_paths=self.PATHS,
        )
        self.assertEqual(v.verdict, "block")

    def test_the_prefix_must_end_at_a_path_boundary(self):
        # "alpha/experiments/" must not match "alpha/experiments-live/".
        v = classify(
            ecosystem="crates.io", name="h2", version="0.4.11",
            lockfile="alpha/experiments-live/Cargo.lock",
            dependency_groups=None, advisory_paths=self.PATHS,
        )
        self.assertEqual(v.verdict, "block")


class NearestConfig(unittest.TestCase):
    """Measured 2026-08-29: osv-scanner discovers an osv-scanner.toml in the
    lockfile's OWN directory and does NOT walk up, so croft/osv-scanner.toml never
    applied to croft/android/app/gradle.lockfile and its 43 advisories arrived
    unfiltered. The gate resolves the config itself and passes it with --config."""

    PRESENT = {"osv-scanner.toml", "relay/source/osv-scanner.toml"}

    def exists(self, p):
        return p in self.PRESENT

    def test_walks_up_from_the_lockfile_directory_to_the_repo_root(self):
        self.assertEqual(nearest_config("android/app/gradle.lockfile", self.exists), "osv-scanner.toml")

    def test_prefers_the_nearest_config_over_the_root_one(self):
        self.assertEqual(nearest_config("relay/source/Cargo.lock", self.exists), "relay/source/osv-scanner.toml")

    def test_returns_none_when_no_config_applies_rather_than_escaping_the_repo(self):
        self.assertIsNone(nearest_config("a/b/Cargo.lock", lambda p: False))




# ---------------------------------------------------------------------------
# Phase 3 — licences (SUPPLY-CHAIN.md rule 7)
# ---------------------------------------------------------------------------

class DeprecatedOrLaterSuffix(unittest.TestCase):
    """SPDX's `+` suffix means "or later". osv-scanner 2.3.5 REPORTS it and REFUSES it:
    deps.dev returns `MPL-2.0+` for the `im` crate family, while `--licenses=...,MPL-2.0+`
    is rejected with "not recognized as spdx: MPL-2.0+" — and on that rejection the
    scanner writes to stderr, emits NO JSON and exits 0. The two halves of one tool
    disagree about what SPDX is, so the gate bridges them rather than the allowlist."""

    def test_plus_suffix_normalises_to_its_base_identifier(self):
        self.assertEqual(normalise_licence("MPL-2.0+"), "MPL-2.0")
        self.assertEqual(normalise_licence("LGPL-2.1+"), "LGPL-2.1")

    def test_a_bare_identifier_is_unchanged(self):
        self.assertEqual(normalise_licence("MPL-2.0"), "MPL-2.0")
        self.assertEqual(normalise_licence("Apache-2.0 OR MIT"), "Apache-2.0 OR MIT")

    def test_normalising_does_not_admit_a_licence_that_is_denied_anyway(self):
        # `+` widens the version, never the licence family.
        self.assertEqual(unresolved_licences(["GPL-3.0+"], {"MPL-2.0"}, first_party=False),
                         ["GPL-3.0+"])

    def test_a_lone_plus_is_not_stripped_into_an_empty_identifier(self):
        self.assertEqual(normalise_licence("+"), "+")


CARGO_LOCK = "\n".join([
    'version = 3',
    '',
    '[[package]]',
    'name = "croft-ffi"',
    'version = "0.0.0"',
    '',
    '[[package]]',
    'name = "ciss"',
    'version = "0.8.0"',
    'source = "git+https://github.com/CroftCommunity/CISS.git?rev=2d1e685#2d1e685"',
    '',
    '[[package]]',
    'name = "social-tree-core"',
    'version = "0.1.0"',
    'source = "git+ssh://git@github-personal/CroftCommunity/croft.git?rev=9f7d0c6#9f7d0c6"',
    '',
    '[[package]]',
    'name = "aead"',
    'version = "0.5.2"',
    'source = "registry+https://github.com/rust-lang/crates.io-index"',
])


class FirstPartyProvenance(unittest.TestCase):
    """`UNKNOWN` is resolved BY NAME, never blanket-ignored (rule 7). Measured
    2026-08-29 across all 18 repos: 230 packages report UNKNOWN, and 229 of them are
    our own code — 221 workspace members with no `source` at all, and 8 pinned by git
    to CroftCommunity. The one remainder (`khroma`, npm) is a third-party package and
    must NOT be resolved this way. Provenance is the discriminator that separates them
    without a 143-name list nobody would maintain."""

    def test_a_workspace_member_has_no_source_and_is_first_party(self):
        self.assertIsNone(cargo_source_for(CARGO_LOCK, "croft-ffi", "0.0.0"))
        self.assertTrue(is_first_party(None, org="CroftCommunity"))

    def test_a_git_pin_on_our_own_org_is_first_party_over_https_and_ssh(self):
        self.assertTrue(is_first_party(cargo_source_for(CARGO_LOCK, "ciss", "0.8.0"),
                                       org="CroftCommunity"))
        self.assertTrue(is_first_party(cargo_source_for(CARGO_LOCK, "social-tree-core", "0.1.0"),
                                       org="CroftCommunity"))

    def test_a_registry_crate_is_third_party(self):
        self.assertFalse(is_first_party(cargo_source_for(CARGO_LOCK, "aead", "0.5.2"),
                                        org="CroftCommunity"))

    def test_another_orgs_repo_is_third_party_even_on_the_same_host(self):
        self.assertFalse(is_first_party("git+https://github.com/someone-else/x.git?rev=a#a",
                                        org="CroftCommunity"))

    def test_the_org_name_must_be_a_path_SEGMENT_not_a_substring(self):
        # Found by mutation testing: relaxing `/{org}/` to a bare `in` check survived
        # the suite. A fork or typosquat whose REPOSITORY is named CroftCommunity —
        # github.com/someone-else/CroftCommunity — would then be laundered into
        # first-party and have its UNKNOWN licence waved through.
        self.assertFalse(
            is_first_party("git+https://github.com/someone-else/CroftCommunity.git?rev=a#a",
                           org="CroftCommunity"))
        self.assertFalse(
            is_first_party("git+https://github.com/CroftCommunity-mirror/x.git?rev=a#a",
                           org="CroftCommunity"))

    def test_an_absent_package_yields_no_source_rather_than_raising(self):
        self.assertIsNone(cargo_source_for(CARGO_LOCK, "not-here", "9.9.9"))

    def test_a_version_mismatch_is_not_a_match(self):
        # Two versions of one crate can differ in provenance; the pair is the key.
        self.assertIsNone(cargo_source_for(CARGO_LOCK, "aead", "0.4.0"))


class UnresolvedLicences(unittest.TestCase):
    """What survives the gate's own two resolutions and therefore reaches rung 2."""

    def test_an_allowlisted_licence_reported_with_a_plus_is_resolved(self):
        self.assertEqual(unresolved_licences(["MPL-2.0+"], {"MPL-2.0"}, first_party=False), [])

    def test_unknown_on_our_own_code_is_resolved_by_provenance(self):
        self.assertEqual(unresolved_licences(["UNKNOWN"], {"MIT"}, first_party=True), [])

    def test_unknown_on_a_third_party_package_survives(self):
        self.assertEqual(unresolved_licences(["UNKNOWN"], {"MIT"}, first_party=False), ["UNKNOWN"])

    def test_provenance_does_not_launder_a_real_licence(self):
        # First-party resolves IGNORANCE about our own code, not a stated denial.
        self.assertEqual(unresolved_licences(["SSPL-1.0"], {"MIT"}, first_party=True), ["SSPL-1.0"])

    def test_non_standard_is_never_resolved_by_provenance(self):
        # `non-standard` is deps.dev saying a THIRD-party POM had an unparseable
        # licence string; it is not the absence-of-a-record that UNKNOWN is.
        self.assertEqual(unresolved_licences(["non-standard"], {"MIT"}, first_party=True),
                         ["non-standard"])

    def test_several_violations_are_all_reported(self):
        self.assertEqual(unresolved_licences(["EPL-2.0", "MPL-2.0+", "SSPL-1.0"],
                                             {"MPL-2.0"}, first_party=False),
                         ["EPL-2.0", "SSPL-1.0"])


class LicenceMeetsRungTwo(unittest.TestCase):
    """A licence obligation attaches to DISTRIBUTION, so the same rung-2 question the
    vulnerability half asks answers the licence half too — and it is load-bearing.
    Measured on croft/android 2026-08-29: every one of the 38 Maven licence violations,
    the LGPL-2.1 JNA included, sits in a test-only configuration; the JNA that actually
    ships is 5.14.0, which reports a compatible licence. Without rung 2 the licence
    gate blocks a client release on the licence of the emulator-control plugin — the
    same failure rule 4 was written to prevent for CVEs."""

    def test_the_unshipped_lgpl_jna_is_noted_not_blocked(self):
        v = classify(
            ecosystem="Maven", name="net.java.dev.jna:jna", version="5.6.0",
            lockfile="android/app/gradle.lockfile", dependency_groups=None,
            advisory_paths=[],
            gradle_configs=["_internal-unified-test-platform-android-test-plugin-host-retention"],
        )
        self.assertEqual(v.verdict, "note")

    def test_the_same_licence_on_a_shipped_configuration_blocks(self):
        v = classify(
            ecosystem="Maven", name="net.java.dev.jna:jna", version="5.6.0",
            lockfile="android/app/gradle.lockfile", dependency_groups=None,
            advisory_paths=[], gradle_configs=["releaseRuntimeClasspath"],
        )
        self.assertEqual(v.verdict, "block")

    def test_a_dev_only_npm_licence_is_noted(self):
        # elkjs (EPL-2.0) and khroma (UNKNOWN) both reach discovery only through
        # @mermaid-js/mermaid-cli, a build-time devDependency — measured 2026-08-29.
        self.assertEqual(npm(["dev"]).verdict, "note")


class ScanOutcome(unittest.TestCase):
    """osv-scanner 2.3.5 distinguishes "nothing to scan" from "I refused to run", and
    the gate must too — measured 2026-08-29, all four codes on real invocations:

        0    clean            1    vulnerabilities found
        127  usage error      — e.g. `--licenses` handed a non-SPDX identifier
        128  no package sources found — every lockfile passed held zero packages

    Both 127 and 128 emit an EMPTY stdout, so the JSON is no help; only the exit code
    separates them. Collapsing them (as "anything but 0 or 1 is a failure" does) breaks
    a repo whose lockfile is legitimately empty — found by running the GREEN half of
    the licence validation, where removing the offending dependency left a valid
    lockfile with no packages and the gate reported "could not run"."""

    def test_clean_and_vulnerable_are_both_successful_runs(self):
        self.assertEqual(scan_outcome(0), "ok")
        self.assertEqual(scan_outcome(1), "ok")

    def test_no_package_sources_is_empty_not_broken(self):
        self.assertEqual(scan_outcome(128), "empty")

    def test_a_usage_error_is_a_gate_failure(self):
        self.assertEqual(scan_outcome(127), "failed")

    def test_an_unrecognised_code_fails_closed(self):
        self.assertEqual(scan_outcome(2), "failed")
        self.assertEqual(scan_outcome(-9), "failed")


class AdvisoryPathsCannotSilenceTheWholeGate(unittest.TestCase):
    """`advisory-paths` is CALLER-declared and unbounded, which is the widest trust
    boundary this gate has: a repo states which of its own subtrees ship nothing, and the
    gate believes it. Found by the Phase 6 authored-code pass over the rollout plan
    (SUPPLY-CHAIN.md rule 11) — the question "what stops a caller declaring everything
    unshipped?" had no recorded answer.

    It turns out there IS a limit, and it was accidental rather than designed: the match
    is a DIRECTORY prefix, formed by appending "/" to the declared path. A lockfile at the
    repo root has no directory component, so no declared prefix can ever cover it. The
    root manifest — the one that describes what the repo actually ships — is therefore
    unsilenceable, while a nested subtree can be declared away, which is exactly the split
    the input is for.

    Written down and pinned here because an invariant nobody has stated is one a later
    refactor removes without noticing. The residual risk is real and accepted: a caller
    CAN silence a nested lockfile it should not. That is visible in the caller's own
    tracked file and reviewed like any other change.
    """

    def root(self, *advisory_paths):
        return classify(
            ecosystem="npm", name="vite", version="5.4.21",
            lockfile="package-lock.json", dependency_groups=None,
            advisory_paths=list(advisory_paths),
        )

    def test_no_declared_path_can_silence_a_root_lockfile(self):
        for p in ("", ".", "/", "./", "*", "src", "package-lock.json", "package-lock.json/"):
            self.assertEqual(self.root(p).verdict, "block", f"advisory-path={p!r}")

    def test_nor_can_several_of_them_together(self):
        self.assertEqual(self.root(".", "/", "*", "").verdict, "block")

    def test_a_nested_lockfile_is_still_declarable_which_is_the_point(self):
        v = classify(
            ecosystem="npm", name="vite", version="5.4.21",
            lockfile="alpha/experiments/thing/package-lock.json", dependency_groups=None,
            advisory_paths=["alpha/experiments/"],
        )
        self.assertEqual(v.verdict, "note")

    def test_a_prefix_must_end_at_a_directory_boundary(self):
        # "alpha/exp" must not swallow "alpha/experiments/..." — a declared path is a
        # directory, not a string prefix, or one declaration silences its siblings.
        v = classify(
            ecosystem="npm", name="vite", version="5.4.21",
            lockfile="alpha/experiments/thing/package-lock.json", dependency_groups=None,
            advisory_paths=["alpha/exp"],
        )
        self.assertEqual(v.verdict, "block")


class TheSuiteRunsWhicheverWayItIsInvoked(unittest.TestCase):
    """`python3 test_dep_gate.py` and `python3 -m unittest test_dep_gate` must run the
    SAME tests, and on 2026-08-29 they did not.

    `unittest.main()` collects the TestCases defined at the moment it executes, so 24
    tests appended below it were invisible to the script form while the module form
    saw all 47. The workflow runs the script form. The tests were written, watched
    fail, watched pass — and then never ran in CI, which is the exact failure this
    file's own docstring is about, one level up.

    The workflow now uses the module form, which imports before it collects and so
    cannot be fooled by ordering. This test is the belt: it fails if any TestCase is
    ever again defined after the `__main__` guard, whichever form is used to run it.
    """

    def test_no_test_case_is_defined_below_the_main_guard(self):
        import re as _re
        with open(__file__, encoding="utf-8") as fh:
            source = fh.read()
        guard = source.find('if __name__ == "__main__":')
        if guard == -1:
            return  # no guard, no ordering hazard
        below = source[guard:]
        stragglers = _re.findall(r"^class (\w+)\(unittest\.TestCase\)", below, _re.M)
        self.assertEqual(
            stragglers, [],
            "these TestCases are defined after the __main__ guard and will not run "
            f"under `python3 {__file__.split('/')[-1]}`: {stragglers}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
