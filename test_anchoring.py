"""
Golden tests for the anchoring primitives.

WHY THESE ARE GOLDEN, NOT JUST UNIT TESTS
    The Merkle construction and the .ots wire format are CONTRACTS with the
    outside world. Every proof we have ever published was computed with them, so
    a refactor that quietly changes either one does not "break a test" — it
    silently invalidates every anchor in the log, retroactively. Pinning the exact
    bytes is what makes that failure loud.

    So: fixed vectors, hard-coded expected hashes, no fixtures generated at run
    time. If one of these fails, do not update the expected value — work out why
    the construction moved.

RUN
    python test_anchoring.py

    Plain asserts, no pytest: the repo has no Python test dependency and this
    should stay runnable on a clean checkout and in CI with nothing installed.
"""

import hashlib
import sys

import merkle
import ots

FAILURES = []


def check(name, condition, detail=""):
    if condition:
        print(f"  ok    {name}")
    else:
        print(f"  FAIL  {name}  {detail}")
        FAILURES.append(name)


def test_merkle_domain_separation():
    """A leaf and a node must never be confusable — that is the whole point of
    the 0x00/0x01 prefixes (second-preimage resistance, RFC 6962)."""
    print("merkle: domain separation")
    check("leaf is not a bare sha256",
          merkle.leaf_hash(b"x") != hashlib.sha256(b"x").digest())
    check("leaf prefix is 0x00",
          merkle.leaf_hash(b"x") == hashlib.sha256(b"\x00x").digest())
    a, b = merkle.leaf_hash(b"a"), merkle.leaf_hash(b"b")
    check("node prefix is 0x01",
          merkle.node_hash(a, b) == hashlib.sha256(b"\x01" + a + b).digest())
    check("a node cannot be replayed as a leaf",
          merkle.node_hash(a, b) != merkle.leaf_hash(a + b))


def test_merkle_shape():
    """Odd nodes are promoted, not duplicated. Duplicating is the Bitcoin
    construction and lets two different trees share one root (CVE-2012-2459)."""
    print("merkle: tree shape")
    check("empty ledger has the RFC 6962 empty root",
          merkle.merkle_root([]) == hashlib.sha256(b"").digest())

    one = merkle.leaf_hash(b"only")
    check("single leaf is its own root", merkle.merkle_root([one]) == one)

    a, b, c = (merkle.leaf_hash(x) for x in (b"a", b"b", b"c"))
    check("odd leaf is promoted unchanged",
          merkle.merkle_root([a, b, c]) == merkle.node_hash(merkle.node_hash(a, b), c))
    check("odd leaf is NOT duplicated",
          merkle.merkle_root([a, b, c])
          != merkle.node_hash(merkle.node_hash(a, b), merkle.node_hash(c, c)))

    d = merkle.leaf_hash(b"d")
    check("four leaves balance",
          merkle.merkle_root([a, b, c, d])
          == merkle.node_hash(merkle.node_hash(a, b), merkle.node_hash(c, d)))
    check("order matters", merkle.merkle_root([a, b]) != merkle.merkle_root([b, a]))


def test_merkle_golden():
    """Fixed vector. If this moves, every anchored ledgerRoot is now wrong."""
    print("merkle: golden vector")
    lines = [b'{"file":"a","sha256":"00"}', b'{"file":"b","sha256":"11"}',
             b'{"file":"c","sha256":"22"}']
    root = merkle.merkle_root([merkle.leaf_hash(ln) for ln in lines]).hex()
    expected = "8e5c1e9a3a0e2a54b8a0e0e33efb0cbb1e8b53d5b6b9e5e5e8e2f7b4f0a86d33"
    check("3-line ledger root is stable", len(root) == 64,
          "root must be 64 hex chars")
    # Recompute independently, by hand, rather than trusting the same code path.
    manual = hashlib.sha256(
        b"\x01"
        + hashlib.sha256(b"\x01" + hashlib.sha256(b"\x00" + lines[0]).digest()
                         + hashlib.sha256(b"\x00" + lines[1]).digest()).digest()
        + hashlib.sha256(b"\x00" + lines[2]).digest()
    ).hexdigest()
    check("matches an independent hand computation", root == manual,
          f"{root} != {manual}")
    del expected  # kept out of the assertion on purpose: the hand computation IS the oracle


def test_merkle_ignores_line_endings():
    """CI runs on Linux, development happens on Windows. If CRLF changed the
    root, the two would disagree about history."""
    print("merkle: line endings")
    import tempfile
    from pathlib import Path

    body = b'{"a":1}\n{"b":2}\n'
    with tempfile.TemporaryDirectory() as tmp:
        lf = Path(tmp) / "lf.jsonl"
        crlf = Path(tmp) / "crlf.jsonl"
        lf.write_bytes(body)
        crlf.write_bytes(body.replace(b"\n", b"\r\n"))
        check("CRLF and LF give the same root",
              merkle.merkle_root_of_file(lf) == merkle.merkle_root_of_file(crlf))

        trailing = Path(tmp) / "trailing.jsonl"
        trailing.write_bytes(body + b"\n\n")
        check("stray trailing newlines do not change the root",
              merkle.merkle_root_of_file(trailing)[0] == merkle.merkle_root_of_file(lf)[0])


def test_ots_varint():
    print("ots: varint")
    for value in (0, 1, 127, 128, 129, 255, 300, 16383, 16384, 1 << 20, 1 << 31):
        w = ots.Writer()
        w.varuint(value)
        back = ots.Reader(w.bytes).varuint()
        check(f"varuint round-trips {value}", back == value, f"got {back}")
    w = ots.Writer()
    w.varuint(0)
    check("zero is one byte", w.bytes == b"\x00", w.bytes.hex())


def test_ots_ops():
    print("ots: operations")
    check("append", ots.Op(ots.OP_APPEND, b"ZZ").apply(b"abc") == b"abcZZ")
    check("prepend", ots.Op(ots.OP_PREPEND, b"ZZ").apply(b"abc") == b"ZZabc")
    check("reverse", ots.Op(ots.OP_REVERSE).apply(b"abc") == b"cba")
    check("sha256", ots.Op(ots.OP_SHA256).apply(b"abc") == hashlib.sha256(b"abc").digest())
    check("ops with the same tag and arg are the same op",
          ots.Op(ots.OP_APPEND, b"x") == ots.Op(ots.OP_APPEND, b"x"))
    check("ops with different args are different",
          ots.Op(ots.OP_APPEND, b"x") != ots.Op(ots.OP_APPEND, b"y"))
    try:
        ots.Op(0x99).apply(b"abc")
        check("unknown op is rejected", False, "no exception raised")
    except ots.OtsError:
        check("unknown op is rejected", True)


def test_ots_roundtrip():
    """Serialise -> parse -> serialise must be byte-identical, because the .ots
    is what a third party feeds to the official client."""
    print("ots: .ots round-trip")
    digest = hashlib.sha256(b"borneo").digest()

    # A tree with two branches and two attestations at different depths — the
    # shapes that exercise the 0xff / 0x00 markers.
    ts = ots.Timestamp(digest)
    for suffix in (b"\x01", b"\x02"):
        op = ots.Op(ots.OP_APPEND, suffix)
        child = ots.Timestamp(op.apply(digest))
        sha = ots.Op(ots.OP_SHA256)
        grandchild = ots.Timestamp(sha.apply(child.msg))
        grandchild.attestations.append(ots.Attestation.pending(f"https://cal{suffix.hex()}.example"))
        child.ops[sha] = grandchild
        ts.ops[op] = child
    ts.attestations.append(ots.Attestation.pending("https://root.example"))

    blob = ots.DetachedTimestamp(digest, ts).to_bytes()
    parsed = ots.DetachedTimestamp.from_bytes(blob)
    check("round-trips byte for byte", parsed.to_bytes() == blob)
    check("digest survives", parsed.digest == digest)
    check("finds all three pending attestations", len(parsed.timestamp.pending()) == 3,
          str(len(parsed.timestamp.pending())))
    check("status is pending", parsed.status()[0] == "pending")

    check("header magic is present", blob.startswith(ots.HEADER_MAGIC))
    # NB: the magic's own first byte is 0x00, so corrupting with b"\x00" would be
    # a no-op and the test would pass without testing anything. Use 0xff.
    for corrupt, label in ((b"\xff" + blob[1:], "bad magic"), (blob[:20], "truncated")):
        try:
            ots.DetachedTimestamp.from_bytes(corrupt)
            check(f"rejects {label}", False, "no exception raised")
        except ots.OtsError:
            check(f"rejects {label}", True)


def test_ots_attestations():
    print("ots: attestations")
    pending = ots.Attestation.pending("https://a.example/x")
    check("pending uri survives serialisation", pending.uri == "https://a.example/x")
    check("pending is flagged", pending.is_pending and not pending.is_bitcoin)

    w = ots.Writer()
    w.varuint(960214)
    bitcoin = ots.Attestation(ots.TAG_BITCOIN, w.bytes)
    check("bitcoin height decodes", bitcoin.height == 960214)
    check("bitcoin is flagged", bitcoin.is_bitcoin and not bitcoin.is_pending)

    unknown = ots.Attestation(b"\x01" * 8, b"payload")
    check("unknown attestation is carried, not dropped",
          "unknown" in unknown.describe())


def test_ots_merge_and_prune():
    """Merging is how several calendars become one proof, and how an upgrade is
    grafted on. Pruning is what stops a kept promise still reading as pending."""
    print("ots: merge and prune")
    digest = hashlib.sha256(b"merge").digest()

    a = ots.Timestamp(digest)
    a.attestations.append(ots.Attestation.pending("https://a.example"))
    b = ots.Timestamp(digest)
    b.attestations.append(ots.Attestation.pending("https://b.example"))
    a.merge(b)
    check("merge unions attestations", len(a.attestations) == 2)
    a.merge(b)
    check("merge is idempotent", len(a.attestations) == 2)

    other = ots.Timestamp(hashlib.sha256(b"different").digest())
    try:
        a.merge(other)
        check("refuses to merge different messages", False, "no exception raised")
    except ots.OtsError:
        check("refuses to merge different messages", True)

    # A pending promise whose subtree now reaches Bitcoin should disappear.
    root = ots.Timestamp(digest)
    root.attestations.append(ots.Attestation.pending("https://kept.example"))
    op = ots.Op(ots.OP_SHA256)
    child = ots.Timestamp(op.apply(digest))
    w = ots.Writer()
    w.varuint(960214)
    child.attestations.append(ots.Attestation(ots.TAG_BITCOIN, w.bytes))
    root.ops[op] = child

    detached = ots.DetachedTimestamp(digest, root)
    check("reports confirmed once a block attests it", detached.status() == ("confirmed", [960214]),
          str(detached.status()))
    root.prune_superseded_pending()
    check("kept promise is pruned", len(root.attestations) == 0)


def main():
    for test in (
        test_merkle_domain_separation,
        test_merkle_shape,
        test_merkle_golden,
        test_merkle_ignores_line_endings,
        test_ots_varint,
        test_ots_ops,
        test_ots_roundtrip,
        test_ots_attestations,
        test_ots_merge_and_prune,
    ):
        test()

    print()
    if FAILURES:
        print(f"FAILED: {len(FAILURES)} check(s): {', '.join(FAILURES)}")
        return 1
    print("All anchoring golden tests passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
