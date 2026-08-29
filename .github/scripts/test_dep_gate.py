"""Tests for the dependency gate's classifier.

These run as a STEP OF THE REUSABLE WORKFLOW, not in croft-pwa's vitest suite, and
that placement is deliberate. The classifier ships to 17 caller repos, most of which
have no Node toolchain at all; a test suite that only croft-pwa runs is a check the
callers never invoke (VERIFICATION.md, "a check nothing invokes"). Running them at
the top of every gate job means a broken classifier fails loudly on every PR in every
repo instead of quietly waving findings through.
"""

import unittest

from dep_gate import classify, gradle_configs_for, nearest_config


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


if __name__ == "__main__":
    unittest.main(verbosity=2)
