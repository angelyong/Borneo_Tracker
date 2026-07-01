import datetime
import shutil
import sqlite3
import tempfile
from pathlib import Path

from data_model import assign_canonical, load_indicator_rows

ROOT = Path(__file__).parent
DB = ROOT / "borneo_tracker.db"
FALLBACK_DB = ROOT / "borneo_tracker.snapshot.db"
RUNTIME_DB = Path(tempfile.gettempdir()) / "borneo_tracker.runtime.db"


def build_db(path, rows):
    conn = sqlite3.connect(path)
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS indicators")
    cursor.execute(
        """
        CREATE TABLE indicators (
            territory TEXT NOT NULL,
            source_territory TEXT,
            indicator TEXT NOT NULL,
            dashboard_concept TEXT,
            year TEXT,
            value REAL,
            unit TEXT,
            source TEXT,
            data_level TEXT,
            esg_pillar TEXT,
            sdg_goal TEXT,
            hexagon_pillar TEXT,
            confidence TEXT,
            last_updated TEXT,
            canonical INTEGER NOT NULL DEFAULT 0,
            is_derived INTEGER NOT NULL DEFAULT 0,
            derived_from TEXT,
            source_count INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (territory, indicator)
        )
        """
    )
    cursor.executemany(
        """
        INSERT OR REPLACE INTO indicators (
            territory, source_territory, indicator, dashboard_concept, year, value, unit,
            source, data_level, esg_pillar, sdg_goal, hexagon_pillar, confidence,
            last_updated, canonical, is_derived, derived_from, source_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                row["territory"],
                row["source_territory"],
                row["indicator"],
                row["dashboard_concept"],
                row["year"],
                row["value"],
                row["unit"],
                row["source"],
                row["data_level"],
                row["esg_pillar"],
                row["sdg_goal"],
                row["hexagon_pillar"],
                row["confidence"],
                row["last_updated"],
                row["canonical"],
                row["is_derived"],
                row["derived_from"],
                row["source_count"],
            )
            for row in rows
        ],
    )
    conn.commit()
    conn.close()
    return rows


def load_existing_rows(path):
    if not path.exists():
        return []
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT territory, source_territory, indicator, dashboard_concept, year, value, unit,
                   source, data_level, esg_pillar, sdg_goal, hexagon_pillar, confidence,
                   last_updated, canonical, is_derived, derived_from, source_count
            FROM indicators
            """
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except sqlite3.Error:
        return []


def merge_rows(new_rows):
    existing_rows = load_existing_rows(DB) or load_existing_rows(FALLBACK_DB)
    merged = {(row["territory"], row["indicator"]): dict(row) for row in existing_rows}
    for row in new_rows:
        merged[(row["territory"], row["indicator"])] = dict(row)
    merged_rows = list(merged.values())
    for row in merged_rows:
        row["canonical"] = 0
    assign_canonical(merged_rows)
    return merged_rows


def replace_file_atomically(source_path, target_path):
    temp_target = target_path.with_name(f"{target_path.stem}.next{target_path.suffix}")
    shutil.copyfile(source_path, temp_target)
    temp_target.replace(target_path)
    journal = target_path.parent / f"{target_path.name}-journal"
    journal.unlink(missing_ok=True)


def main():
    run_ts = datetime.date.today().isoformat()
    RUNTIME_DB.unlink(missing_ok=True)
    rows = merge_rows(load_indicator_rows())
    build_db(RUNTIME_DB, rows)
    target_name = RUNTIME_DB.name
    workspace_db_ok = False
    snapshot_ok = False
    try:
        replace_file_atomically(RUNTIME_DB, DB)
        workspace_db_ok = True
        target_name = DB.name
    except (PermissionError, OSError):
        print(
            f"Warning: {DB.name} could not be replaced safely, so the latest runtime database remains at "
            f"{RUNTIME_DB.name}."
        )
    try:
        source_for_snapshot = DB if workspace_db_ok else RUNTIME_DB
        replace_file_atomically(source_for_snapshot, FALLBACK_DB)
        snapshot_ok = True
        if not workspace_db_ok:
            target_name = FALLBACK_DB.name
    except (PermissionError, OSError):
        print(f"Warning: {FALLBACK_DB.name} could not be refreshed; keeping {RUNTIME_DB.name} as the latest copy.")

    total = len(rows)
    kept = sum(1 for row in rows if row["last_updated"] != run_ts)
    manual = sum(1 for row in rows if row["confidence"] == "manual")
    canonical = sum(1 for row in rows if row["canonical"] == 1)
    print(f"Loaded {total} rows ({canonical} canonical, {manual} manual; {kept} older timestamps) -> {target_name}")
    for label, key in (
        ("ESG pillar", "esg_pillar"),
        ("SDG goal", "sdg_goal"),
        ("data_level", "data_level"),
        ("confidence", "confidence"),
    ):
        counts = {}
        for row in rows:
            counts[row[key] or "-"] = counts.get(row[key] or "-", 0) + 1
        summary = ", ".join(
            f"{value}={count}" for value, count in sorted(counts.items(), key=lambda item: item[1], reverse=True)
        )
        print(f"  by {label}: {summary}")
    if workspace_db_ok:
        print(f"  workspace copy updated: {DB.name}")
    if snapshot_ok:
        print(f"  fallback copy updated: {FALLBACK_DB.name}")


if __name__ == "__main__":
    main()
