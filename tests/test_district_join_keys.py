import json
import shutil
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

import validate_data
from district_keys import (
    geometry_join_key,
    row_join_key,
    stamp_geometry_status,
)


class DistrictJoinKeyTests(unittest.TestCase):
    def test_sabah_kota_names_match_geometry_aliases(self):
        self.assertEqual(row_join_key({"parent": "Sabah", "territory": "Kota Belud"}), "belud")
        self.assertEqual(row_join_key({"parent": "Sabah", "territory": "Kota Kinabalu"}), "kinabalu")
        self.assertEqual(row_join_key({"parent": "Sabah", "territory": "Kota Marudu"}), "marudu")
        self.assertEqual(geometry_join_key("Sabah", "Kota Kinabalu", iso="MYS"), "kinabalu")

    def test_indonesia_uses_codes_only_when_geometry_can_use_codes(self):
        self.assertEqual(
            row_join_key({"parent": "Kalimantan Timur", "territory": "Balikpapan", "code": "6471"}),
            "6471",
        )
        self.assertEqual(
            geometry_join_key("Kalimantan Timur", "Balikpapan", iso="IDN", cc2="6471"),
            "6471",
        )
        self.assertEqual(
            row_join_key({"parent": "Kalimantan Utara", "territory": "Malinau", "code": "221"}),
            "malinau",
        )
        self.assertEqual(
            geometry_join_key("Kalimantan Utara", "Malinau", iso="IDN", cc2="NA"),
            "malinau",
        )

    def test_stamp_geometry_status_labels_unmatched_rows(self):
        rows = [
            {"parent": "Sabah", "territory": "Kota Kinabalu"},
            {"parent": "Sarawak", "territory": "Gedong"},
        ]

        stamp_geometry_status(rows, {("Sabah", "kinabalu")})

        self.assertEqual(rows[0]["key"], "kinabalu")
        self.assertTrue(rows[0]["has_geometry"])
        self.assertEqual(rows[0]["geometry_status"], "match")
        self.assertEqual(rows[1]["key"], "gedong")
        self.assertFalse(rows[1]["has_geometry"])
        self.assertEqual(rows[1]["geometry_status"], "no_geometry")


class DistrictJoinCoverageValidationTests(unittest.TestCase):
    def run_coverage_check(self, rows, previous=None):
        root = Path.cwd() / "tests" / "_tmp_district_join_keys"
        if root.exists():
            shutil.rmtree(root)
        try:
            data_dir = root / "public" / "data"
            data_dir.mkdir(parents=True)
            (data_dir / "borneo_districts.geojson").write_text(
                json.dumps(
                    {
                        "type": "FeatureCollection",
                        "features": [
                            {
                                "type": "Feature",
                                "properties": {"parent": "Sabah", "key": "kinabalu"},
                                "geometry": None,
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            original_root = validate_data.ROOT
            validate_data.ROOT = root
            try:
                report = validate_data.Report()
                with redirect_stdout(StringIO()):
                    validate_data.check_district_join_coverage(report, rows, previous)
                return report
            finally:
                validate_data.ROOT = original_root
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_validator_fails_new_unlabelled_no_geometry_row(self):
        report = self.run_coverage_check(
            [
                {"parent": "Sabah", "territory": "Kota Kinabalu", "indicator": "Population"},
                {"parent": "Sarawak", "territory": "Gedong", "indicator": "Population"},
            ],
            previous={"rows": []},
        )

        self.assertGreater(report.failed, 0)
        self.assertTrue(
            any("new no-geometry districts are explicitly labelled" in failure for failure in report.failures)
        )

    def test_validator_accepts_labelled_no_geometry_row(self):
        report = self.run_coverage_check(
            [
                {"parent": "Sabah", "territory": "Kota Kinabalu", "indicator": "Population"},
                {
                    "parent": "Sarawak",
                    "territory": "Gedong",
                    "indicator": "Population",
                    "geometry_status": "no_geometry",
                    "has_geometry": False,
                },
            ],
            previous={"rows": []},
        )

        self.assertEqual(report.failed, 0)

    def test_validator_tolerates_unchanged_legacy_unlabelled_rows(self):
        matched = {"parent": "Sabah", "territory": "Kota Kinabalu", "indicator": "Population"}
        row = {"parent": "Sarawak", "territory": "Gedong", "indicator": "Population"}
        report = self.run_coverage_check([matched, row], previous={"rows": [matched, row]})

        self.assertEqual(report.failed, 0)


if __name__ == "__main__":
    unittest.main()
