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
import sqlite3
from pathlib import Path

ROOT = Path(__file__).parent
CSV = ROOT / "borneo_tracker_poc.csv"
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
    # inherited country-level governance + city-level air quality = medium; else high
    if "wgi" in low(row["source"]) or row["data_level"] == "city":
        return "medium"
    return "high"


def main():
    rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute("DROP TABLE IF EXISTS indicators")
    c.execute("""
        CREATE TABLE indicators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            confidence  TEXT
        )
    """)
    for r in rows:
        try:
            val = float(r["value"])
        except (ValueError, TypeError):
            val = None
        c.execute(
            "INSERT INTO indicators (territory,indicator,year,value,unit,source,"
            "data_level,esg_pillar,sdg_goal,hexagon_pillar,confidence) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (r["territory"], r["indicator"], r["year"], val, r["unit"], r["source"],
             r["data_level"], esg_pillar(r["indicator"]), sdg_goal(r["indicator"]),
             hexagon_pillar(r["indicator"]), confidence(r)),
        )
    conn.commit()

    print(f"Loaded {len(rows)} rows -> {DB.name}")
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
