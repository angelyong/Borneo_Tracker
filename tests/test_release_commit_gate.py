import unittest

from verify_release_commit import BOT_EMAIL, ReleaseCommitError, validate_release_metadata


ANCHOR_PATHS = [
    "public/data/anchors.jsonl",
    "public/data/manifest.json.ots",
    "public/data/versions/" + "a" * 64 + "/manifest.json",
    "public/data/versions/" + "a" * 64 + "/manifest.json.ots",
]


def valid_metadata(**overrides):
    values = {
        "source": "anchor",
        "sender": "github-actions[bot]",
        "subject": "chore: anchor data version on Bitcoin",
        "author_email": BOT_EMAIL,
        "committer_email": BOT_EMAIL,
        "parents": ["b" * 40],
        "paths": ANCHOR_PATHS,
        "current_manifest_sha": "a" * 64,
    }
    values.update(overrides)
    return values


class AutomaticReleaseCommitTests(unittest.TestCase):
    def test_accepts_anchor_and_monotonic_upgrade_shapes(self):
        validate_release_metadata(**valid_metadata())
        validate_release_metadata(
            **valid_metadata(
                source="upgrade",
                subject="chore: confirm anchor in a Bitcoin block",
                paths=[
                    "public/data/anchors.jsonl",
                    "public/data/manifest.json.ots",
                    "public/data/versions/" + "a" * 64 + "/manifest.json.ots",
                ],
            )
        )
        validate_release_metadata(
            **valid_metadata(
                source="upgrade",
                subject="chore: confirm anchor in a Bitcoin block",
                paths=[
                    "public/data/anchors.jsonl",
                    "public/data/versions/" + "c" * 64 + "/manifest.json.ots",
                ],
            )
        )

    def test_rejects_forged_sender_generic_commit_and_wrong_bot_identity(self):
        bad_cases = [
            {"sender": "repository-writer"},
            {"paths": ANCHOR_PATHS + ["src/App.jsx"]},
            {"subject": "feat: ordinary master commit"},
            {"author_email": "developer@example.com"},
            {"committer_email": "developer@example.com"},
        ]
        for change in bad_cases:
            with self.subTest(change=change), self.assertRaises(ReleaseCommitError):
                validate_release_metadata(**valid_metadata(**change))

    def test_rejects_merge_empty_missing_ledger_and_manifest_mutating_upgrade(self):
        bad_cases = [
            {"parents": ["b" * 40, "c" * 40]},
            {"paths": []},
            {"paths": ["public/data/manifest.json.ots"]},
            {"paths": [path for path in ANCHOR_PATHS if path != "public/data/manifest.json.ots"]},
            {
                "paths": [
                    "public/data/anchors.jsonl",
                    "public/data/manifest.json.ots",
                    "public/data/versions/" + "c" * 64 + "/manifest.json",
                    "public/data/versions/" + "c" * 64 + "/manifest.json.ots",
                ]
            },
            {
                "source": "upgrade",
                "subject": "chore: confirm anchor in a Bitcoin block",
                "paths": ANCHOR_PATHS,
            },
        ]
        for change in bad_cases:
            with self.subTest(change=change), self.assertRaises(ReleaseCommitError):
                validate_release_metadata(**valid_metadata(**change))


if __name__ == "__main__":
    unittest.main()
