"""Build a traceable Resilience Index series from committed Git snapshots.

The output is Option A: an unhashed auxiliary file.  It must never be added to
``manifest_contract.DATASET_PATHS`` because old clients verify exactly the six
core datasets.  History values are snapshots of their then-current method, not
retrospective estimates; methodology breaks make that limitation explicit.
"""

import json
import math
import re
import subprocess
from collections import OrderedDict
from datetime import date as calendar_date
from pathlib import Path

from json_artifacts import write_json_lf
from project_time import project_today_iso

ROOT = Path(__file__).parent
OUTPUT = ROOT / "public" / "data" / "resilience_history.json"
RESILIENCE_PATH = "public/data/resilience.json"
TERRITORIES = ("Sabah", "Sarawak", "Brunei", "Kalimantan")
GIT_SHA = re.compile(r"^[0-9a-f]{40}$")

# The 2026-08-03 published refresh removed Sabah/Sarawak education inputs. It
# inflated the arithmetic mean by excluding a weak pillar; 2026-08-17 restored the
# canonical six-pillar calculation. These values remain traceable but are not
# comparable across the tag boundary.
METHODOLOGY_WINDOWS = (
    ("2026-07-05", "2026-07-07", "v0.1-initial", True),
    ("2026-07-08", "2026-07-14", "v0.2-incomplete-pillar-coverage", True),
    ("2026-07-15", "2026-08-02", "v1.0-six-pillar", True),
    ("2026-08-03", "2026-08-16", "v1.1-education-loss-defect", True),
    ("2026-08-17", None, "v1.2-canonical-fixed", True),
)


def _git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True, encoding="utf-8")


def methodology_for(date):
    for start, end, tag, is_break in METHODOLOGY_WINDOWS:
        if date >= start and (end is None or date <= end):
            return tag, is_break
    return "v0-unknown", True


def valid_iso_date(value):
    if not isinstance(value, str) or len(value) != 10:
        return False
    try:
        return calendar_date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def finite_number(value):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)


def validate_snapshot_territories(territories, label):
    if not isinstance(territories, dict):
        raise RuntimeError(f"{label} has invalid territories")
    for territory in TERRITORIES:
        entry = territories.get(territory)
        if entry is None:
            continue
        if not isinstance(entry, dict):
            raise RuntimeError(f"{label} has invalid territory entry for {territory}")
        if "index" in entry and not finite_number(entry["index"]):
            raise RuntimeError(f"{label} has non-finite index for {territory}")
        if "indexStrict" in entry and entry["indexStrict"] is not None and not finite_number(entry["indexStrict"]):
            raise RuntimeError(f"{label} has non-finite strict score for {territory}")
    return territories


def snapshot_from_commit(commit, git=_git):
    """Return the artifact's own publication date and territory snapshot.

    Git commit dates are audit metadata, not data dates: scheduled commits often
    cross midnight UTC while ``generatedAt`` is the project/MYT publication day.
    """
    try:
        payload = json.loads(git("show", f"{commit}:{RESILIENCE_PATH}"))
    except (subprocess.CalledProcessError, json.JSONDecodeError) as error:
        raise RuntimeError(f"unable to read resilience snapshot for {commit}") from error
    published_date = payload.get("generatedAt")
    if not valid_iso_date(published_date):
        raise RuntimeError(f"resilience snapshot {commit} has invalid generatedAt={published_date!r}")
    territories = validate_snapshot_territories(payload.get("territories"), f"resilience snapshot {commit}")
    return published_date, territories


def snapshots_by_published_date(revision="HEAD", git=_git):
    """Return the final immutable commit snapshot for each published date."""
    commits = git("rev-list", "--reverse", revision, "--", RESILIENCE_PATH).splitlines()
    by_date = OrderedDict()
    for commit in commits:
        published_date, territories = snapshot_from_commit(commit.strip(), git)
        # Latest commit wins if a publisher rebuilds an artifact on the same
        # MYT date. The point remains tied to the exact immutable Git SHA.
        by_date[published_date] = (commit.strip(), territories)
    return by_date


def working_tree_snapshot(path=ROOT / RESILIENCE_PATH):
    """Read the snapshot computed before the refresh workflow commits it."""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError("unable to read current resilience snapshot") from error
    date = payload.get("generatedAt")
    if not valid_iso_date(date):
        raise RuntimeError("current resilience snapshot has no ISO date")
    territories = validate_snapshot_territories(payload.get("territories"), "current resilience snapshot")
    return date, territories


def build_payload(revision="HEAD", generated_at=None, git=_git, include_working_tree=False):
    points = {territory: [] for territory in TERRITORIES}
    prior_tag = None
    snapshots = [(date, commit, snapshot) for date, (commit, snapshot) in snapshots_by_published_date(revision, git).items()]
    if include_working_tree:
        current_date, current_snapshot = working_tree_snapshot()
        previous = next(((commit, snapshot) for date, commit, snapshot in snapshots if date == current_date), None)
        # Avoid replacing a committed traceability SHA when the working tree is
        # byte-for-byte the already-published snapshot.
        if previous is None or previous[1] != current_snapshot:
            snapshots = [(date, commit, snapshot) for date, commit, snapshot in snapshots if date != current_date]
            snapshots.append((current_date, None, current_snapshot))
    for date, commit, snapshot in sorted(snapshots, key=lambda item: item[0]):
        tag, window_break = methodology_for(date)
        tag_changed = tag != prior_tag
        for territory in TERRITORIES:
            entry = snapshot.get(territory) or {}
            index, strict = entry.get("index"), entry.get("indexStrict")
            if not finite_number(index):
                continue  # no index is more honest than fabricated continuity
            strict_value = strict if finite_number(strict) else None
            points[territory].append({
                "date": date,
                "index": index,
                "strict": strict_value,
                "methodologyTag": tag,
                "isMethodologyBreak": bool(window_break and prior_tag is not None and tag_changed),
                "sourceCommit": commit,
            })
        prior_tag = tag
    for territory, series in points.items():
        dates = [point["date"] for point in series]
        if dates != sorted(dates) or len(dates) != len(set(dates)):
            raise RuntimeError(f"history must be sorted with unique dates: {territory}")
    payload = {"schemaVersion": 1, "generatedAt": generated_at or project_today_iso(), "territories": points}
    validate_payload(payload)
    return payload


def validate_payload(payload):
    if set(payload) != {"schemaVersion", "generatedAt", "territories"} or payload["schemaVersion"] != 1 or not valid_iso_date(payload["generatedAt"]):
        raise ValueError("invalid resilience history envelope")
    if set(payload["territories"]) != set(TERRITORIES):
        raise ValueError("invalid resilience history territories")
    required = {"date", "index", "strict", "methodologyTag", "isMethodologyBreak", "sourceCommit"}
    for territory, series in payload["territories"].items():
        if not isinstance(series, list):
            raise ValueError(f"invalid history series for {territory}")
        dates = []
        for point in series:
            if set(point) != required or not valid_iso_date(point["date"]):
                raise ValueError(f"invalid history point for {territory}")
            if not finite_number(point["index"]):
                raise ValueError(f"invalid index for {territory}")
            if point["strict"] is not None and not finite_number(point["strict"]):
                raise ValueError(f"invalid strict score for {territory}")
            if not isinstance(point["methodologyTag"], str) or not isinstance(point["isMethodologyBreak"], bool):
                raise ValueError(f"invalid methodology metadata for {territory}")
            if point["sourceCommit"] is None:
                # Only the just-computed working-tree snapshot is uncommitted;
                # it must be today's auxiliary export point. Historical points
                # always carry their immutable 40-character Git object SHA.
                if point["date"] != payload["generatedAt"]:
                    raise ValueError(f"uncommitted point is not the current export for {territory}")
            elif not isinstance(point["sourceCommit"], str) or not GIT_SHA.fullmatch(point["sourceCommit"]):
                raise ValueError(f"invalid source commit for {territory}")
            dates.append(point["date"])
        if dates != sorted(dates) or len(dates) != len(set(dates)):
            raise ValueError(f"history must be sorted with unique dates: {territory}")
    return True


def export_json(output=OUTPUT, revision="HEAD"):
    payload = build_payload(revision=revision, include_working_tree=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    write_json_lf(output, payload)
    try:
        label = output.relative_to(ROOT)
    except ValueError:
        label = output
    print(f"Wrote resilience history ({sum(map(len, payload['territories'].values()))} points) -> {label}")
    return payload


def main():
    export_json()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
