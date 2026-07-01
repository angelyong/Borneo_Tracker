"""
Borneo Tracker — full data refresh (Phase 3.5).

One command that runs the whole data layer end-to-end:
    1. pull all sources -> borneo_tracker_poc.csv   (ingest_poc)
    2. load CSV -> SQLite borneo_tracker.db          (load_db)

Run manually:  python run_pipeline.py

Schedule it (data updates yearly/quarterly, so weekly is plenty):
  Windows (Task Scheduler):
    schtasks /create /tn "BorneoTracker" /tr "python C:\\path\\to\\run_pipeline.py" ^
             /sc weekly /d SUN /st 03:00
  Linux/macOS (cron, Sundays 03:00):
    0 3 * * 0  cd /path/to/Borneo_Tracker && python run_pipeline.py >> pipeline.log 2>&1
"""

import sys
import export_json
import ingest_poc
import load_db


def main():
    print(">>> [1/3] Pulling sources -> CSV")
    ingest_poc.main()
    print("\n>>> [2/3] Loading CSV -> SQLite")
    load_db.main()
    print("\n>>> [3/3] Exporting dashboard JSON")
    export_json.main()
    print("\n>>> Pipeline complete.")


if __name__ == "__main__":
    sys.exit(main())
