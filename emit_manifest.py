"""Publish the atomic, provenance-committing Manifest v2 (Phase 1 P1-01/02)."""
import hashlib
import json
import os
import sys
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

import merkle
from manifest_contract import DATASET_PATHS, SCHEMA_VERSION, data_version, strict_json_loads, validate_manifest

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "public" / "data"
MANIFEST = DATA_DIR / "manifest.json"
PROVENANCE = DATA_DIR / "provenance.jsonl"
LOCK = DATA_DIR / ".manifest.lock"
TRACKED_FILES = list(DATASET_PATHS)  # compatibility name for callers

def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def run_id():
    return os.environ.get("GITHUB_RUN_ID") or "local"

def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()

def generated_at_of(path):
    try:
        value = strict_json_loads(path.read_text(encoding="utf-8"), str(path))
        return value.get("generatedAt") if isinstance(value, dict) else None
    except (OSError, ValueError):
        return None

@contextmanager
def publication_lock():
    """Cross-process lock held across ledger append and manifest replacement."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    handle = LOCK.open("a+b")
    try:
        if os.name == "nt":
            import msvcrt
            handle.seek(0); handle.write(b"0"); handle.flush()
            msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        yield
    finally:
        if os.name == "nt":
            try: handle.seek(0); msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            except OSError: pass
        else:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        handle.close()

def atomic_write(path, body):
    with tempfile.NamedTemporaryFile("wb", dir=path.parent, delete=False) as tmp:
        tmp.write(body); tmp.flush(); os.fsync(tmp.fileno()); name = tmp.name
    os.replace(name, path)

def build_files():
    files, missing = {}, []
    for rel_path in DATASET_PATHS:
        path = ROOT / rel_path
        if not path.is_file():
            missing.append(rel_path); continue
        files[rel_path] = {"sha256": sha256_of(path), "bytes": path.stat().st_size, "generatedAt": generated_at_of(path)}
    return files, missing

def load_lines():
    if not PROVENANCE.exists(): return []
    raw = merkle.ledger_lines(PROVENANCE)
    # Fail closed before extending a ledger that no longer has valid JSON entries.
    for index, line in enumerate(raw, 1): strict_json_loads(line.decode("utf-8"), f"provenance line {index}")
    return raw

def load_existing_manifest():
    if not MANIFEST.exists(): return None
    raw = strict_json_loads(MANIFEST.read_text(encoding="utf-8"), str(MANIFEST))
    # v1 is a legitimate migration input, not malformed v2. It has no prefix
    # commitment and therefore cannot be reused as an anchored Phase-1 state.
    if isinstance(raw, dict) and raw.get("schemaVersion") is None:
        if not isinstance(raw.get("files"), dict) or not raw["files"]:
            raise ValueError("legacy Manifest has no usable files object")
        return None
    return validate_manifest(raw)

def manifest_bytes(manifest):
    return (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")

def build_manifest():
    """Compatibility helper: builds an uncommitted v2 candidate and missing list."""
    files, missing = build_files()
    if missing: return None, missing
    return {"schemaVersion": SCHEMA_VERSION, "generatedAt": utc_now(), "runId": run_id(), "dataVersion": data_version(files), "files": files, "provenance": {"algorithm": "rfc6962-sha256-jsonl-v1", "root": "0" * 64, "entries": 1}}, missing

def _events_for_version(files, version, timestamp, start):
    return [json.dumps({"schemaVersion": 2, "ts": timestamp, "runId": run_id(), "dataVersion": version,
                        "entryIndex": start + offset, "entryCount": len(files), "file": path,
                        **entry}, sort_keys=True, separators=(",", ":")) .encode("utf-8")
            for offset, (path, entry) in enumerate(sorted(files.items()), 1)]

def _validate_committed_prefix(existing, lines):
    """Refuse to extend a Manifest whose already-committed ledger prefix changed."""
    entries = existing["provenance"]["entries"]
    if len(lines) < entries:
        raise ValueError("existing Manifest provenance prefix is missing from ledger")
    root = merkle.merkle_root([merkle.leaf_hash(line) for line in lines[:entries]]).hex()
    if root != existing["provenance"]["root"]:
        raise ValueError("existing Manifest provenance prefix does not match ledger")

def _complete_recovery_tail(tail, files, version, start):
    """Return whether *tail* is exactly the one batch the current data requires."""
    if len(tail) != len(files):
        return False
    timestamp = tail[0].get("ts")
    batch_run_id = tail[0].get("runId")
    if not isinstance(timestamp, str) or not timestamp or not isinstance(batch_run_id, str) or not batch_run_id:
        return False
    expected_indices = set(range(start + 1, start + len(files) + 1))
    seen_paths = set()
    for item in tail:
        path = item.get("file")
        if (item.get("schemaVersion") != SCHEMA_VERSION or item.get("dataVersion") != version
                or item.get("entryCount") != len(files) or item.get("ts") != timestamp
                or item.get("runId") != batch_run_id or item.get("entryIndex") not in expected_indices
                or path in seen_paths or path not in files):
            return False
        seen_paths.add(path)
        descriptor = files[path]
        if any(item.get(field) != descriptor[field] for field in ("sha256", "bytes", "generatedAt")):
            return False
    return seen_paths == set(files) and {item["entryIndex"] for item in tail} == expected_indices

def publish():
    files, missing = build_files()
    if missing: raise ValueError(f"cannot build manifest, missing data file(s): {missing}")
    version = data_version(files)
    with publication_lock():
        lines = load_lines()
        existing = load_existing_manifest()
        # This check applies even when data has changed.  Otherwise a damaged
        # committed prefix could be silently carried forward into a new root.
        if existing:
            _validate_committed_prefix(existing, lines)
        # Exact v2 state is a byte-for-byte no-op. This is the normal refresh path.
        if existing and existing["dataVersion"] == version and existing["files"] == files:
            return existing, False
        # Crash recovery: a completed v2 batch may have reached/fsynced the
        # ledger before the atomic Manifest replacement. Reconstruct it once;
        # never append a duplicate version. Any incomplete v2 tail is unsafe.
        start = existing["provenance"]["entries"] if existing else 0
        tail = [strict_json_loads(raw.decode("utf-8"), "provenance tail") for raw in lines[start:]]
        if tail:
            if not _complete_recovery_tail(tail, files, version, start):
                raise ValueError("incomplete or unrelated unreferenced provenance tail; append-only recovery is required")
            root = merkle.merkle_root([merkle.leaf_hash(line) for line in lines]).hex()
            timestamp = tail[0]["ts"]
            recovered = {"schemaVersion": SCHEMA_VERSION, "generatedAt": timestamp, "runId": tail[0]["runId"], "dataVersion": version,
                         "files": files, "provenance": {"algorithm": "rfc6962-sha256-jsonl-v1", "root": root, "entries": len(lines)}}
            validate_manifest(recovered)
            atomic_write(MANIFEST, manifest_bytes(recovered))
            return recovered, True
        timestamp = utc_now()
        additions = _events_for_version(files, version, timestamp, len(lines))
        all_lines = lines + additions
        root = merkle.merkle_root([merkle.leaf_hash(line) for line in all_lines]).hex()
        manifest = {"schemaVersion": SCHEMA_VERSION, "generatedAt": timestamp, "runId": run_id(), "dataVersion": version,
                    "files": files, "provenance": {"algorithm": "rfc6962-sha256-jsonl-v1", "root": root, "entries": len(all_lines)}}
        validate_manifest(manifest)
        # Ledger append is fsynced before the manifest; recovery can safely recreate a missing manifest.
        with PROVENANCE.open("ab") as handle:
            for line in additions: handle.write(line + b"\n")
            handle.flush(); os.fsync(handle.fileno())
        atomic_write(MANIFEST, manifest_bytes(manifest))
        return manifest, True

def main():
    try: manifest, changed = publish()
    except ValueError as exc:
        print(f"ERROR: {exc}"); return 1
    print(f"Manifest v2 {manifest['dataVersion']} ({'published' if changed else 'unchanged'})")
    print(f"Committed provenance prefix: {manifest['provenance']['entries']} entries, {manifest['provenance']['root']}")
    return 0

if __name__ == "__main__": sys.exit(main())
