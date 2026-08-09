"""Verify the public OTS/event discovery contract without claiming Bitcoin proof."""
import argparse, hashlib
from pathlib import Path
from verify_anchor import proof_binds_manifest
from witness_events import parse_events, reduce_events

def verify(data_dir):
    data=Path(data_dir); manifest=(data/"manifest.json").read_bytes(); sha=hashlib.sha256(manifest).hexdigest()
    version=data/"versions"/sha/"manifest.json"
    if version.read_bytes()!=manifest: raise ValueError("versioned Manifest bytes differ from latest Manifest")
    if not proof_binds_manifest(manifest,(data/"manifest.json.ots").read_bytes()): raise ValueError("latest OTS proof does not bind Manifest")
    if not proof_binds_manifest(manifest,(version.parent/"manifest.json.ots").read_bytes()): raise ValueError("versioned OTS proof does not bind Manifest")
    state=reduce_events(parse_events((data/"anchors.jsonl").read_text(encoding="utf-8")),sha)
    expected=f"public/data/versions/{sha}/manifest.json.ots"
    if not state["ots"] or state["ots"].get("proof")!=expected: raise ValueError("anchor event does not identify matching version proof")
    return sha

def main(argv=None):
    parser=argparse.ArgumentParser(); parser.add_argument("data_dir",type=Path); args=parser.parse_args(argv)
    try: print(f"Proof contract verified: {verify(args.data_dir)}")
    except (OSError, ValueError) as exc: print(f"ERROR: {exc}"); return 1
    return 0
if __name__=="__main__": raise SystemExit(main())
