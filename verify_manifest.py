"""Manifest-v2-driven local and remote byte-contract verification."""
import argparse, hashlib, json
from pathlib import Path
import merkle
from manifest_contract import DATASET_PATHS, strict_json_loads, validate_manifest

def sha256_of(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""): digest.update(chunk)
    return digest.hexdigest()

def read_manifest(data_dir):
    path = Path(data_dir) / "manifest.json"
    try: return validate_manifest(strict_json_loads(path.read_text(encoding="utf-8"), str(path)))
    except (OSError, ValueError) as exc: raise ValueError(f"{path}: {exc}") from exc

def verify_data_dir(data_dir, *, verify_provenance=True):
    data_dir, errors = Path(data_dir), []
    try: manifest = read_manifest(data_dir)
    except ValueError as exc: return [str(exc)]
    for rel_path in DATASET_PATHS:
        entry, path = manifest["files"][rel_path], data_dir / Path(rel_path).name
        if not path.is_file(): errors.append(f"missing data file {path}"); continue
        if sha256_of(path) != entry["sha256"]: errors.append(f"{rel_path}: sha256 mismatch")
        if path.stat().st_size != entry["bytes"]: errors.append(f"{rel_path}: byte count mismatch")
    if verify_provenance:
        ledger = data_dir / "provenance.jsonl"
        try:
            root, count = merkle.merkle_root_of_file(ledger, manifest["provenance"]["entries"])
            if root != manifest["provenance"]["root"] or count != manifest["provenance"]["entries"]:
                errors.append("provenance ledger prefix does not match Manifest commitment")
        except (OSError, ValueError) as exc: errors.append(f"provenance ledger: {exc}")
    return errors

def expected_snapshot(data_dir):
    errors = verify_data_dir(data_dir)
    if errors: raise ValueError("; ".join(errors))
    manifest = read_manifest(data_dir)
    return {"schemaVersion": 2, "dataVersion": manifest["dataVersion"], "files": manifest["files"]}

def verify_remote_data_dir(remote_data_dir, expected_path):
    try:
        expected = strict_json_loads(Path(expected_path).read_text(encoding="utf-8"), str(expected_path))
        files = expected["files"]
        # validate with a synthetic but structurally complete manifest
        manifest = {"schemaVersion": 2, "generatedAt": "2000-01-01T00:00:00Z", "runId": "expected", "dataVersion": expected["dataVersion"], "files": files, "provenance": {"algorithm":"rfc6962-sha256-jsonl-v1", "root":"0"*64, "entries":1}}
        validate_manifest(manifest)
    except (OSError, KeyError, ValueError) as exc: return [f"{expected_path}: invalid expected snapshot: {exc}"]
    remote, errors = Path(remote_data_dir), []
    try: remote_manifest = read_manifest(remote)
    except ValueError as exc: return [str(exc)]
    for rel_path in DATASET_PATHS:
        entry, remote_entry = files[rel_path], remote_manifest["files"].get(rel_path)
        path = remote / Path(rel_path).name
        if remote_entry != entry: errors.append(f"production manifest differs for {rel_path}")
        if not path.is_file(): errors.append(f"production download is missing {rel_path}"); continue
        raw = path.read_bytes()
        if raw.lstrip().lower().startswith(b"<!doctype") or b"<html" in raw[:512].lower(): errors.append(f"production {rel_path}: received SPA HTML fallback"); continue
        if hashlib.sha256(raw).hexdigest() != entry["sha256"]: errors.append(f"production {rel_path}: sha256 mismatch")
        if len(raw) != entry["bytes"]: errors.append(f"production {rel_path}: byte count mismatch")
    return errors

def main(argv=None):
    parser=argparse.ArgumentParser(); sub=parser.add_subparsers(dest="command", required=True)
    v=sub.add_parser("verify"); v.add_argument("data_dir",type=Path); v.add_argument("--expected-out",type=Path)
    r=sub.add_parser("verify-remote"); r.add_argument("remote_data_dir",type=Path); r.add_argument("expected_snapshot",type=Path)
    sub.add_parser("paths", help="print the canonical Phase-1 dataset paths")
    args=parser.parse_args(argv)
    if args.command == "paths":
        print("\n".join(DATASET_PATHS)); return 0
    if args.command == "verify":
        errors=verify_data_dir(args.data_dir)
        if not errors and args.expected_out: args.expected_out.write_text(json.dumps(expected_snapshot(args.data_dir),indent=2,sort_keys=True)+"\n",encoding="utf-8",newline="\n")
    else: errors=verify_remote_data_dir(args.remote_data_dir,args.expected_snapshot)
    for error in errors: print(f"ERROR: {error}")
    if not errors: print("Manifest verified" if args.command=="verify" else "Production data verified")
    return 1 if errors else 0
if __name__ == "__main__": raise SystemExit(main())
