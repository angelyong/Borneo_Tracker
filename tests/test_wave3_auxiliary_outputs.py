"""Contracts for Wave 3's unhashed transparency/history auxiliary outputs."""
import json
import tempfile
import unittest
from pathlib import Path

import build_resilience_history as history
import sources_registry
from manifest_contract import DATASET_PATHS


class SourceRegistryTests(unittest.TestCase):
    def test_registry_is_complete_canonical_and_exportable(self):
        self.assertTrue(sources_registry.validate_registry())
        payload = sources_registry.build_payload(generated_at="2026-08-24")
        self.assertEqual(payload["schemaVersion"], 1)
        self.assertEqual(len(payload["sources"]), 16)
        self.assertEqual([item["source_id"] for item in payload["sources"]], sorted(sources_registry.SOURCES_REGISTRY))
        for item in payload["sources"]:
            self.assertTrue(item["official_url"].startswith("https://"))
            self.assertIn(item["cadence"], sources_registry.CADENCES)
            self.assertGreater(item["expected_interval_days"], 0)
            self.assertTrue(set(item["territories"]).issubset(sources_registry.TERRITORIES))
            self.assertTrue(set(item["pillars"]).issubset(sources_registry.PILLARS))
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "sources.json"
            sources_registry.export_json(output)
            self.assertTrue(output.exists())
            self.assertNotIn("public/data/sources.json", DATASET_PATHS)

    def test_registry_rejects_invalid_cadence_or_taxonomy(self):
        bad = {key: dict(value) for key, value in sources_registry.SOURCES_REGISTRY.items()}
        bad["dosm"]["cadence"] = "hourly"
        with self.assertRaises(ValueError):
            sources_registry.validate_registry(bad)
        bad["dosm"]["cadence"] = "daily"
        bad["dosm"]["territories"] = ["Borneo"]
        with self.assertRaises(ValueError):
            sources_registry.validate_registry(bad)


class ResilienceHistoryTests(unittest.TestCase):
    INITIAL_COMMIT = "a" * 40
    DEFECT_COMMIT = "506aeefe7254ce9877bff0c7d61a1d62c20e362f"
    FALSE_JUMP_COMMIT = "80e9f9c12e514145697645dfd257687994b2ed3b"
    FIXED_COMMIT = "6a7ca77bffc5bdf3bce3c388acb6dd5e100d4088"

    def fake_git(self, *args):
        command = tuple(args)
        if command[:2] == ("rev-list", "--reverse"):
            return "\n".join((self.INITIAL_COMMIT, self.DEFECT_COMMIT, self.FALSE_JUMP_COMMIT, self.FIXED_COMMIT)) + "\n"
        if command[0] == "show":
            commit = command[1].split(":", 1)[0]
            values = {
                self.INITIAL_COMMIT: ("2026-07-06", 56.9, None),
                # Git %cs is 2026-08-02, but the archived data artifact says
                # 2026-08-03. The artifact date is the user-visible truth.
                self.DEFECT_COMMIT: ("2026-08-03", 67.5, 62.0),
                # The false Sabah rise is published on 2026-08-04, not the
                # previous UTC commit day.
                self.FALSE_JUMP_COMMIT: ("2026-08-04", 72.1, 67.0),
                self.FIXED_COMMIT: ("2026-08-17", 67.6, 62.0),
            }
            generated_at, index, strict = values[commit]
            sabah = {"index": index}
            if strict is not None:
                sabah["indexStrict"] = strict
            return json.dumps({"generatedAt": generated_at, "territories": {"Sabah": sabah, "Sarawak": {"index": 70, "indexStrict": 65}}})
        raise AssertionError(command)

    def test_history_is_sorted_unique_and_marks_education_defect_and_fix(self):
        payload = history.build_payload(generated_at="2026-08-24", git=self.fake_git)
        sabah = payload["territories"]["Sabah"]
        self.assertEqual([point["date"] for point in sabah], ["2026-07-06", "2026-08-03", "2026-08-04", "2026-08-17"])
        self.assertFalse(sabah[0]["isMethodologyBreak"])  # no synthetic pre-history break
        self.assertIsNone(sabah[0]["strict"])  # valid old index-only snapshot is retained
        self.assertEqual(sabah[1]["methodologyTag"], "v1.1-education-loss-defect")
        self.assertTrue(sabah[1]["isMethodologyBreak"])
        self.assertEqual(sabah[1]["sourceCommit"], self.DEFECT_COMMIT)
        self.assertEqual(sabah[2]["index"], 72.1)
        self.assertEqual(sabah[2]["date"], "2026-08-04")
        self.assertFalse(sabah[2]["isMethodologyBreak"])
        self.assertEqual(sabah[3]["methodologyTag"], "v1.2-canonical-fixed")
        self.assertTrue(sabah[3]["isMethodologyBreak"])
        self.assertEqual(payload["territories"]["Brunei"], [])
        self.assertNotIn("public/data/resilience_history.json", DATASET_PATHS)

    def test_working_tree_snapshot_is_added_to_the_same_refresh_commit_series(self):
        original = history.working_tree_snapshot
        history.working_tree_snapshot = lambda: ("2026-08-17", {"Sabah": {"index": 67.6, "indexStrict": 62.0}})
        try:
            payload = history.build_payload(git=self.fake_git, include_working_tree=True, generated_at="2026-08-17")
        finally:
            history.working_tree_snapshot = original
        sabah = payload["territories"]["Sabah"]
        self.assertEqual(sabah[-1]["date"], "2026-08-17")
        self.assertEqual(sabah[-1]["index"], 67.6)
        self.assertIsNone(sabah[-1]["sourceCommit"])

    def test_unknown_or_unscored_values_are_not_fabricated(self):
        self.assertEqual(history.methodology_for("1900-01-01"), ("v0-unknown", True))
        self.assertEqual(history.methodology_for("2026-07-08")[0], "v0.2-incomplete-pillar-coverage")
        self.assertEqual(history.methodology_for("2026-08-02")[0], "v1.0-six-pillar")
        self.assertEqual(history.methodology_for("2026-08-03")[0], "v1.1-education-loss-defect")
        self.assertEqual(history.methodology_for("2026-08-17")[0], "v1.2-canonical-fixed")

    def test_history_schema_rejects_invalid_dates_and_strict_values(self):
        payload = {"schemaVersion": 1, "generatedAt": "2026-08-24", "territories": {territory: [] for territory in history.TERRITORIES}}
        payload["territories"]["Sabah"] = [{"date": "2026-08-03", "index": 67.5, "strict": None, "methodologyTag": "v1", "isMethodologyBreak": False, "sourceCommit": "a" * 40}]
        self.assertTrue(history.validate_payload(payload))
        payload["territories"]["Sabah"][0]["date"] = "2026-02-30"
        with self.assertRaises(ValueError):
            history.validate_payload(payload)

    def test_history_schema_rejects_noncanonical_commit_identifiers(self):
        payload = {"schemaVersion": 1, "generatedAt": "2026-08-24", "territories": {territory: [] for territory in history.TERRITORIES}}
        point = {"date": "2026-08-03", "index": 67.5, "strict": None, "methodologyTag": "v1", "isMethodologyBreak": False, "sourceCommit": "abc"}
        payload["territories"]["Sabah"] = [point]
        for bad in ("abc", "A" * 40, "g" * 40, "a" * 39):
            point["sourceCommit"] = bad
            with self.assertRaises(ValueError):
                history.validate_payload(payload)
        point["sourceCommit"] = None
        with self.assertRaises(ValueError):
            history.validate_payload(payload)
        point["date"] = "2026-08-24"
        self.assertTrue(history.validate_payload(payload))

    def test_history_rejects_nonfinite_snapshot_and_payload_scores(self):
        def nonfinite_git(*args):
            return '{"generatedAt":"2026-08-03","territories":{"Sabah":{"index":NaN}}}'

        with self.assertRaises(RuntimeError):
            history.snapshot_from_commit("bad", nonfinite_git)
        payload = {"schemaVersion": 1, "generatedAt": "2026-08-24", "territories": {territory: [] for territory in history.TERRITORIES}}
        payload["territories"]["Sabah"] = [{"date": "2026-08-03", "index": 67.5, "strict": float("inf"), "methodologyTag": "v1", "isMethodologyBreak": False, "sourceCommit": "abc"}]
        with self.assertRaises(ValueError):
            history.validate_payload(payload)
