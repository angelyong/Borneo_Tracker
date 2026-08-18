"""Static guards for the exact-SHA publication/deploy contract."""
import unittest
from pathlib import Path

ROOT=Path(__file__).parents[1]

class WorkflowContractTests(unittest.TestCase):
    def read(self,name): return (ROOT/".github/workflows"/name).read_text(encoding="utf-8")
    def test_publication_workflows_share_serialisation_and_never_cancel(self):
        for name in ("refresh-data.yml","anchor.yml","anchor-upgrade.yml","anchor-catchup.yml","deploy.yml"):
            text=self.read(name); self.assertIn("group: phase1-publication",text); self.assertIn("queue: max",text); self.assertIn("cancel-in-progress: false",text)
    def test_deploy_accepts_only_manual_or_exact_proof_dispatch(self):
        text=self.read("deploy.yml")
        self.assertIn("workflow_dispatch:",text)
        self.assertIn("repository_dispatch:",text)
        self.assertIn("types: [deploy-proof]",text)
        self.assertNotIn("\n  push:\n",text)
        self.assertIn("proof_commit_sha:",text)
        self.assertIn("confirm_production:",text)
        self.assertIn("DISPATCH_PROOF_COMMIT_SHA",text)
        self.assertIn("AUTO_PRODUCTION_DEPLOY",text)
        self.assertIn("ref: ${{ steps.gate.outputs.proof_commit_sha }}",text)
        self.assertIn('git merge-base --is-ancestor "${PROOF_COMMIT_SHA}" origin/master',text)
        self.assertIn('test "${PROOF_COMMIT_SHA}" = "$(git rev-parse origin/master)"',text)

    def test_anchor_workflows_dispatch_only_new_exact_proofs_when_enabled(self):
        for name in ("anchor.yml", "anchor-upgrade.yml"):
            text=self.read(name)
            self.assertIn("deploy-proof", text)
            self.assertIn("/dispatches", text)
            self.assertIn("AUTO_PRODUCTION_DEPLOY", text)
            self.assertIn("id: deploy_dispatch", text)
            self.assertIn('echo "dispatched=true" >> "$GITHUB_OUTPUT"', text)
            self.assertIn("GH_TOKEN: ${{ github.token }}", text)
            self.assertIn('test "${PROOF_COMMIT_SHA}" = "$(git rev-parse origin/master)"',text)
            self.assertIn("for attempt in 1 2 3 4", text)
            self.assertIn("Recover with a manual production run", text)
        anchor=self.read("anchor.yml")
        self.assertIn("needs.attest.outputs.mode != 'catchup'", anchor)
    def test_deploy_checks_full_scope_and_version_pair(self):
        text=self.read("deploy.yml")
        # The exact Phase-1 dataset list is intentionally not duplicated in the
        # deploy workflow.  It is emitted by verify_manifest.py from the shared
        # manifest contract, while these publication artefacts remain fixed.
        for artifact in ("anchors.jsonl","manifest.json.ots","versions/${manifest_sha}"):
            self.assertIn(artifact,text)
        self.assertIn("verify_manifest.py verify-remote",text)
        self.assertIn("verify_proof_contract.py \"$OUT\"", text)
        self.assertIn("verify_proof_contract.py \"$CACHE_OUT\"", text)
        self.assertIn("cachebust=${GITHUB_RUN_ID}",text)
        self.assertIn('"$OUT/versions/${manifest_sha}/manifest.json.ots"',text)
        self.assertIn("python verify_manifest.py paths",text)
        self.assertNotIn("manifest_tool.py",text)
        refresh=self.read("refresh-data.yml")
        self.assertIn("mapfile -t manifest_paths < <(python verify_manifest.py paths)",refresh)
        self.assertIn('python validate_data.py --baseline-ref "${{ github.sha }}" --require-baseline', refresh)
    def test_catchup_refuses_branch_tip_stamping(self):
        text=(ROOT/"catch_up_anchors.py").read_text(encoding="utf-8")
        self.assertIn("never infer a byte sequence from branch tip",text)
        self.assertIn('"git","show"',text)
        self.assertIn("client_payload[manifest_sha]",text)
        self.assertIn("git_blobs",text)
        self.assertIn("--max-commits",text)
        anchor=self.read("anchor.yml")
        self.assertIn('git show "${DISPATCH_DATA_SHA}:public/data/manifest.json"',anchor)
        self.assertIn('subject="$RUNNER_TEMP/historical-manifest.json"',anchor)
        self.assertIn("subject-path: ${{ steps.release.outputs.manifest_file }}",anchor)
        self.assertIn('if [ "${{ needs.attest.outputs.mode }}" != "catchup" ]',anchor)
        self.assertIn("proof_binds_manifest(manifest, proof_path(digest).read_bytes())",anchor)
        self.assertIn('if [ "${{ needs.attest.outputs.mode }}" != "catchup" ]',anchor)
    def test_normal_dispatch_and_manual_release_are_attached_master_only(self):
        anchor=self.read("anchor.yml")
        self.assertIn("ref: master",anchor)
        self.assertIn("fetch-depth: 0",anchor)
        self.assertIn('test "$WORKFLOW_REF" = "refs/heads/master"',anchor)
        self.assertIn('test "$(git branch --show-current)" = "master"',anchor)
        self.assertIn('test "$RUN_SOURCE_SHA" = "$head_sha"',anchor)
        self.assertIn('test "$DISPATCH_DATA_SHA" = "$head_sha"',anchor)
        self.assertIn('elif [ "$EVENT_NAME" = "workflow_dispatch" ]',anchor)
        self.assertIn('test "$data_sha" = "$head_sha"',anchor)
        self.assertNotIn("ref: ${{ github.event_name",anchor)
    def test_sigstore_is_pinned_and_verified_before_recording(self):
        anchor=self.read("anchor.yml")
        self.assertIn("actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683",anchor)
        self.assertIn("actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065",anchor)
        self.assertIn("actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6",anchor)
        self.assertIn("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",anchor)
        self.assertIn("actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093",anchor)
        self.assertIn("bundle_sha256",anchor)
        self.assertIn('test "$(sha256sum "$bundle" | awk \'{print $1}\')" = "$BUNDLE_SHA256"',anchor)
        self.assertIn("contents: read",anchor)
        self.assertIn("contents: write",anchor)
        self.assertIn("gh attestation verify",anchor)
        for option in ("--bundle", '--signer-workflow "${{ github.repository }}/.github/workflows/anchor.yml"', "--source-ref refs/heads/master", "--source-digest"):
            self.assertIn(option,anchor)
        self.assertLess(anchor.index("Verify Sigstore identity"),anchor.index("Stamp the manifest"))
        script=(ROOT/"anchor_provenance.py").read_text(encoding="utf-8")
        self.assertIn("refusing to record an unverified Sigstore bundle",script)
        self.assertIn('"dataCommitSha": data_commit',script)
        self.assertIn('"signerSourceSha": signer_source',script)
    def test_deploy_actions_are_pinned_to_immutable_revisions(self):
        deploy=self.read("deploy.yml")
        for revision in (
            "actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683",
            "actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065",
            "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
            "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
        ):
            self.assertIn(revision,deploy)
    def test_connected_pr_gate_is_non_mutating_and_identity_constrained(self):
        integration=self.read("anchor-integration.yml")
        self.assertIn("pull_request:",integration)
        self.assertIn("head.repo.full_name == github.repository",integration)
        self.assertIn("id-token: write",integration)
        self.assertIn("attestations: write",integration)
        self.assertIn("gh attestation verify",integration)
        self.assertIn('--signer-workflow "${{ github.repository }}/.github/workflows/anchor-integration.yml"',integration)
        self.assertNotIn("contents: write",integration)
        self.assertNotIn("git push",integration)
    def test_upgrade_events_retain_source_identity_and_name_the_upgrader(self):
        upgrade=(ROOT/"upgrade_anchors.py").read_text(encoding="utf-8")
        for field in ("dataCommitSha", "signerSourceSha", "upgradeSignerSourceSha", "upgradeSignerWorkflow", "upgradeSignerRef", "upgradeWorkflowRunId"):
            self.assertIn(field,upgrade)
    def test_every_gh_dispatch_gets_an_explicit_actions_token(self):
        for name in ("refresh-data.yml", "anchor.yml", "anchor-upgrade.yml", "anchor-catchup.yml"):
            text=self.read(name)
            if "gh api" in text or "--dispatch" in text:
                self.assertIn("GH_TOKEN: ${{ github.token }}",text)
if __name__=="__main__": unittest.main()
