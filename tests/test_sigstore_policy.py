import unittest

from anchor_provenance import event_context, sigstore_verification


class SigstorePolicyTests(unittest.TestCase):
    def test_bundle_cannot_be_recorded_without_explicit_verification_gate(self):
        with self.assertRaisesRegex(ValueError, "unverified"):
            sigstore_verification([], {"bundleSha256": "a" * 64})

    def test_verification_policy_requires_identity_constraints(self):
        with self.assertRaisesRegex(ValueError, "incomplete"):
            sigstore_verification(["--sigstore-verified"], {"bundleSha256": "a" * 64})
        args=["--sigstore-verified", "--sigstore-repository", "owner/repo", "--sigstore-signer-workflow", ".github/workflows/anchor.yml", "--sigstore-source-ref", "refs/heads/master", "--sigstore-source-digest", "b" * 40]
        self.assertEqual(sigstore_verification(args, {"bundleSha256": "a" * 64})["sourceDigest"], "b" * 40)

    def test_data_commit_and_signer_context_are_separate(self):
        args=["--data-commit-sha", "a" * 40, "--signer-source-sha", "b" * 40, "--signer-workflow", ".github/workflows/anchor.yml", "--signer-ref", "refs/heads/master"]
        context=event_context(args)
        self.assertEqual(context["dataCommitSha"], "a" * 40)
        self.assertEqual(context["signerSourceSha"], "b" * 40)
        self.assertEqual(context["sourceCommitSha"], context["dataCommitSha"])


if __name__ == "__main__": unittest.main()
