import json
import shutil
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

import validate_data
from build_geojson import assert_unique_geometry_identities
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
    @staticmethod
    def feature(parent, key, name=None, geometry=None):
        return {
            "type": "Feature",
            "properties": {"parent": parent, "key": key, "name": name or key},
            "geometry": geometry if geometry is not None else {
                "type": "Polygon",
                "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]],
            },
        }

    def run_coverage_check(self, rows, previous=None, features=None, previous_geo=None):
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
                        "features": features if features is not None else [self.feature("Sabah", "kinabalu")],
                    }
                ),
                encoding="utf-8",
            )
            original_root = validate_data.ROOT
            validate_data.ROOT = root
            try:
                report = validate_data.Report()
                with redirect_stdout(StringIO()):
                    validate_data.check_district_join_coverage(
                        report,
                        rows,
                        previous,
                        previous_geo,
                    )
                return report
            finally:
                validate_data.ROOT = original_root
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_validator_fails_unlabelled_no_geometry_row(self):
        report = self.run_coverage_check(
            [
                {
                    "parent": "Sabah", "territory": "Kota Kinabalu", "indicator": "Population",
                    "key": "kinabalu", "geometry_status": "match", "has_geometry": True,
                },
                {"parent": "Sarawak", "territory": "Gedong", "indicator": "Population"},
            ],
            previous={"rows": []},
        )

        self.assertGreater(report.failed, 0)
        self.assertTrue(
            any("geometry status exactly matches GeoJSON coverage" in failure for failure in report.failures)
        )

    def test_validator_accepts_labelled_no_geometry_row(self):
        report = self.run_coverage_check(
            [
                {
                    "parent": "Sabah", "territory": "Kota Kinabalu", "indicator": "Population",
                    "key": "kinabalu", "geometry_status": "match", "has_geometry": True,
                },
                {
                    "parent": "Sarawak",
                    "territory": "Gedong",
                    "indicator": "Population",
                    "key": "gedong",
                    "geometry_status": "no_geometry",
                    "has_geometry": False,
                },
            ],
            previous={"rows": []},
        )

        self.assertEqual(report.failed, 0)

    def test_validator_rejects_serialized_key_mismatch(self):
        row = {
            "parent": "Sabah", "territory": "Kota Kinabalu", "indicator": "Population",
            "key": "kotakinabalu", "geometry_status": "match", "has_geometry": True,
        }
        report = self.run_coverage_check([row])

        self.assertGreater(report.failed, 0)
        self.assertTrue(any("serialized keys equal canonical join keys" in failure for failure in report.failures))

    def test_validator_rejects_status_mismatch_for_existing_geometry(self):
        row = {
            "parent": "Sabah", "territory": "Kota Kinabalu", "indicator": "Population",
            "key": "kinabalu", "geometry_status": "no_geometry", "has_geometry": False,
        }
        report = self.run_coverage_check([row])

        self.assertGreater(report.failed, 0)
        self.assertTrue(any("geometry status exactly matches GeoJSON coverage" in failure for failure in report.failures))

    def test_validator_rejects_duplicate_geometry_identity(self):
        row = {
            "parent": "Sabah", "territory": "Kota Kinabalu", "indicator": "Population",
            "key": "kinabalu", "geometry_status": "match", "has_geometry": True,
        }
        report = self.run_coverage_check(
            [row],
            features=[
                self.feature("Sabah", "kinabalu", "Kota Kinabalu"),
                self.feature("Sabah", "kinabalu", "Kota Kinabalu duplicate"),
            ],
        )

        self.assertGreater(report.failed, 0)
        self.assertTrue(any("parent-scoped keys are unique" in failure for failure in report.failures))

    def test_validator_rejects_null_geometry_feature(self):
        row = {
            "parent": "Sabah", "territory": "Kota Kinabalu", "indicator": "Population",
            "key": "kinabalu", "geometry_status": "no_geometry", "has_geometry": False,
        }
        feature = self.feature("Sabah", "kinabalu")
        feature["geometry"] = None
        report = self.run_coverage_check([row], features=[feature])

        self.assertGreater(report.failed, 0)
        self.assertTrue(
            any("renderable Polygon/MultiPolygon geometry" in failure for failure in report.failures)
        )

    def test_validator_rejects_conflicting_display_names(self):
        rows = [
            {
                "parent": "Sabah", "territory": "Kota Kinabalu", "indicator": "Population",
                "key": "kinabalu", "geometry_status": "match", "has_geometry": True,
            },
            {
                "parent": "Sabah", "territory": "Kinabalu", "indicator": "GDP",
                "key": "kinabalu", "geometry_status": "match", "has_geometry": True,
            },
        ]
        report = self.run_coverage_check(rows)

        self.assertGreater(report.failed, 0)
        self.assertTrue(any("parent-scoped keys have one display name" in failure for failure in report.failures))

    def test_validator_rejects_baseline_geometry_removal(self):
        row = {
            "parent": "Sabah", "territory": "Kota Kinabalu", "indicator": "Population",
            "key": "kinabalu", "geometry_status": "no_geometry", "has_geometry": False,
        }
        previous = {
            "rows": [{
                "parent": "Sabah", "territory": "Kota Kinabalu", "indicator": "Population",
                "key": "kinabalu", "geometry_status": "match", "has_geometry": True,
            }]
        }
        previous_geo = {"type": "FeatureCollection", "features": [self.feature("Sabah", "kinabalu")]}
        report = self.run_coverage_check([row], previous, features=[], previous_geo=previous_geo)

        self.assertGreater(report.failed, 0)
        self.assertTrue(any("previously mapped districts do not lose geometry" in failure for failure in report.failures))
        self.assertTrue(any("geometry coverage does not decline from baseline" in failure for failure in report.failures))


class DistrictGeometryBuilderTests(unittest.TestCase):
    def test_builder_rejects_duplicate_parent_scoped_identity(self):
        polygon = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}
        features = [
            {
                "properties": {"parent": "Sabah", "key": "kinabalu", "name": "Kota Kinabalu"},
                "geometry": polygon,
            },
            {
                "properties": {"parent": "Sabah", "key": "kinabalu", "name": "Duplicate"},
                "geometry": polygon,
            },
        ]

        with self.assertRaisesRegex(ValueError, "duplicate geometry identity"):
            assert_unique_geometry_identities(features)


if __name__ == "__main__":
    unittest.main()
