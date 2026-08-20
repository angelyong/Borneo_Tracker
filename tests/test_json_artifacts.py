import json
import unittest
from pathlib import Path
from json_artifacts import (
    build_districts_meta,
    build_indicators_meta,
    build_resilience_meta,
    write_json_lf,
)

ROOT = Path(__file__).resolve().parents[1]
SCRATCH = ROOT / ".tmp_tests" / "test_json_artifacts"


def scratch_path(name):
    SCRATCH.mkdir(parents=True, exist_ok=True)
    path = SCRATCH / name
    if path.exists():
        path.unlink()
    return path


class JsonArtifactTests(unittest.TestCase):
    def test_volatile_clock_is_a_byte_preserving_noop(self):
        path = scratch_path("volatile.json")
        try:
            self.assertTrue(write_json_lf(path,{"generatedAt":"2026-08-01","rows":[{"sourceDate":"2020"}]}))
            before=path.read_bytes()
            self.assertFalse(write_json_lf(path,{"generatedAt":"2026-08-02","rows":[{"sourceDate":"2020"}]}))
            self.assertEqual(before,path.read_bytes())
        finally:
            if path.exists():
                path.unlink()

    def test_substantive_change_writes_new_bytes(self):
        path = scratch_path("substantive.json")
        try:
            write_json_lf(path,{"generatedAt":"a","rows":[1]})
            self.assertTrue(write_json_lf(path,{"generatedAt":"b","rows":[2]}))
            self.assertEqual(json.loads(path.read_text())["rows"],[2])
        finally:
            if path.exists():
                path.unlink()

    def test_indicators_meta_is_deterministic_from_rows(self):
        rows = [
            {
                "territory": "Sabah",
                "indicator": "Clean water access",
                "dashboard_concept": "clean_water_access",
                "year": "2024",
                "source": "DOSM",
                "canonical": 1,
            },
            {
                "territory": "Sabah",
                "indicator": "Air quality (AQI, live)",
                "dashboard_concept": "air_quality",
                "year": "2026-08-16",
                "source": "WAQI",
                "canonical": 1,
            },
            {
                "territory": "Brunei",
                "indicator": "GDP (current US$)",
                "dashboard_concept": "economy",
                "year": "2023",
                "source": "World Bank",
                "canonical": 1,
            },
        ]
        territories = ["Sabah", "Brunei"]
        series = {"Sabah": {"clean_water_access": {"points": [1, 2, 3]}}}
        first = build_indicators_meta(rows, territories, series)
        second = build_indicators_meta(list(rows), list(territories), dict(series))

        self.assertEqual(json.dumps(first, sort_keys=True), json.dumps(second, sort_keys=True))
        self.assertEqual(first["schemaVersion"], 1)
        self.assertEqual(first["sourceCount"], 3)
        self.assertEqual(first["coverage"]["totalRows"], 3)
        self.assertEqual(first["coverage"]["territories"]["Sabah"]["latestYear"], 2026)
        self.assertNotIn("nextExpectedUpdate", json.dumps(first))

    def test_indicators_meta_changes_only_when_substantive_data_changes(self):
        rows = [
            {
                "territory": "Sabah",
                "indicator": "Clean water access",
                "dashboard_concept": "clean_water_access",
                "year": "2024",
                "source": "DOSM",
                "canonical": 1,
            }
        ]
        first = build_indicators_meta(rows, ["Sabah"], {})
        changed = build_indicators_meta(rows + [dict(rows[0], source="World Bank")], ["Sabah"], {})

        self.assertNotEqual(first["sourceCount"], changed["sourceCount"])
        self.assertNotEqual(first["coverage"]["totalRows"], changed["coverage"]["totalRows"])

    def test_districts_meta_is_deterministic_from_rows_and_parents(self):
        rows = [
            {"parent": "Sabah", "territory": "Kota Kinabalu", "year": "2024", "source": "DOSM", "has_geometry": True},
            {"parent": "Sabah", "territory": "Ranau", "year": "2023", "source": "DOSM", "has_geometry": False},
            {"parent": "Sarawak", "territory": "Kuching", "year": "2022", "source": "GFW", "has_geometry": True},
        ]
        parents = {"Sabah": ["Kota Kinabalu", "Ranau"], "Sarawak": ["Kuching"]}
        first = build_districts_meta(rows, parents)
        second = build_districts_meta(list(rows), dict(parents))

        self.assertEqual(json.dumps(first, sort_keys=True), json.dumps(second, sort_keys=True))
        self.assertEqual(first["sourceCount"], 2)
        self.assertEqual(first["coverage"]["totalDistricts"], 3)
        self.assertEqual(first["coverage"]["withGeometry"], 2)
        self.assertEqual(first["coverage"]["withoutGeometry"], 1)
        self.assertNotIn("nextExpectedUpdate", json.dumps(first))

    def test_resilience_meta_is_deterministic_from_scores(self):
        scores = {
            "Sabah": {
                "scoredPillars": ["Energy", "Shelter"],
                "unscoredPillars": ["Food"],
                "detail": {
                    "Energy": [{"indicator": "Electricity access", "source": "DOSM"}],
                    "Shelter": [{"indicator": "Clean water access", "source": "DOSM"}],
                },
            },
            "Brunei": {
                "scoredPillars": ["Healthcare"],
                "unscoredPillars": ["Food", "Energy"],
                "detail": {
                    "Healthcare": [{"indicator": "Life expectancy", "source": "World Bank"}],
                },
            },
        }
        pillars = ["Food", "Energy", "Shelter", "Healthcare"]
        first = build_resilience_meta(scores, pillars)
        second = build_resilience_meta(json.loads(json.dumps(scores)), list(pillars))

        self.assertEqual(json.dumps(first, sort_keys=True), json.dumps(second, sort_keys=True))
        self.assertEqual(first["sourceCount"], 2)
        self.assertEqual(first["coverage"]["scoredIndicators"], 3)
        self.assertEqual(first["unscoredPillars"]["Sabah"], ["Food"])
        self.assertNotIn("nextExpectedUpdate", json.dumps(first))
if __name__=="__main__": unittest.main()
