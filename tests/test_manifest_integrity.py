"""Offline byte-contract tests for published dashboard JSON artifacts."""

import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from json_artifacts import write_json_lf  # noqa: E402
from verify_manifest import (  # noqa: E402
    REQUIRED_FILES,
    expected_snapshot,
    verify_data_dir,
    verify_remote_data_dir,
)


PUBLIC_DATA = ROOT / "public" / "data"
DIST_DATA = ROOT / "dist" / "data"


class PublishedJsonArtifactTests(unittest.TestCase):
    def test_shared_writer_is_lf_only_and_round_trips_values(self):
        payload = {"title": "Borneo\nTracker", "rows": [{"value": 1.25}]}
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "artifact.json"
            write_json_lf(output, payload)
            raw = output.read_bytes()
            self.assertNotIn(b"\r\n", raw)
            self.assertEqual(json.loads(raw.decode("utf-8")), payload)

    def test_current_public_manifest_claims_match_actual_bytes(self):
        self.assertEqual(verify_data_dir(PUBLIC_DATA), [])

    def test_published_data_is_lf_only_and_parseable(self):
        for name in REQUIRED_FILES:
            with self.subTest(name=name):
                raw = (PUBLIC_DATA / name).read_bytes()
                self.assertNotIn(b"\r\n", raw)
                self.assertIsInstance(json.loads(raw.decode("utf-8")), dict)

    def test_built_data_matches_manifest_when_a_build_exists(self):
        if not DIST_DATA.is_dir():
            self.skipTest("dist/data is absent; run npm run build before release verification")
        self.assertEqual(verify_data_dir(DIST_DATA), [])

    def test_remote_verifier_checks_manifest_claim_and_downloaded_bytes(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            expected_path = Path(temp_dir) / "expected.json"
            expected_path.write_text(
                json.dumps(expected_snapshot(PUBLIC_DATA)), encoding="utf-8", newline="\n"
            )
            self.assertEqual(verify_remote_data_dir(PUBLIC_DATA, expected_path), [])

            tampered = expected_snapshot(PUBLIC_DATA)
            tampered["files"]["indicators.json"]["bytes"] += 1
            expected_path.write_text(json.dumps(tampered), encoding="utf-8", newline="\n")
            self.assertTrue(verify_remote_data_dir(PUBLIC_DATA, expected_path))


if __name__ == "__main__":
    unittest.main()
