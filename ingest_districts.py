"""
Borneo Tracker — DISTRICT-level (ADM2) ingestion.

Produces public/data/districts.json, a PARALLEL dataset to indicators.json that
powers the dashboard's Region <-> District drill-down toggle. The existing
4-territory pipeline (indicators.json) is left completely untouched.

Sources (keys already present in .env where required):
  DOSM OpenDOSM            -> Sabah + Sarawak districts   (keyless)
                             GDP, unemployment, poverty, household income,
                             Gini, population
  Global Forest Watch ADM2 -> all Borneo districts        (GFW_API_KEY)
                             forest extent, tree-cover loss, fire alerts
  BPS Indonesia            -> Kalimantan kabupaten/kota    (BPS_API_KEY)

Row schema mirrors indicators.json so the frontend helpers work unchanged, with
`territory` set to the DISTRICT name plus an extra `parent` (state/province):

  territory | parent | indicator | dashboard_concept | year | value | unit |
  source | data_level | esg_pillar | sdg_goal | hexagon_pillar | confidence | canonical

Stdlib only (urllib/csv/json) so it runs on a bare Python 3, consistent with the
rest of the pipeline. Run standalone:  python ingest_districts.py
"""

import csv
import io
import json
import os
import re
from datetime import date
from pathlib import Path
import urllib.request
import urllib.error

ROOT = Path(__file__).parent
OUTPUT = ROOT / "public" / "data" / "districts.json"
TODAY = date.today().isoformat()
UA = "Mozilla/5.0 (Borneo-Tracker-Districts)"

DOSM_BASE = "https://storage.dosm.gov.my"

# Pseudo-districts DOSM adds to Sabah/Sarawak GDP for offshore oil & gas — not a
# real place, so it must never appear as a selectable district.
EXCLUDE_DISTRICTS = {"Supra"}


# ----------------------------------------------------------------- helpers
def load_env(path=ROOT / ".env"):
    env = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    for key in ("BPS_API_KEY", "GFW_API_KEY", "WAQI_TOKEN", "FIRMS_MAP_KEY", "GDL_API_TOKEN"):
        if os.environ.get(key):
            env[key] = os.environ[key]
    return env


def fetch(url, headers=None, timeout=90):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=timeout).read()


def fetch_csv(path):
    """Fetch a DOSM storage CSV and return a list of dict rows."""
    raw = fetch(f"{DOSM_BASE}/{path}.csv")
    text = raw.decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def year_of(date_str):
    text = str(date_str or "")
    return text[:4] if len(text) >= 4 and text[:4].isdigit() else text


def latest_by_district(rows, value_key, state_filter=("Sabah", "Sarawak"), where=None):
    """Collapse rows to the single latest-year observation per (state, district).

    `where` is an optional predicate(row) to pre-filter (e.g. GDP series/sector).
    Returns {(state, district): {"date", "year", "value"}}.
    """
    best = {}
    for row in rows:
        state = row.get("state")
        district = row.get("district")
        if state not in state_filter or not district or district in EXCLUDE_DISTRICTS:
            continue
        if where and not where(row):
            continue
        value = to_float(row.get(value_key))
        if value is None:
            continue
        key = (state, district)
        row_date = row.get("date", "")
        if key not in best or row_date > best[key]["date"]:
            best[key] = {"date": row_date, "year": year_of(row_date), "value": value}
    return best


def make_row(state, district, indicator, concept, pillar, sdg, unit, obs, source,
             hexagon="", confidence="high", canonical=1):
    return {
        "territory": district,        # district name is the join key (reuses frontend helpers)
        "parent": state,
        "indicator": indicator,
        "dashboard_concept": concept,
        "year": obs["year"],
        "value": round(obs["value"], 4),
        "unit": unit,
        "source": source,
        "data_level": "district",
        "esg_pillar": pillar,
        "sdg_goal": sdg,
        "hexagon_pillar": hexagon,
        "confidence": confidence,
        "canonical": canonical,
    }


# ----------------------------------------------------------------- DOSM (MY)
def build_dosm():
    """Sabah + Sarawak district indicators from OpenDOSM (keyless)."""
    rows = []
    print("  [districts:DOSM] pulling Sabah/Sarawak district datasets…")

    # GDP (real, constant 2015) — sector p0 = overall total, series abs.
    gdp = fetch_csv("gdp/gdp_district_real_supply")
    for (state, district), obs in latest_by_district(
        gdp, "value", where=lambda r: r.get("series") == "abs" and r.get("sector") == "p0"
    ).items():
        rows.append(make_row(state, district, "GDP (real)", "economy", "S", "SDG8",
                             "RM mil", obs, "DOSM / gdp_district_real_supply"))

    # Unemployment rate (labour force survey).
    lfs = fetch_csv("labour/lfs_district")
    for (state, district), obs in latest_by_district(lfs, "u_rate").items():
        rows.append(make_row(state, district, "Unemployment rate", "unemployment_rate",
                             "S", "SDG8", "%", obs, "DOSM / lfs_district"))

    # Poverty (absolute) — % of households below the PLI.
    pov = fetch_csv("hies/hh_poverty_district")
    for (state, district), obs in latest_by_district(pov, "poverty_absolute").items():
        rows.append(make_row(state, district, "Poverty rate (absolute)", "poverty",
                             "S", "SDG1", "%", obs, "DOSM / hh_poverty_district"))

    # Household income (mean) + Gini — from HIES district table.
    hies = fetch_csv("hies/hies_district")
    for (state, district), obs in latest_by_district(hies, "income_mean").items():
        rows.append(make_row(state, district, "Household income (mean)", "household_income",
                             "S", "SDG8", "RM/month", obs, "DOSM / hies_district"))
    for (state, district), obs in latest_by_district(hies, "gini").items():
        rows.append(make_row(state, district, "Gini coefficient", "inequality",
                             "S", "SDG10", "index", obs, "DOSM / hies_district"))

    # Population (overall: both sexes, all ages, all ethnicities). Values in '000.
    pop = fetch_csv("population/population_district")
    pop_latest = latest_by_district(
        pop, "population",
        where=lambda r: r.get("sex") == "both" and r.get("age") == "overall"
        and r.get("ethnicity") == "overall",
    )
    for (state, district), obs in pop_latest.items():
        rows.append(make_row(state, district, "Population", "population", "S", "SDG11",
                             "'000 people", obs, "DOSM / population_district"))

    print(f"  [districts:DOSM] {len(rows)} district rows")
    return rows


# ----------------------------------------------------------------- reconcile
def norm_key(name):
    """Plain normalized name key: lowercase, alphanumerics only. Used as the join key
    for MALAYSIA, where DOSM and GADM both use English names that match directly
    ('Kota Kinabalu' -> 'kotakinabalu' on both sides). We deliberately do NOT strip a
    'Kota' prefix — in Indonesia a 'Kota X' city and an 'X' regency are DIFFERENT units,
    so stripping would wrongly merge them (e.g. Kota Pontianak vs Pontianak)."""
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


def join_key(row):
    """The cross-source district identity. Indonesia rows carry a BPS/GADM numeric
    `code` (BPS vervar val == GADM CC_2), which is unambiguous and immune to the
    Kota/regency naming mismatch. Malaysia rows fall back to the normalized name."""
    return str(row["code"]) if row.get("code") else norm_key(row["territory"])


# Prefer the official statistics-office name (DOSM/BPS) over GADM's geometry name
# when the same district arrives from multiple sources.
def _source_rank(source):
    if source.startswith("DOSM"):
        return 0
    if source.startswith("BPS"):
        return 1
    return 2  # GFW / GADM


def reconcile_names(rows):
    """Collapse the same district (matched by join_key) arriving under different
    spellings to one canonical display name per (parent, key), preferring the local
    statistics-office name. Stamps each row's `key` for the frontend map join."""
    best = {}
    for row in rows:
        key = (row["parent"], join_key(row))
        rank = _source_rank(row["source"])
        if key not in best or rank < best[key][0]:
            best[key] = (rank, row["territory"])
    for row in rows:
        jk = join_key(row)
        row["territory"] = best[(row["parent"], jk)][1]
        row["key"] = jk
    return rows


def _year_num(year):
    nums = [int(n) for n in re.findall(r"\d{4}", str(year))]
    return max(nums) if nums else 0


def dedupe_rows(rows):
    """One row per (parent, key, indicator), keeping the newest year. Safety net for
    residual same-district duplicates (e.g. a DOSM spelling variant like Lubok/Lubuk
    Antu) so a district/concept is never double-counted as canonical."""
    best = {}
    for row in rows:
        key = (row["parent"], row["key"], row["indicator"])
        if key not in best or _year_num(row["year"]) > _year_num(best[key]["year"]):
            best[key] = row
    return list(best.values())


# ----------------------------------------------------------------- assemble
def build_parents(rows):
    parents = {}
    for row in rows:
        parents.setdefault(row["parent"], set()).add(row["territory"])
    return {parent: sorted(names) for parent, names in sorted(parents.items())}


def main():
    env = load_env()
    rows = []

    rows.extend(build_dosm())

    # Phase-3 sources — added by companion modules, guarded by their keys so a
    # missing key just yields fewer rows instead of failing the whole build.
    try:
        import ingest_districts_gfw
        rows.extend(ingest_districts_gfw.build_gfw_districts(env.get("GFW_API_KEY")))
    except ImportError:
        pass
    try:
        import ingest_districts_bps
        rows.extend(ingest_districts_bps.build_bps_districts(env.get("BPS_API_KEY")))
    except ImportError:
        pass

    reconcile_names(rows)  # canonicalizes display names and stamps row["key"]
    rows = dedupe_rows(rows)  # one row per (parent, key, indicator)

    parents = build_parents(rows)
    payload = {
        "generatedAt": TODAY,
        "parents": parents,
        "rows": rows,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    district_count = sum(len(v) for v in parents.values())
    print(f"Wrote {len(rows)} district rows across {district_count} districts "
          f"({', '.join(f'{k}:{len(v)}' for k, v in parents.items())}) -> "
          f"{OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
