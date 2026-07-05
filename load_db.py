import datetime
import os
import shutil
import sqlite3
import tempfile
from pathlib import Path

from data_model import DASHBOARD_TERRITORIES, load_indicator_rows

ROOT = Path(__file__).parent
DB = ROOT / "borneo_tracker.db"
FALLBACK_DB = ROOT / "borneo_tracker.snapshot.db"
RUNTIME_DB = Path(tempfile.gettempdir()) / "borneo_tracker.runtime.db"
EXPECTED_COLUMNS = {
    "territory",
    "source_territory",
    "indicator",
    "dashboard_concept",
    "year",
    "value",
    "unit",
    "source",
    "data_level",
    "esg_pillar",
    "sdg_goal",
    "hexagon_pillar",
    "confidence",
    "last_updated",
    "canonical",
    "is_derived",
    "derived_from",
    "source_count",
}


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


def validate_source_rows(rows):
    if not rows:
        raise RuntimeError("No indicator rows were produced by data_model.py.")

    bad_rows = [
        index
        for index, row in enumerate(rows, start=1)
        if not str(row.get("territory") or "").strip() or not str(row.get("indicator") or "").strip()
    ]
    if bad_rows:
        raise RuntimeError(f"Invalid source rows with missing territory/indicator at positions: {bad_rows[:10]}")

    return {(row["territory"], row["indicator"]) for row in rows}


def validate_db(path, expected_row_count=None):
    if not path.exists():
        raise RuntimeError(f"{path.name} was not created.")
    if path.stat().st_size == 0:
        raise RuntimeError(f"{path.name} is empty.")

    try:
        with sqlite3.connect(path) as conn:
            quick_check = conn.execute("PRAGMA quick_check").fetchone()[0]
            if quick_check != "ok":
                raise RuntimeError(f"{path.name} failed PRAGMA quick_check: {quick_check}")

            table_count = conn.execute(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='indicators'"
            ).fetchone()[0]
            if table_count != 1:
                raise RuntimeError(f"{path.name} does not contain the indicators table.")

            columns = {row[1] for row in conn.execute("PRAGMA table_info(indicators)").fetchall()}
            missing_columns = sorted(EXPECTED_COLUMNS - columns)
            if missing_columns:
                raise RuntimeError(f"{path.name} indicators table is missing columns: {missing_columns}")

            row_count = conn.execute("SELECT COUNT(*) FROM indicators").fetchone()[0]
            if expected_row_count is not None and row_count != expected_row_count:
                raise RuntimeError(
                    f"{path.name} contains {row_count} rows; expected {expected_row_count} after key de-duplication."
                )
            if row_count <= 0:
                raise RuntimeError(f"{path.name} contains no indicator rows.")

            bad_key_count = conn.execute(
                """
                SELECT COUNT(*)
                FROM indicators
                WHERE territory IS NULL
                   OR TRIM(territory) = ''
                   OR indicator IS NULL
                   OR TRIM(indicator) = ''
                """
            ).fetchone()[0]
            if bad_key_count:
                raise RuntimeError(f"{path.name} contains {bad_key_count} rows with invalid territory/indicator keys.")

            territory_counts = dict(
                conn.execute(
                    """
                    SELECT territory, COUNT(*)
                    FROM indicators
                    WHERE territory IN (?, ?, ?, ?)
                    GROUP BY territory
                    """,
                    DASHBOARD_TERRITORIES,
                ).fetchall()
            )
            missing_territories = [territory for territory in DASHBOARD_TERRITORIES if territory_counts.get(territory, 0) == 0]
            if missing_territories:
                raise RuntimeError(f"{path.name} has no dashboard rows for: {missing_territories}")

            return {
                "rows": row_count,
                "territory_counts": territory_counts,
            }
    except sqlite3.Error as error:
        raise RuntimeError(f"{path.name} is not a readable SQLite database: {error}") from error


def publish_db_file(source_path, target_path):
    if os.name == "nt" and target_path.exists():
        try:
            # This workspace denies rename/delete for existing .db files, but allows overwriting contents.
            # The caller validates the final DB immediately after this Windows fallback.
            shutil.copyfile(source_path, target_path)
            print(f"  overwrote existing {target_path.name}; validating copy")
            return
        except (PermissionError, OSError) as error:
            raise RuntimeError(
                f"Could not safely publish {target_path.name}. Close any tool using the DB "
                "(DBeaver, DB Browser for SQLite, VS Code SQLite extensions, antivirus/sync tools) and retry."
            ) from error

    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S%f")
    temp_target = target_path.with_name(f"{target_path.stem}.publish-{timestamp}-{os.getpid()}{target_path.suffix}")
    try:
        shutil.copyfile(source_path, temp_target)
        temp_target.replace(target_path)
    except (PermissionError, OSError) as error:
        if not target_path.exists():
            raise RuntimeError(
                f"Could not safely publish {target_path.name}. Close any tool using the DB "
                "(DBeaver, DB Browser for SQLite, VS Code SQLite extensions, antivirus/sync tools) and retry."
            ) from error
        backup_path = target_path.with_name(
            f"{target_path.stem}.broken-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}{target_path.suffix}"
        )
        try:
            target_path.replace(backup_path)
            temp_target.replace(target_path)
            print(f"  moved previous {target_path.name} aside as {backup_path.name}")
        except (PermissionError, OSError) as fallback_error:
            try:
                # Some Windows setups deny replace/move on existing DB files but allow overwriting contents.
                # The caller validates the final DB immediately after this fallback.
                shutil.copyfile(source_path, target_path)
                print(f"  overwrote existing {target_path.name} after replace was denied; validating copy")
                try:
                    temp_target.unlink(missing_ok=True)
                except OSError:
                    pass
            except (PermissionError, OSError) as copy_error:
                raise RuntimeError(
                    f"Could not safely publish {target_path.name}. Close any tool using the DB "
                    "(DBeaver, DB Browser for SQLite, VS Code SQLite extensions, antivirus/sync tools) and retry."
                ) from copy_error


def main():
    run_ts = datetime.date.today().isoformat()
    RUNTIME_DB.unlink(missing_ok=True)
    rows = load_indicator_rows()
    expected_keys = validate_source_rows(rows)
    expected_row_count = len(expected_keys)
    build_db(RUNTIME_DB, rows)
    validate_db(RUNTIME_DB, expected_row_count)

    publish_db_file(RUNTIME_DB, DB)
    db_stats = validate_db(DB, expected_row_count)

    publish_db_file(DB, FALLBACK_DB)
    snapshot_stats = validate_db(FALLBACK_DB, expected_row_count)

    total = len(rows)
    kept = sum(1 for row in rows if row["last_updated"] != run_ts)
    manual = sum(1 for row in rows if row["confidence"] == "manual")
    canonical = sum(1 for row in rows if row["canonical"] == 1)
    print(
        f"Loaded {total} processed rows -> {DB.name} "
        f"({db_stats['rows']} stored rows after key de-duplication; {canonical} canonical, {manual} manual; "
        f"{kept} older timestamps)"
    )
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
    for name, stats in ((DB.name, db_stats), (FALLBACK_DB.name, snapshot_stats)):
        coverage = ", ".join(f"{territory}={stats['territory_counts'][territory]}" for territory in DASHBOARD_TERRITORIES)
        print(f"  validated {name}: rows={stats['rows']}; {coverage}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"ERROR: {error}")
        raise SystemExit(1)
