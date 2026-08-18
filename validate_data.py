"""
Borneo Tracker — pre-commit data validation gate (loop engineering, item A2).

WHY THIS EXISTS
    The daily refresh Action used to go green whether or not it produced real
    data: a failed source degrades silently, run_pipeline.py keeps the previous
    file, and the workflow commits (or skips) without anyone noticing. That is an
    open loop that lies. This module is the gate that closes it — the refresh
    workflow runs it AFTER the pipeline and BEFORE the commit step, so a broken
    source fails the run red instead of quietly publishing stale or gutted data.

WHAT IT CHECKS
    public/data/indicators.json, resilience.json, districts.json:
      1. the file parses as JSON               (parse failure = hard fail)
      2. all four dashboard territories are present, where applicable
      3. vs the previously COMMITTED version of the same file (`git show HEAD:…`):
           a. the record count has not dropped below MIN_COUNT_RATIO of it
              (a big drop means an upstream source broke, not a real-world change)
           b. `generatedAt` has not gone BACKWARDS (never publish older data over
              newer data — this is the real gate on a stale/skipped rebuild)
    Checks that need the git baseline are SKIPPED (not failed) when the file is
    new or git is unavailable, so a fresh clone / first run still works.

    It reads only; it never writes, regenerates or repairs a data file, and it
    contains no scoring logic — the numbers it inspects are whatever the pipeline
    produced.

USAGE
    python validate_data.py            -> compares with HEAD by default, prints a
                                          PASS/FAIL line per check, exits 0 (all
                                          good) or 1 (any failure)
    python validate_data.py --baseline-ref <sha>
                                       -> compares the working tree with an
                                          explicit Git revision.  Use this in
                                          refresh and PR workflows; do not let a
                                          checked-out PR artifact compare with
                                          itself.
    import validate_data; validate_data.main()   -> same, returns the exit code
"""

import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

from compute_resilience import PILLARS
from data_model import DASHBOARD_TERRITORIES, KALIMANTAN_PROVINCES
from project_time import project_today

ROOT = Path(__file__).parent

# A data file may legitimately lose a few records between runs (a source drops a
# year, a district is merged). It must never lose a LOT: below this fraction of
# the previously committed count, the likely cause is a broken/rate-limited source
# returning an empty payload, which we must not publish. 90% = tolerate normal
# churn, catch a collapse.
MIN_COUNT_RATIO = 0.90

# Last-good rows are useful for continuity, but they need an honest expiry.
# Annual/quarterly snapshots may remain visible for a short outage; after 45
# days the workflow fails rather than presenting them as a current refresh.
MAX_STALE_AGE_DAYS = 45
MAX_SCORED_STALE_RATIO = 0.20
VOLATILE_INDICATORS = {"Air quality (AQI, live)", "Active fire hotspots (24h)"}

# districts.json has no Brunei layer: Brunei has no ADM2 (district) statistical
# series in the sources we use, so only these parents are expected there.
REQUIRED_DISTRICT_PARENTS = ["Sabah", "Sarawak"]

INDICATORS_JSON = "public/data/indicators.json"
RESILIENCE_JSON = "public/data/resilience.json"
DISTRICTS_JSON = "public/data/districts.json"


# ------------------------------------------------------------------ reporting
class Report:
    """Collects PASS / FAIL / SKIP lines and prints them as they happen, so the
    GitHub Actions log reads top-to-bottom like a checklist."""

    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.failures = []

    def check(self, scope, name, ok, detail=""):
        if ok:
            self.passed += 1
            status = "PASS"
        else:
            self.failed += 1
            status = "FAIL"
            self.failures.append(f"{scope}: {name} - {detail}")
        print(f"  {status}  {scope:<17} {name}" + (f" - {detail}" if detail else ""))
        return ok

    def skip(self, scope, name, reason):
        self.skipped += 1
        print(f"  SKIP  {scope:<17} {name} - {reason}")

    def summary(self):
        print("-" * 72)
        print(f"  {self.passed} passed, {self.failed} failed, {self.skipped} skipped")
        if self.failed:
            print("\n  VALIDATION FAILED - data must NOT be committed:")
            for failure in self.failures:
                print(f"    * {failure}")
            return 1
        print("  VALIDATION PASSED - data is safe to commit.")
        return 0


# ------------------------------------------------------------------- helpers
def read_json(rel_path):
    """Return (data, error_message). error_message is None on success."""
    path = ROOT / rel_path
    if not path.exists():
        return None, "file does not exist"
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except (json.JSONDecodeError, UnicodeDecodeError, OSError) as error:
        return None, f"unreadable: {error}"


def previous_json(rel_path, baseline_ref="HEAD"):
    """Read ``rel_path`` from an explicit Git baseline.

    Returns (data, skip_reason). skip_reason is None on success; when it is set
    the caller must SKIP its baseline checks (new file / no git / detached repo),
    never fail them — a first run has nothing to compare against.
    """
    try:
        result = subprocess.run(
            ["git", "show", f"{baseline_ref}:{rel_path}"],
            cwd=str(ROOT),
            capture_output=True,
            timeout=60,
        )
    except (OSError, subprocess.SubprocessError) as error:
        return None, f"git unavailable ({error})"
    if result.returncode != 0:
        return None, f"not in baseline {baseline_ref!r} (new file or unavailable ref)"
    try:
        return json.loads(result.stdout.decode("utf-8")), None
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        return None, f"committed version is not valid JSON ({error})"


def baseline_file_json(path):
    """Read a resilience baseline JSON file for hermetic/manual comparisons.

    The normal release gate must use ``--baseline-ref`` so *all* artifacts are
    compared against the same trusted commit.  This file option intentionally
    applies only to resilience.json: it is for fixture-driven regression checks
    and operator diagnosis, not a substitute for the release baseline.
    """
    path = Path(path)
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except (json.JSONDecodeError, UnicodeDecodeError, OSError) as error:
        return None, f"baseline file unreadable ({error})"


def parse_generated_at(value):
    """`generatedAt` is an ISO date ('2026-07-27'); tolerate a full timestamp."""
    text = str(value or "")[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def check_generated_at(report, scope, current, previous, previous_skip):
    """generatedAt must parse, and must not move BACKWARDS vs the last commit."""
    current_date = parse_generated_at(current.get("generatedAt"))
    if not report.check(
        scope, "generatedAt is a valid date", current_date is not None,
        f"got {current.get('generatedAt')!r}" if current_date is None else str(current_date),
    ):
        return
    if previous is None:
        report.skip(scope, "generatedAt not older than last commit", previous_skip)
        return
    previous_date = parse_generated_at(previous.get("generatedAt"))
    if previous_date is None:
        report.skip(scope, "generatedAt not older than last commit",
                    "committed version has no usable generatedAt")
        return
    report.check(
        scope, "generatedAt not older than last commit",
        current_date >= previous_date,
        f"{current_date} vs committed {previous_date}",
    )


def check_artifact_freshness(report, scope, artifact, today=None,
                             maximum_days=MAX_STALE_AGE_DAYS):
    """Catch an entire pipeline step retaining an old artifact unchanged."""
    today = project_today() if today is None else today
    generated = parse_generated_at(artifact.get("generatedAt"))
    if generated is None:
        report.check(
            scope, f"artifact is no older than {maximum_days} days", False,
            f"invalid generatedAt={artifact.get('generatedAt')!r}",
        )
        return
    age = (today - generated).days
    report.check(
        scope,
        f"artifact is no older than {maximum_days} days",
        0 <= age <= maximum_days,
        f"generated {generated}; age {age} day(s)",
    )


def check_count(report, scope, label, current_count, previous_count, previous_skip):
    """Record count must stay at or above MIN_COUNT_RATIO of the committed count."""
    if previous_count is None:
        report.skip(scope, f"{label} did not collapse", previous_skip)
        return
    floor = int(previous_count * MIN_COUNT_RATIO)
    report.check(
        scope, f"{label} did not collapse",
        current_count >= floor,
        f"{current_count} now vs {previous_count} committed "
        f"(floor {floor} = {int(MIN_COUNT_RATIO * 100)}%)",
    )


def scored_indicator_count(resilience):
    """Number of individual scored indicator entries across every territory and
    pillar. This is resilience.json's meaningful 'record count': it shrinks the
    moment a source stops feeding a scoreable indicator."""
    total = 0
    for territory in (resilience.get("territories") or {}).values():
        for entries in (territory.get("detail") or {}).values():
            total += len(entries)
    return total


def _pillar_set(value):
    """Return a pillar set only when the JSON field has the expected shape.

    Keeping this deliberately strict prevents a malformed list/dict from being
    treated as an empty set — an empty set would hide exactly the class of loss
    this gate exists to catch.
    """
    if not isinstance(value, list) or not all(isinstance(pillar, str) for pillar in value):
        return None
    return set(value)


def check_resilience_pillar_consistency(report, territories):
    """Verify that every territory describes the same scored/unscored partition.

    ``pillarScores``, ``scoredPillars`` and ``detail`` are three representations
    of the scored True Wealth pillars.  They must name exactly the same pillars;
    ``unscoredPillars`` must be their complete, disjoint complement in PILLARS.
    This preserves the project's E (Ethics) rule: missing data is disclosed, not
    silently excluded from a score.
    """
    expected = set(PILLARS)
    for territory in DASHBOARD_TERRITORIES:
        data = territories.get(territory)
        if not isinstance(data, dict):
            # Territory presence is reported separately. Avoid a duplicate
            # structural failure whose detail would add no diagnostic value.
            continue

        scored_list = data.get("scoredPillars")
        unscored_list = data.get("unscoredPillars")
        scored = _pillar_set(scored_list)
        unscored = _pillar_set(unscored_list)
        score_map = data.get("pillarScores")
        detail_map = data.get("detail")
        score_keys = set(score_map) if isinstance(score_map, dict) else None
        detail_keys = set(detail_map) if isinstance(detail_map, dict) else None
        detail_entries_ok = (
            isinstance(detail_map, dict)
            and all(isinstance(entries, list) and entries for entries in detail_map.values())
        )

        representations_ok = (
            scored is not None
            and score_keys is not None
            and detail_keys is not None
            and scored == score_keys == detail_keys
            and len(scored_list) == len(scored)
            and detail_entries_ok
        )
        report.check(
            "resilience.json",
            f"{territory} scored pillar fields agree",
            representations_ok,
            (f"scoredPillars={sorted(scored) if scored is not None else scored_list!r}; "
             f"pillarScores={sorted(score_keys) if score_keys is not None else score_map!r}; "
             f"detail={sorted(detail_keys) if detail_keys is not None else detail_map!r}; "
             f"all detail entries non-empty={detail_entries_ok}"),
        )

        partition_ok = (
            scored is not None
            and unscored is not None
            and len(unscored_list) == len(unscored)
            and scored.isdisjoint(unscored)
            and scored | unscored == expected
        )
        report.check(
            "resilience.json",
            f"{territory} scored/unscored pillars form the True Wealth Hexagon",
            partition_ok,
            (f"scored={sorted(scored) if scored is not None else scored_list!r}; "
             f"unscored={sorted(unscored) if unscored is not None else unscored_list!r}; "
             f"expected={sorted(expected)}"),
        )


def check_no_lost_scored_pillars(report, current_territories, previous_territories,
                                  previous_skip=None):
    """Fail if a territory loses any previously scored True Wealth pillar.

    A record-count floor is intentionally tolerant of ordinary source churn.
    Pillar coverage is not: dropping Education changes the meaning of the
    resilience average, even if only one indicator disappeared.  Newly scored
    pillars are allowed; this gate only blocks loss and keeps "never imputed"
    intact.
    """
    if previous_territories is None:
        report.skip("resilience.json", "no territory lost a scored pillar", previous_skip)
        return

    territory_names = sorted(set(previous_territories) | set(current_territories))
    for territory in territory_names:
        previous = previous_territories.get(territory) or {}
        current = current_territories.get(territory) or {}
        previous_pillars = _pillar_set(previous.get("scoredPillars"))
        current_pillars = _pillar_set(current.get("scoredPillars"))
        if previous_pillars is None or current_pillars is None:
            report.check(
                "resilience.json",
                f"{territory} scored pillar coverage is comparable to baseline",
                False,
                "missing or malformed scoredPillars in current or baseline artifact",
            )
            continue
        lost = sorted(previous_pillars - current_pillars)
        report.check(
            "resilience.json",
            f"{territory} did not lose a scored pillar",
            not lost,
            f"lost {lost} (baseline={sorted(previous_pillars)}, current={sorted(current_pillars)})"
            if lost else f"retained {sorted(current_pillars)}",
        )


def is_stale(row):
    return "STALE" in str(row.get("source") or "")


def check_stale_ratio(report, scope, label, rows, maximum=MAX_SCORED_STALE_RATIO):
    stale = sum(1 for row in rows if is_stale(row))
    ratio = stale / len(rows) if rows else 0.0
    report.check(
        scope,
        label,
        ratio <= maximum,
        f"{stale}/{len(rows)} stale ({ratio:.1%}); maximum {maximum:.0%}",
    )


def check_stale_freshness(report, scope, rows, today=None, maximum_days=MAX_STALE_AGE_DAYS):
    """Require every retained row to identify a recent, real last-success date."""
    today = project_today() if today is None else today
    stale_rows = [row for row in rows if is_stale(row)]
    problems = []
    ages = []
    for row in stale_rows:
        refreshed = parse_generated_at(row.get("last_updated"))
        identity = f"{row.get('territory', '?')} / {row.get('indicator', '?')}"
        if refreshed is None:
            problems.append(f"{identity}: invalid last_updated={row.get('last_updated')!r}")
            continue
        age = (today - refreshed).days
        ages.append(age)
        if age < 0:
            problems.append(f"{identity}: last_updated is {abs(age)} day(s) in the future")
        elif age > maximum_days:
            problems.append(f"{identity}: {age} days stale")
    detail = (
        "; ".join(problems[:3]) + (f"; +{len(problems) - 3} more" if len(problems) > 3 else "")
        if problems else
        f"{len(stale_rows)} stale row(s); oldest {max(ages) if ages else 0} day(s)"
    )
    report.check(scope, f"stale rows are no older than {maximum_days} days", not problems, detail)


def check_no_volatile_stale(report, scope, rows):
    offenders = [
        row for row in rows
        if is_stale(row) and row.get("indicator") in VOLATILE_INDICATORS
    ]
    report.check(
        scope,
        "volatile live indicators are never retained stale",
        not offenders,
        ", ".join(sorted({row.get("indicator", "?") for row in offenders}))
        if offenders else "none retained",
    )


# -------------------------------------------------------------- file checks
def check_baseline_available(report, scope, previous, previous_skip, required):
    """Fail closed for release workflows that supplied an explicit baseline."""
    if required:
        report.check(
            scope,
            "required baseline is readable",
            previous is not None,
            previous_skip or "available",
        )


def validate_indicators(report, baseline_ref="HEAD", require_baseline=False):
    scope = "indicators.json"
    current, error = read_json(INDICATORS_JSON)
    if not report.check(scope, "parses as JSON", current is not None, error or ""):
        return
    previous, previous_skip = previous_json(INDICATORS_JSON, baseline_ref)
    check_baseline_available(report, scope, previous, previous_skip, require_baseline)

    rows = current.get("rows") or []
    report.check(scope, "has rows", len(rows) > 0, f"{len(rows)} rows")

    declared = current.get("territories") or []
    missing_declared = [t for t in DASHBOARD_TERRITORIES if t not in declared]
    report.check(scope, "declares all 4 territories", not missing_declared,
                 f"missing {missing_declared}" if missing_declared else ", ".join(declared))

    present = {row.get("territory") for row in rows}
    missing_rows = [t for t in DASHBOARD_TERRITORIES if t not in present]
    report.check(scope, "has rows for all 4 territories", not missing_rows,
                 f"missing {missing_rows}" if missing_rows else "Sabah, Sarawak, Brunei, Kalimantan")

    check_count(report, scope, "row count", len(rows),
                len(previous.get("rows") or []) if previous else None, previous_skip)
    check_stale_freshness(report, scope, rows)
    check_no_volatile_stale(report, scope, rows)
    check_generated_at(report, scope, current, previous, previous_skip)
    check_artifact_freshness(report, scope, current)


def validate_resilience(report, baseline_ref="HEAD", baseline_file=None, require_baseline=False):
    scope = "resilience.json"
    current, error = read_json(RESILIENCE_JSON)
    if not report.check(scope, "parses as JSON", current is not None, error or ""):
        return
    if baseline_file:
        previous, previous_skip = baseline_file_json(baseline_file)
    else:
        previous, previous_skip = previous_json(RESILIENCE_JSON, baseline_ref)
    check_baseline_available(report, scope, previous, previous_skip, require_baseline)

    territories = current.get("territories") or {}
    missing = [t for t in DASHBOARD_TERRITORIES if t not in territories]
    report.check(scope, "scores all 4 territories", not missing,
                 f"missing {missing}" if missing else ", ".join(DASHBOARD_TERRITORIES))

    unscored = [
        t for t in DASHBOARD_TERRITORIES
        if not isinstance((territories.get(t) or {}).get("index"), (int, float))
    ]
    report.check(scope, "every territory has an index", not unscored,
                 f"no index for {unscored}" if unscored else
                 ", ".join(f"{t}={territories[t]['index']}" for t in DASHBOARD_TERRITORIES
                           if t in territories))

    check_resilience_pillar_consistency(report, territories)
    check_no_lost_scored_pillars(
        report,
        territories,
        (previous.get("territories") or {}) if previous else None,
        previous_skip,
    )
    check_count(report, scope, "scored indicator count", scored_indicator_count(current),
                scored_indicator_count(previous) if previous else None, previous_skip)
    scored_entries = [
        entry
        for territory in territories.values()
        for entries in (territory.get("detail") or {}).values()
        for entry in entries
    ]
    check_stale_ratio(
        report, scope, "scored stale ratio is acceptable", scored_entries
    )
    check_stale_freshness(report, scope, scored_entries)
    check_generated_at(report, scope, current, previous, previous_skip)
    check_artifact_freshness(report, scope, current)


def validate_districts(report, baseline_ref="HEAD", require_baseline=False):
    scope = "districts.json"
    current, error = read_json(DISTRICTS_JSON)
    if not report.check(scope, "parses as JSON", current is not None, error or ""):
        return
    previous, previous_skip = previous_json(DISTRICTS_JSON, baseline_ref)
    check_baseline_available(report, scope, previous, previous_skip, require_baseline)

    parents = current.get("parents") or {}
    rows = current.get("rows") or []
    report.check(scope, "parents is non-empty", len(parents) > 0, f"{len(parents)} parents")

    # Brunei is deliberately absent (no ADM2 series); Kalimantan appears as its
    # five provinces, so require Sabah + Sarawak + at least one Kalimantan province.
    missing_parents = [p for p in REQUIRED_DISTRICT_PARENTS if p not in parents]
    kalimantan_present = [p for p in KALIMANTAN_PROVINCES if p in parents]
    problems = []
    if missing_parents:
        problems.append(f"missing {missing_parents}")
    if not kalimantan_present:
        problems.append("no Kalimantan province present")
    report.check(
        scope, "covers Sabah, Sarawak and Kalimantan",
        not problems,
        "; ".join(problems) if problems
        else f"Sabah, Sarawak + {len(kalimantan_present)} Kalimantan province(s)",
    )

    district_count = sum(len(v) for v in parents.values())
    report.check(scope, "has districts", district_count > 0, f"{district_count} districts")

    previous_districts = (
        sum(len(v) for v in (previous.get("parents") or {}).values()) if previous else None
    )
    check_count(report, scope, "district count", district_count, previous_districts, previous_skip)
    check_count(report, scope, "row count", len(rows),
                len(previous.get("rows") or []) if previous else None, previous_skip)
    check_stale_freshness(report, scope, rows)
    check_generated_at(report, scope, current, previous, previous_skip)
    check_artifact_freshness(report, scope, current)


# ------------------------------------------------------------------- entry point
def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Validate generated public data before publication."
    )
    parser.add_argument(
        "--baseline-ref",
        default="HEAD",
        help="Git revision containing the last approved artifacts (default: HEAD).",
    )
    parser.add_argument(
        "--baseline-file",
        help=("Path to a resilience.json baseline for a fixture/manual resilience "
              "comparison. Normal release validation should use --baseline-ref."),
    )
    parser.add_argument(
        "--require-baseline",
        action="store_true",
        help=("Fail instead of skipping baseline checks when the selected baseline "
              "cannot be read. Required for controlled release workflows."),
    )
    args = parser.parse_args(argv)
    print("=" * 72)
    print("Borneo Tracker - data validation gate")
    print(f"  baseline: {args.baseline_ref!r}"
          + (f"; resilience fixture: {args.baseline_file}" if args.baseline_file else ""))
    print(f"  record-count floor: {int(MIN_COUNT_RATIO * 100)}% of the last committed count")
    print(f"  retained-data expiry: {MAX_STALE_AGE_DAYS} days")
    print(f"  scored stale ceiling: {int(MAX_SCORED_STALE_RATIO * 100)}%")
    print("=" * 72)
    report = Report()
    validate_indicators(report, args.baseline_ref, args.require_baseline)
    validate_resilience(report, args.baseline_ref, args.baseline_file, args.require_baseline)
    validate_districts(report, args.baseline_ref, args.require_baseline)
    return report.summary()


if __name__ == "__main__":
    sys.exit(main())
