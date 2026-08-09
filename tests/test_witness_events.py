import unittest
from witness_events import parse_events, reduce_events

SHA = "a" * 64
PROOF = f"public/data/versions/{SHA}/manifest.json.ots"

class WitnessReducerTests(unittest.TestCase):
    def event(self, typ, status, **extra):
        return {"schemaVersion":2,"manifestSha256":SHA,"eventType":typ,"witness":{"type":"ots" if typ.startswith("ots") else "sigstore","status":status},**extra}
    def test_upgrade_preserves_sigstore_and_cannot_downgrade(self):
        stamp=self.event("ots.stamped","pending",proof=PROOF)
        sig=self.event("sigstore.attested","attested",sigstore={"present":True})
        upgraded=self.event("ots.upgraded","pending",proof=PROOF,otsAttestationClaim={"kind":"bitcoin-attestation-present"})
        downgrade=self.event("ots.stamped","pending",proof=PROOF)
        state=reduce_events([stamp,sig,upgraded,downgrade],SHA)
        self.assertEqual(state["ots"]["eventType"],"ots.upgraded")
        self.assertEqual(state["sigstore"]["sigstore"],{"present":True})
    def test_unknown_event_and_traversal_fail_closed(self):
        with self.assertRaises(ValueError): reduce_events([self.event("bad","pending")],SHA)
        with self.assertRaises(ValueError): reduce_events([self.event("ots.stamped","pending",proof="../proof.ots")],SHA)
    def test_event_type_cannot_claim_another_witness_or_status(self):
        with self.assertRaises(ValueError): reduce_events([self.event("ots.stamped","confirmed",proof=PROOF)],SHA)
        with self.assertRaises(ValueError): reduce_events([self.event("sigstore.attested","pending")],SHA)
        with self.assertRaises(ValueError): reduce_events([{"schemaVersion":1,"manifestSha256":SHA}],SHA)
    def test_malformed_event_for_another_manifest_fails_the_log(self):
        other="b"*64
        valid=self.event("ots.stamped","pending",proof=PROOF)
        malformed={"schemaVersion":2,"manifestSha256":other,"eventType":"ots.stamped","witness":{"type":"ots","status":"confirmed"},"proof":f"public/data/versions/{other}/manifest.json.ots"}
        with self.assertRaises(ValueError): reduce_events([valid,malformed],SHA)
    def test_legacy_event_is_mapped_to_a_canonical_versioned_path(self):
        legacy={"type":"stamp","manifestSha256":SHA,"status":"pending","proof":"public/data/anchors/old.ots"}
        state=reduce_events([legacy],SHA)
        self.assertEqual(state["ots"]["proof"],PROOF)
        self.assertEqual(parse_events(__import__("json").dumps(legacy))[0]["proof"],PROOF)

if __name__ == "__main__": unittest.main()
