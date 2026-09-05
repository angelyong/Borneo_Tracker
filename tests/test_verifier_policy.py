"""Policy regression: self-hosted witness metadata never earns confirmed."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
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

def _published_fixture():
    """One coherent publication, in memory, as a remote host would serve it."""
    files={}; payloads={}
    for index, rel in enumerate(DATASET_PATHS):
        body=f"{{\"n\":{index}}}\n".encode(); payloads[rel]=body
        files[rel]={"sha256":hashlib.sha256(body).hexdigest(),"bytes":len(body),"generatedAt":None}
    line=b'{"legacy":true}'; payloads["public/data/provenance.jsonl"]=line+b"\n"
    manifest={"schemaVersion":2,"generatedAt":"2026-08-09T00:00:00Z","runId":"test","dataVersion":data_version(files),"files":files,"provenance":{"algorithm":"rfc6962-sha256-jsonl-v1","root":merkle.merkle_root([merkle.leaf_hash(line)]).hex(),"entries":1}}
    raw=(json.dumps(manifest,indent=2)+"\n").encode(); payloads["public/data/manifest.json"]=raw
    sha=hashlib.sha256(raw).hexdigest()
    timestamp=ots.Timestamp(bytes.fromhex(sha)); timestamp.attestations.append(ots.Attestation.pending("https://calendar.example"))
    proof_rel=f"public/data/versions/{sha}/manifest.json.ots"
    proof_bytes=ots.DetachedTimestamp(bytes.fromhex(sha),timestamp).to_bytes(); payloads[proof_rel]=proof_bytes
    event={"schemaVersion":2,"manifestSha256":sha,"eventType":"ots.upgraded","witness":{"type":"ots","status":"pending"},"proof":proof_rel,"otsAttestationClaim":{"kind":"bitcoin-attestation-present"}}
    payloads["public/data/anchors.jsonl"]=(json.dumps(event)+"\n").encode()
    return payloads, raw, proof_bytes

class _RemoteSource(verify_anchor.Source):
    """A --remote Source serving the fixture, so no network is touched."""
    def __init__(self, payloads):
        super().__init__("https://production.example"); self._payloads=payloads
    def get(self, rel):
        self.error=None if rel in self._payloads else "missing"
        return self._payloads.get(rel)

class RemoteBitcoinVerificationTests(unittest.TestCase):
    """--verify-bitcoin-core is either honoured or reported, never dropped.

    It used to be skipped whenever --remote was given, so the combination
    returned a reassuring PENDING without any Bitcoin check having happened.
    """
    def test_bitcoin_flag_is_not_silently_ignored_under_remote(self):
        payloads, raw, proof_bytes = _published_fixture(); seen={}
        def fake_run(cmd, cwd=None, **kwargs):
            seen["subject"]=Path(cwd,"manifest.json").read_bytes(); seen["proof"]=Path(cmd[-1]).read_bytes()
            return SimpleNamespace(returncode=0, stdout="", stderr="")
        with patch.object(verify_anchor.subprocess,"run",side_effect=fake_run) as run:
            result,_=verify_anchor.evaluate(_RemoteSource(payloads), verify_with_ots=True)
        self.assertTrue(run.called, "--verify-bitcoin-core must never be dropped under --remote")
        self.assertEqual(result,"VERIFIED_CONFIRMED")
        # The official client must see what production served, not the worktree.
        self.assertEqual(seen["subject"], raw)
        self.assertEqual(seen["proof"], proof_bytes)

    def test_missing_official_client_is_reported_not_passed_over(self):
        payloads,_,_=_published_fixture()
        with patch.object(verify_anchor.subprocess,"run",side_effect=OSError("ots not found")):
            result,detail=verify_anchor.evaluate(_RemoteSource(payloads), verify_with_ots=True)
        self.assertEqual(result,"INVALID")
        self.assertIn("opentimestamps.org", detail)

    def test_unconfirmed_official_result_stays_pending(self):
        payloads,_,_=_published_fixture()
        with patch.object(verify_anchor.subprocess,"run",return_value=SimpleNamespace(returncode=1,stdout="",stderr="pending confirmation")):
            result,detail=verify_anchor.evaluate(_RemoteSource(payloads), verify_with_ots=True)
        self.assertEqual(result,"PENDING")
        self.assertIn("pending confirmation", detail)

    def test_without_the_flag_nothing_is_executed(self):
        payloads,_,_=_published_fixture()
        with patch.object(verify_anchor.subprocess,"run") as run:
            result,_=verify_anchor.evaluate(_RemoteSource(payloads))
        self.assertFalse(run.called)
        self.assertEqual(result,"PENDING")

if __name__=="__main__": unittest.main()
