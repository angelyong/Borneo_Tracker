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
import math
import sqlite3
from pathlib import Path

from data_model import DASHBOARD_TERRITORIES, TODAY, hexagon_pillar
from json_artifacts import build_resilience_meta, write_json_lf

ROOT = Path(__file__).parent
DB = ROOT / "borneo_tracker.db"
FALLBACK_DB = ROOT / "borneo_tracker.snapshot.db"
OUTPUT = ROOT / "public" / "data" / "resilience.json"
MODEL_OUTPUT = ROOT / "public" / "data" / "resilience_model.json"

# Bumped whenever the resilience_model.json SHAPE changes (new/renamed/removed
# field) — never for a value-only refresh. src/utils/resilienceModel.js and its
# golden test key off this to fail loudly instead of silently misreading an old
# field name after a schema change.
MODEL_SCHEMA_VERSION = 1

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
    "Domestic electrification ratio":     {"unit": "%",     "best": 100, "worst": 50},
    "Renewable electricity (% output)":   {"unit": "%",     "best": 100, "worst": 0},
    # Education
    "Adult literacy":                     {"unit": "%",     "best": 100, "worst": 60},
    "Mean years schooling (RLS)":         {"unit": "years", "best": 12,  "worst": 6},
    "School enrolment (primary, gross)":  {"unit": "%",     "best": 100, "worst": 70},
    "School enrolment (secondary, gross)": {"unit": "%",    "best": 100, "worst": 70},
    # Food
    "Agricultural land":                  {"unit": "% land", "best": 25, "worst": 0},
    # Food self-sufficiency proxy (measures domestic staple PRODUCTION, not food access —
    # a place can import its way to food security yet score low, which is the point, per
    # the book's "Brunei money-rich / ~8.4% food self-sufficient = fragile" thesis).
    # target = 100 kg paddy/capita/yr, NOT full rice self-sufficiency (~150): paddy is a
    # rice-only proxy that under-counts non-rice food, so a lenient target offsets that
    # and better approximates TOTAL food self-sufficiency — and lands Brunei ≈ 8, in line
    # with the book's cited 8.4%. (Exact target is the supervisor's to fine-tune.) floor = 0.
    "Paddy production per capita":         {"unit": "kg/capita", "best": 100, "worst": 0},
    # Entertainment (Phase 1, C2=B): internet use %, same 100/50 band as other access
    # indicators. Multi-agency proxy — carries medium confidence.
    "Internet use":                       {"unit": "%", "best": 100, "worst": 50},
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


def geometric_mean(scores):
    """Strict resilience (Phase 1, methodology §3). The geometric mean collapses toward
    zero if ANY pillar is near zero — 'no food = no resilience, however good the rest'.
    The gap between this and the arithmetic index is the imbalance / fragility penalty."""
    if not scores:
        return None
    if any(s <= 0 for s in scores):
        return 0.0
    return round(math.prod(scores) ** (1.0 / len(scores)), 1)


def rag_band(value):
    if value is None:
        return None
    return "green" if value >= RAG_GREEN else "amber" if value >= RAG_AMBER else "red"


def load_canonical_rows():
    query = """
        SELECT territory, indicator, value, unit, hexagon_pillar, confidence, source, year,
               last_updated
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
                        "source": row["source"],
                        "year": row["year"],
                        "last_updated": row.get("last_updated") or "",
                    })
            if scored:
                pillar_scores[pillar] = round(sum(s["score"] for s in scored) / len(scored), 1)
                pillar_detail[pillar] = scored
        scored_pillars = sorted(pillar_scores)
        unscored_pillars = [p for p in PILLARS if p not in pillar_scores]
        index = round(sum(pillar_scores.values()) / len(pillar_scores), 1) if pillar_scores else None
        strict = geometric_mean(list(pillar_scores.values())) if pillar_scores else None
        weakest = min(pillar_scores, key=pillar_scores.get) if pillar_scores else None
        result[territory] = {
            "index": index,
            "rag": rag_band(index),
            "indexStrict": strict,
            "ragStrict": rag_band(strict),
            "weakestPillar": weakest,
            "pillarScores": pillar_scores,
            "scoredPillars": scored_pillars,
            "unscoredPillars": unscored_pillars,
            "detail": pillar_detail,
        }
    return result


def _indicator_to_pillar(scores):
    """Derive indicator -> pillar strictly from the scored `detail` rows
    `compute()` already produced for this run — NOT a second hand-maintained
    table. `compute()` itself only ever groups by the row's own hexagon_pillar
    column, so this is the exact same grouping, just inverted into a lookup a
    JS engine can use for `overrides` keyed by indicator name.

    Returns (mapping, conflicts). A conflict (the same indicator name observed
    under two different pillars across territories) would mean compute()'s own
    grouping is itself inconsistent — surfaced rather than silently resolved,
    so it fails a test instead of shipping a wrong contract.
    """
    mapping = {}
    conflicts = {}
    for territory_data in scores.values():
        for pillar, entries in territory_data["detail"].items():
            for entry in entries:
                indicator = entry["indicator"]
                prior = mapping.get(indicator)
                if prior is not None and prior != pillar:
                    conflicts.setdefault(indicator, {prior}).add(pillar)
                    continue
                mapping[indicator] = pillar

    # BOUNDS entries never scored in this run (no matching row this pipeline
    # run, or a unit mismatch) can't be inferred from `detail` — data_model's
    # own hexagon_pillar() is the same function that tags rows on ingestion,
    # so it is the correct fallback, not a second guess. A few BOUNDS entries
    # (the "cross-pillar wellbeing rates") deliberately have no fixed concept
    # mapping there either; those stay unmapped rather than guessed.
    unmapped = []
    for indicator in BOUNDS:
        if indicator in mapping:
            continue
        pillar = hexagon_pillar(indicator)
        if pillar:
            mapping[indicator] = pillar
        else:
            unmapped.append(indicator)

    return mapping, conflicts, unmapped


def build_model(scores):
    """Build the versioned, deterministic export a JS engine mirrors to
    reproduce `compute()` client-side (Impact Simulator, IS-2A). Every number
    in `baseline` is copied from `scores` (compute()'s own return value) —
    nothing here is recomputed, so this can never disagree with resilience.json
    for the SAME `scores` input. See IMPACT_SIMULATOR_SPEC.md §2.
    """
    indicator_to_pillar, pillar_conflicts, unmapped_indicators = _indicator_to_pillar(scores)
    if pillar_conflicts:
        print(f"WARNING: indicator(s) mapped to more than one pillar across territories: {pillar_conflicts}")
    if unmapped_indicators:
        print(f"NOTE: BOUNDS indicator(s) with no scored row and no hexagon_pillar() concept this run "
              f"(omitted from indicatorToPillar): {unmapped_indicators}")

    baseline = {}
    for territory, data in scores.items():
        inputs = {}
        for pillar, entries in data["detail"].items():
            for entry in entries:
                inputs[entry["indicator"]] = {
                    "value": entry["value"],
                    "unit": entry["unit"],
                    "score": entry["score"],
                    "year": entry["year"],
                    "source": entry["source"],
                    "confidence": entry["confidence"],
                    "pillar": pillar,
                }
        baseline[territory] = {
            "inputs": inputs,
            "pillarScores": data["pillarScores"],
            "index": data["index"],
            "indexStrict": data["indexStrict"],
            "rag": data["rag"],
            "ragStrict": data["ragStrict"],
            "weakestPillar": data["weakestPillar"],
            "scoredPillars": data["scoredPillars"],
            "unscoredPillars": data["unscoredPillars"],
        }

    return {
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "generatedAt": TODAY,
        "pillars": PILLARS,
        "bounds": BOUNDS,
        "indicatorToPillar": indicator_to_pillar,
        "scoring": {
            "normalization": "linear",
            "inputRange": "each indicator's own {worst, best} in BOUNDS; either direction "
                           "(best < worst means lower raw values score higher)",
            "outputRange": [0, 100],
            "roundingPrecision": 1,
            "requireExactUnitMatch": True,
            "notes": "a row is only scored if its unit string matches BOUNDS[indicator].unit "
                     "exactly (e.g. a '%' target is never applied to an absolute-count row of "
                     "the same indicator name); missing bounds entry, null value, or unit "
                     "mismatch => indicator excluded from its pillar, never imputed",
            "pillarAggregation": "arithmetic mean of that pillar's scored indicator scores, "
                                  "rounded to roundingPrecision",
            "unscoredPillarBehavior": "a pillar with zero scored indicators is excluded from "
                                      "pillarScores and the index, and listed in "
                                      "unscoredPillars — never imputed",
        },
        "index": {
            "arithmeticMean": {
                "method": "mean of the scored pillarScores (already rounded to "
                          "roundingPrecision), rounded again to roundingPrecision",
                "roundingPrecision": 1,
            },
            "strictGeometricMean": {
                "method": "geometric mean of the scored pillarScores (already rounded to "
                          "roundingPrecision), rounded again to roundingPrecision",
                "zeroPillarBehavior": "if ANY scored pillar score is <= 0, indexStrict is "
                                      "exactly 0.0 — 'no food = no resilience, however good "
                                      "the rest' — rather than a partial geometric mean",
                "roundingPrecision": 1,
            },
            "ragThresholds": {"green": RAG_GREEN, "amber": RAG_AMBER},
            "ragBasis": "rag/ragStrict are computed FROM THE ROUNDED index/indexStrict value "
                        "(green if >= green threshold, amber if >= amber threshold, else red) "
                        "— not from the raw pre-rounding mean",
            "emptyBehavior": "index, indexStrict, rag, ragStrict and weakestPillar are all "
                             "null when a territory has zero scored pillars",
        },
        "baseline": baseline,
    }


def main():
    rows = load_canonical_rows()
    scores = compute(rows)
    payload = {
        "generatedAt": TODAY,
        "meta": build_resilience_meta(scores, PILLARS),
        "method": "linear 0-100 vs documented bounds; pillar = mean of scored indicators; "
                  "index = mean of scored pillars; indexStrict = geometric mean (weakest-link "
                  "strict mode); unscored pillars excluded, never imputed",
        "ragThresholds": {"green": RAG_GREEN, "amber": RAG_AMBER},
        "territories": scores,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    write_json_lf(OUTPUT, payload)
    for territory, data in scores.items():
        print(f"  {territory}: index={data['index']} ({data['rag']})  strict={data['indexStrict']} "
              f"({data['ragStrict']})  weakest={data['weakestPillar']} "
              f"(scored {len(data['pillarScores'])}/{len(PILLARS)} pillars)")
    print(f"Wrote -> {OUTPUT.relative_to(ROOT)}")

    # Impact Simulator: the same run's `scores` reshaped into a versioned,
    # deterministic contract a JS engine can mirror. Written in the same
    # pipeline step as resilience.json (both come from this one `scores`), and
    # tracked by emit_manifest.py's TRACKED_FILES the same way (IS-1B).
    model_payload = build_model(scores)
    MODEL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    write_json_lf(MODEL_OUTPUT, model_payload)
    print(f"Wrote -> {MODEL_OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"ERROR: {error}")
        raise SystemExit(1)
