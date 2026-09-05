"""Auxiliary files are anchored through the ledger, never through `files`.

`sources.json` and `resilience_history.json` are published and rendered but must
never enter ``manifest_contract.DATASET_PATHS``: widening that frozen scope would
invalidate every Manifest ever anchored. They are covered by the provenance
ledger instead, whose Merkle root the Manifest commits to and the OpenTimestamps
proof anchors. These tests pin both halves of that bargain -- the coverage, and
the promise that historical publications keep verifying untouched.
"""
import hashlib
import json
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

import emit_manifest
import ots
import verify_anchor
from manifest_contract import AUXILIARY_PATHS, DATASET_PATHS, strict_json_loads, validate_manifest


@contextmanager
def emitter(root, data):
    with patch.multiple(emit_manifest, ROOT=root, DATA_DIR=data, MANIFEST=data / "manifest.json",
                        PROVENANCE=data / "provenance.jsonl", LOCK=data / ".manifest.lock"):
        yield


def build_tree(root, *, auxiliary=True):
    data = root / "public/data"
    data.mkdir(parents=True)
    for index, rel in enumerate(DATASET_PATHS):
        (root / rel).write_text(json.dumps({"generatedAt": "2026-08-09", "n": index}), encoding="utf-8", newline="\n")
    if auxiliary:
        for index, rel in enumerate(AUXILIARY_PATHS):
            (root / rel).write_text(json.dumps({"generatedAt": "2026-08-09", "aux": index}), encoding="utf-8", newline="\n")
    return data


def ledger_rows(data):
    raw = (data / "provenance.jsonl").read_bytes()
    return [strict_json_loads(line.decode("utf-8"), "row") for line in raw.split(b"\n") if line.strip()]


def served(root, data):
    """Everything a remote host would serve for this publication."""
    payloads = {rel: (root / rel).read_bytes() for rel in DATASET_PATHS}
    payloads.update({rel: (root / rel).read_bytes() for rel in AUXILIARY_PATHS if (root / rel).is_file()})
    payloads["public/data/manifest.json"] = (data / "manifest.json").read_bytes()
    payloads["public/data/provenance.jsonl"] = (data / "provenance.jsonl").read_bytes()
    sha = hashlib.sha256(payloads["public/data/manifest.json"]).hexdigest()
    stamp = ots.Timestamp(bytes.fromhex(sha))
    stamp.attestations.append(ots.Attestation.pending("https://calendar.example"))
    proof_rel = f"public/data/versions/{sha}/manifest.json.ots"
    payloads[proof_rel] = ots.DetachedTimestamp(bytes.fromhex(sha), stamp).to_bytes()
    event = {"schemaVersion": 2, "manifestSha256": sha, "eventType": "ots.upgraded",
             "witness": {"type": "ots", "status": "pending"}, "proof": proof_rel,
             "otsAttestationClaim": {"kind": "bitcoin-attestation-present"}}
    payloads["public/data/anchors.jsonl"] = (json.dumps(event) + "\n").encode()
    return payloads


class Served(verify_anchor.Source):
    """A --remote Source backed by a fixture, so no network is touched."""

    def __init__(self, payloads):
        super().__init__("https://production.example")
        self._payloads = payloads

    def get(self, rel):
        self.error = None if rel in self._payloads else "missing"
        return self._payloads.get(rel)


class FrozenScopeTests(unittest.TestCase):
    def test_auxiliaries_stay_out_of_the_manifest_file_scope(self):
        self.assertTrue(set(AUXILIARY_PATHS).isdisjoint(DATASET_PATHS))
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data = build_tree(root)
            with emitter(root, data):
                manifest, changed = emit_manifest.publish()
        self.assertTrue(changed)
        # The anchored archive depends on this staying exactly six forever.
        self.assertEqual(set(manifest["files"]), set(DATASET_PATHS))
        self.assertEqual(validate_manifest(manifest), manifest)

    def test_a_manifest_that_smuggles_an_auxiliary_into_files_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data = build_tree(root)
            with emitter(root, data):
                manifest, _ = emit_manifest.publish()
        manifest["files"][AUXILIARY_PATHS[0]] = dict(manifest["files"][DATASET_PATHS[0]])
        with self.assertRaises(ValueError):
            validate_manifest(manifest)


class AuxiliaryLedgerCoverageTests(unittest.TestCase):
    def test_auxiliaries_are_recorded_in_the_committed_prefix(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data = build_tree(root)
            with emitter(root, data):
                manifest, _ = emit_manifest.publish()
                auxiliary = emit_manifest.build_auxiliary()
                lines = emit_manifest.load_lines()
                recorded = emit_manifest.committed_auxiliary(lines, manifest["provenance"]["entries"])
            rows = ledger_rows(data)
        self.assertEqual(len(rows), len(DATASET_PATHS) + len(AUXILIARY_PATHS))
        self.assertEqual({row["file"] for row in rows}, set(DATASET_PATHS) | set(AUXILIARY_PATHS))
        self.assertEqual(recorded, auxiliary)
        # Every row of the batch, auxiliaries included, sits inside the prefix
        # the Manifest commits to -- which is what the anchor timestamps.
        self.assertEqual(manifest["provenance"]["entries"], len(rows))
        for row in rows:
            self.assertEqual(row["entryCount"], len(rows))

    def test_an_auxiliary_only_change_still_publishes_a_new_root(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data = build_tree(root)
            with emitter(root, data):
                first, _ = emit_manifest.publish()
                unchanged, changed = emit_manifest.publish()
                self.assertFalse(changed, "an untouched tree must stay a no-op")
                self.assertEqual(unchanged["provenance"]["root"], first["provenance"]["root"])
                (root / AUXILIARY_PATHS[0]).write_text('{"generatedAt":"2026-08-10","aux":99}', encoding="utf-8", newline="\n")
                second, changed = emit_manifest.publish()
        # Used to be a silent no-op: the auxiliary shipped under the previous
        # version's proof, covered by nothing.
        self.assertTrue(changed)
        self.assertNotEqual(second["provenance"]["root"], first["provenance"]["root"])
        # The core six did not move, so the data version must not have either.
        self.assertEqual(second["dataVersion"], first["dataVersion"])
        self.assertEqual(second["files"], first["files"])


    def test_dropping_an_auxiliary_settles_instead_of_republishing_forever(self):
        """The ledger view is the newest batch, not all of history.

        Reading every row instead would keep resurrecting a removed file's last
        known hash, so the emitter could never reach a settled state and would
        publish a new version on every single run.
        """
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data = build_tree(root)
            with emitter(root, data):
                emit_manifest.publish()
                (root / AUXILIARY_PATHS[0]).unlink()
                dropped, changed = emit_manifest.publish()
                self.assertTrue(changed, "removing a covered file must be recorded")
                again, changed_again = emit_manifest.publish()
                rows = ledger_rows(data)
        self.assertFalse(changed_again, "the emitter must settle on the next run")
        self.assertEqual(again["provenance"]["root"], dropped["provenance"]["root"])
        # The newest batch no longer names the removed file; history still does.
        newest = rows[-rows[-1]["entryCount"]:]
        self.assertNotIn(AUXILIARY_PATHS[0], {row["file"] for row in newest})
        self.assertIn(AUXILIARY_PATHS[0], {row["file"] for row in rows})

    def test_a_legacy_prefix_reports_no_auxiliaries(self):
        legacy = [json.dumps({"file": rel, "sha256": "a" * 64, "bytes": 1}, sort_keys=True).encode() for rel in DATASET_PATHS]
        self.assertEqual(emit_manifest.committed_auxiliary(legacy, len(legacy)), {})


class AuxiliaryVerificationTests(unittest.TestCase):
    def test_a_tampered_auxiliary_is_caught(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data = build_tree(root)
            with emitter(root, data):
                emit_manifest.publish()
            payloads = served(root, data)
            result, detail = verify_anchor.evaluate(Served(payloads))
            self.assertEqual(result, "PENDING", detail)
            payloads[AUXILIARY_PATHS[0]] = b'{"generatedAt":"2026-08-09","aux":"tampered"}'
            result, detail = verify_anchor.evaluate(Served(payloads))
        self.assertEqual(result, "MISMATCH")
        self.assertIn(AUXILIARY_PATHS[0], detail)

    def test_a_withheld_auxiliary_is_caught(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data = build_tree(root)
            with emitter(root, data):
                emit_manifest.publish()
            payloads = served(root, data)
            del payloads[AUXILIARY_PATHS[1]]
            result, detail = verify_anchor.evaluate(Served(payloads))
        self.assertEqual(result, "MISMATCH")
        self.assertIn(AUXILIARY_PATHS[1], detail)

    def test_a_publication_without_auxiliaries_still_verifies(self):
        """Backward compatibility: this is the shape of every anchored version."""
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data = build_tree(root, auxiliary=False)
            with emitter(root, data):
                manifest, _ = emit_manifest.publish()
            self.assertEqual(len(ledger_rows(data)), len(DATASET_PATHS))
            result, detail = verify_anchor.evaluate(Served(served(root, data)))
        self.assertEqual(result, "PENDING", detail)
        self.assertEqual(validate_manifest(manifest), manifest)


if __name__ == "__main__":
    unittest.main()
