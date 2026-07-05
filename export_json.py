import argparse
import json
import sqlite3
from pathlib import Path

from data_model import DASHBOARD_TERRITORIES, TODAY, dashboard_rows, load_indicator_rows

ROOT = Path(__file__).parent
OUTPUT = ROOT / "public" / "data" / "indicators.json"
DB = ROOT / "borneo_tracker.db"
FALLBACK_DB = ROOT / "borneo_tracker.snapshot.db"


def load_rows_from_db():
    query = """
        SELECT territory, source_territory, indicator, dashboard_concept, year, value, unit,
               source, data_level, esg_pillar, sdg_goal, hexagon_pillar, confidence,
               last_updated, canonical, is_derived, derived_from, source_count
        FROM indicators
        WHERE territory IN (?, ?, ?, ?)
        ORDER BY territory, esg_pillar, indicator
    """
    errors = []
    for database_path in (DB, FALLBACK_DB):
        if not database_path.exists():
            errors.append(f"{database_path.name}: missing")
            continue
        try:
            with sqlite3.connect(database_path) as connection:
                connection.row_factory = sqlite3.Row
                quick_check = connection.execute("PRAGMA quick_check").fetchone()[0]
                if quick_check != "ok":
                    raise sqlite3.DatabaseError(f"quick_check failed: {quick_check}")
                cursor = connection.cursor()
                result = cursor.execute(query, DASHBOARD_TERRITORIES).fetchall()
                rows = [dict(row) for row in result]
                if not rows:
                    raise sqlite3.DatabaseError("query returned 0 dashboard rows")
                print(f"Read {len(rows)} dashboard rows from {database_path.name}")
                return rows
        except sqlite3.Error as error:
            errors.append(f"{database_path.name}: {error}")
    raise sqlite3.OperationalError("Unable to read indicators from DB paths: " + "; ".join(errors))


def load_rows_from_model():
    merged = {}
    for row in load_indicator_rows():
        merged[(row["territory"], row["indicator"])] = row
    rows = dashboard_rows(list(merged.values()))
    return sorted(rows, key=lambda row: (row["territory"], row["esg_pillar"], row["indicator"]))


def validate_dashboard_rows(rows):
    territories = {row.get("territory") for row in rows}
    missing_territories = [territory for territory in DASHBOARD_TERRITORIES if territory not in territories]
    if missing_territories:
        raise RuntimeError(f"Dashboard JSON is missing territories: {missing_territories}")

    bad_confidence = [
        (row.get("territory"), row.get("indicator"))
        for row in rows
        if not str(row.get("confidence") or "").strip()
    ]
    if bad_confidence:
        raise RuntimeError(f"Dashboard rows are missing confidence values: {bad_confidence[:10]}")

    duplicates = set()
    seen = set()
    for row in rows:
        key = (row.get("territory"), row.get("indicator"))
        if key in seen:
            duplicates.add(key)
        seen.add(key)
    if duplicates:
        raise RuntimeError(f"Dashboard rows contain duplicate territory/indicator keys: {sorted(duplicates)[:10]}")

    fire_rows = {
        row.get("territory")
        for row in rows
        if row.get("dashboard_concept") == "fire_hotspots" or "Fire alerts" in str(row.get("indicator") or "")
    }
    missing_fire = [territory for territory in DASHBOARD_TERRITORIES if territory not in fire_rows]
    if missing_fire:
        raise RuntimeError(f"Dashboard JSON is missing fire hotspot rows for: {missing_fire}")


def parse_args():
    parser = argparse.ArgumentParser(description="Export Borneo Tracker dashboard data from SQLite to JSON.")
    parser.add_argument(
        "--allow-model-fallback",
        action="store_true",
        help="Allow generating JSON directly from the data model if both DB files cannot be read.",
    )
    return parser.parse_args()


def main(allow_model_fallback=False):
    try:
        rows = load_rows_from_db()
    except sqlite3.Error as error:
        if not allow_model_fallback:
            raise RuntimeError(
                f"DB export failed and model fallback is disabled. Re-run load_db.py or use "
                f"--allow-model-fallback only for preview/recovery. Details: {error}"
            ) from error
        print(f"Warning: DB export failed; using explicit model fallback. Details: {error}")
        rows = load_rows_from_model()
    validate_dashboard_rows(rows)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": TODAY,
        "territories": DASHBOARD_TERRITORIES,
        "trendReady": False,
        "rows": rows,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} dashboard rows -> {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    args = parse_args()
    try:
        raise SystemExit(main(allow_model_fallback=args.allow_model_fallback))
    except RuntimeError as error:
        print(f"ERROR: {error}")
        raise SystemExit(1)
