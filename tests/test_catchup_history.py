import unittest
import os
from unittest.mock import patch
import catch_up_anchors

class CatchupHistoryTests(unittest.TestCase):
    def test_unanchored_historical_v2_manifest_is_dispatched_by_exact_commit(self):
        sha="a"*64; commit="b"*40
        with patch.object(catch_up_anchors,"git_blobs",return_value=[(sha,commit)]), patch.object(catch_up_anchors,"version_blobs",return_value=[]), patch.object(catch_up_anchors,"read_anchors",return_value=[]):
            self.assertEqual(catch_up_anchors.missing_versions(10),[(sha,commit)])
    def test_existing_event_suppresses_historical_candidate(self):
        sha="a"*64
        event={"schemaVersion":2,"manifestSha256":sha,"eventType":"legacy.migrated","witness":{"type":"ots","status":"pending"},"proof":f"public/data/versions/{sha}/manifest.json.ots"}
        with patch.object(catch_up_anchors,"git_blobs",return_value=[(sha,"b"*40)]), patch.object(catch_up_anchors,"version_blobs",return_value=[]), patch.object(catch_up_anchors,"read_anchors",return_value=[event]):
            self.assertEqual(catch_up_anchors.missing_versions(10),[])
    def test_historical_v1_snapshot_is_skipped_not_validated_as_v2(self):
        import hashlib, tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as td:
            versions=Path(td); raw=b'{"files":{"legacy":true}}\n'; sha=hashlib.sha256(raw).hexdigest()
            directory=versions/sha; directory.mkdir(); (directory/"manifest.json").write_bytes(raw)
            with patch.object(catch_up_anchors,"VERSIONS",versions), patch.object(catch_up_anchors,"git_blobs",return_value=[(sha,"b"*40)]):
                self.assertEqual(list(catch_up_anchors.version_blobs()),[])
    def test_dispatch_requires_explicit_actions_token(self):
        with patch.dict(os.environ,{"GITHUB_REPOSITORY":"owner/repo"},clear=True):
            with self.assertRaisesRegex(RuntimeError,"GH_TOKEN"):
                catch_up_anchors.dispatch("a"*64,"b"*40)
if __name__=="__main__": unittest.main()
