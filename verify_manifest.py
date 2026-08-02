"""Verify the byte-level Borneo Tracker data-manifest contract locally.

Usage:
    python verify_manifest.py verify public/data
    python verify_manifest.py verify dist/data

This is intentionally stdlib-only so local ZIP preparation, GitHub Actions and
independent review can use the same verification rules without network access.
"""

import argparse
import hashlib
import json
from pathlib import Path


REQUIRED_FILES = ("indicators.json", "resilience.json", "districts.json")
HEX64 = set("0123456789abcdef")


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def manifest_entries(data_dir: Path) -> dict[str, dict]:
    """Read the canonical manifest shape and return entries by public basename."""
    manifest_path = data_dir / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{manifest_path}: invalid manifest JSON: {error}") from error

    files = manifest.get("files") if isinstance(manifest, dict) else None
    if not isinstance(files, dict):
        raise ValueError(f"{manifest_path}: expected a files object")

    entries = {}
    for public_path, entry in files.items():
        if not isinstance(entry, dict):
            raise ValueError(f"{manifest_path}: {public_path!r} is not an object")
        name = Path(str(public_path)).name
        if name in entries:
            raise ValueError(f"{manifest_path}: duplicate basename {name!r}")
        entries[name] = entry
    return entries


def verify_data_dir(data_dir: Path) -> list[str]:
    """Return human-readable byte-contract errors; an empty list means valid."""
    errors = []
    try:
        entries = manifest_entries(data_dir)
    except ValueError as error:
        return [str(error)]

    for name in REQUIRED_FILES:
        if name not in entries:
            errors.append(f"manifest is missing required entry {name!r}")

    for name, entry in sorted(entries.items()):
        expected_hash = entry.get("sha256")
        expected_bytes = entry.get("bytes")
        path = data_dir / name
        if not isinstance(expected_hash, str) or len(expected_hash) != 64 or set(expected_hash) - HEX64:
            errors.append(f"manifest {name}: invalid sha256")
        if not isinstance(expected_bytes, int) or expected_bytes < 0:
            errors.append(f"manifest {name}: invalid byte count")
        if not path.is_file():
            errors.append(f"missing data file {path}")
            continue
        actual_hash = sha256_of(path)
        actual_bytes = path.stat().st_size
        if actual_hash != expected_hash:
            errors.append(
                f"{name}: sha256 mismatch (manifest {expected_hash}, actual {actual_hash})"
            )
        if actual_bytes != expected_bytes:
            errors.append(
                f"{name}: byte count mismatch (manifest {expected_bytes}, actual {actual_bytes})"
            )
    return errors


def expected_snapshot(data_dir: Path) -> dict:
    """Return the immutable deploy expectation for the three public artifacts."""
    errors = verify_data_dir(data_dir)
    if errors:
        raise ValueError("; ".join(errors))
    entries = manifest_entries(data_dir)
    try:
        generated_at = json.loads((data_dir / "indicators.json").read_text(encoding="utf-8"))["generatedAt"]
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, KeyError) as error:
        raise ValueError(f"{data_dir / 'indicators.json'}: missing valid generatedAt: {error}") from error
    return {
        "generatedAt": generated_at,
        "files": {name: entries[name] for name in REQUIRED_FILES},
    }


def verify_remote_data_dir(remote_data_dir: Path, expected_path: Path) -> list[str]:
    """Verify downloaded production data against the just-built expectation."""
    try:
        expected = json.loads(expected_path.read_text(encoding="utf-8"))
        expected_files = expected["files"]
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError) as error:
        return [f"{expected_path}: invalid expected manifest snapshot: {error}"]

    errors = []
    try:
        remote_entries = manifest_entries(remote_data_dir)
    except ValueError as error:
        return [str(error)]

    for name in REQUIRED_FILES:
        expected_entry = expected_files.get(name) if isinstance(expected_files, dict) else None
        remote_entry = remote_entries.get(name)
        if not isinstance(expected_entry, dict):
            errors.append(f"expected snapshot is missing required entry {name!r}")
            continue
        if not isinstance(remote_entry, dict):
            errors.append(f"production manifest is missing required entry {name!r}")
            continue
        for field in ("sha256", "bytes"):
            if remote_entry.get(field) != expected_entry.get(field):
                errors.append(
                    f"production manifest {name}: {field} is {remote_entry.get(field)!r}, "
                    f"expected {expected_entry.get(field)!r}"
                )

        path = remote_data_dir / name
        if not path.is_file():
            errors.append(f"production download is missing {name!r}")
            continue
        actual_hash = sha256_of(path)
        actual_bytes = path.stat().st_size
        if actual_hash != expected_entry.get("sha256"):
            errors.append(
                f"production {name}: sha256 mismatch (expected {expected_entry.get('sha256')}, actual {actual_hash})"
            )
        if actual_bytes != expected_entry.get("bytes"):
            errors.append(
                f"production {name}: byte count mismatch (expected {expected_entry.get('bytes')}, actual {actual_bytes})"
            )
    return errors


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    verify_parser = subparsers.add_parser("verify", help="verify local public/data or dist/data")
    verify_parser.add_argument("data_dir", type=Path)
    verify_parser.add_argument("--expected-out", type=Path)
    remote_parser = subparsers.add_parser("verify-remote", help="verify downloaded production JSON")
    remote_parser.add_argument("remote_data_dir", type=Path)
    remote_parser.add_argument("expected_snapshot", type=Path)
    args = parser.parse_args(argv)
    if args.command == "verify":
        errors = verify_data_dir(args.data_dir)
        if not errors and args.expected_out:
            snapshot = expected_snapshot(args.data_dir)
            args.expected_out.write_text(
                json.dumps(snapshot, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
            )
            print(f"Wrote expected snapshot: {args.expected_out}")
    else:
        errors = verify_remote_data_dir(args.remote_data_dir, args.expected_snapshot)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    if args.command == "verify":
        print(f"Manifest verified: {args.data_dir}")
    else:
        print(f"Production data verified: {args.remote_data_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
