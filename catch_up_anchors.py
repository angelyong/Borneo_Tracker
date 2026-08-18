"""Safely redispatch exact historical v2 Manifest blobs missing OTS events."""
import argparse, hashlib, os, subprocess, sys
from anchor_provenance import ROOT, read_anchors
from manifest_contract import strict_json_loads, validate_manifest
from witness_events import reduce_events

VERSIONS=ROOT/"public/data/versions"; MANIFEST_REL="public/data/manifest.json"

def git_blobs(limit):
    """Bounded Git history only; never infer a byte sequence from branch tip."""
    commits=subprocess.check_output(["git","log","--all",f"--max-count={limit}","--format=%H","--",MANIFEST_REL],cwd=ROOT,text=True).splitlines()
    for commit in commits:
        try: raw=subprocess.check_output(["git","show",f"{commit}:{MANIFEST_REL}"],cwd=ROOT)
        except subprocess.CalledProcessError: continue
        sha=hashlib.sha256(raw).hexdigest()
        try: validate_manifest(strict_json_loads(raw.decode("utf-8"),f"{commit}:{MANIFEST_REL}"))
        except ValueError: continue  # v1/malformed history is not a safe catch-up candidate
        yield sha,commit

def version_blobs(history=None):
    """Yield committed v2 version snapshots only.

    v1 snapshots are retained as historical evidence and represented by their
    `legacy.migrated` event.  They do not satisfy the v2 Manifest contract and
    therefore must not crash or become fresh dispatch candidates.
    """
    if not VERSIONS.exists(): return
    if history is None:
        history = {}
        for sha, commit in git_blobs(500):
            history.setdefault(sha, commit)
    for directory in VERSIONS.iterdir():
        manifest=directory/"manifest.json"
        if not manifest.is_file(): continue
        raw=manifest.read_bytes(); sha=hashlib.sha256(raw).hexdigest()
        if directory.name!=sha: raise RuntimeError(f"version directory digest mismatch: {directory}")
        payload=strict_json_loads(raw.decode("utf-8"),str(manifest))
        if isinstance(payload,dict) and payload.get("schemaVersion") is None:
            continue
        validate_manifest(payload)
        # The snapshot could be absent from Git only in an uncommitted working
        # tree; do not dispatch it because a source commit cannot prove it.
        commit=history.get(sha)
        if commit: yield sha,commit

def missing_versions(limit=200):
    events=read_anchors()
    history={}
    for sha,commit in git_blobs(limit): history.setdefault(sha,commit)
    anchored={sha for sha in {event.get("manifestSha256") for event in events} if sha and reduce_events(events,sha)["ots"]}
    candidates=dict(history)
    for sha,commit in version_blobs(history) or ():
        candidates.setdefault(sha,commit)
    return sorted((sha,commit) for sha,commit in candidates.items() if sha not in anchored)

def dispatch(sha,commit):
    repo=os.environ.get("GITHUB_REPOSITORY")
    if not repo: raise RuntimeError("GITHUB_REPOSITORY is required for --dispatch")
    if not os.environ.get("GH_TOKEN"): raise RuntimeError("GH_TOKEN is required for --dispatch")
    subprocess.run(["gh","api",f"repos/{repo}/dispatches","-f","event_type=anchor-manifest", "-f",f"client_payload[sha]={commit}","-f",f"client_payload[manifest_sha]={sha}"],check=True,cwd=ROOT)

def main(argv=None):
    parser=argparse.ArgumentParser(); parser.add_argument("--dispatch",action="store_true"); parser.add_argument("--max-commits",type=int,default=200); args=parser.parse_args(argv)
    if not 1 <= args.max_commits <= 1000: raise SystemExit("--max-commits must be 1..1000")
    for sha,commit in missing_versions(args.max_commits):
        print(f"MISSING_OTS_EVENT {sha} sourceCommit={commit}")
        if args.dispatch: dispatch(sha,commit)
    return 0
if __name__=="__main__": raise SystemExit(main())
