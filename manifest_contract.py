"""Strict, shared Phase-1 Manifest v2 contract.

The contract is deliberately stdlib-only: emitters, CI, deploy smoke tests and
independent reviewers must use the same byte-level rules.
"""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import PurePosixPath

SCHEMA_VERSION = 2
DATASET_PATHS = (
    "public/data/indicators.json", "public/data/resilience.json",
    "public/data/resilience_model.json", "public/data/districts.json",
    "public/data/borneo_districts.geojson", "public/data/brunei.geojson",
)
# Auxiliary published files. Deliberately NOT in DATASET_PATHS: the Manifest's
# `files` scope is frozen at the six core datasets so that every Manifest ever
# published keeps validating (see build_resilience_history.py). Widening it
# would invalidate the whole anchored archive at once. These files are covered
# through the provenance ledger instead -- the Manifest commits to that ledger's
# Merkle root, and the OpenTimestamps proof anchors it, so a ledger row carries
# exactly the same tamper evidence without a schema break.
AUXILIARY_PATHS = (
    "public/data/resilience_history.json", "public/data/sources.json",
)
LEDGER_PATHS = DATASET_PATHS + AUXILIARY_PATHS
HEX64 = re.compile(r"^[0-9a-f]{64}$")
RFC3339_UTC = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")


def _no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key {key!r}")
        result[key] = value
    return result


def strict_json_loads(raw, label="JSON"):
    try:
        return json.loads(raw, object_pairs_hook=_no_duplicate_keys)
    except (TypeError, json.JSONDecodeError, ValueError) as exc:
        raise ValueError(f"{label}: invalid JSON: {exc}") from exc


def _is_safe_relative(path):
    parsed = PurePosixPath(path)
    return not parsed.is_absolute() and ".." not in parsed.parts and "\\" not in path


def safe_dataset_path(path):
    """A path the Manifest's frozen `files` scope may name."""
    return isinstance(path, str) and path in DATASET_PATHS and _is_safe_relative(path)


def safe_ledger_path(path):
    """A path the provenance ledger may name: core datasets plus auxiliaries."""
    return isinstance(path, str) and path in LEDGER_PATHS and _is_safe_relative(path)


def canonical_data_descriptors(files):
    descriptors = [
        {"path": path, "sha256": files[path]["sha256"], "bytes": files[path]["bytes"]}
        for path in sorted(files)
    ]
    return json.dumps(descriptors, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def data_version(files):
    return hashlib.sha256(canonical_data_descriptors(files)).hexdigest()


def is_rfc3339_utc_seconds(value):
    """Reject impossible dates which a regex alone accepts (e.g. month 99)."""
    if not isinstance(value, str) or not RFC3339_UTC.fullmatch(value):
        return False
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).utcoffset() == timezone.utc.utcoffset(None)
    except ValueError:
        return False


def auxiliary_in_prefix(prefix_lines):
    """Auxiliary descriptors recorded by the NEWEST batch of a ledger prefix.

    Deliberately scoped to the last batch rather than to all of history, so that
    dropping an auxiliary from publication stays expressible: its rows simply
    stop appearing. Scanning all history instead would keep resurrecting a
    removed file's last known hash, and the emitter would then republish forever
    trying to reach a state it can no longer produce.

    Legacy rows carry no ``entryCount`` and never described auxiliaries, so a
    historical prefix yields nothing and compares equal to a tree that has no
    auxiliary files at all.
    """
    if not prefix_lines:
        return {}
    last = strict_json_loads(prefix_lines[-1].decode("utf-8"), "provenance line")
    count = last.get("entryCount")
    if isinstance(count, bool) or not isinstance(count, int) or not 0 < count <= len(prefix_lines):
        return {}
    latest = {}
    for raw in prefix_lines[-count:]:
        item = strict_json_loads(raw.decode("utf-8"), "provenance line")
        path = item.get("file")
        if path not in AUXILIARY_PATHS:
            continue
        if not safe_ledger_path(path):
            raise ValueError(f"unsafe ledger path {path!r}")
        digest, size, generated = item.get("sha256"), item.get("bytes"), item.get("generatedAt")
        if not isinstance(digest, str) or not HEX64.match(digest):
            raise ValueError(f"invalid ledger sha256 for {path}")
        if isinstance(size, bool) or not isinstance(size, int) or size < 0:
            raise ValueError(f"invalid ledger byte count for {path}")
        if generated is not None and not isinstance(generated, str):
            raise ValueError(f"invalid ledger generatedAt for {path}")
        latest[path] = {"sha256": digest, "bytes": size, "generatedAt": generated}
    return latest


def validate_manifest(manifest, *, require_scope=True):
    if not isinstance(manifest, dict):
        raise ValueError("manifest must be an object")
    if manifest.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(f"unsupported schemaVersion {manifest.get('schemaVersion')!r}")
    required = {"schemaVersion", "generatedAt", "runId", "dataVersion", "files", "provenance"}
    if set(manifest) != required:
        raise ValueError("manifest has missing or unknown top-level fields")
    if not is_rfc3339_utc_seconds(manifest["generatedAt"]):
        raise ValueError("manifest generatedAt must be RFC3339 UTC seconds")
    if not isinstance(manifest["runId"], str) or not manifest["runId"]:
        raise ValueError("manifest runId must be non-empty")
    files = manifest["files"]
    if not isinstance(files, dict) or not files:
        raise ValueError("manifest files must be a non-empty object")
    if require_scope and set(files) != set(DATASET_PATHS):
        raise ValueError("manifest files must contain exactly the six Phase-1 datasets")
    for path, entry in files.items():
        if not safe_dataset_path(path):
            raise ValueError(f"unsafe or unknown dataset path {path!r}")
        if not isinstance(entry, dict) or set(entry) != {"sha256", "bytes", "generatedAt"}:
            raise ValueError(f"invalid descriptor for {path}")
        if not isinstance(entry["sha256"], str) or not HEX64.match(entry["sha256"]):
            raise ValueError(f"invalid sha256 for {path}")
        if isinstance(entry["bytes"], bool) or not isinstance(entry["bytes"], int) or entry["bytes"] < 0:
            raise ValueError(f"invalid bytes for {path}")
        if entry["generatedAt"] is not None and not isinstance(entry["generatedAt"], str):
            raise ValueError(f"invalid generatedAt for {path}")
    if not isinstance(manifest["dataVersion"], str) or not HEX64.match(manifest["dataVersion"]):
        raise ValueError("invalid dataVersion")
    if manifest["dataVersion"] != data_version(files):
        raise ValueError("dataVersion does not match canonical descriptors")
    provenance = manifest["provenance"]
    if not isinstance(provenance, dict) or set(provenance) != {"algorithm", "root", "entries"}:
        raise ValueError("invalid provenance object")
    if provenance["algorithm"] != "rfc6962-sha256-jsonl-v1":
        raise ValueError("unsupported provenance algorithm")
    if not isinstance(provenance["root"], str) or not HEX64.match(provenance["root"]):
        raise ValueError("invalid provenance root")
    if isinstance(provenance["entries"], bool) or not isinstance(provenance["entries"], int) or provenance["entries"] <= 0:
        raise ValueError("invalid provenance entry count")
    return manifest
