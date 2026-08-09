import hashlib
import json
import tempfile
import unittest
from pathlib import Path
import ots
from verify_proof_contract import verify

class ProofContractTests(unittest.TestCase):
    def test_rejects_unbound_latest_or_versioned_proof(self):
        with tempfile.TemporaryDirectory() as td:
            data=Path(td); manifest=b'{"schemaVersion":2}\n'; sha=hashlib.sha256(manifest).hexdigest()
            (data/"manifest.json").write_bytes(manifest)
            timestamp=ots.Timestamp(bytes.fromhex(sha)); timestamp.attestations.append(ots.Attestation.pending("https://calendar.example")); proof=ots.DetachedTimestamp(bytes.fromhex(sha),timestamp).to_bytes()
            (data/"manifest.json.ots").write_bytes(proof)
            version=data/"versions"/sha; version.mkdir(parents=True); (version/"manifest.json").write_bytes(manifest); (version/"manifest.json.ots").write_bytes(proof)
            event={"schemaVersion":2,"manifestSha256":sha,"eventType":"ots.stamped","witness":{"type":"ots","status":"pending"},"proof":f"public/data/versions/{sha}/manifest.json.ots"}
            (data/"anchors.jsonl").write_text(json.dumps(event)+"\n",encoding="utf-8")
            self.assertEqual(verify(data),sha)
            (data/"manifest.json.ots").write_bytes(b"arbitrary")
            with self.assertRaises(ValueError): verify(data)
if __name__=="__main__": unittest.main()
