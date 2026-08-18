import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import anchor_provenance
import merkle
from manifest_contract import DATASET_PATHS, data_version


class AnchorDryRunTests(unittest.TestCase):
    def test_dry_run_never_creates_snapshot_or_event(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); data=root/"public"/"data"; data.mkdir(parents=True)
            files={}
            for index, rel in enumerate(DATASET_PATHS):
                path=root/rel; path.parent.mkdir(parents=True,exist_ok=True)
                body=f'{{"n":{index}}}\n'.encode(); path.write_bytes(body)
                files[rel]={"sha256":hashlib.sha256(body).hexdigest(),"bytes":len(body),"generatedAt":None}
            line=b'{"legacy":true}'
            (data/"provenance.jsonl").write_bytes(line+b"\n")
            manifest={"schemaVersion":2,"generatedAt":"2026-08-09T00:00:00Z","runId":"test","dataVersion":data_version(files),"files":files,"provenance":{"algorithm":"rfc6962-sha256-jsonl-v1","root":merkle.merkle_root([merkle.leaf_hash(line)]).hex(),"entries":1}}
            (data/"manifest.json").write_text(json.dumps(manifest),encoding="utf-8")
            anchors=data/"anchors.jsonl"; before={path: path.read_bytes() for path in data.rglob("*") if path.is_file()}
            with patch.multiple(anchor_provenance,ROOT=root,DATA_DIR=data,MANIFEST=data/"manifest.json",PROVENANCE=data/"provenance.jsonl",ANCHORS=anchors,VERSIONS=data/"versions",CURRENT_PROOF=data/"manifest.json.ots"):
                self.assertEqual(anchor_provenance.main(["--dry-run"]),0)
            after={path: path.read_bytes() for path in data.rglob("*") if path.is_file()}
            self.assertEqual(after,before)
            self.assertFalse((data/"versions").exists())
            self.assertFalse(anchors.exists())

    def test_orphaned_version_proof_fails_closed_without_restamping(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); data=root/"public"/"data"; data.mkdir(parents=True)
            files={}
            for index, rel in enumerate(DATASET_PATHS):
                path=root/rel; path.parent.mkdir(parents=True,exist_ok=True)
                body=f'{{"n":{index}}}\n'.encode(); path.write_bytes(body)
                files[rel]={"sha256":hashlib.sha256(body).hexdigest(),"bytes":len(body),"generatedAt":None}
            line=b'{"legacy":true}'
            (data/"provenance.jsonl").write_bytes(line+b"\n")
            manifest={"schemaVersion":2,"generatedAt":"2026-08-09T00:00:00Z","runId":"test","dataVersion":data_version(files),"files":files,"provenance":{"algorithm":"rfc6962-sha256-jsonl-v1","root":merkle.merkle_root([merkle.leaf_hash(line)]).hex(),"entries":1}}
            raw=json.dumps(manifest).encode()
            (data/"manifest.json").write_bytes(raw)
            sha=hashlib.sha256(raw).hexdigest()
            proof=data/"versions"/sha/"manifest.json.ots"; proof.parent.mkdir(parents=True); proof.write_bytes(b"stronger-proof")
            with patch.multiple(anchor_provenance,ROOT=root,DATA_DIR=data,MANIFEST=data/"manifest.json",PROVENANCE=data/"provenance.jsonl",ANCHORS=data/"anchors.jsonl",VERSIONS=data/"versions",CURRENT_PROOF=data/"manifest.json.ots"), patch.object(anchor_provenance.ots,"submit") as submit:
                self.assertEqual(anchor_provenance.main([]),4)
            self.assertEqual(proof.read_bytes(),b"stronger-proof")
            submit.assert_not_called()


if __name__ == "__main__": unittest.main()
