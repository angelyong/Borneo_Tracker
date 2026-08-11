"""Fail-closed validation for automatically deployed proof commits.

The repository-dispatch payload is discovery metadata, not authentication.  This
gate proves that the requested commit itself has the shape produced by the two
proof-publication workflows before production credentials are used.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
from pathlib import PurePosixPath


BOT_EMAIL = "github-actions[bot]@users.noreply.github.com"
EXPECTED_SUBJECT = {
    "anchor": "chore: anchor data version on Bitcoin",
    "upgrade": "chore: confirm anchor in a Bitcoin block",
}
VERSION_FILE = re.compile(
    r"public/data/versions/[0-9a-f]{64}/manifest\.json(?:\.ots)?\Z"
)
EXACT_PROOF_FILES = {
    "public/data/anchors.jsonl",
    "public/data/manifest.json.ots",
}


class ReleaseCommitError(ValueError):
    """The candidate commit is not an automatic proof release."""


def validate_release_metadata(
    *,
    source: str,
    sender: str,
    subject: str,
    author_email: str,
    committer_email: str,
    parents: list[str],
    paths: list[str],
    current_manifest_sha: str,
) -> None:
    if source not in EXPECTED_SUBJECT:
        raise ReleaseCommitError("dispatch source must be anchor or upgrade")
    if sender != "github-actions[bot]":
        raise ReleaseCommitError("dispatch sender is not github-actions[bot]")
    if subject != EXPECTED_SUBJECT[source]:
        raise ReleaseCommitError("commit subject does not match the proof workflow")
    if author_email != BOT_EMAIL or committer_email != BOT_EMAIL:
        raise ReleaseCommitError("proof commit was not authored and committed by github-actions[bot]")
    if len(parents) != 1:
        raise ReleaseCommitError("automatic proof release must be a single-parent commit")
    if not paths:
        raise ReleaseCommitError("proof commit has no changed paths")
    if len(paths) != len(set(paths)):
        raise ReleaseCommitError("proof commit contains duplicate changed paths")
    if "public/data/anchors.jsonl" not in paths:
        raise ReleaseCommitError("proof commit does not update anchors.jsonl")

    for path in paths:
        normalized = PurePosixPath(path).as_posix()
        if normalized != path:
            raise ReleaseCommitError(f"non-canonical changed path: {path}")
        if path not in EXACT_PROOF_FILES and VERSION_FILE.fullmatch(path) is None:
            raise ReleaseCommitError(f"non-proof path in automatic release: {path}")

    if source == "upgrade" and any(
        path.endswith("/manifest.json") for path in paths
    ):
        raise ReleaseCommitError("upgrade commit may not change historical Manifest bytes")

    current_pair = f"public/data/versions/{current_manifest_sha}/manifest.json"
    current_proof = current_pair + ".ots"
    if source == "anchor":
        if "public/data/manifest.json.ots" not in paths:
            raise ReleaseCommitError("anchor commit does not update the latest proof alias")
        if current_proof not in paths:
            raise ReleaseCommitError("anchor commit does not update the current Manifest proof")
        if current_pair not in paths:
            raise ReleaseCommitError("anchor commit does not publish the current versioned Manifest")
    elif not any(VERSION_FILE.fullmatch(path) and path.endswith(".ots") for path in paths):
        raise ReleaseCommitError("upgrade commit does not update a versioned OTS proof")


def git(*args: str) -> str:
    return subprocess.check_output(
        ["git", *args], text=True, encoding="utf-8", errors="strict"
    ).strip()


def validate_commit(commit_sha: str, source: str, sender: str) -> None:
    if re.fullmatch(r"[0-9a-f]{40}", commit_sha) is None:
        raise ReleaseCommitError("commit SHA must be 40 lowercase hexadecimal characters")

    fields = git(
        "show",
        "-s",
        "--format=%s%n%ae%n%ce%n%P",
        commit_sha,
    ).splitlines()
    if len(fields) != 4:
        raise ReleaseCommitError("could not read proof commit metadata")
    subject, author_email, committer_email, parent_line = fields
    paths = git(
        "diff-tree", "--no-commit-id", "--name-only", "-r", commit_sha
    ).splitlines()
    manifest = subprocess.check_output(
        ["git", "show", f"{commit_sha}:public/data/manifest.json"]
    )
    current_manifest_sha = hashlib.sha256(manifest).hexdigest()
    validate_release_metadata(
        source=source,
        sender=sender,
        subject=subject,
        author_email=author_email,
        committer_email=committer_email,
        parents=parent_line.split(),
        paths=paths,
        current_manifest_sha=current_manifest_sha,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("commit_sha")
    parser.add_argument("source", choices=sorted(EXPECTED_SUBJECT))
    parser.add_argument("sender")
    args = parser.parse_args()
    try:
        validate_commit(args.commit_sha, args.source, args.sender)
    except (ReleaseCommitError, subprocess.CalledProcessError) as exc:
        print(f"INVALID AUTOMATIC PROOF COMMIT: {exc}", file=sys.stderr)
        return 1
    print("Automatic proof commit metadata verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
