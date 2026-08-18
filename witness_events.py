"""Append-only witness-event validation and monotonic reduction.

Witness metadata is self-hosted, so every line is treated as untrusted input.
Validate the whole log before selecting one Manifest: a malformed unrelated line
must not become invisible merely because it names a different digest.
"""
import re

from manifest_contract import HEX64, strict_json_loads

EVENT_WITNESS = {
    "ots.stamped": ("ots", "pending"),
    # An upgraded proof may contain a Bitcoin-attestation *claim*, but only an
    # official OTS verifier backed by Bitcoin Core can make it confirmed.
    "ots.upgraded": ("ots", "pending"),
    "sigstore.attested": ("sigstore", "attested"),
    "legacy.migrated": ("ots", "pending"),
}
STATUS_RANK = {"pending": 1}
SAFE_PROOF = re.compile(r"^public/data/versions/[0-9a-f]{64}/manifest\.json\.ots$")


def canonical_proof_path(sha):
    return f"public/data/versions/{sha}/manifest.json.ots"


def safe_proof_path(path, sha):
    return isinstance(path, str) and path == canonical_proof_path(sha) and SAFE_PROOF.fullmatch(path) is not None


def _legacy(event):
    sha = event.get("manifestSha256")
    if not isinstance(sha, str) or not HEX64.fullmatch(sha):
        raise ValueError("legacy event has invalid manifestSha256")
    if event.get("type") not in {"stamp", "upgrade"}:
        raise ValueError("unsupported legacy witness event")
    status = "pending"
    return {
        **event,
        "schemaVersion": 1,
        "manifestSha256": sha,
        "eventType": "ots.upgraded" if event.get("status") == "confirmed" else "ots.stamped",
        "witness": {"type": "ots", "status": status},
        "otsAttestationClaim": "legacy-confirmed-metadata" if event.get("status") == "confirmed" else None,
        # Old unversioned proof paths are never trusted by a verifier.  The
        # one-time migration creates this immutable canonical location.
        "proof": canonical_proof_path(sha),
        "legacy": event,
    }


def normalize_event(raw):
    if not isinstance(raw, dict):
        raise ValueError("anchor event must be an object")
    if raw.get("schemaVersion") is None:
        event = _legacy(raw)
    elif raw.get("schemaVersion") == 1 and isinstance(raw.get("legacy"), dict):
        # Only the in-memory legacy adapter may carry schema 1.  Persisted
        # legacy records have no schemaVersion and must pass through `_legacy`.
        event = raw
    elif raw.get("schemaVersion") == 2:
        event = raw
    else:
        raise ValueError("unsupported witness schema")
    sha = event.get("manifestSha256")
    if not isinstance(sha, str) or not HEX64.fullmatch(sha):
        raise ValueError("anchor event has invalid manifestSha256")
    event_type = event.get("eventType")
    expected = EVENT_WITNESS.get(event_type)
    if expected is None:
        raise ValueError("unknown anchor eventType")
    witness = event.get("witness")
    if not isinstance(witness, dict) or (witness.get("type"), witness.get("status")) != expected:
        raise ValueError("invalid witness event type or status")
    if expected[0] == "ots" and not safe_proof_path(event.get("proof"), sha):
        raise ValueError("unsafe OTS proof path")
    return event


def parse_events(text):
    events = []
    for number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        raw = strict_json_loads(line, f"anchors.jsonl line {number}")
        try:
            events.append(normalize_event(raw))
        except ValueError as exc:
            raise ValueError(f"anchors.jsonl line {number}: {exc}") from exc
    return events


def reduce_events(events, manifest_sha256):
    if not isinstance(manifest_sha256, str) or not HEX64.fullmatch(manifest_sha256):
        raise ValueError("invalid requested Manifest digest")
    state = {"ots": None, "sigstore": None, "events": []}
    for raw in events:
        event = normalize_event(raw)
        if event["manifestSha256"] != manifest_sha256:
            continue
        witness_type = event["witness"]["type"]
        previous = state[witness_type]
        if witness_type == "ots" and previous:
            if STATUS_RANK[event["witness"]["status"]] < STATUS_RANK[previous["witness"]["status"]]:
                continue
            # An upgraded proof is a stronger artifact than a fresh stamp even
            # though neither is Bitcoin-chain-verified locally. Never let a
            # later pending stamp replace its proof revision in the reducer.
            if previous["eventType"] == "ots.upgraded" and event["eventType"] != "ots.upgraded":
                continue
        state[witness_type] = event
        state["events"].append(event)
    return state
