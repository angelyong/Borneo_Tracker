"""Static safety checks for the read-only deployment PR workflow."""

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "deployment-pr-validation.yml"


class DeployPrValidationWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text(encoding="utf-8")

    def test_runs_for_deployment_and_data_cache_policy_changes(self):
        self.assertIn("pull_request:", self.text)
        self.assertIn("branches: [master]", self.text)
        for path in (
            '".github/workflows/deploy.yml"',
            '".github/workflows/deployment-pr-validation.yml"',
            '"public/.htaccess"',
            '"public/data/**"',
        ):
            self.assertIn(path, self.text)

    def test_has_no_production_secrets_or_transport_steps(self):
        for forbidden in (
            "SFTP_HOST",
            "SFTP_USER",
            "SFTP_KEY",
            "SFTP_PASSWORD",
            "lftp",
            "mirror --reverse",
            "repository_dispatch:",
        ):
            self.assertNotIn(forbidden, self.text)
        self.assertIn("permissions:\n  contents: read", self.text)

    def test_validates_contract_and_publishable_htaccess_files(self):
        self.assertIn("tests.test_deploy_workflow_contract", self.text)
        self.assertIn("tests.test_workflow_contract", self.text)
        self.assertIn("python validate_data.py", self.text)
        self.assertIn("python verify_manifest.py verify public/data", self.text)
        self.assertIn("python verify_proof_contract.py public/data", self.text)
        self.assertIn("python verify_anchor.py --allow-pending", self.text)
        self.assertIn("npm ci", self.text)
        self.assertIn("npm run lint", self.text)
        self.assertIn("npm run build", self.text)
        self.assertIn("test -s dist/.htaccess", self.text)
        self.assertIn("test -s dist/data/.htaccess", self.text)


if __name__ == "__main__":
    unittest.main()
