"""Hermetic regression tests for scored True Wealth pillar continuity.

The fixtures reproduce the 2026 Sabah/Sarawak incident: Education was scored
in the baseline, then vanished while total scored-indicator volume still looked
healthy.  They intentionally do not use ``git show`` so they remain stable as
the production data refreshes.
"""

import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import detect_resilience_shifts  # noqa: E402
import validate_data  # noqa: E402


FIXTURES = ROOT / "tests" / "fixtures" / "resilience-pillar-loss"


def load_fixture(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class ResiliencePillarGuardrailTests(unittest.TestCase):
    def setUp(self):
        self.previous = load_fixture("previous.json")
        self.lost = load_fixture("education-lost.json")

    def test_known_education_loss_fails_the_hard_gate(self):
        report = validate_data.Report()
        validate_data.check_resilience_pillar_consistency(
            report, self.lost["territories"]
        )
        validate_data.check_no_lost_scored_pillars(
            report, self.lost["territories"], self.previous["territories"]
        )

        self.assertEqual(report.failed, 2)
        self.assertTrue(all("Education" in failure for failure in report.failures))
        self.assertTrue(all("did not lose a scored pillar" in failure for failure in report.failures))

    def test_restoring_education_is_valid_and_does_not_require_imputation(self):
        report = validate_data.Report()
        validate_data.check_resilience_pillar_consistency(
            report, self.previous["territories"]
        )
        validate_data.check_no_lost_scored_pillars(
            report, self.previous["territories"], self.lost["territories"]
        )

        self.assertEqual(report.failed, 0)

    def test_shift_watch_reports_both_lost_pillars(self):
        lines, warnings, notable = detect_resilience_shifts.compare(self.previous, self.lost)
        self.assertEqual(notable, 2)
        self.assertEqual(len(warnings), 2)
        self.assertTrue(all("scored pillar(s) lost" in title for title, _ in warnings))
        self.assertTrue(all("Education" in line for line in lines))

    def test_model_partition_mismatch_fails_even_without_a_baseline(self):
        malformed = load_fixture("education-lost.json")
        malformed["territories"]["Sabah"]["scoredPillars"].append("Education")
        malformed["territories"]["Sabah"]["unscoredPillars"] = []

        report = validate_data.Report()
        validate_data.check_resilience_pillar_consistency(report, malformed["territories"])

        self.assertEqual(report.failed, 1)
        self.assertTrue(any("Sabah" in failure for failure in report.failures))

    def test_controlled_release_fails_closed_when_baseline_is_unavailable(self):
        report = validate_data.Report()
        validate_data.check_baseline_available(
            report, "resilience.json", None, "baseline ref is unavailable", True
        )
        self.assertEqual(report.failed, 1)
        self.assertIn("required baseline is readable", report.failures[0])


if __name__ == "__main__":
    unittest.main()
