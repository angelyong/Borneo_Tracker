"""IS-1B: resilience_model.json must be tracked/hashed by emit_manifest.py the
same way as resilience.json, so a single pipeline run's manifest always covers
both Impact Simulator outputs."""

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import emit_manifest as em  # noqa: E402


class ManifestTracksResilienceModelTests(unittest.TestCase):
    def test_resilience_model_json_is_in_tracked_files(self):
        self.assertIn("public/data/resilience_model.json", em.TRACKED_FILES)

    def test_tracked_files_are_all_present_on_disk(self):
        for rel_path in em.TRACKED_FILES:
            with self.subTest(rel_path=rel_path):
                self.assertTrue((ROOT / rel_path).is_file(), f"missing {rel_path}")

    def test_build_manifest_hashes_resilience_model_with_no_missing_files(self):
        manifest, missing = em.build_manifest()
        self.assertEqual(missing, [])
        entry = manifest["files"]["public/data/resilience_model.json"]
        self.assertEqual(len(entry["sha256"]), 64)
        self.assertIsInstance(entry["bytes"], int)
        self.assertGreater(entry["bytes"], 0)

    def test_build_manifest_is_deterministic_for_unchanged_files(self):
        """Two consecutive builds against unchanged files must hash identically —
        proves the manifest step introduces no run-to-run drift for the Impact
        Simulator's model export (Stage IS-1B determinism check)."""
        first, _ = em.build_manifest()
        second, _ = em.build_manifest()
        self.assertEqual(first["files"], second["files"])


if __name__ == "__main__":
    unittest.main()
