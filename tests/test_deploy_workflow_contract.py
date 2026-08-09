"""Offline guardrails for the DirectAdmin deployment workflow.

These assertions deliberately inspect the committed workflow rather than a live
FTP account.  They stop a future edit from silently changing Pure-FTPd port 21
back to implicit FTPS, or making a supposedly read-only connection test write
to production.
"""

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "deploy.yml"


def step_block(text: str, start: str, end: str) -> str:
    """Return the text between two unique workflow step names."""
    after_start = text.index(start)
    after_end = text.index(end, after_start)
    return text[after_start:after_end]


class DeployWorkflowContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text(encoding="utf-8")

    def test_explicit_ftps_port_21_uses_auth_tls_not_implicit_ftps(self):
        self.assertIn('echo "set ftp:ssl-auth TLS"', self.text)
        self.assertIn('echo "set ftp:ssl-force true"', self.text)
        self.assertIn('echo "set ftp:ssl-protect-data true"', self.text)
        self.assertIn('echo "set ssl:verify-certificate ${FTPS_VERIFY_CERT}"', self.text)
        self.assertIn('ftp://${SFTP_HOST}:${PORT}', self.text)
        self.assertNotRegex(
            self.text,
            r'echo "open[^\n]*ftps://\$\{SFTP_HOST\}:\$\{PORT\}',
        )

    def test_certificate_verification_stays_enabled_by_default(self):
        self.assertIn("FTPS_VERIFY_CERT: ${{ vars.FTPS_VERIFY_CERT || 'yes' }}", self.text)
        self.assertIn("FTPS_VERIFY_CERT must be yes or no (default: yes)", self.text)
        self.assertIn("FTPS certificate verification disabled", self.text)
        self.assertIn("emergency temporary diagnostic override", self.text)

    def test_public_smoke_tls_is_strict_by_default(self):
        self.assertIn(
            "SMOKE_ALLOW_INSECURE_TLS: ${{ vars.SMOKE_ALLOW_INSECURE_TLS || 'false' }}",
            self.text,
        )
        self.assertIn(
            "ALLOW_INSECURE: ${{ vars.SMOKE_ALLOW_INSECURE_TLS || 'false' }}",
            self.text,
        )
        self.assertNotIn("SMOKE_ALLOW_INSECURE_TLS || 'true'", self.text)
        self.assertIn("TLS verification override enabled", self.text)
        self.assertIn("Strict TLS is enabled", self.text)

    def test_dry_run_never_reaches_transport_steps(self):
        for step in ("Install lftp", "Prepare credentials"):
            block = self.text[self.text.index(f"- name: {step}"):]
            first_lines = "\n".join(block.splitlines()[:4])
            self.assertIn("steps.gate.outputs.mode != 'dry_run'", first_lines, step)
        for step, condition in (
            ("Test DirectAdmin connection (read only)", "mode == 'connection_test_only'"),
            ("Upload dist/ to DirectAdmin (non-destructive)", "mode == 'production'"),
        ):
            block = self.text[self.text.index(f"- name: {step}"):]
            first_lines = "\n".join(block.splitlines()[:4])
            self.assertIn(condition, first_lines, step)

    def test_connection_test_is_manual_read_only_and_never_smokes(self):
        self.assertIn("connection_test_only", self.text)
        self.assertIn("mode == 'connection_test_only'", self.text)
        self.assertIn("mode != 'connection_test_only'", self.text)
        connection = step_block(
            self.text,
            "- name: Test DirectAdmin connection (read only)",
            "- name: Upload dist/ to DirectAdmin (non-destructive)",
        )
        self.assertIn('echo "cd \\"${REMOTE_DIR}\\""', connection)
        self.assertIn('echo "cls -1"', connection)
        self.assertNotIn("mirror --reverse", connection)
        self.assertNotIn('echo "put ', connection)
        self.assertNotIn('echo "get ', connection)
        self.assertNotIn("Smoke-test production", connection)

    def test_release_modes_are_explicit_and_production_needs_confirmation(self):
        self.assertIn("release_mode:", self.text)
        self.assertIn("dry_run|connection_test_only|production", self.text)
        self.assertIn('case "${RELEASE_MODE}" in dry_run|connection_test_only|production) ;; *)', self.text)
        self.assertIn('exit 1\n          esac\n          if ! [[ "${PROOF_COMMIT_SHA}"', self.text)
        self.assertIn("proof_commit_sha:", self.text)
        self.assertIn("^[0-9a-f]{40}$", self.text)
        self.assertIn("confirm_production:", self.text)
        self.assertIn('"${CONFIRM_PRODUCTION}" != "true"', self.text)
        self.assertIn("Production confirmation required", self.text)

    def test_exact_proof_sha_is_checked_out_and_must_belong_to_master(self):
        self.assertIn("ref: ${{ inputs.proof_commit_sha }}", self.text)
        self.assertIn("fetch-depth: 0", self.text)
        self.assertIn("Verify requested proof commit is an immutable master release", self.text)
        self.assertIn('git merge-base --is-ancestor "${PROOF_COMMIT_SHA}" origin/master', self.text)
        self.assertIn('test "$(git rev-parse HEAD)" = "${PROOF_COMMIT_SHA}"', self.text)

    def test_missing_required_secrets_are_red_not_a_green_skip(self):
        self.assertIn("Deployment prerequisites missing", self.text)
        self.assertIn("exit 1", self.text)
        self.assertNotIn("Deployment SKIPPED — not yet configured", self.text)
        self.assertNotIn("This run finished green **on purpose**", self.text)

    def test_modes_have_separate_build_and_transport_boundaries(self):
        setup_python = step_block(self.text, "- name: Set up Python", "- name: Validate dashboard data (blocking gate)")
        self.assertIn("mode != 'connection_test_only'", setup_python)
        self.assertIn("if [ \"${RELEASE_MODE}\" != \"connection_test_only\" ]", self.text)
        self.assertIn("if [ \"${RELEASE_MODE}\" != \"dry_run\" ]", self.text)
        upload = step_block(self.text, "- name: Upload dist/ to DirectAdmin (non-destructive)", "- name: Keep the previous .htaccess for rollback")
        self.assertIn("mode == 'production'", upload)
        self.assertIn("Verify exact proof release contract", self.text)

    def test_real_mirror_is_non_destructive_with_supported_lftp_flags(self):
        upload = step_block(
            self.text,
            "- name: Upload dist/ to DirectAdmin (non-destructive)",
            "- name: Keep the previous .htaccess for rollback",
        )
        self.assertIn(
            'mirror --reverse --verbose --exclude-glob index.html --exclude-glob .htaccess . .',
            upload,
        )
        mirror_line = next(
            line for line in upload.splitlines() if 'echo "mirror ' in line
        )
        self.assertNotIn("--delete", mirror_line)
        self.assertNotIn("--no-delete", mirror_line)

    def test_transport_config_is_validated_before_lftp(self):
        prepare = step_block(
            self.text,
            "- name: Prepare credentials",
            "- name: Test DirectAdmin connection (read only)",
        )
        self.assertIn("SFTP_HOST must be a hostname only", prepare)
        self.assertIn("SFTP_PORT must be a number from 1 to 65535", prepare)
        self.assertIn("SFTP_REMOTE_DIR must be a safe absolute POSIX path", prepare)
        self.assertIn("SFTP_PASSWORD contains a newline", prepare)
        self.assertIn('REMOTE_DIR="${SFTP_REMOTE_DIR:-$DEFAULT_REMOTE_DIR}"', prepare)

    def test_password_scripts_are_private_cleaned_and_not_printed(self):
        self.assertGreaterEqual(self.text.count("chmod 600 \"$SCRIPT\""), 2)
        self.assertGreaterEqual(self.text.count("trap 'rm -f \"$SCRIPT\"' EXIT"), 2)
        self.assertIn("grep -v -e '^open' -e 'connect-program' \"$SCRIPT\"", self.text)
        self.assertNotRegex(self.text, r'cat\s+"?\$SCRIPT"?')


if __name__ == "__main__":
    unittest.main()
