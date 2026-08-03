"""
Borneo Tracker — a minimal OpenTimestamps client (ABCDE letter "B").

WHY THIS FILE EXISTS AT ALL
    We need a Bitcoin timestamp for each published data version, and we need it
    with no wallet, no private key and no money — because a key that can write
    anchors is a key that, once leaked, lets an attacker make tampered data look
    verified, and a funded wallet is something that silently runs dry after the
    team graduates. OpenTimestamps gives exactly that: calendar servers batch
    thousands of digests into one Bitcoin transaction, so our marginal cost is
    zero and our marginal key material is nothing.

WHY NOT THE `opentimestamps` PACKAGE
    It depends on `python-bitcoinlib`, whose OpenSSL bindings fail on Windows —
    which is where this project is developed. A dependency that cannot run on the
    maintainer's own machine is a dependency that will not be maintained. The
    wire format is small enough to implement against the spec, so we do, in the
    standard library only.

WHAT THIS IMPLEMENTS
    - the `.ots` detached-proof file format (serialise + parse + merge)
    - calendar submission  (POST <calendar>/digest)
    - calendar upgrade     (GET  <calendar>/timestamp/<hex commitment>)
    Enough to stamp, to upgrade a pending stamp into a real Bitcoin attestation,
    and to read back what a proof currently claims.

    It does NOT verify a Bitcoin attestation against the chain — that needs block
    headers we do not have. `verify_anchor.py` says so plainly rather than
    implying more assurance than we can deliver; use the official `ots verify`,
    or a block explorer, for the final link.

THE ONE DELIBERATE SIMPLIFICATION
    The reference client hashes a random 16-byte nonce onto the file digest before
    sending it, so a calendar never learns the digest of your private file. Our
    data files are public and their digests are already published in
    `manifest.json`, so the nonce would protect nothing and would add a step a
    third-party verifier has to reproduce. We submit the file digest directly.
    The resulting `.ots` is a plain, standard proof: `ots verify manifest.json`
    works on it with no special handling.

FORMAT NOTES (so the next reader does not have to rediscover them)
    Timestamps form a tree. Each node holds a message, zero or more attestations,
    and zero or more operations; applying an operation to the node's message gives
    the child node's message. Serialisation is depth-first with 0xff as
    "another branch follows" and 0x00 as "an attestation follows".
"""

import hashlib
import urllib.error
import urllib.request

# ---------------------------------------------------------------- wire format

HEADER_MAGIC = b"\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94"
MAJOR_VERSION = 1

# Operation tags.
OP_SHA1 = 0x02
OP_RIPEMD160 = 0x03
OP_SHA256 = 0x08
OP_KECCAK256 = 0x67
OP_APPEND = 0xF0
OP_PREPEND = 0xF1
OP_REVERSE = 0xF2
OP_HEXLIFY = 0xF3

# Ops that carry a byte-string argument; the rest are unary hashes/transforms.
BINARY_OPS = (OP_APPEND, OP_PREPEND)

# 8-byte attestation type tags.
TAG_PENDING = b"\x83\xdf\xe3\x0d\x2e\xf9\x0c\x8e"
TAG_BITCOIN = b"\x05\x88\x96\x0d\x73\xd7\x19\x01"
TAG_LITECOIN = b"\x06\x86\x9a\x0d\x73\xd7\x1b\x45"
TAG_ETHEREUM = b"\x30\xfe\x80\x87\xb5\xc7\xea\xd7"

# Public calendars. More than one on purpose: a proof that only one server can
# upgrade is a proof with a single point of failure.
DEFAULT_CALENDARS = (
    "https://a.pool.opentimestamps.org",
    "https://b.pool.opentimestamps.org",
    "https://a.pool.eternitywall.com",
    "https://ots.btc.catallaxy.com",
)

USER_AGENT = "borneo-tracker-ots/1.0 (+https://github.com/angelyong/Borneo_Tracker)"
MAX_PAYLOAD = 8192


class OtsError(Exception):
    """Anything malformed in a proof, or any calendar that misbehaves."""


# ---------------------------------------------------------------- read / write


class Reader:
    def __init__(self, data):
        self.data = data
        self.pos = 0

    def byte(self):
        if self.pos >= len(self.data):
            raise OtsError("truncated proof: expected another byte")
        value = self.data[self.pos]
        self.pos += 1
        return value

    def read(self, n):
        if self.pos + n > len(self.data):
            raise OtsError(f"truncated proof: wanted {n} bytes, {len(self.data) - self.pos} left")
        chunk = self.data[self.pos:self.pos + n]
        self.pos += n
        return chunk

    def varuint(self):
        value = 0
        shift = 0
        while True:
            b = self.byte()
            value |= (b & 0x7F) << shift
            if not b & 0x80:
                return value
            shift += 7

    def varbytes(self):
        length = self.varuint()
        if length > MAX_PAYLOAD:
            raise OtsError(f"implausible length {length} in proof")
        return self.read(length)

    @property
    def done(self):
        return self.pos >= len(self.data)


class Writer:
    def __init__(self):
        self.chunks = []

    def write(self, data):
        self.chunks.append(data)

    def byte(self, value):
        self.chunks.append(bytes([value]))

    def varuint(self, value):
        if value < 0:
            raise OtsError("varuint cannot be negative")
        if value == 0:
            self.byte(0)
            return
        while value:
            b = value & 0x7F
            value >>= 7
            if value:
                b |= 0x80
            self.byte(b)

    def varbytes(self, data):
        self.varuint(len(data))
        self.write(data)

    @property
    def bytes(self):
        return b"".join(self.chunks)


# ---------------------------------------------------------------- operations


class Op:
    """One step in the tree: applying it to a node's message yields the child's."""

    __slots__ = ("tag", "arg")

    def __init__(self, tag, arg=b""):
        self.tag = tag
        self.arg = arg

    def apply(self, msg):
        if self.tag == OP_APPEND:
            return msg + self.arg
        if self.tag == OP_PREPEND:
            return self.arg + msg
        if self.tag == OP_REVERSE:
            return msg[::-1]
        if self.tag == OP_HEXLIFY:
            return msg.hex().encode("ascii")
        if self.tag == OP_SHA256:
            return hashlib.sha256(msg).digest()
        if self.tag == OP_SHA1:
            return hashlib.sha1(msg).digest()
        if self.tag == OP_KECCAK256:
            raise OtsError("keccak256 appears in this proof; not supported")
        if self.tag == OP_RIPEMD160:
            try:
                return hashlib.new("ripemd160", msg).digest()
            except ValueError as exc:  # OpenSSL 3 drops it from the default set
                raise OtsError("this proof needs ripemd160, unavailable in this build") from exc
        raise OtsError(f"unknown operation tag 0x{self.tag:02x}")

    def serialize(self, w):
        w.byte(self.tag)
        if self.tag in BINARY_OPS:
            w.varbytes(self.arg)

    @property
    def serialized(self):
        w = Writer()
        self.serialize(w)
        return w.bytes

    # Identity is (tag, arg): the same operation reached by two paths is one op.
    def __eq__(self, other):
        return isinstance(other, Op) and self.tag == other.tag and self.arg == other.arg

    def __hash__(self):
        return hash((self.tag, self.arg))

    def __repr__(self):
        return f"Op(0x{self.tag:02x}{', ' + self.arg.hex() if self.arg else ''})"

    @staticmethod
    def parse(r, tag):
        return Op(tag, r.varbytes() if tag in BINARY_OPS else b"")


# ---------------------------------------------------------------- attestations


class Attestation:
    """A claim about when a message existed. Pending = a calendar promises to
    include it; Bitcoin = it is committed to by a block header."""

    __slots__ = ("tag", "payload")

    def __init__(self, tag, payload):
        self.tag = tag
        self.payload = payload

    @property
    def is_pending(self):
        return self.tag == TAG_PENDING

    @property
    def is_bitcoin(self):
        return self.tag == TAG_BITCOIN

    @property
    def uri(self):
        """Calendar URI, for a pending attestation."""
        if not self.is_pending:
            return None
        return Reader(self.payload).varbytes().decode("utf-8", "replace")

    @property
    def height(self):
        """Bitcoin block height, for a confirmed attestation."""
        if not self.is_bitcoin:
            return None
        return Reader(self.payload).varuint()

    def describe(self):
        if self.is_pending:
            return f"pending via {self.uri}"
        if self.is_bitcoin:
            return f"bitcoin block {self.height}"
        if self.tag == TAG_LITECOIN:
            return "litecoin block attestation"
        if self.tag == TAG_ETHEREUM:
            return "ethereum block attestation"
        return f"unknown attestation {self.tag.hex()}"

    def serialize(self, w):
        w.write(self.tag)
        w.varbytes(self.payload)

    @property
    def sort_key(self):
        return (self.tag, self.payload)

    def __eq__(self, other):
        return isinstance(other, Attestation) and self.sort_key == other.sort_key

    def __hash__(self):
        return hash(self.sort_key)

    def __repr__(self):
        return f"Attestation({self.describe()})"

    @staticmethod
    def parse(r):
        # The payload is length-prefixed precisely so that attestation types we
        # have never heard of can be carried through untouched.
        tag = r.read(8)
        return Attestation(tag, r.varbytes())

    @staticmethod
    def pending(uri):
        w = Writer()
        w.varbytes(uri.encode("utf-8"))
        return Attestation(TAG_PENDING, w.bytes)


# ---------------------------------------------------------------- timestamp


class Timestamp:
    """A node: one message, its attestations, and the ops leading to children."""

    __slots__ = ("msg", "attestations", "ops")

    def __init__(self, msg):
        self.msg = msg
        self.attestations = []
        self.ops = {}  # Op -> Timestamp

    # -- traversal ---------------------------------------------------------

    def walk(self):
        """Every node in the tree, this one first."""
        yield self
        for child in self.ops.values():
            yield from child.walk()

    def all_attestations(self):
        for node in self.walk():
            for att in node.attestations:
                yield node, att

    def pending(self):
        """(node, attestation) for every calendar promise still outstanding."""
        return [(n, a) for n, a in self.all_attestations() if a.is_pending]

    def bitcoin(self):
        """(node, attestation) for every confirmed Bitcoin attestation."""
        return [(n, a) for n, a in self.all_attestations() if a.is_bitcoin]

    def has_bitcoin(self):
        return any(a.is_bitcoin for _, a in self.all_attestations())

    # -- merge -------------------------------------------------------------

    def merge(self, other):
        """Fold another timestamp for the same message into this one.

        Used both to combine several calendars' answers into one proof and to
        graft an upgraded (Bitcoin-attested) subtree onto a pending node.
        """
        if self.msg != other.msg:
            raise OtsError("cannot merge timestamps for different messages")

        for att in other.attestations:
            if att not in self.attestations:
                self.attestations.append(att)

        for op, other_child in other.ops.items():
            child = self.ops.get(op)
            if child is None:
                child = Timestamp(op.apply(self.msg))
                self.ops[op] = child
            child.merge(other_child)

    def prune_superseded_pending(self):
        """Drop calendar promises at nodes whose subtree now has a Bitcoin proof.

        A promise that has been kept is noise; leaving it in makes a confirmed
        proof still report as pending.
        """
        for node in self.walk():
            if node.attestations and any(a.is_bitcoin for a in node.attestations):
                node.attestations = [a for a in node.attestations if not a.is_pending]
                continue
            if any(a.is_pending for a in node.attestations):
                if any(child.has_bitcoin() for child in node.ops.values()):
                    node.attestations = [a for a in node.attestations if not a.is_pending]

    # -- serialisation -----------------------------------------------------

    def serialize(self, w):
        atts = sorted(self.attestations, key=lambda a: a.sort_key)
        ops = sorted(self.ops.items(), key=lambda item: item[0].serialized)

        if not atts and not ops:
            raise OtsError("refusing to serialise an empty timestamp node")

        # Every attestation but the last is introduced by 0xff 0x00 ("more follows").
        if len(atts) > 1:
            for att in atts[:-1]:
                w.write(b"\xff\x00")
                att.serialize(w)

        if not ops:
            w.byte(0x00)
            atts[-1].serialize(w)
            return

        if atts:
            w.write(b"\xff\x00")
            atts[-1].serialize(w)

        for op, child in ops[:-1]:
            w.byte(0xFF)
            op.serialize(w)
            child.serialize(w)

        last_op, last_child = ops[-1]
        last_op.serialize(w)
        last_child.serialize(w)

    @staticmethod
    def parse(r, msg):
        ts = Timestamp(msg)
        tag = r.byte()
        while tag == 0xFF:
            inner = r.byte()
            if inner == 0x00:
                ts.attestations.append(Attestation.parse(r))
            else:
                op = Op.parse(r, inner)
                ts.ops[op] = Timestamp.parse(r, op.apply(msg))
            tag = r.byte()

        if tag == 0x00:
            ts.attestations.append(Attestation.parse(r))
        else:
            op = Op.parse(r, tag)
            ts.ops[op] = Timestamp.parse(r, op.apply(msg))
        return ts


# ---------------------------------------------------------------- .ots file


class DetachedTimestamp:
    """The contents of a `.ots` file: which hash of which file, and its proof."""

    __slots__ = ("hash_op", "digest", "timestamp")

    def __init__(self, digest, timestamp, hash_op=OP_SHA256):
        self.hash_op = hash_op
        self.digest = digest
        self.timestamp = timestamp

    def to_bytes(self):
        w = Writer()
        w.write(HEADER_MAGIC)
        w.varuint(MAJOR_VERSION)
        w.byte(self.hash_op)
        w.write(self.digest)
        self.timestamp.serialize(w)
        return w.bytes

    @staticmethod
    def from_bytes(data):
        r = Reader(data)
        if r.read(len(HEADER_MAGIC)) != HEADER_MAGIC:
            raise OtsError("not an OpenTimestamps proof (bad magic)")
        version = r.varuint()
        if version != MAJOR_VERSION:
            raise OtsError(f"unsupported proof version {version}")
        hash_op = r.byte()
        if hash_op != OP_SHA256:
            raise OtsError(f"proof uses hash op 0x{hash_op:02x}; only sha256 is supported")
        digest = r.read(32)
        return DetachedTimestamp(digest, Timestamp.parse(r, digest), hash_op)

    def status(self):
        """('confirmed', [heights]) | ('pending', [uris]) | ('unknown', [])."""
        heights = sorted({a.height for _, a in self.timestamp.bitcoin()})
        if heights:
            return "confirmed", heights
        uris = sorted({a.uri for _, a in self.timestamp.pending()})
        if uris:
            return "pending", uris
        return "unknown", []


# ---------------------------------------------------------------- calendars


def _http(url, data=None, timeout=25):
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Accept": "application/vnd.opentimestamps.v1",
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def submit(digest, calendars=DEFAULT_CALENDARS, timeout=25):
    """Stamp `digest` with every calendar we can reach.

    Returns (timestamp, [reached_uris], [(uri, error)]). Partial success is normal
    and fine — one reachable calendar is a usable proof — so callers get both
    lists rather than an exception.
    """
    if len(digest) != 32:
        raise OtsError("expected a 32-byte sha256 digest")

    merged = Timestamp(digest)
    reached, failed = [], []

    for calendar in calendars:
        try:
            body = _http(f"{calendar.rstrip('/')}/digest", data=digest, timeout=timeout)
            answer = Timestamp.parse(Reader(body), digest)
        except (urllib.error.URLError, OtsError, OSError) as exc:
            failed.append((calendar, str(exc)))
            continue
        # A calendar that answers with nothing useful is a failure, not a success.
        if not list(answer.all_attestations()):
            failed.append((calendar, "answered with no attestation"))
            continue
        merged.merge(answer)
        reached.append(calendar)

    if not reached:
        detail = "; ".join(f"{c}: {e}" for c, e in failed) or "no calendars configured"
        raise OtsError(f"no calendar accepted the stamp ({detail})")

    return merged, reached, failed


def upgrade(detached, timeout=25):
    """Ask each calendar whether its promise has made it into Bitcoin yet.

    Mutates `detached` in place. Returns True if anything was upgraded. A 404 is
    the ordinary "not in a block yet" answer, not an error worth raising.
    """
    upgraded = False
    for node, att in detached.timestamp.pending():
        uri = att.uri
        if not uri:
            continue
        url = f"{uri.rstrip('/')}/timestamp/{node.msg.hex()}"
        try:
            body = _http(url, timeout=timeout)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                continue  # still waiting for a block; expected
            continue
        except (urllib.error.URLError, OSError):
            continue
        try:
            node.merge(Timestamp.parse(Reader(body), node.msg))
        except OtsError:
            continue
        upgraded = True

    if upgraded:
        detached.timestamp.prune_superseded_pending()
    return upgraded


# ---------------------------------------------------------------- convenience


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.digest()


def stamp_file(path, calendars=DEFAULT_CALENDARS):
    """Stamp a file. Returns (DetachedTimestamp, reached, failed)."""
    digest = sha256_file(path)
    timestamp, reached, failed = submit(digest, calendars)
    return DetachedTimestamp(digest, timestamp), reached, failed
