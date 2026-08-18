"""Clean-fixture Phase-1 publication, recovery, and remote-SPA contract tests."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import emit_manifest
from manifest_contract import DATASET_PATHS
import verify_manifest

class Phase1PublishIntegrationTests(unittest.TestCase):
    def configured(self, root):
        data=root/"public/data"; data.mkdir(parents=True)
        for index, rel in enumerate(DATASET_PATHS):
            (root/rel).write_text(json.dumps({"generatedAt":"2026-08-09","n":index}),encoding="utf-8",newline="\n")
        return data
    def patch_paths(self, root, data):
        return patch.multiple(emit_manifest, ROOT=root, DATA_DIR=data, MANIFEST=data/"manifest.json", PROVENANCE=data/"provenance.jsonl", LOCK=data/".manifest.lock")
    def test_v2_publish_is_idempotent_and_recovers_missing_manifest(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); data=self.configured(root)
            with self.patch_paths(root,data):
                manifest,changed=emit_manifest.publish(); first=(data/"manifest.json").read_bytes(); ledger=(data/"provenance.jsonl").read_bytes()
                self.assertTrue(changed); self.assertEqual(manifest["schemaVersion"],2)
                again,changed=emit_manifest.publish(); self.assertFalse(changed); self.assertEqual(first,(data/"manifest.json").read_bytes()); self.assertEqual(ledger,(data/"provenance.jsonl").read_bytes())
                (data/"manifest.json").unlink()
                recovered,changed=emit_manifest.publish(); self.assertTrue(changed); self.assertEqual(recovered["dataVersion"],manifest["dataVersion"]); self.assertEqual(first,(data/"manifest.json").read_bytes())
    def test_changed_data_refuses_a_corrupted_committed_prefix(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); data=self.configured(root)
            with self.patch_paths(root,data):
                emit_manifest.publish()
                (root/DATASET_PATHS[0]).write_text('{"generatedAt":"2026-08-10","changed":true}',encoding="utf-8",newline="\n")
                lines=(data/"provenance.jsonl").read_bytes().splitlines()
                lines[0]=b'{"tampered":true}'
                (data/"provenance.jsonl").write_bytes(b"\n".join(lines)+b"\n")
                with self.assertRaisesRegex(ValueError,"prefix"):
                    emit_manifest.publish()
    def test_recovery_requires_exact_tail_descriptors(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); data=self.configured(root)
            with self.patch_paths(root,data):
                old,_=emit_manifest.publish()
                (root/DATASET_PATHS[0]).write_text('{"generatedAt":"2026-08-10","changed":true}',encoding="utf-8",newline="\n")
                files,_=emit_manifest.build_files(); version=emit_manifest.data_version(files)
                tail=emit_manifest._events_for_version(files,version,"2026-08-10T00:00:00Z",old["provenance"]["entries"])
                bad=json.loads(tail[0]); bad["sha256"]="0"*64
                tail[0]=json.dumps(bad,sort_keys=True,separators=(",",":" )).encode()
                with (data/"provenance.jsonl").open("ab") as ledger:
                    for line in tail: ledger.write(line+b"\n")
                with self.assertRaisesRegex(ValueError,"unreferenced provenance tail"):
                    emit_manifest.publish()
    def test_exact_complete_tail_recovers_after_manifest_write_crash(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); data=self.configured(root)
            with self.patch_paths(root,data):
                old,_=emit_manifest.publish()
                (root/DATASET_PATHS[0]).write_text('{"generatedAt":"2026-08-10","changed":true}',encoding="utf-8",newline="\n")
                files,_=emit_manifest.build_files(); version=emit_manifest.data_version(files)
                tail=emit_manifest._events_for_version(files,version,"2026-08-10T00:00:00Z",old["provenance"]["entries"])
                with (data/"provenance.jsonl").open("ab") as ledger:
                    for line in tail: ledger.write(line+b"\n")
                recovered,changed=emit_manifest.publish()
                self.assertTrue(changed); self.assertEqual(recovered["dataVersion"],version)
    def test_remote_fixture_rejects_spa_fallback_for_each_declared_dataset(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); data=self.configured(root)
            with self.patch_paths(root,data): emit_manifest.publish()
            expected=root/"expected.json"; self.assertEqual(verify_manifest.main(["verify",str(data),"--expected-out",str(expected)]),0)
            remote=root/"remote"; remote.mkdir()
            for path in data.iterdir():
                if path.is_file(): (remote/path.name).write_bytes(path.read_bytes())
            self.assertEqual(verify_manifest.verify_remote_data_dir(remote,expected),[])
            (remote/"brunei.geojson").write_text("<!doctype html><html>SPA</html>",encoding="utf-8")
            self.assertTrue(any("SPA HTML" in error for error in verify_manifest.verify_remote_data_dir(remote,expected)))
if __name__=="__main__": unittest.main()
