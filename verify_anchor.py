"""
Borneo Tracker — verify published data against its anchors.

WHAT THIS CHECKS, IN ORDER
    1. Every file listed in manifest.json hashes to what the manifest says.
    2. manifest.json itself hashes to what the anchor log recorded.
    3. The .ots proof is well formed and is about that same digest.
    4. What the proof currently attests: a Bitcoin block, or a pending promise.
    5. The Merkle root over provenance.jsonl still matches what was recorded —
       i.e. nobody rewrote publication history.

WHAT IT DELIBERATELY DOES NOT CHECK
    Whether the Bitcoin block in step 4 is real. Doing that honestly needs the
    block headers, which we do not have and will not pretend to. So this prints
    the block height and tells you how to confirm it independently, rather than
    printing a green tick it has not earned.

    And, to be said plainly because it is the whole point: NONE of this says the
    numbers are correct. It says the bytes have not changed. Data quality lives in
    the `confidence` and `source` fields, not here.

USAGE
    python verify_anchor.py                     verify the working copy
    python verify_anchor.py --remote            verify what production is serving
    python verify_anchor.py --remote <base-url> verify some other deployment

EXIT CODES
    0 everything checked out (a pending anchor is still a pass)
    1 a mismatch, a missing file, or a malformed proof
"""

import hashlib
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

import merkle
import ots
from anchor_provenance import read_anchors
from upgrade_anchors import latest_status_by_manifest

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "public" / "data"
DEFAULT_BASE_URL = "https://borneotracker.rentsmartprop.com.my"

OK = "  ok  "
BAD = " FAIL "
WARN = " warn "


class Source:
    """Where the bytes come from — the working copy, or a live deployment.

    Both paths must read RAW BYTES. Parsing JSON and re-serialising it would
    change key order and whitespace and break every hash, which is exactly the
    trap the browser-side check has to avoid too.
    """

    def __init__(self, base_url=None):
        self.base_url = base_url.rstrip("/") if base_url else None

    @property
    def label(self):
        return self.base_url or f"{DATA_DIR.as_posix()} (working copy)"

    def get(self, repo_rel_path):
        if not self.base_url:
            path = ROOT / repo_rel_path
            if not path.exists():
                return None
            return path.read_bytes()

        # "public/data/x.json" is served as "/data/x.json"
        url = f"{self.base_url}/{repo_rel_path.replace('public/', '', 1)}"
        req = urllib.request.Request(url, headers={
            "User-Agent": ots.USER_AGENT,
            "Cache-Control": "no-cache",
        })
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read()
                ctype = resp.headers.get("Content-Type", "")
        except (urllib.error.URLError, OSError) as exc:
            print(f"{BAD} fetch {url}: {exc}")
            return None

        # A single-page app answers 200 with index.html for anything it does not
        # have. Silently hashing that would produce a confident, meaningless
        # mismatch, so name the real problem instead.
        if body.lstrip()[:9].lower() == b"<!doctype" or "text/html" in ctype:
            print(f"{BAD} {url} returned HTML, not the file — it is not deployed")
            return None
        return body


def check(source, results):
    """Run every check against one source. Appends (status, message) to results."""
    failed = False

    manifest_bytes = source.get("public/data/manifest.json")
    if manifest_bytes is None:
        results.append((BAD, "manifest.json could not be read"))
        return True

    manifest_sha256 = hashlib.sha256(manifest_bytes).hexdigest()
    try:
        manifest = json.loads(manifest_bytes)
    except json.JSONDecodeError as exc:
        results.append((BAD, f"manifest.json is not valid JSON: {exc}"))
        return True

    results.append((OK, f"manifest.json  sha256 {manifest_sha256}"))
    results.append((OK, f"generatedAt    {manifest.get('generatedAt')}  run {manifest.get('runId')}"))

    # 1. each data file matches the manifest
    for rel_path, entry in sorted(manifest.get("files", {}).items()):
        body = source.get(rel_path)
        if body is None:
            results.append((BAD, f"{rel_path}  could not be read"))
            failed = True
            continue
        actual = hashlib.sha256(body).hexdigest()
        expected = entry.get("sha256")
        if actual != expected:
            results.append((BAD, f"{rel_path}  {actual[:16]}… != manifest {str(expected)[:16]}…"))
            failed = True
        elif len(body) != entry.get("bytes"):
            results.append((BAD, f"{rel_path}  hash matches but size {len(body)} != {entry.get('bytes')}"))
            failed = True
        else:
            results.append((OK, f"{rel_path}  {actual[:16]}…  {len(body):,} B"))

    # 5. publication history has not been rewritten
    ledger_bytes = source.get("public/data/provenance.jsonl")
    ledger_root = None
    if ledger_bytes is None:
        results.append((WARN, "provenance.jsonl not available — ledger root not checked"))
    else:
        lines = [ln for ln in ledger_bytes.replace(b"\r\n", b"\n").split(b"\n") if ln.strip()]
        ledger_root = merkle.merkle_root([merkle.leaf_hash(ln) for ln in lines]).hex()
        results.append((OK, f"provenance.jsonl  {len(lines)} entries, root {ledger_root[:16]}…"))

    # 2-4. the anchor
    anchors_bytes = source.get("public/data/anchors.jsonl")
    if anchors_bytes is None:
        results.append((WARN, "anchors.jsonl not available — data is not anchored yet"))
        return failed

    events = []
    for line in anchors_bytes.decode("utf-8", "replace").splitlines():
        if line.strip():
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                results.append((BAD, "anchors.jsonl contains a corrupt line"))
                failed = True

    event = latest_status_by_manifest(events).get(manifest_sha256)
    if event is None:
        results.append((WARN, "this manifest is not anchored yet (a new version, or the "
                              "anchor job has not run)"))
        return failed

    results.append((OK, f"anchored       {event.get('ts')}  status={event.get('status')}"))

    if ledger_root and event.get("ledgerRoot") and ledger_root != event["ledgerRoot"]:
        results.append((BAD, f"ledger root {ledger_root[:16]}… != anchored "
                             f"{event['ledgerRoot'][:16]}… — history was rewritten"))
        failed = True
    elif ledger_root and event.get("ledgerRoot"):
        results.append((OK, "ledger root matches the anchored value"))

    proof_bytes = source.get(event.get("proof", ""))
    if proof_bytes is None:
        results.append((BAD, f"proof {event.get('proof')} could not be read"))
        return True

    try:
        detached = ots.DetachedTimestamp.from_bytes(proof_bytes)
    except ots.OtsError as exc:
        results.append((BAD, f"proof is malformed: {exc}"))
        return True

    if detached.digest.hex() != manifest_sha256:
        results.append((BAD, f"proof attests {detached.digest.hex()[:16]}… but this "
                             f"manifest is {manifest_sha256[:16]}…"))
        return True

    results.append((OK, f"proof          {event['proof']} attests this exact manifest"))

    status, detail = detached.status()
    if status == "confirmed":
        for height in detail:
            results.append((OK, f"bitcoin        block {height} — confirm independently at "
                                f"https://mempool.space/block/{height}"))
    elif status == "pending":
        results.append((WARN, f"bitcoin        not in a block yet; {len(detail)} calendar(s) "
                              f"hold the promise. Run upgrade_anchors.py later."))
    else:
        results.append((WARN, "proof carries no recognised attestation"))

    return failed


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv

    if "--remote" in argv:
        idx = argv.index("--remote")
        base = argv[idx + 1] if len(argv) > idx + 1 and not argv[idx + 1].startswith("-") \
            else DEFAULT_BASE_URL
        source = Source(base)
    else:
        source = Source()

    print(f"Verifying: {source.label}\n")
    results = []
    failed = check(source, results)
    for status, message in results:
        print(f"[{status}] {message}")

    print()
    if failed:
        print("RESULT: FAILED — the published bytes do not match what was anchored.")
        print("Do not cite this data until it is resolved.")
        return 1

    print("RESULT: PASSED — the published bytes are exactly what was anchored.")
    print("Note: this proves the data has not been ALTERED. It does not prove the "
          "numbers are CORRECT — see the confidence and source fields for that.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
