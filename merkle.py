"""
Borneo Tracker — Merkle commitment over the provenance ledger (ABCDE letter "B").

WHY THIS EXISTS
    `provenance.jsonl` is an append-only record of every distinct data version this
    project has published. A Merkle root over it is a single 32-byte value that
    commits to ALL of those lines at once: change, reorder or delete any one line
    and the root changes. Publishing the root alongside the ledger therefore turns
    "we never rewrite history" from a promise into something a stranger can check.

    The root is recomputable by anyone who fetches the published ledger, in any
    language, with nothing but a SHA-256 implementation. That is the whole point —
    a commitment nobody can verify is decoration.

THE CONSTRUCTION (RFC 6962 / Certificate Transparency)
    leaf(line)        = SHA256(0x00 || line_bytes)
    node(left, right) = SHA256(0x01 || left || right)

    The 0x00 / 0x01 domain-separation prefixes are not decoration either: without
    them an attacker can present an internal node as if it were a leaf
    (the "second preimage" attack on naive Merkle trees).

    An odd node at any level is promoted unchanged to the next level rather than
    duplicated. Duplicating it — the Bitcoin block construction — admits distinct
    trees with identical roots (CVE-2012-2459). We do not want that property.

    Leaves are the EXACT bytes of each line as published, UTF-8 encoded, WITHOUT
    the trailing newline, in file order. Blank lines are skipped so a stray
    trailing newline cannot change the root.

    An empty ledger has the root SHA256(b"") — the RFC 6962 convention.

USAGE
    python merkle.py                          print the root of public/data/provenance.jsonl
    python merkle.py <path>                   ... of some other ledger
    from merkle import merkle_root_of_file    -> (root_hex, leaf_count)
"""

import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).parent
PROVENANCE = ROOT / "public" / "data" / "provenance.jsonl"

LEAF_PREFIX = b"\x00"
NODE_PREFIX = b"\x01"


def leaf_hash(line_bytes):
    """RFC 6962 leaf: SHA256(0x00 || entry)."""
    return hashlib.sha256(LEAF_PREFIX + line_bytes).digest()


def node_hash(left, right):
    """RFC 6962 interior node: SHA256(0x01 || left || right)."""
    return hashlib.sha256(NODE_PREFIX + left + right).digest()


def merkle_root(leaves):
    """Fold a list of 32-byte leaf hashes into a single root.

    Odd node out is promoted, never duplicated (see module docstring).
    """
    if not leaves:
        return hashlib.sha256(b"").digest()

    level = list(leaves)
    while len(level) > 1:
        nxt = []
        for i in range(0, len(level) - 1, 2):
            nxt.append(node_hash(level[i], level[i + 1]))
        if len(level) % 2:
            nxt.append(level[-1])  # promote, do not duplicate
        level = nxt
    return level[0]


def ledger_lines(path):
    """The published ledger as a list of line-byte-strings, blank lines dropped.

    Read as bytes, not text: the leaves must be the bytes a verifier downloads,
    not whatever a local text decoder makes of them.
    """
    raw = Path(path).read_bytes()
    return [line for line in raw.replace(b"\r\n", b"\n").split(b"\n") if line.strip()]


def merkle_root_of_file(path):
    """Returns (root_hex, leaf_count) for a .jsonl ledger."""
    lines = ledger_lines(path)
    return merkle_root([leaf_hash(line) for line in lines]).hex(), len(lines)


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else PROVENANCE
    if not path.exists():
        print(f"ERROR: ledger not found: {path}")
        return 1
    root, count = merkle_root_of_file(path)
    print(f"{root}  ({count} entries, {path.as_posix()})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
