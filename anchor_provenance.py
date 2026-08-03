"""
Borneo Tracker — anchor the published data on Bitcoin (ABCDE letter "B", step 1).

WHAT THIS DOES
    Takes the manifest the pipeline just wrote, timestamps it via OpenTimestamps,
    and records the result in an append-only log. After this runs, the claim
    "this data has not been altered since <date>" stops being something we assert
    and becomes something a stranger can check without asking us anything.

WHY manifest.json IS THE THING WE ANCHOR
    `manifest.json` already contains the sha256 of every published data file, so
    one stamp covers all of them transitively — anchoring each file separately
    would cost three proofs to say the same thing. It is also a real file served
    at a real URL, which means the official client works on it unmodified:

        curl -O https://<site>/data/manifest.json
        ots verify manifest.json.ots

    A proof a third party can check with a tool we did not write is worth more
    than a bespoke one they have to trust us about.

THE LEDGER ROOT
    We also record a Merkle root over the whole of `provenance.jsonl` (see
    merkle.py). That is a single value committing to every data version ever
    published, and anyone can recompute it from the file we serve. Note honestly:
    in this version the root is RECORDED, not separately stamped — the Bitcoin
    attestation covers manifest.json. Anchoring the root too is a later step, and
    the UI must not imply otherwise.

WHAT IT WRITES
    public/data/anchors/<first16 of manifest sha256>.ots
        The proof. Named after what it proves, so it is immutable, never
        overwritten, and safe to upgrade later without racing the next run.
    public/data/anchors.jsonl
        Append-only, one line per event. Same discipline as provenance.jsonl:
        NEVER truncate, reorder or rewrite; only append; only ADD fields.
        Status changes (pending -> confirmed) are appended as a new "upgrade"
        line, never by editing the "stamp" line. Readers take the LAST line for
        a given manifestSha256 as current.

IDEMPOTENCE
    Re-running on unchanged data does nothing. The daily refresh only commits
    when the data actually changed, so the log stays a record of distinct data
    versions rather than of cron ticks.

THE SECOND WITNESS
    In CI we also attest the manifest through GitHub's `actions/attest`, which
    signs it with the workflow's own identity and records it in Sigstore's public
    transparency log — the same infrastructure npm and PyPI use. Pass the bundle
    with --sigstore-bundle and its log index is recorded alongside the Bitcoin
    stamp. Two independent witnesses to the same digest: if either is unreachable,
    the other still stands.

USAGE
    python anchor_provenance.py              stamp the current manifest if new
    python anchor_provenance.py --force      stamp again even if already anchored
    python anchor_provenance.py --dry-run    show what would happen, touch nothing
    python anchor_provenance.py --sigstore-bundle <path>   also record the attestation
"""

import json
import sys
from pathlib import Path

import merkle
import ots
from emit_manifest import run_id, utc_now

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "public" / "data"
MANIFEST = DATA_DIR / "manifest.json"
PROVENANCE = DATA_DIR / "provenance.jsonl"
ANCHORS = DATA_DIR / "anchors.jsonl"
PROOF_DIR = DATA_DIR / "anchors"


def read_anchors():
    """Every event so far, oldest first. Missing file is not an error."""
    if not ANCHORS.exists():
        return []
    events = []
    for line in ANCHORS.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            # A corrupt line is a fact about the log, not a reason to stop
            # anchoring. verify_anchor.py reports it.
            continue
    return events


def append_anchor(entry):
    """Append one event. Opened in 'a' mode ONLY — never 'w'."""
    ANCHORS.parent.mkdir(parents=True, exist_ok=True)
    with open(ANCHORS, "a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(entry, sort_keys=True) + "\n")


def proof_path(manifest_sha256):
    """Proofs are named after the digest they attest, so the name is the claim."""
    return PROOF_DIR / f"{manifest_sha256[:16]}.ots"


def already_anchored(events, manifest_sha256):
    return any(e.get("type") == "stamp" and e.get("manifestSha256") == manifest_sha256
               for e in events)


def read_sigstore_bundle(path):
    """Pull the Rekor log index out of an `actions/attest` bundle.

    Best-effort by design: the bundle is GitHub's format, not ours, and a schema
    change there must not fail the anchoring run. If anything is unrecognisable
    we record that an attestation exists without pretending to know its index.
    """
    if not path:
        return None
    bundle_path = Path(path)
    if not bundle_path.exists():
        print(f"  note: sigstore bundle not found at {path} — not recorded")
        return None
    try:
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"  note: sigstore bundle unreadable ({exc}) — recorded without an index")
        return {"present": True}

    entry = {"present": True}
    try:
        tlog = bundle["verificationMaterial"]["tlogEntries"][0]
        entry["logIndex"] = str(tlog.get("logIndex"))
        entry["integratedTime"] = str(tlog.get("integratedTime"))
    except (KeyError, IndexError, TypeError):
        pass
    return entry


def flag_value(argv, name):
    """--name <value>, or None."""
    if name not in argv:
        return None
    idx = argv.index(name)
    return argv[idx + 1] if len(argv) > idx + 1 else None


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    force = "--force" in argv
    dry_run = "--dry-run" in argv

    if not MANIFEST.exists():
        print(f"ERROR: no manifest at {MANIFEST.as_posix()} — run the pipeline first")
        return 1
    if not PROVENANCE.exists():
        print(f"ERROR: no provenance ledger at {PROVENANCE.as_posix()}")
        return 1

    manifest_digest = ots.sha256_file(MANIFEST)
    manifest_sha256 = manifest_digest.hex()
    manifest_generated_at = json.loads(MANIFEST.read_text(encoding="utf-8")).get("generatedAt")
    ledger_root, ledger_entries = merkle.merkle_root_of_file(PROVENANCE)

    print(f"manifest.json  sha256 {manifest_sha256}")
    print(f"               generatedAt {manifest_generated_at}")
    print(f"ledger root    {ledger_root}  ({ledger_entries} entries)")

    events = read_anchors()
    if already_anchored(events, manifest_sha256) and not force:
        print("Already anchored — nothing to do. (--force to stamp again.)")
        return 0

    if dry_run:
        print(f"DRY RUN: would stamp and write {proof_path(manifest_sha256).as_posix()}")
        return 0

    try:
        timestamp, reached, failed = ots.submit(manifest_digest)
    except ots.OtsError as exc:
        print(f"ERROR: {exc}")
        return 1

    detached = ots.DetachedTimestamp(manifest_digest, timestamp)
    status, detail = detached.status()

    path = proof_path(manifest_sha256)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(detached.to_bytes())

    entry = {
        "ts": utc_now(),
        "runId": run_id(),
        "type": "stamp",
        "method": "opentimestamps",
        "chain": "bitcoin",
        "target": "public/data/manifest.json",
        "manifestSha256": manifest_sha256,
        "manifestGeneratedAt": manifest_generated_at,
        "ledgerRoot": ledger_root,
        "ledgerEntries": ledger_entries,
        "proof": path.relative_to(ROOT).as_posix(),
        "status": status,
        "calendars": sorted(detail) if status == "pending" else [],
    }
    sigstore = read_sigstore_bundle(flag_value(argv, "--sigstore-bundle"))
    if sigstore:
        entry["sigstore"] = sigstore
    append_anchor(entry)

    print(f"Stamped via {len(reached)} calendar(s); {len(failed)} unreachable.")
    for calendar, error in failed:
        print(f"  unreachable: {calendar} — {error}")
    print(f"Wrote -> {path.relative_to(ROOT).as_posix()} ({path.stat().st_size} bytes), "
          f"status={status}")
    print("A fresh stamp is PENDING for a few hours until a Bitcoin block includes "
          "it. Run upgrade_anchors.py later to turn it into a confirmed proof.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
