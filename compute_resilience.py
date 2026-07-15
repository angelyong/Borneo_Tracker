"""
Borneo Tracker — Resilience Index computation.

Method (per the summary in PROGRESS_REPORT.md §9 — the original
borneo_tracker_resilience_index_methodology.md was removed from the repo, so
the normalization targets below are reconstructed and kept as ONE explicit,
editable table):

  1. Normalize each scorable canonical indicator to 0-100 against documented
     best/worst bounds (linear, clamped).
  2. Pillar score = mean of its scored indicators (True Wealth Hexagon pillars).
  3. Resilience Index = mean of the pillars that HAVE a score. Pillars with no
     scorable indicator are excluded and listed — never imputed (no fake data).
  4. Weakest pillar + RAG status (>=70 green, >=40 amber, else red).

Only ratio/percent/years indicators are scored. Absolute counts (households,
crop tonnes, enrolment headcounts, tourist trips…) are size-dependent and
cannot be honestly compared across territories without per-capita context, so
they are left unscored and reported as coverage only.

Run after load_db.py:  python compute_resilience.py
Writes: public/data/resilience.json
"""

import json
import sqlite3
from pathlib import Path

from data_model import DASHBOARD_TERRITORIES, TODAY

ROOT = Path(__file__).parent
DB = ROOT / "borneo_tracker.db"
FALLBACK_DB = ROOT / "borneo_tracker.snapshot.db"
OUTPUT = ROOT / "public" / "data" / "resilience.json"

PILLARS = ["Food", "Energy", "Education", "Shelter", "Healthcare", "Entertainment"]

# indicator name -> (best, worst). Linear 0-100 between worst and best, clamped.
# Direction is implied by the bounds (best < worst means lower is better).
# Units guard: a row is only scored if its unit matches the expected unit, so a
# '%' target is never applied to an absolute-count row of the same indicator.
BOUNDS = {
    # Healthcare
    "Life expectancy":                    {"unit": "years", "best": 80, "worst": 60},
    "Hospital beds (per 1k)":             {"unit": "/1k",   "best": 4,  "worst": 1},
    # Shelter (water & sanitation are shelter-quality indicators in the hexagon)
    "Clean water access":                 {"unit": "%",     "best": 100, "worst": 50},
    "Basic sanitation access":            {"unit": "%",     "best": 100, "worst": 50},
    # Energy
    "Electricity access":                 {"unit": "%",     "best": 100, "worst": 50},
    "Electrification ratio":              {"unit": "%",     "best": 100, "worst": 50},
    "Renewable electricity (% output)":   {"unit": "%",     "best": 100, "worst": 0},
    # Education
    "Adult literacy":                     {"unit": "%",     "best": 100, "worst": 60},
    "Mean years schooling (RLS)":         {"unit": "years", "best": 12,  "worst": 6},
    "School enrolment (primary, gross)":  {"unit": "%",     "best": 100, "worst": 70},
    "School enrolment (secondary, gross)": {"unit": "%",    "best": 100, "worst": 70},
    # Food
    "Agricultural land":                  {"unit": "% land", "best": 25, "worst": 0},
    # Cross-pillar wellbeing rates (attach to the pillar tagged on the row)
    "Unemployment rate":                  {"unit": "%", "best": 3,  "worst": 15},
    "Poverty rate (absolute)":            {"unit": "%", "best": 0,  "worst": 25},
    "Poverty rate (P0)":                  {"unit": "%", "best": 0,  "worst": 25},
    "Poverty headcount <$2.15/day (SDG1)": {"unit": "%", "best": 0, "worst": 25},
}

# 2026-07-15 (Phase 0.5): unified on the methodology doc's 70/40 bands (was 67/34).
RAG_GREEN = 70
RAG_AMBER = 40


def score_value(indicator, unit, value):
    spec = BOUNDS.get(indicator)
    if spec is None or value is None:
        return None
    if (unit or "").strip() != spec["unit"]:
        return None  # same indicator name but a non-comparable unit (e.g. households)
    best, worst = spec["best"], spec["worst"]
    if best == worst:
        return None
    ratio = (value - worst) / (best - worst)
    return round(max(0.0, min(1.0, ratio)) * 100, 1)


def load_canonical_rows():
    query = """
        SELECT territory, indicator, value, unit, hexagon_pillar, confidence
        FROM indicators
        WHERE canonical = 1 AND territory IN (?, ?, ?, ?)
    """
    for path in (DB, FALLBACK_DB):
        if not path.exists():
            continue
        try:
            with sqlite3.connect(path) as conn:
                conn.row_factory = sqlite3.Row
                rows = [dict(r) for r in conn.execute(query, DASHBOARD_TERRITORIES).fetchall()]
                if rows:
                    print(f"Read {len(rows)} canonical rows from {path.name}")
                    return rows
        except sqlite3.Error as error:
            print(f"  {path.name}: {error}")
    raise RuntimeError("No readable database with canonical rows — run load_db.py first.")


def compute(rows):
    result = {}
    for territory in DASHBOARD_TERRITORIES:
        pillar_scores = {}
        pillar_detail = {}
        for pillar in PILLARS:
            scored = []
            for row in rows:
                if row["territory"] != territory or row["hexagon_pillar"] != pillar:
                    continue
                score = score_value(row["indicator"], row["unit"], row["value"])
                if score is not None:
                    scored.append({
                        "indicator": row["indicator"],
                        "value": row["value"],
                        "unit": row["unit"],
                        "score": score,
                        "confidence": row["confidence"],
                    })
            if scored:
                pillar_scores[pillar] = round(sum(s["score"] for s in scored) / len(scored), 1)
                pillar_detail[pillar] = scored
        scored_pillars = sorted(pillar_scores)
        unscored_pillars = [p for p in PILLARS if p not in pillar_scores]
        index = round(sum(pillar_scores.values()) / len(pillar_scores), 1) if pillar_scores else None
        weakest = min(pillar_scores, key=pillar_scores.get) if pillar_scores else None
        rag = None
        if index is not None:
            rag = "green" if index >= RAG_GREEN else "amber" if index >= RAG_AMBER else "red"
        result[territory] = {
            "index": index,
            "rag": rag,
            "weakestPillar": weakest,
            "pillarScores": pillar_scores,
            "scoredPillars": scored_pillars,
            "unscoredPillars": unscored_pillars,
            "detail": pillar_detail,
        }
    return result


def main():
    rows = load_canonical_rows()
    scores = compute(rows)
    payload = {
        "generatedAt": TODAY,
        "method": "linear 0-100 vs documented bounds; pillar = mean of scored indicators; "
                  "index = mean of scored pillars; unscored pillars excluded, never imputed",
        "ragThresholds": {"green": RAG_GREEN, "amber": RAG_AMBER},
        "territories": scores,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    for territory, data in scores.items():
        print(f"  {territory}: index={data['index']} rag={data['rag']} weakest={data['weakestPillar']} "
              f"(scored {len(data['pillarScores'])}/{len(PILLARS)} pillars)")
    print(f"Wrote -> {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"ERROR: {error}")
        raise SystemExit(1)
