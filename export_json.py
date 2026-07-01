import json
import sqlite3
import tempfile
from pathlib import Path

from data_model import DASHBOARD_TERRITORIES, TODAY, dashboard_rows, load_indicator_rows

ROOT = Path(__file__).parent
OUTPUT = ROOT / "public" / "data" / "indicators.json"
DB = ROOT / "borneo_tracker.db"
FALLBACK_DB = ROOT / "borneo_tracker.snapshot.db"
RUNTIME_DB = Path(tempfile.gettempdir()) / "borneo_tracker.runtime.db"


def load_rows_from_db():
    query = """
        SELECT territory, source_territory, indicator, dashboard_concept, year, value, unit,
               source, data_level, esg_pillar, sdg_goal, hexagon_pillar, confidence,
               last_updated, canonical, is_derived, derived_from, source_count
        FROM indicators
        WHERE territory IN (?, ?, ?, ?)
        ORDER BY territory, esg_pillar, indicator
    """
    last_error = None
    for database_path in (DB, FALLBACK_DB, RUNTIME_DB):
        if not database_path.exists():
            continue
        try:
            connection = sqlite3.connect(database_path)
            connection.row_factory = sqlite3.Row
            cursor = connection.cursor()
            result = cursor.execute(query, DASHBOARD_TERRITORIES).fetchall()
            connection.close()
            return [dict(row) for row in result]
        except sqlite3.Error as error:
            last_error = error
    raise sqlite3.OperationalError(f"Unable to read indicators from known DB paths: {last_error}")


def load_rows_from_model():
    merged = {}
    for row in load_indicator_rows():
        merged[(row["territory"], row["indicator"])] = row
    rows = dashboard_rows(list(merged.values()))
    return sorted(rows, key=lambda row: (row["territory"], row["esg_pillar"], row["indicator"]))


def main():
    try:
        rows = load_rows_from_db()
    except sqlite3.Error:
        rows = load_rows_from_model()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": TODAY,
        "territories": DASHBOARD_TERRITORIES,
        "trendReady": False,
        "rows": rows,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} dashboard rows -> {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
