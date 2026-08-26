"""
Borneo Tracker — full data refresh (Phase 3.5).

One command that runs the whole data layer end-to-end:
    1. pull all sources -> borneo_tracker_poc.csv   (ingest_poc)
    2. load CSV -> SQLite borneo_tracker.db          (load_db)
    3. export SQLite -> public/data/indicators.json  (export_json)
    ... plus resilience, districts and the provenance manifest (see main()).

Degradation policy (loop engineering, item A2): the two add-on steps (history,
districts) stay NON-FATAL — a flaky source must not block the core refresh — but
they are no longer silent. Every non-fatal failure is recorded and re-printed as
a DEGRADED block at the end, and emitted as a `::warning::` annotation when
running in GitHub Actions, so a partially-successful run is visible at a glance
instead of hiding behind a green tick. The hard gate on stale/gutted data is
validate_data.py, which the refresh workflow runs before it commits.

Run manually:  python run_pipeline.py

Schedule it (data updates yearly/quarterly, so weekly is plenty):
  Windows (Task Scheduler):
    schtasks /create /tn "BorneoTracker" /tr "python C:\\path\\to\\run_pipeline.py" ^
             /sc weekly /d SUN /st 03:00
  Linux/macOS (cron, Sundays 03:00):
    0 3 * * 0  cd /path/to/Borneo_Tracker && python run_pipeline.py >> pipeline.log 2>&1
"""

import os
import sys
import build_resilience_history
import compute_resilience
import emit_manifest
import export_json
import ingest_districts
import ingest_history
import ingest_poc
import load_db

TOTAL_STEPS = 8


def ensure_success(step_name, result):
    if result not in (None, 0):
        raise RuntimeError(f"{step_name} failed with exit code {result}.")


def report_degraded(degraded):
    """Make non-fatal failures impossible to miss: a summary block on stdout plus
    a GitHub Actions warning annotation (surfaces on the run page, not just deep
    in the log). Does not change the exit code — see the module docstring."""
    if not degraded:
        print("\n>>> Pipeline complete - all steps OK.")
        return
    print(f"\n>>> Pipeline complete BUT DEGRADED - {len(degraded)} non-fatal step failure(s):")
    for step, error in degraded:
        print(f"    - {step}: {error}")
    print("    Affected outputs keep their PREVIOUS contents. validate_data.py decides "
          "whether that is still publishable.")
    if os.environ.get("GITHUB_ACTIONS") == "true":
        for step, error in degraded:
            message = str(error).replace("\n", " ")
            print(f"::warning title=Degraded pipeline step::{step}: {message}")


def main():
    degraded = []

    print(f">>> [1/{TOTAL_STEPS}] Pulling sources -> CSV")
    ensure_success("ingest_poc", ingest_poc.main())

    print(f"\n>>> [2/{TOTAL_STEPS}] Pulling historical series -> history CSV")
    try:
        ensure_success("ingest_history", ingest_history.main())
    except RuntimeError as error:
        # Trends are an add-on: a failed history pull must not block the
        # snapshot refresh. load_db keeps the previous history CSV if present.
        print(f"WARNING: history pull failed, keeping previous history CSV. {error}")
        degraded.append(("ingest_history", f"{error} (kept previous history CSV)"))

    print(f"\n>>> [3/{TOTAL_STEPS}] Loading CSV -> SQLite")
    ensure_success("load_db", load_db.main())

    print(f"\n>>> [4/{TOTAL_STEPS}] Exporting dashboard JSON")
    ensure_success("export_json", export_json.main())

    print(f"\n>>> [5/{TOTAL_STEPS}] Computing Resilience Index")
    ensure_success("compute_resilience", compute_resilience.main())

    print(f"\n>>> [6/{TOTAL_STEPS}] Building auxiliary resilience history")
    try:
        ensure_success("build_resilience_history", build_resilience_history.main())
    except (RuntimeError, OSError) as error:
        # History is Option A auxiliary output. A shallow/local checkout must
        # not invalidate the six anchored datasets; retain the last good series
        # and make the degraded state explicit.
        print(f"WARNING: resilience history build failed, keeping previous history JSON. {error}")
        degraded.append(("build_resilience_history", f"{error} (kept previous history JSON)"))

    print(f"\n>>> [7/{TOTAL_STEPS}] Building district (ADM2) drill-down JSON")
    try:
        ensure_success("ingest_districts", ingest_districts.main())
    except RuntimeError as error:
        # District drill-down is an add-on layer (separate districts.json); a failed
        # pull must not block the core territory dashboard refresh. Recorded as
        # degraded so the run says so out loud instead of exiting 0 in silence.
        print(f"WARNING: district pull failed, keeping previous districts.json. {error}")
        degraded.append(("ingest_districts", f"{error} (kept previous districts.json)"))

    print(f"\n>>> [8/{TOTAL_STEPS}] Emitting provenance manifest")
    ensure_success("emit_manifest", emit_manifest.main())

    report_degraded(degraded)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as error:
        print(f"ERROR: {error}")
        sys.exit(1)
