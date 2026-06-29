"""
Borneo Tracker — load the standard CSV into SQLite (Phase 3.4).

Reads borneo_tracker_poc.csv, enriches each row with the tag columns the app's
three views need (ESG pillar / SDG goal / Hexagon pillar / confidence), and writes
one table the frontend reads. This is the "CSV -> DB" step that turns the POC into
a real data layer. Re-runnable: it rebuilds the table each time (idempotent).

Final DB schema (one table, tagged for all 3 views — ESG / SDG / Hexagon):
    territory | indicator | year | value | unit | source | data_level
    | esg_pillar | sdg_goal | hexagon_pillar | confidence
"""

import csv
import datetime
import sqlite3
from pathlib import Path

ROOT = Path(__file__).parent
CSV = ROOT / "borneo_tracker_poc.csv"
MANUAL = ROOT / "manual_overrides.csv"
DB = ROOT / "borneo_tracker.db"


def low(s):
    return s.lower()


def esg_pillar(ind):
    i = low(ind)
    if any(k in i for k in ("forest", "tree cover", "fire", "air quality")):
        return "E"
    if "corruption" in i or "wgi" in i or "governance" in i:
        return "G"
    return "S"  # social/economic default


def sdg_goal(ind):
    i = low(ind)
    rules = [
        (("forest", "tree cover"), "SDG15"),
        (("fire", "air quality"), "SDG13"),
        (("clean water", "sanitation"), "SDG6"),
        (("electri",), "SDG7"),
        (("unemployment", "gdp", "tourist", "arrival"), "SDG8"),
        (("enrolment", "schooling", "literacy"), "SDG4"),
        (("poverty",), "SDG1"),
        (("hospital", "beds", "life expect"), "SDG3"),
        (("crop", "paddy", "agricultur"), "SDG2"),
        (("households",), "SDG11"),
        (("corruption", "wgi"), "SDG16"),
    ]
    for keys, goal in rules:
        if any(k in i for k in keys):
            return goal
    return ""


def hexagon_pillar(ind):
    i = low(ind)
    rules = [
        (("crop", "paddy", "agricultur"), "Food"),
        (("electri", "energy"), "Energy"),
        (("enrolment", "schooling", "literacy"), "Education"),
        (("households", "housing"), "Shelter"),
        (("hospital", "beds", "life expect"), "Healthcare"),
        (("tourist", "tourism", "arrival", "wisataw"), "Entertainment"),
    ]
    for keys, pillar in rules:
        if any(k in i for k in keys):
            return pillar
    return ""


def confidence(row):
    # medium for: inherited country-level governance, city-level air quality, and
    # unweighted-mean Kalimantan aggregates (approximations). Exact sums stay high.
    src = low(row["source"])
    if "wgi" in src or row["data_level"] == "city" or "approx" in src:
        return "medium"
    return "high"


def main():
    rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    # Keep-last-good: do NOT drop the table. Upsert on (territory, indicator) so a
    # row whose source is down this run KEEPS its previous value (not wiped).
    run_ts = datetime.date.today().isoformat()
    # One-time migration: a table from before the keep-last-good schema (autoincrement
    # `id` PK, no `last_updated`, no (territory,indicator) upsert key) can't be
    # upserted into. Rebuild it once — the CSV is canonical, so nothing real is lost.
    cols = [r[1] for r in c.execute("PRAGMA table_info(indicators)").fetchall()]
    if cols and "last_updated" not in cols:
        print("  migrating: rebuilding 'indicators' to keep-last-good schema")
        c.execute("DROP TABLE indicators")
    c.execute("""
        CREATE TABLE IF NOT EXISTS indicators (
            territory   TEXT NOT NULL,
            indicator   TEXT NOT NULL,
            year        TEXT,
            value       REAL,
            unit        TEXT,
            source      TEXT,
            data_level  TEXT,
            esg_pillar  TEXT,
            sdg_goal    TEXT,
            hexagon_pillar TEXT,
            confidence  TEXT,
            last_updated TEXT,
            canonical   INTEGER DEFAULT 0,
            PRIMARY KEY (territory, indicator)
        )
    """)
    # add canonical column to a pre-existing table (no-op if already present)
    if "canonical" not in [r[1] for r in c.execute("PRAGMA table_info(indicators)").fetchall()]:
        c.execute("ALTER TABLE indicators ADD COLUMN canonical INTEGER DEFAULT 0")
    for r in rows:
        try:
            val = float(r["value"])
        except (ValueError, TypeError):
            val = None
        c.execute(
            "INSERT INTO indicators (territory,indicator,year,value,unit,source,"
            "data_level,esg_pillar,sdg_goal,hexagon_pillar,confidence,last_updated) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(territory,indicator) DO UPDATE SET "
            "year=excluded.year, value=excluded.value, unit=excluded.unit, "
            "source=excluded.source, data_level=excluded.data_level, "
            "esg_pillar=excluded.esg_pillar, sdg_goal=excluded.sdg_goal, "
            "hexagon_pillar=excluded.hexagon_pillar, confidence=excluded.confidence, "
            "last_updated=excluded.last_updated",
            (r["territory"], r["indicator"], r["year"], val, r["unit"], r["source"],
             r["data_level"], esg_pillar(r["indicator"]), sdg_goal(r["indicator"]),
             hexagon_pillar(r["indicator"]), confidence(r), run_ts),
        )
    # Manual/reference layer: figures that exist only in DOSM/UNDP/agency reports
    # (no machine API), each carrying its own provenance (source_doc/url/note). These
    # make Healthcare/Education/Energy/Food consistent across all 4 territories. They
    # upsert into the SAME table but are flagged data_level='report', confidence='manual'
    # so the dashboard can show them as cited-from-report, not live API.
    n_manual = 0
    if MANUAL.exists():
        for r in csv.DictReader(open(MANUAL, encoding="utf-8")):
            try:
                val = float(r["value"])
            except (ValueError, TypeError):
                val = None
            src = r["source_doc"] + (f" — {r['note']}" if r.get("note") else "")
            c.execute(
                "INSERT INTO indicators (territory,indicator,year,value,unit,source,"
                "data_level,esg_pillar,sdg_goal,hexagon_pillar,confidence,last_updated) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(territory,indicator) DO UPDATE SET "
                "year=excluded.year, value=excluded.value, unit=excluded.unit, "
                "source=excluded.source, data_level=excluded.data_level, "
                "esg_pillar=excluded.esg_pillar, sdg_goal=excluded.sdg_goal, "
                "hexagon_pillar=excluded.hexagon_pillar, confidence=excluded.confidence, "
                "last_updated=excluded.last_updated",
                (r["territory"], r["indicator"], r["year"], val, r["unit"], src,
                 "report", esg_pillar(r["indicator"]), sdg_goal(r["indicator"]),
                 hexagon_pillar(r["indicator"]), "manual", r.get("retrieved_date") or run_ts),
            )
            n_manual += 1
        print(f"  + manual layer: upserted {n_manual} cited report figures from {MANUAL.name}")

    # Canonical marking: flag the ONE unified metric per concept so the dashboard can
    # show a single consistent indicator per territory (legacy/extra indicators stay in
    # the table for reference but canonical=0). The frontend reads WHERE canonical=1.
    c.execute("UPDATE indicators SET canonical=0")
    canon = [
        "Forest extent (2000)", "Fire alerts (VIIRS, annual)", "Air quality (AQI, live)",
        "Clean water access", "Unemployment rate", "GDP growth", "GDP growth (PDRB)",
        "Life expectancy", "Mean years schooling (RLS)", "Poverty rate (absolute)",
        "Poverty rate (P0)", "Control of Corruption (WGI)", "Crop production (paddy)",
        "Households", "Tourist arrivals", "Tourist trips (domestic)",
    ]
    c.executemany("UPDATE indicators SET canonical=1 WHERE indicator=?", [(x,) for x in canon])
    # Energy: only the %-based rows are canonical (Sabah's household-count row is NOT —
    # no statewide % is published, so Sabah energy stays a deliberate blank).
    c.execute("UPDATE indicators SET canonical=1 WHERE indicator IN "
              "('Electrification ratio','Electricity access') AND unit='%'")
    n_canon = c.execute("SELECT COUNT(*) FROM indicators WHERE canonical=1").fetchone()[0]
    print(f"  + canonical: flagged {n_canon} unified-metric rows")
    conn.commit()

    total = c.execute("SELECT COUNT(*) FROM indicators").fetchone()[0]
    kept = c.execute("SELECT COUNT(*) FROM indicators WHERE last_updated<>?", (run_ts,)).fetchone()[0]
    print(f"Upserted {len(rows)} rows; table has {total} ({kept} kept from earlier runs) -> {DB.name}")
    for label, col in [("ESG pillar", "esg_pillar"), ("SDG goal", "sdg_goal"),
                       ("data_level", "data_level"), ("confidence", "confidence")]:
        got = c.execute(f"SELECT {col}, COUNT(*) FROM indicators "
                        f"GROUP BY {col} ORDER BY 2 DESC").fetchall()
        print(f"  by {label}: " + ", ".join(f"{k or '-'}={n}" for k, n in got))

    print("\nSample query — latest forest extent per territory:")
    q = c.execute("SELECT territory, value, unit FROM indicators "
                  "WHERE indicator='Forest extent (2000)' ORDER BY value DESC").fetchall()
    for terr, val, unit in q:
        print(f"  {terr:20} {val:>12,.0f} {unit}")
    conn.close()


if __name__ == "__main__":
    main()
