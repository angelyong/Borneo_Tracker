"""Stamp an immutable Manifest-v2 snapshot; never overwrite a stronger proof."""
import hashlib, json, os, sys, tempfile
from pathlib import Path
import ots
from emit_manifest import run_id, utc_now
from manifest_contract import strict_json_loads, validate_manifest
from witness_events import parse_events, reduce_events

ROOT=Path(__file__).parent; DATA_DIR=ROOT/"public"/"data"; MANIFEST=DATA_DIR/"manifest.json"; PROVENANCE=DATA_DIR/"provenance.jsonl"
ANCHORS=DATA_DIR/"anchors.jsonl"; VERSIONS=DATA_DIR/"versions"; CURRENT_PROOF=DATA_DIR/"manifest.json.ots"

def sha256_bytes(raw): return hashlib.sha256(raw).hexdigest()
def read_anchors():
    if not ANCHORS.exists(): return []
    return parse_events(ANCHORS.read_text(encoding="utf-8"))
def append_anchor(entry):
    ANCHORS.parent.mkdir(parents=True,exist_ok=True)
    with ANCHORS.open("a",encoding="utf-8",newline="\n") as f: f.write(json.dumps(entry,sort_keys=True,separators=(",",":"))+"\n"); f.flush(); os.fsync(f.fileno())
def version_dir(sha):
    if not isinstance(sha,str) or len(sha)!=64 or any(c not in "0123456789abcdef" for c in sha): raise ValueError("invalid Manifest SHA-256")
    return VERSIONS/sha
def proof_path(sha): return version_dir(sha)/"manifest.json.ots"
def manifest_path(sha): return version_dir(sha)/"manifest.json"
def atomic_bytes(path, body):
    path.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile("wb",dir=path.parent,delete=False) as tmp: tmp.write(body); tmp.flush(); os.fsync(tmp.fileno()); name=tmp.name
    os.replace(name,path)
def _manifest(requested_sha=None, manifest_file=None):
    # Catch-up supplies a byte-exact Manifest extracted with `git show` while
    # the worktree remains on master.  Never checkout/push a historical SHA.
    if manifest_file:
        path = Path(manifest_file)
    else:
        versioned = manifest_path(requested_sha) if requested_sha else None
        path = versioned if versioned and versioned.exists() else MANIFEST
    raw=path.read_bytes(); value=validate_manifest(strict_json_loads(raw.decode("utf-8"),str(path))); actual=sha256_bytes(raw)
    if requested_sha and actual != requested_sha: raise ValueError("requested version snapshot digest mismatch")
    return raw,value,actual
def read_sigstore_bundle(path, *, attestation_id=None, attestation_url=None):
    if not path: return None
    raw=Path(path).read_bytes(); item={"bundleSha256":sha256_bytes(raw)}
    if attestation_id: item["attestationId"] = attestation_id
    if attestation_url: item["attestationUrl"] = attestation_url
    try:
        bundle=strict_json_loads(raw.decode("utf-8"),str(path)); tlog=bundle["verificationMaterial"]["tlogEntries"][0]
        item.update({"logIndex":str(tlog.get("logIndex")),"integratedTime":str(tlog.get("integratedTime"))})
    except (OSError, ValueError, KeyError, IndexError, TypeError): pass
    return item
def _flag(argv,name):
    return argv[argv.index(name)+1] if name in argv and argv.index(name)+1<len(argv) else None

def sigstore_verification(argv, bundle):
    """Require evidence that the workflow ran the identity-constrained CLI gate."""
    if not bundle:
        if "--sigstore-verified" in argv:
            raise ValueError("--sigstore-verified requires --sigstore-bundle")
        return None
    if "--sigstore-verified" not in argv:
        raise ValueError("refusing to record an unverified Sigstore bundle")
    fields = {
        "repository": _flag(argv, "--sigstore-repository"),
        "signerWorkflow": _flag(argv, "--sigstore-signer-workflow"),
        "sourceRef": _flag(argv, "--sigstore-source-ref"),
        "sourceDigest": _flag(argv, "--sigstore-source-digest"),
    }
    if not all(isinstance(value, str) and value for value in fields.values()):
        raise ValueError("Sigstore verification policy is incomplete")
    return {"method": "gh-attestation-verify", **fields}

def event_context(argv):
    data_commit = _flag(argv, "--data-commit-sha") or _flag(argv, "--source-commit-sha") or os.environ.get("GITHUB_SHA", "local")
    signer_source = _flag(argv, "--signer-source-sha") or os.environ.get("GITHUB_SHA", "local")
    return {
        # sourceCommitSha remains for existing readers, but new events always
        # distinguish the historical data commit from the signing run context.
        "sourceCommitSha": data_commit,
        "dataCommitSha": data_commit,
        "signerSourceSha": signer_source,
        "signerWorkflow": _flag(argv, "--signer-workflow") or "local",
        "signerRef": _flag(argv, "--signer-ref") or "local",
    }

def main(argv=None):
    argv=sys.argv[1:] if argv is None else argv
    if "--force" in argv:
        print("ERROR: --force was removed: restamping could downgrade a confirmed proof."); return 5
    if not MANIFEST.exists() or not PROVENANCE.exists(): print("ERROR: Manifest v2 and provenance ledger are required"); return 5
    requested_sha=_flag(argv,"--manifest-sha"); manifest_file=_flag(argv,"--manifest-file")
    try:
        raw,manifest,sha=_manifest(requested_sha, manifest_file)
        events=read_anchors(); state=reduce_events(events,sha)
        sigstore=read_sigstore_bundle(_flag(argv,"--sigstore-bundle"), attestation_id=_flag(argv,"--sigstore-attestation-id"), attestation_url=_flag(argv,"--sigstore-attestation-url"))
        sigstore_policy=sigstore_verification(argv, sigstore)
    except ValueError as exc: print(f"ERROR: {exc}"); return 5
    snapshot=manifest_path(sha); proof=proof_path(sha)
    if snapshot.exists() and snapshot.read_bytes()!=raw: print("ERROR: immutable Manifest snapshot differs from current bytes"); return 4
    # A proof without a corresponding OTS event is an interrupted publication,
    # not permission to stamp again.  Replacing it could throw away a stronger
    # proof that reached Bitcoin before the event append failed.  Recovery must
    # validate that proof and append a deliberately auditable recovery event.
    if proof.exists() and not state["ots"]:
        print("ERROR: found an orphaned version proof; refuse to overwrite it. Recover and record its OTS event first.")
        return 4
    # Dry-run is an inspection mode.  In particular it must not create a
    # version snapshot or append a Sigstore event before deciding not to stamp.
    if "--dry-run" in argv:
        action="would preserve existing OTS proof" if state["ots"] else f"would stamp {snapshot}"
        print(f"DRY RUN: {action}"); return 0
    if not snapshot.exists(): atomic_bytes(snapshot,raw)
    if sigstore and not state["sigstore"]:
        append_anchor({"schemaVersion":2,"ts":utc_now(),"runId":run_id(),"manifestSha256":sha,**event_context(argv),"sigstoreSubjectSha256":sha,"eventType":"sigstore.attested","witness":{"type":"sigstore","status":"attested"},"sigstore":sigstore,"sigstoreVerification":sigstore_policy})
    if state["ots"]:
        print("Manifest already stamped; preserved its strongest OTS proof."); return 0
    try: timestamp,reached,failed=ots.submit(bytes.fromhex(sha))
    except ots.OtsError as exc: print(f"ERROR: {exc}"); return 5
    detached=ots.DetachedTimestamp(bytes.fromhex(sha),timestamp); blob=detached.to_bytes(); atomic_bytes(proof,blob)
    if MANIFEST.exists() and sha256_bytes(MANIFEST.read_bytes()) == sha: atomic_bytes(CURRENT_PROOF,blob)
    status, detail=detached.status()
    append_anchor({"schemaVersion":2,"ts":utc_now(),"runId":run_id(),"manifestSha256":sha,"manifestGeneratedAt":manifest["generatedAt"],"dataVersion":manifest["dataVersion"],**event_context(argv),"eventType":"ots.stamped","witness":{"type":"ots","status":"pending"},"proof":proof.relative_to(ROOT).as_posix(),"proofSha256Before":None,"proofSha256After":sha256_bytes(blob),"calendars":sorted(detail) if status=="pending" else [],"otsAttestationClaim":status})
    print(f"Stamped {sha}; {len(reached)} calendar(s) reached, {len(failed)} unavailable."); return 0
if __name__=="__main__": sys.exit(main())
