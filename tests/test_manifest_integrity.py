"""Phase-1 contract tests: safe scope, deterministic version and committed prefix."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import merkle
import verify_manifest
from manifest_contract import DATASET_PATHS, data_version, is_rfc3339_utc_seconds, strict_json_loads, validate_manifest

class ManifestContractTests(unittest.TestCase):
    def manifest(self):
        files={path:{"sha256":hashlib.sha256(path.encode()).hexdigest(),"bytes":len(path),"generatedAt":None} for path in DATASET_PATHS}
        return {"schemaVersion":2,"generatedAt":"2026-08-09T00:00:00Z","runId":"test","dataVersion":data_version(files),"files":files,"provenance":{"algorithm":"rfc6962-sha256-jsonl-v1","root":"0"*64,"entries":1}}
    def test_scope_and_data_version_are_deterministic(self):
        item=self.manifest(); validate_manifest(item)
        self.assertEqual(item["dataVersion"],data_version(dict(reversed(list(item["files"].items())))))
        item["files"][DATASET_PATHS[0]]["bytes"]+=1
        with self.assertRaises(ValueError): validate_manifest(item)
    def test_duplicate_keys_and_unknown_path_fail(self):
        with self.assertRaises(ValueError): strict_json_loads('{"x":1,"x":2}')
        item=self.manifest(); item["files"]["public/data/../secret.json"]=item["files"].pop(DATASET_PATHS[-1]); item["dataVersion"]=data_version(item["files"])
        with self.assertRaises(ValueError): validate_manifest(item)
    def test_historical_prefix_survives_later_append(self):
        with tempfile.TemporaryDirectory() as td:
            ledger=Path(td)/"provenance.jsonl"; ledger.write_bytes(b'{"n":1}\n{"n":2}\n')
            old=merkle.merkle_root_of_file(ledger,2); ledger.write_bytes(ledger.read_bytes()+b'{"n":3}\n')
            self.assertEqual(old,merkle.merkle_root_of_file(ledger,2))
            self.assertNotEqual(old,merkle.merkle_root_of_file(ledger))
    def test_rfc3339_is_a_real_timestamp_not_only_a_regex(self):
        self.assertTrue(is_rfc3339_utc_seconds("2026-08-09T00:00:00Z"))
        self.assertFalse(is_rfc3339_utc_seconds("2026-99-99T99:99:99Z"))
    def test_workflows_can_read_the_single_canonical_dataset_list(self):
        from io import StringIO
        from contextlib import redirect_stdout
        output=StringIO()
        with redirect_stdout(output): self.assertEqual(verify_manifest.main(["paths"]),0)
        self.assertEqual(tuple(output.getvalue().splitlines()),DATASET_PATHS)

if __name__=="__main__": unittest.main()
