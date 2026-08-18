"""One-time, append-only migration of known v1 Manifest/proof pairs from Git."""
import hashlib, subprocess, sys
import ots
from anchor_provenance import ROOT, append_anchor, atomic_bytes, manifest_path, proof_path, read_anchors
from emit_manifest import run_id, utc_now

LEGACY={"e533d68fd34741bd13f0f458cff83e6ea3cd5cb8479a166612541871e7ad3e30":"d9d6d4093f350f3734a880573d47079b1d5850de","9cd31c46f08e85e9dfa77bc6dd95cb36f04d187995e5e3cbded580c5a8df283a":"a9e18b1449222109baf020115c5ed7f4d26aaebb","6b4660a93671435b5e76a5a578bc11ab966bb2fb2b83bf2fa861ee23b1de7d4e":"aa564351a9647cc5c136db8672bf5fb8172cfdf6"}
def main(argv=None):
    dry="--dry-run" in (argv or sys.argv[1:])
    existing={(event.get("manifestSha256"), event.get("eventType")) for event in read_anchors()}
    for sha,commit in LEGACY.items():
        raw=subprocess.check_output(["git","show",f"{commit}:public/data/manifest.json"],cwd=ROOT)
        if hashlib.sha256(raw).hexdigest()!=sha: raise RuntimeError(f"{commit}: manifest digest mismatch")
        legacy=ROOT/"public/data/anchors"/f"{sha[:16]}.ots"
        if not legacy.is_file(): raise RuntimeError(f"missing legacy proof {legacy}")
        try:
            detached=ots.DetachedTimestamp.from_bytes(legacy.read_bytes())
        except ots.OtsError as exc: raise RuntimeError(f"invalid legacy proof {legacy}: {exc}") from exc
        if detached.digest.hex()!=sha: raise RuntimeError(f"legacy proof subject mismatch {legacy}")
        if dry: print(f"would migrate {sha}"); continue
        snapshot,target_proof=manifest_path(sha),proof_path(sha)
        if snapshot.exists() and snapshot.read_bytes()!=raw: raise RuntimeError(f"immutable snapshot conflict {snapshot}")
        if not snapshot.exists(): atomic_bytes(snapshot,raw)
        if not target_proof.exists(): atomic_bytes(target_proof,legacy.read_bytes())
        if (sha,"legacy.migrated") not in existing:
            append_anchor({"schemaVersion":2,"ts":utc_now(),"runId":run_id(),"manifestSha256":sha,"eventType":"legacy.migrated","witness":{"type":"ots","status":"pending"},"proof":target_proof.relative_to(ROOT).as_posix(),"legacySourceCommit":commit,"proofSha256After":hashlib.sha256(target_proof.read_bytes()).hexdigest()})
    return 0
if __name__=="__main__": raise SystemExit(main())
