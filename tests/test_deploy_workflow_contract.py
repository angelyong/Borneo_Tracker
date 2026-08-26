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
ROOT_HTACCESS = ROOT / "public" / ".htaccess"
DATA_HTACCESS = ROOT / "public" / "data" / ".htaccess"


def step_block(text: str, start: str, end: str) -> str:
    """Return the text between two unique workflow step names."""
    after_start = text.index(start)
    after_end = text.index(end, after_start)
    return text[after_start:after_end]


class DeployWorkflowContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text(encoding="utf-8")

    def test_data_cache_policy_is_scoped_and_geojson_has_a_real_mime_type(self):
        root_htaccess = ROOT_HTACCESS.read_text(encoding="utf-8")
        data_htaccess = DATA_HTACCESS.read_text(encoding="utf-8")

        self.assertIn("RewriteEngine On", root_htaccess)
        self.assertIn("CacheDisable public /data/", root_htaccess)
        self.assertIn("CacheDisable private /data/", root_htaccess)
        self.assertIn("AddType application/geo+json .geojson", root_htaccess)
        self.assertNotIn("CacheDisable public /assets/", root_htaccess)
        self.assertNotIn("CacheDisable private /assets/", root_htaccess)

        self.assertIn("Cache-Control \"no-store, no-cache, must-revalidate, max-age=0\"", data_htaccess)
        self.assertIn('Header always set Pragma "no-cache"', data_htaccess)
        self.assertIn('Header always set Expires "0"', data_htaccess)

    def test_build_requires_the_scoped_data_cache_policy(self):
        self.assertIn("dist/data/.htaccess", self.text)
        self.assertIn("dist/data/.htaccess does not contain the required data cache policy", self.text)

    def test_upload_plan_explicitly_publishes_both_htaccess_files(self):
        upload = step_block(
            self.text,
            "- name: Upload dist/ to DirectAdmin (non-destructive)",
            "- name: Keep the previous .htaccess files for rollback",
        )
        self.assertIn('mirror --reverse --verbose --exclude-glob index.html --exclude-glob .htaccess . .', upload)
        self.assertIn('echo "put data/.htaccess -o data/.htaccess"', upload)
        self.assertIn('echo "put .htaccess"', upload)
        self.assertIn('echo "get \\"${REMOTE_DIR}/data/.htaccess\\" -o \\"${BACKUP_DIR}/data-htaccess.live\\""', upload)
        self.assertIn("Server data/.htaccess replaced", upload)

        rollback = step_block(
            self.text,
            "- name: Keep the previous .htaccess files for rollback",
            "- name: Smoke-test production",
        )
        self.assertIn("predeploy/data-htaccess.live", rollback)

    def test_smoke_test_distinguishes_mime_endpoints_from_stale_cache(self):
        smoke = step_block(
            self.text,
            "- name: Smoke-test production",
            "- name: Write deployment summary",
        )
        self.assertIn("data_content_type_ok()", smoke)
        self.assertIn("*.geojson)", smoke)
        self.assertIn("application/geo+json", smoke)
        self.assertIn("application/json", smoke)
        self.assertIn("Cache-busted /data/${filename}", smoke)
        self.assertIn("Production data endpoint/MIME error", smoke)
        self.assertIn("Production endpoint error", smoke)
        self.assertIn("Production byte mismatch", smoke)
        self.assertIn("Stale cache, not a failed upload", smoke)
        self.assertIn("verify_manifest.py verify-remote \"$CACHE_OUT\" \"$EXPECTED\"", smoke)

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

    def test_release_modes_are_explicit_and_auto_dispatch_is_explicitly_enabled(self):
        self.assertIn("release_mode:", self.text)
        self.assertIn("dry_run|connection_test_only|production", self.text)
        self.assertIn('case "${RELEASE_MODE}" in dry_run|connection_test_only|production) ;; *)', self.text)
        self.assertIn('exit 1\n          esac\n          if ! [[ "${PROOF_COMMIT_SHA}"', self.text)
        self.assertIn("proof_commit_sha:", self.text)
        self.assertIn("^[0-9a-f]{40}$", self.text)
        self.assertIn("confirm_production:", self.text)
        self.assertIn('"${CONFIRM_PRODUCTION}" != "true"', self.text)
        self.assertIn("Production confirmation required", self.text)
        self.assertIn("repository_dispatch:", self.text)
        self.assertIn("types: [deploy-proof]", self.text)
        self.assertIn("DISPATCH_PROOF_COMMIT_SHA", self.text)
        self.assertIn("DISPATCH_SENDER", self.text)
        self.assertIn("AUTO_PRODUCTION_DEPLOY", self.text)
        self.assertIn("Automatic production deployment disabled", self.text)
        self.assertIn('case "${DISPATCH_SOURCE}" in anchor|upgrade)', self.text)

    def test_exact_proof_sha_is_checked_out_and_must_belong_to_master(self):
        self.assertIn("ref: ${{ steps.gate.outputs.proof_commit_sha }}", self.text)
        self.assertIn("fetch-depth: 0", self.text)
        self.assertIn("Verify requested proof commit is an immutable master release", self.text)
        self.assertIn('git merge-base --is-ancestor "${PROOF_COMMIT_SHA}" origin/master', self.text)
        self.assertIn('test "$(git rev-parse HEAD)" = "${PROOF_COMMIT_SHA}"', self.text)
        self.assertIn('if [ "${EVENT_NAME}" = "repository_dispatch" ]; then', self.text)
        self.assertIn('test "${PROOF_COMMIT_SHA}" = "$(git rev-parse origin/master)"', self.text)
        self.assertIn('python verify_release_commit.py "${PROOF_COMMIT_SHA}" "${DISPATCH_SOURCE}" "${DISPATCH_SENDER}"', self.text)
        self.assertIn("Reconfirm automatic proof immediately before upload", self.text)

    def test_deploy_serializes_with_proof_publication(self):
        self.assertIn("group: phase1-publication", self.text)
        self.assertIn("queue: max", self.text)
        self.assertIn("cancel-in-progress: false", self.text)

    def test_missing_required_secrets_are_red_not_a_green_skip(self):
        self.assertIn("Deployment prerequisites missing", self.text)
        self.assertIn("exit 1", self.text)
        self.assertNotIn("Deployment SKIPPED — not yet configured", self.text)
        self.assertNotIn("This run finished green **on purpose**", self.text)

    def test_ai_chat_endpoint_is_required_and_passed_only_to_frontend_builds(self):
        gate = step_block(
            self.text,
            "- name: Check deployment secrets",
            "- name: Checkout",
        )
        build = step_block(
            self.text,
            "- name: Build production bundle",
            "- name: Assert the build is publishable",
        )
        self.assertIn("VITE_AI_CHAT_ENDPOINT: ${{ secrets.VITE_AI_CHAT_ENDPOINT }}", gate)
        self.assertIn('missing="${missing} VITE_AI_CHAT_ENDPOINT"', gate)
        self.assertIn('if [ "${RELEASE_MODE}" != "connection_test_only" ]', gate)
        self.assertIn("matching credential-free https /ai-chat function URL", gate)
        self.assertIn("VITE_AI_CHAT_ENDPOINT: ${{ secrets.VITE_AI_CHAT_ENDPOINT }}", build)
        for server_only_name in (
            "SUPABASE_SERVICE_ROLE_KEY",
            "SUPABASE_SERVICE_KEY",
            "GEMINI_API_KEY",
            "AICHATBOTGEMINI_API_KEY",
        ):
            self.assertNotIn(f"{server_only_name}: ${{{{ secrets.", build)

    def test_ai_chat_build_and_production_smoke_are_explicit_and_do_not_log_endpoint(self):
        assertions = step_block(
            self.text,
            "- name: Assert the build is publishable",
            "- name: Install lftp",
        )
        smoke = step_block(
            self.text,
            "- name: Smoke-test production",
            "- name: Write deployment summary",
        )
        summary = self.text[self.text.index("- name: Write deployment summary"):]
        self.assertIn('grep -R -F --quiet -- "$VITE_AI_CHAT_ENDPOINT" dist/assets', assertions)
        self.assertIn("grep -R -F --quiet -- 'bt33-v1' dist/assets", assertions)
        self.assertIn("BT-33 suggested-question contract marker", assertions)
        self.assertIn("AI Chat Edge Function CORS reachability", smoke)
        self.assertIn("-X OPTIONS", smoke)
        self.assertIn('Access-Control-Request-Method: POST', smoke)
        self.assertIn("AI Chat smoke test failed", smoke)
        self.assertNotIn('echo "$VITE_AI_CHAT_ENDPOINT"', self.text)
        self.assertIn("| AI Chat endpoint | ${AI_CHAT_ENDPOINT:-not run} |", summary)

    def test_modes_have_separate_build_and_transport_boundaries(self):
        setup_python = step_block(self.text, "- name: Set up Python", "- name: Validate dashboard data (blocking gate)")
        self.assertIn("mode != 'connection_test_only'", setup_python)
        self.assertIn("if [ \"${RELEASE_MODE}\" != \"connection_test_only\" ]", self.text)
        self.assertIn("if [ \"${RELEASE_MODE}\" != \"dry_run\" ]", self.text)
        upload = step_block(self.text, "- name: Upload dist/ to DirectAdmin (non-destructive)", "- name: Keep the previous .htaccess files for rollback")
        self.assertIn("mode == 'production'", upload)
        self.assertIn("Verify exact proof release contract", self.text)

    def test_real_mirror_is_non_destructive_with_supported_lftp_flags(self):
        upload = step_block(
            self.text,
            "- name: Upload dist/ to DirectAdmin (non-destructive)",
            "- name: Keep the previous .htaccess files for rollback",
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
