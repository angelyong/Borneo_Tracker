"""
Borneo Tracker — turn pending timestamps into confirmed Bitcoin proofs.

WHY THIS IS A SEPARATE SCRIPT
    An OpenTimestamps stamp is not a Bitcoin proof at the moment it is created.
    The calendar servers batch many digests into one transaction, so a fresh
    stamp is a PROMISE ("we will include this"), and it stays a promise until a
    block confirms it — the docs say a few hours; measured here, still pending
    after 24 minutes. You therefore CANNOT stamp and verify in the same CI run.

    That gap is not an error state and the UI must not paint it as one. It is why
    the integrity chip has an amber "Timestamping…" state, and why this runs on
    its own schedule instead of being tacked onto the end of anchor_provenance.py.

WHAT IT DOES
    Finds every anchor whose latest status is "pending", asks each calendar
    whether its promise has made it into a block yet, and if so rewrites the
    .ots proof with the real attestation and APPENDS an "upgrade" event.

    The .ots file is replaced in place — it is a proof about a digest, and the
    upgraded version proves strictly more about the same digest. The LOG is what
    must never be rewritten: status changes are appended, so the history of what
    we claimed and when stays intact.

    Nothing to upgrade is the normal outcome most of the time. Exit code stays 0.

USAGE
    python upgrade_anchors.py            upgrade whatever is pending
    python upgrade_anchors.py --dry-run  report only, change nothing
"""

import sys
from pathlib import Path

import ots
from anchor_provenance import ANCHORS, append_anchor, read_anchors
from emit_manifest import run_id, utc_now

ROOT = Path(__file__).parent


def latest_status_by_manifest(events):
    """The current state of each anchored manifest.

    The log is append-only, so an anchor's status is whatever its most recent
    event says. Reading it this way is what lets upgrades be appends.
    """
    latest = {}
    for event in events:
        key = event.get("manifestSha256")
        if not key:
            continue
        latest[key] = event
    return latest


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    dry_run = "--dry-run" in argv

    if not ANCHORS.exists():
        print("No anchors.jsonl yet — nothing to upgrade.")
        return 0

    events = read_anchors()
    pending = [e for e in latest_status_by_manifest(events).values()
               if e.get("status") == "pending"]

    if not pending:
        print(f"No pending anchors ({len(events)} event(s) in the log). Nothing to do.")
        return 0

    print(f"{len(pending)} pending anchor(s) to check.")
    upgraded_count = 0

    for event in pending:
        manifest_sha256 = event["manifestSha256"]
        path = ROOT / event["proof"]
        label = f"{manifest_sha256[:16]}  ({event.get('manifestGeneratedAt')})"

        if not path.exists():
            print(f"  {label}  MISSING proof file {event['proof']} — skipped")
            continue

        try:
            detached = ots.DetachedTimestamp.from_bytes(path.read_bytes())
        except ots.OtsError as exc:
            print(f"  {label}  unreadable proof: {exc} — skipped")
            continue

        if detached.digest.hex() != manifest_sha256:
            print(f"  {label}  proof is for a different digest — skipped")
            continue

        if dry_run:
            print(f"  {label}  would query {len(detached.timestamp.pending())} calendar(s)")
            continue

        if not ots.upgrade(detached):
            print(f"  {label}  still pending — no block yet")
            continue

        status, detail = detached.status()
        if status != "confirmed":
            # A calendar answered but nothing reached Bitcoin: keep waiting rather
            # than logging a state change that did not happen.
            print(f"  {label}  answered but still {status} — no event appended")
            continue

        path.write_bytes(detached.to_bytes())
        append_anchor({
            "ts": utc_now(),
            "runId": run_id(),
            "type": "upgrade",
            "method": "opentimestamps",
            "chain": "bitcoin",
            "target": event.get("target", "public/data/manifest.json"),
            "manifestSha256": manifest_sha256,
            "manifestGeneratedAt": event.get("manifestGeneratedAt"),
            "ledgerRoot": event.get("ledgerRoot"),
            "ledgerEntries": event.get("ledgerEntries"),
            "proof": event["proof"],
            "status": "confirmed",
            "bitcoinBlocks": detail,
        })
        upgraded_count += 1
        print(f"  {label}  CONFIRMED in Bitcoin block(s) {detail}")

    if dry_run:
        return 0

    print(f"Upgraded {upgraded_count} of {len(pending)} pending anchor(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
