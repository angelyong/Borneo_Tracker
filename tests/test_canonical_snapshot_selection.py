"""Regression tests for the snapshot/canonical boundary (BT-11a)."""

import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import compute_resilience  # noqa: E402
import data_model  # noqa: E402
import load_db  # noqa: E402


class CanonicalSnapshotSelectionTests(unittest.TestCase):
    def test_gdl_education_survives_a_later_noncanonical_duplicate(self):
        """The exact Sabah/Sarawak collision must not recur at SQLite write time."""
        rows = data_model.load_indicator_rows()

        for territory in ("Sabah", "Sarawak"):
            matches = [
                row for row in rows
                if row["territory"] == territory
                and row["indicator"] == "Mean years schooling (RLS)"
            ]
            self.assertEqual(len(matches), 1, territory)
            self.assertEqual(matches[0]["canonical"], 1, territory)
            self.assertIn("Global Data Lab", matches[0]["source"])

            # Simulate the legacy ordering defect: a later same-key row that
            # was not selected canonical by the data model.
            legacy_duplicate = dict(matches[0])
            legacy_duplicate["canonical"] = 0
            legacy_duplicate["source"] = "Legacy duplicate fixture"
            rows.append(legacy_duplicate)

        with tempfile.TemporaryDirectory() as temporary_directory:
            db_path = Path(temporary_directory) / "snapshot.db"
            load_db.build_db(db_path, rows)

            with closing(sqlite3.connect(db_path)) as connection:
                connection.row_factory = sqlite3.Row
                education = [
                    dict(row)
                    for row in connection.execute(
                        """
                        SELECT territory, indicator, value, unit, source, canonical,
                               hexagon_pillar, confidence, year, last_updated
                        FROM indicators
                        WHERE territory IN ('Sabah', 'Sarawak')
                          AND indicator = 'Mean years schooling (RLS)'
                        ORDER BY territory
                        """
                    ).fetchall()
                ]
                canonical_rows = [
                    dict(row)
                    for row in connection.execute(
                        """
                        SELECT territory, indicator, value, unit, hexagon_pillar,
                               confidence, source, year, last_updated
                        FROM indicators
                        WHERE canonical = 1
                        """
                    ).fetchall()
                ]

        self.assertEqual([row["territory"] for row in education], ["Sabah", "Sarawak"])
        for row in education:
            self.assertEqual(row["canonical"], 1, row["territory"])
            self.assertEqual(row["value"], 8.7, row["territory"])
            self.assertEqual(row["unit"], "years", row["territory"])
            self.assertIn("Global Data Lab", row["source"], row["territory"])

        scores = compute_resilience.compute(canonical_rows)
        expected_scores = {
            "Sabah": (67.6, 62.0),
            "Sarawak": (73.6, 71.0),
        }
        for territory, (expected_index, expected_strict) in expected_scores.items():
            self.assertEqual(set(scores[territory]["scoredPillars"]), set(compute_resilience.PILLARS))
            self.assertEqual(scores[territory]["pillarScores"]["Education"], 45.0)
            self.assertEqual(scores[territory]["index"], expected_index)
            self.assertEqual(scores[territory]["indexStrict"], expected_strict)

    def test_snapshot_selection_keeps_latest_multiyear_population_row(self):
        """Legitimate historical input still produces the current snapshot."""
        rows = data_model.load_indicator_rows()
        selected = load_db.select_snapshot_rows(rows)
        population = next(
            row for row in selected
            if row["territory"] == "Sabah" and row["indicator"] == "Population"
        )
        self.assertEqual(population["year"], "2026")
        self.assertEqual(population["canonical"], 1)


if __name__ == "__main__":
    unittest.main()
