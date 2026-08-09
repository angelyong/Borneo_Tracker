"""Policy regression: self-hosted witness metadata never earns confirmed."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import merkle, ots, verify_anchor
from manifest_contract import DATASET_PATHS, data_version

class VerifierPolicyTests(unittest.TestCase):
    def test_proof_binding_rejects_arbitrary_binary(self):
        self.assertFalse(verify_anchor.proof_binds_manifest(b"manifest", b"not an ots proof"))
        digest=hashlib.sha256(b"manifest").digest(); stamp=ots.Timestamp(digest); stamp.attestations.append(ots.Attestation.pending("https://calendar.example"))
        self.assertTrue(verify_anchor.proof_binds_manifest(b"manifest",ots.DetachedTimestamp(digest,stamp).to_bytes()))
    def test_self_hosted_confirmation_claim_is_rejected_without_official_ots(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); data=root/"public/data"; data.mkdir(parents=True)
            files={}
            for index, rel in enumerate(DATASET_PATHS):
                path=data/Path(rel).name; body=f"{{\"n\":{index}}}\n".encode(); path.write_bytes(body)
                files[rel]={"sha256":hashlib.sha256(body).hexdigest(),"bytes":len(body),"generatedAt":None}
            line=b'{"legacy":true}'; (data/"provenance.jsonl").write_bytes(line+b"\n")
            manifest={"schemaVersion":2,"generatedAt":"2026-08-09T00:00:00Z","runId":"test","dataVersion":data_version(files),"files":files,"provenance":{"algorithm":"rfc6962-sha256-jsonl-v1","root":merkle.merkle_root([merkle.leaf_hash(line)]).hex(),"entries":1}}
            raw=(json.dumps(manifest,indent=2)+"\n").encode(); (data/"manifest.json").write_bytes(raw); sha=hashlib.sha256(raw).hexdigest()
            timestamp=ots.Timestamp(bytes.fromhex(sha)); timestamp.attestations.append(ots.Attestation.pending("https://calendar.example"))
            proof=data/"versions"/sha/"manifest.json.ots"; proof.parent.mkdir(parents=True); proof.write_bytes(ots.DetachedTimestamp(bytes.fromhex(sha),timestamp).to_bytes())
            event={"schemaVersion":2,"manifestSha256":sha,"eventType":"ots.upgraded","witness":{"type":"ots","status":"pending"},"proof":f"public/data/versions/{sha}/manifest.json.ots","otsAttestationClaim":{"kind":"bitcoin-attestation-present"}}
            (data/"anchors.jsonl").write_text(json.dumps(event)+"\n", encoding="utf-8")
            original_root=verify_anchor.ROOT
            with patch.object(verify_anchor,"ROOT",root), patch.object(verify_anchor,"read_anchors",return_value=[event]), patch.object(verify_anchor,"proof_path",return_value=proof):
                result,_=verify_anchor.evaluate(verify_anchor.Source())
            self.assertEqual(result,"PENDING")

if __name__=="__main__": unittest.main()
