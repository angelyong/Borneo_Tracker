"""Monotonically merge pending OTS proofs without losing other witnesses."""
import os, sys
import ots
from anchor_provenance import CURRENT_PROOF, MANIFEST, append_anchor, atomic_bytes, proof_path, read_anchors, sha256_bytes
from emit_manifest import run_id, utc_now
from witness_events import reduce_events

def latest_status_by_manifest(events):
    keys={e.get("manifestSha256") for e in events if e.get("manifestSha256")}
    return {key:reduce_events(events,key) for key in keys}
def main(argv=None):
    dry="--dry-run" in (sys.argv[1:] if argv is None else argv); events=read_anchors(); count=0
    for sha,state in latest_status_by_manifest(events).items():
        event=state["ots"]
        if not event or event["witness"]["status"]!="pending": continue
        path=proof_path(sha)
        if not path.exists(): print(f"ERROR: missing proof {path}"); continue
        try: detached=ots.DetachedTimestamp.from_bytes(path.read_bytes())
        except ots.OtsError as exc: print(f"ERROR: invalid proof {path}: {exc}"); continue
        if detached.digest.hex()!=sha: print(f"ERROR: proof subject mismatch {path}"); continue
        before=sha256_bytes(path.read_bytes())
        if dry: print(f"Would upgrade {sha}"); continue
        if not ots.upgrade(detached): continue
        claim,blocks=detached.status()
        if claim!="confirmed": continue
        blob=detached.to_bytes()
        # A merge that does not strengthen bytes is idempotent; do not append noise.
        if sha256_bytes(blob)==before: continue
        atomic_bytes(path,blob)
        if MANIFEST.exists() and sha256_bytes(MANIFEST.read_bytes())==sha: atomic_bytes(CURRENT_PROOF,blob)
        # Keep the original data/signing identity stable: an upgrade is proof
        # maintenance, not a new attestation of different data. Record the
        # upgrader separately so auditors can distinguish both operations.
        append_anchor({
            "schemaVersion":2,
            "ts":utc_now(),
            "runId":run_id(),
            "manifestSha256":sha,
            "sourceCommitSha":event.get("sourceCommitSha", event.get("dataCommitSha", "legacy")),
            "dataCommitSha":event.get("dataCommitSha", event.get("sourceCommitSha", "legacy")),
            "signerSourceSha":event.get("signerSourceSha", event.get("sourceCommitSha", "legacy")),
            "signerWorkflow":event.get("signerWorkflow", "legacy"),
            "signerRef":event.get("signerRef", "legacy"),
            "eventType":"ots.upgraded",
            "witness":{"type":"ots","status":"pending"},
            "proof":path.relative_to(__import__('pathlib').Path(__file__).parent).as_posix(),
            "proofSha256Before":before,
            "proofSha256After":sha256_bytes(blob),
            "upgradeSignerSourceSha":os.environ.get("GITHUB_SHA", "local"),
            "upgradeSignerWorkflow":".github/workflows/anchor-upgrade.yml",
            "upgradeSignerRef":os.environ.get("GITHUB_REF", "local"),
            "upgradeWorkflowRunId":os.environ.get("GITHUB_RUN_ID", "local"),
            "otsAttestationClaim":{"kind":"bitcoin-attestation-present","blocks":blocks},
        })
        count+=1
    print(f"Upgraded {count} proof(s)."); return 0
if __name__=="__main__": sys.exit(main())
