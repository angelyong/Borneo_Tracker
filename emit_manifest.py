"""
Borneo Tracker — data provenance manifest (loop engineering, item D13).

WHY THIS EXISTS
    (a) VERIFIABLE DEPLOY. The deploy workflow (and anyone else) can hash the
        JSON actually served from production and compare it to the sha256 the
        pipeline recorded here. Byte-identical => what the public sees is exactly
        what the pipeline produced; different => the deploy is stale, truncated,
        cached or tampered with. Without this the deploy is another open loop
        that reports success without evidence.
    (b) AUDIT TRAIL / BLOCKCHAIN SEAM (ABCDE letter "B"). provenance.jsonl is an
        append-only ledger of every distinct data version this project has ever
        published. A future anchoring step notarises those hashes (one per line,
        or a Merkle root over them) on-chain, which only works if the log is
        never rewritten and its line format never silently changes.
    Consequences of (b), treat as rules: NEVER truncate, reorder or rewrite
    provenance.jsonl; only append. Only ADD fields to a line, never rename or
    remove one.

WHAT IT WRITES
    public/data/manifest.json   — overwritten each run. UTC timestamp + a `files`
                                  map of {sha256, bytes, generatedAt} keyed by
                                  repo-relative POSIX path.
    public/data/provenance.jsonl — appended, ONE JSON LINE PER FILE PER RUN
                                  (chosen over one-line-per-run so a single line
                                  is a self-contained {file, hash} claim that can
                                  be hashed/anchored/queried on its own, with no
                                  nested structure to parse).

    The sha256 is of the FILE BYTES on disk. It is deliberately NOT embedded in
    the file it describes — a hash inside its own payload is self-referential and
    can never be recomputed by a verifier.

USAGE
    python emit_manifest.py                       (run_pipeline.py calls it last)
    import emit_manifest; emit_manifest.main()    -> returns the exit code
"""

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "public" / "data"
MANIFEST = DATA_DIR / "manifest.json"
PROVENANCE = DATA_DIR / "provenance.jsonl"

# Repo-relative POSIX paths — these strings are the manifest's public keys, so a
# consumer (the deploy smoke test) can map them straight onto served URLs.
TRACKED_FILES = [
    "public/data/indicators.json",
    "public/data/resilience.json",
    "public/data/districts.json",
]


def utc_now():
    """ISO-8601 UTC, seconds precision, explicit Z — stable and sortable."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def run_id():
    """CI run identity, so a provenance line can be traced back to its Action run."""
    return os.environ.get("GITHUB_RUN_ID") or "local"


def sha256_of(path):
    """SHA-256 of the file BYTES (streamed, so it never depends on JSON parsing)."""
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def generated_at_of(path):
    """The data file's own `generatedAt`, carried into the manifest so a verifier
    sees WHEN the bytes were produced without re-downloading the file."""
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("generatedAt")
    except (json.JSONDecodeError, UnicodeDecodeError, OSError):
        return None


def build_manifest():
    """Returns (manifest_dict, missing_files)."""
    files = {}
    missing = []
    for rel_path in TRACKED_FILES:
        path = ROOT / rel_path
        if not path.exists():
            missing.append(rel_path)
            continue
        files[rel_path] = {
            "sha256": sha256_of(path),
            "bytes": path.stat().st_size,
            "generatedAt": generated_at_of(path),
        }
    return {"generatedAt": utc_now(), "runId": run_id(), "files": files}, missing


def append_provenance(manifest):
    """Append one line per file. Opened in 'a' mode ONLY — never 'w'."""
    PROVENANCE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROVENANCE, "a", encoding="utf-8", newline="\n") as handle:
        for rel_path, entry in manifest["files"].items():
            handle.write(json.dumps({
                "ts": manifest["generatedAt"],
                "runId": manifest["runId"],
                "file": rel_path,
                "sha256": entry["sha256"],
                "bytes": entry["bytes"],
                "generatedAt": entry["generatedAt"],
            }, sort_keys=True) + "\n")


def main():
    manifest, missing = build_manifest()
    if missing:
        print(f"ERROR: cannot build manifest, missing data file(s): {missing}")
        return 1

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    append_provenance(manifest)

    print(f"Manifest {manifest['generatedAt']} (run {manifest['runId']}):")
    for rel_path, entry in manifest["files"].items():
        print(f"  {entry['sha256'][:16]}...  {entry['bytes']:>8,} B  "
              f"generatedAt={entry['generatedAt']}  {rel_path}")
    lines = sum(1 for _ in PROVENANCE.open(encoding="utf-8"))
    print(f"Wrote -> public/data/manifest.json; appended {len(manifest['files'])} line(s) "
          f"-> public/data/provenance.jsonl ({lines} total)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
