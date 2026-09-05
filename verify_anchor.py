"""Truthful Phase-1 verifier: bytes/proof binding, not Bitcoin-chain verification.

Use the official OTS browser verifier or `ots verify` backed by Bitcoin Core for
chain verification. Hosted CI only proves official-format compatibility here.
"""
import hashlib, json, sys, tempfile, urllib.error, urllib.request, subprocess
from pathlib import Path
import merkle, ots
from anchor_provenance import ANCHORS, CURRENT_PROOF, MANIFEST, proof_path, read_anchors
from manifest_contract import DATASET_PATHS, auxiliary_in_prefix, strict_json_loads, validate_manifest
from witness_events import parse_events, reduce_events, safe_proof_path

ROOT=Path(__file__).parent; DATA_DIR=ROOT/"public"/"data"
EXIT={"VERIFIED_CONFIRMED":0,"PENDING":2,"UNANCHORED":3,"MISMATCH":4,"INVALID":5}

def proof_binds_manifest(manifest_bytes, proof_bytes):
    """Format + subject binding only; intentionally not Bitcoin-chain verify."""
    try:
        detached=ots.DetachedTimestamp.from_bytes(proof_bytes)
    except ots.OtsError:
        return False
    return detached.digest.hex()==hashlib.sha256(manifest_bytes).hexdigest()

def official_ots_verify(manifest_bytes, proof_bytes):
    """Promote a result only via the official OTS CLI, over the exact bytes checked.

    The subject and its proof are materialised in a temporary directory rather
    than pointing the CLI at the working tree. Under --remote the subject is
    whatever production served, which need not match what is on disk; verifying
    the local copy and reporting it as a remote result would be precisely the
    false assurance this tool exists to prevent. For a local run the bytes are
    identical either way, so one path serves both.
    """
    with tempfile.TemporaryDirectory() as tmp:
        subject=Path(tmp)/"manifest.json"; proof=Path(tmp)/"manifest.json.ots"
        subject.write_bytes(manifest_bytes); proof.write_bytes(proof_bytes)
        try:
            completed=subprocess.run(["ots","verify",str(proof)],cwd=tmp,capture_output=True,text=True,timeout=180)
        except (OSError, subprocess.SubprocessError) as exc:
            return "INVALID",(f"official OTS verifier unavailable: {exc}; install the OpenTimestamps "
                              "client, or verify manifest.json together with manifest.json.ots in a "
                              "browser at https://opentimestamps.org")
        if completed.returncode==0:
            return "VERIFIED_CONFIRMED","files/Manifest/proof verified by the official OTS CLI"
        return "PENDING","official OTS verification did not confirm inclusion: "+(completed.stderr.strip() or completed.stdout.strip())

class Source:
    def __init__(self,base=None): self.base=base.rstrip("/") if base else None; self.error=None
    def get(self,rel):
        self.error=None
        if not self.base:
            path=ROOT/rel
            if not path.is_file(): self.error="missing"; return None
            return path.read_bytes()
        try:
            with urllib.request.urlopen(urllib.request.Request(f"{self.base}/{rel.replace('public/','',1)}",headers={"Cache-Control":"no-cache"}),timeout=30) as r: raw=r.read(); typ=r.headers.get("Content-Type","")
        except (OSError,urllib.error.URLError) as exc: self.error=str(exc); return None
        if "text/html" in typ or raw.lstrip().lower().startswith(b"<!doctype") or b"<html" in raw[:512].lower(): self.error="SPA HTML fallback"; return None
        return raw

def evaluate(source, *, verify_with_ots=False):
    raw=source.get("public/data/manifest.json")
    if raw is None: return "INVALID",f"manifest unavailable: {source.error}"
    sha=hashlib.sha256(raw).hexdigest()
    try: manifest=validate_manifest(strict_json_loads(raw.decode("utf-8"),"manifest.json"))
    except ValueError as exc: return "INVALID",str(exc)
    for rel in DATASET_PATHS:
        body=source.get(rel); entry=manifest["files"][rel]
        if body is None: return "MISMATCH",f"{rel}: {source.error}"
        if hashlib.sha256(body).hexdigest()!=entry["sha256"] or len(body)!=entry["bytes"]: return "MISMATCH",f"{rel}: differs from Manifest"
    ledger=source.get("public/data/provenance.jsonl")
    if ledger is None: return "MISMATCH",f"provenance ledger: {source.error}"
    try:
        lines=[line for line in ledger.replace(b"\r\n",b"\n").split(b"\n") if line.strip()]
        root=merkle.merkle_root([merkle.leaf_hash(line) for line in lines[:manifest["provenance"]["entries"]]]).hex()
        if len(lines)<manifest["provenance"]["entries"] or root!=manifest["provenance"]["root"]: return "MISMATCH","provenance prefix mismatch"
        auxiliary=auxiliary_in_prefix(lines[:manifest["provenance"]["entries"]])
    except ValueError as exc: return "INVALID",str(exc)
    # Auxiliary files sit outside the Manifest's frozen `files` scope, so this is
    # the only check that covers them. The prefix above is proven, hence so are
    # the hashes it records.
    for rel,entry in auxiliary.items():
        body=source.get(rel)
        if body is None: return "MISMATCH",f"{rel}: {source.error}"
        if hashlib.sha256(body).hexdigest()!=entry["sha256"] or len(body)!=entry["bytes"]: return "MISMATCH",f"{rel}: differs from the provenance ledger"
    log=source.get("public/data/anchors.jsonl")
    if log is None: return "UNANCHORED","no readable anchor event log"
    try: state=reduce_events(read_anchors() if not source.base else parse_events(log.decode('utf-8')),sha)
    except ValueError as exc: return "INVALID",f"invalid anchor metadata: {exc}"
    ots_event=state["ots"]
    if not ots_event: return "UNANCHORED","no OTS event for this Manifest"
    if not safe_proof_path(ots_event.get("proof"), sha):
        return "INVALID", "unsafe OTS proof path"
    proof=source.get(ots_event["proof"])
    if proof is None: return "MISMATCH",f"proof unavailable: {source.error}"
    try: detached=ots.DetachedTimestamp.from_bytes(proof)
    except ots.OtsError as exc: return "INVALID",f"malformed OTS proof: {exc}"
    if not proof_binds_manifest(raw, proof): return "MISMATCH","OTS proof subject differs from Manifest"
    # Metadata in anchors.jsonl is mutable/self-hosted. It can never promote a
    # result by itself. The only promotion path executes the official CLI.
    # This deliberately does not depend on source.base: a request to verify
    # Bitcoin inclusion is either honoured or reported, never dropped.
    if verify_with_ots: return official_ots_verify(raw, proof)
    return "PENDING","files match Manifest and OTS proof binds it; external Bitcoin verification not recorded"

def main(argv=None):
    argv=sys.argv[1:] if argv is None else argv; allow="--allow-pending" in argv
    base=None
    if "--remote" in argv:
        i=argv.index("--remote"); base=argv[i+1] if len(argv)>i+1 and not argv[i+1].startswith("-") else "https://borneotracker.rentsmartprop.com.my"
    result,detail=evaluate(Source(base), verify_with_ots="--verify-bitcoin-core" in argv); code=EXIT[result]
    if result=="PENDING" and allow: code=0
    print(f"RESULT: {result} — {detail}")
    # The boundary statement has to track what actually happened, or it becomes
    # the same kind of stale claim it exists to prevent.
    if result=="VERIFIED_CONFIRMED":
        print("Boundary: Bitcoin inclusion was checked by the official OpenTimestamps client, not by this tool.")
    else:
        print("Boundary: this tool parses the proof but does not verify Bitcoin headers/inclusion; use official OTS verification for that.")
    return code
if __name__=="__main__": sys.exit(main())
