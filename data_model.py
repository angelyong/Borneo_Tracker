import csv
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parent
CSV = ROOT / "borneo_tracker_poc.csv"
MANUAL = ROOT / "manual_overrides.csv"
DASHBOARD_TERRITORIES = ["Sabah", "Sarawak", "Brunei", "Kalimantan"]
KALIMANTAN_PROVINCES = [
    "Kalimantan Barat",
    "Kalimantan Tengah",
    "Kalimantan Selatan",
    "Kalimantan Timur",
    "Kalimantan Utara",
]

TODAY = date.today().isoformat()

SUM_INDICATORS = {
    "Crop production (paddy)",
    "Fire alerts (VIIRS, annual)",
    "Forest extent (2000)",
    "Tourist trips (domestic)",
    "Tree cover loss (cumulative)",
}
MEAN_INDICATORS = {
    "Clean water access",
    "GDP growth (PDRB)",
    "Life expectancy",
    "Mean years schooling (RLS)",
    "Poverty rate (P0)",
    "Unemployment rate",
}

CONCEPT_PRIORITY = {
    "forest_cover": ["Forest cover", "Forest extent (2000)"],
    "deforestation": ["Tree cover loss (cumulative)"],
    "air_quality": ["Air quality (AQI, live)"],
    "fire_hotspots": ["Fire alerts (VIIRS, annual)"],
    "protected_areas": ["National parks (count)"],
    "clean_water_access": ["Clean water access"],
    "poverty": ["Poverty rate (absolute)", "Poverty rate (P0)", "Poverty headcount <$2.15/day (SDG1)"],
    "unemployment_rate": ["Unemployment rate"],
    "economy": ["GDP (real)", "GDP growth", "GDP growth (PDRB)", "GDP (current US$)"],
    "healthcare": ["Life expectancy", "Hospital beds (per 1k)", "Hospital beds"],
    "education": [
        "Adult literacy",
        "Mean years schooling (RLS)",
        "School enrolment (secondary, gross)",
        "School enrolment (primary, gross)",
        "School enrolment",
    ],
    "governance": ["Control of Corruption (WGI)"],
    "food": ["Crop production (paddy)", "Agricultural land"],
    "energy": ["Electricity access", "Electrification ratio", "Renewable electricity (% output)"],
    "shelter": ["Households", "Basic sanitation access"],
    "entertainment": ["Tourist arrivals", "Tourist trips (domestic)"],
    "heritage": ["UNESCO World Heritage Sites"],
}


def low(value):
    return value.lower()


def parse_value(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def sort_year_key(year):
    text = str(year or "")
    parts = [int(part) for part in text.replace("/", "-").split("-") if part.isdigit()]
    return max(parts) if parts else 0


def dashboard_concept(indicator):
    if indicator in ("Forest cover", "Forest extent (2000)"):
        return "forest_cover"
    if indicator == "Tree cover loss (cumulative)":
        return "deforestation"
    if indicator == "Air quality (AQI, live)":
        return "air_quality"
    if indicator == "Fire alerts (VIIRS, annual)":
        return "fire_hotspots"
    if indicator == "National parks (count)":
        return "protected_areas"
    if indicator == "Clean water access":
        return "clean_water_access"
    if indicator in ("Poverty rate (absolute)", "Poverty rate (P0)", "Poverty headcount <$2.15/day (SDG1)"):
        return "poverty"
    if indicator == "Unemployment rate":
        return "unemployment_rate"
    if indicator in ("GDP (real)", "GDP growth", "GDP growth (PDRB)", "GDP (current US$)"):
        return "economy"
    if indicator in ("Hospital beds", "Hospital beds (per 1k)", "Life expectancy"):
        return "healthcare"
    if indicator in (
        "School enrolment",
        "School enrolment (primary, gross)",
        "School enrolment (secondary, gross)",
        "Adult literacy",
        "Mean years schooling (RLS)",
    ):
        return "education"
    if indicator == "Control of Corruption (WGI)":
        return "governance"
    if indicator in ("Crop production (paddy)", "Agricultural land"):
        return "food"
    if indicator in ("Electricity access", "Electrification ratio", "Renewable electricity (% output)"):
        return "energy"
    if indicator in ("Households", "Basic sanitation access"):
        return "shelter"
    if indicator in ("Tourist arrivals", "Tourist trips (domestic)"):
        return "entertainment"
    if indicator == "UNESCO World Heritage Sites":
        return "heritage"
    return "other"


def esg_pillar(indicator):
    concept = dashboard_concept(indicator)
    if concept in {"forest_cover", "deforestation", "air_quality", "fire_hotspots", "protected_areas"}:
        return "E"
    if indicator == "Renewable electricity (% output)":
        return "E"
    if concept == "governance":
        return "G"
    return "S"


def sdg_goal(indicator):
    concept = dashboard_concept(indicator)
    mapping = {
        "forest_cover": "SDG15",
        "deforestation": "SDG13",
        "air_quality": "SDG13",
        "fire_hotspots": "SDG13",
        "protected_areas": "SDG15",
        "clean_water_access": "SDG6",
        "poverty": "SDG1",
        "unemployment_rate": "SDG8",
        "economy": "SDG8",
        "healthcare": "SDG3",
        "education": "SDG4",
        "governance": "SDG16",
        "food": "SDG2",
        "energy": "SDG7",
        "shelter": "SDG11",
        "entertainment": "SDG8",
        "heritage": "SDG11",
    }
    return mapping.get(concept, "")


def hexagon_pillar(indicator):
    concept = dashboard_concept(indicator)
    mapping = {
        "food": "Food",
        "energy": "Energy",
        "education": "Education",
        "shelter": "Shelter",
        "healthcare": "Healthcare",
        # 2026-07-15 (Phase 0.1): clean water is a Shelter/WASH adequacy indicator, not
        # Healthcare. Re-tagged so the Shelter pillar lights up instead of Healthcare
        # double-counting. Life expectancy stays Healthcare. See docs/ABCDE_HEXAGON_REFRAME_PLAN.md.
        "clean_water_access": "Shelter",
        "entertainment": "Entertainment",
        "heritage": "Entertainment",
    }
    return mapping.get(concept, "")


def confidence_for_row(row):
    territory = row["territory"]
    source = row["source"] or ""
    if row.get("is_derived"):
        return "medium"
    if row.get("data_level") == "report":
        return "manual"
    if "manual" in low(source):
        return "manual"
    if row.get("data_level") == "modeled":
        # academic/harmonised sources (e.g. Global Data Lab) — cite-able but not
        # an official statistics office, so never "high".
        return "medium"
    if territory in {"Sabah", "Sarawak", "Kalimantan"} and row["data_level"] == "national":
        return "medium"
    if row["data_level"] == "city":
        return "medium"
    return "high"


def indicator_rank(row):
    concept = row["dashboard_concept"]
    ranking = CONCEPT_PRIORITY.get(concept, [])
    try:
        return ranking.index(row["indicator"])
    except ValueError:
        return len(ranking)


def data_level_rank(row):
    order = {
        "territory": 0,
        "state": 1,
        "province": 1,
        "report": 1,
        "satellite": 1,
        "national": 2,
        "modeled": 2,
        "city": 3,
    }
    return order.get(row["data_level"], 9)


def canonical_sort_key(row):
    return (
        row.get("is_derived", 0),
        data_level_rank(row),
        indicator_rank(row),
        -sort_year_key(row["year"]),
        row["indicator"],
    )


def load_csv_rows():
    with open(CSV, encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def load_manual_rows():
    if not MANUAL.exists():
        return []
    with open(MANUAL, encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def build_processed_row(
    raw_row,
    territory=None,
    source=None,
    data_level=None,
    value=None,
    year=None,
    unit=None,
    source_territory=None,
    last_updated=None,
):
    indicator = raw_row["indicator"]
    row = {
        "territory": territory or raw_row["territory"],
        "source_territory": source_territory or raw_row["territory"],
        "indicator": indicator,
        "dashboard_concept": dashboard_concept(indicator),
        "year": year if year is not None else raw_row["year"],
        "value": parse_value(value if value is not None else raw_row["value"]),
        "unit": unit if unit is not None else raw_row["unit"],
        "source": source if source is not None else raw_row["source"],
        "data_level": data_level if data_level is not None else raw_row["data_level"],
        "esg_pillar": esg_pillar(indicator),
        "sdg_goal": sdg_goal(indicator),
        "hexagon_pillar": hexagon_pillar(indicator),
        "last_updated": last_updated or TODAY,
        "is_derived": 0,
        "derived_from": "",
        "source_count": 1,
        "canonical": 0,
    }
    row["confidence"] = confidence_for_row(row)
    return row


def build_manual_processed_rows(rows):
    processed = []
    for raw_row in rows:
        note = raw_row.get("note") or ""
        source_doc = raw_row.get("source_doc") or "Manual report"
        source_url = raw_row.get("source_url") or ""
        parts = [source_doc]
        if note:
            parts.append(note)
        if source_url:
            parts.append(source_url)
        source = "Manual report: " + " — ".join(parts)
        processed.append(
            build_processed_row(
                raw_row,
                source=source,
                data_level="report",
                source_territory=raw_row["territory"],
                last_updated=raw_row.get("retrieved_date") or TODAY,
            )
        )
    return processed


def build_kalimantan_aggregates(rows):
    grouped = {}
    existing_kalimantan_indicators = {
        raw_row["indicator"] for raw_row in rows if raw_row["territory"] == "Kalimantan"
    }
    for raw_row in rows:
        if raw_row["territory"] not in KALIMANTAN_PROVINCES:
            continue
        grouped.setdefault(raw_row["indicator"], []).append(raw_row)

    aggregates = []
    for indicator, indicator_rows in grouped.items():
        if indicator in existing_kalimantan_indicators:
            continue
        method = "sum" if indicator in SUM_INDICATORS else "mean" if indicator in MEAN_INDICATORS else None
        if method is None:
            continue
        year_groups = {}
        for row in indicator_rows:
            year_groups.setdefault(sort_year_key(row["year"]), []).append(row)
        selected_year, selected_rows = max(
            year_groups.items(),
            key=lambda item: (len(item[1]), item[0]),
        )
        if selected_year == 0 or len(selected_rows) < 3:
            continue
        values = [parse_value(row["value"]) for row in selected_rows]
        values = [value for value in values if value is not None]
        if not values:
            continue
        aggregate_value = sum(values) if method == "sum" else sum(values) / len(values)
        selected_year_label = selected_rows[0]["year"]
        base = build_processed_row(
            selected_rows[0],
            territory="Kalimantan",
            source=f"Derived from {len(selected_rows)} Kalimantan provinces ({selected_rows[0]['source']})",
            data_level="territory",
            value=str(aggregate_value),
            year=selected_year_label,
            unit=selected_rows[0]["unit"],
        )
        base["is_derived"] = 1
        base["derived_from"] = ", ".join(sorted(row["territory"] for row in selected_rows))
        base["source_count"] = len(selected_rows)
        base["confidence"] = confidence_for_row(base)
        aggregates.append(base)
    return aggregates


def assign_canonical(rows):
    grouped = {}
    for row in rows:
        grouped.setdefault((row["territory"], row["dashboard_concept"]), []).append(row)
    for group_rows in grouped.values():
        winner = min(group_rows, key=canonical_sort_key)
        winner["canonical"] = 1


def load_indicator_rows():
    raw_rows = load_csv_rows()
    processed = [build_processed_row(raw_row) for raw_row in raw_rows]
    processed.extend(build_manual_processed_rows(load_manual_rows()))
    processed.extend(build_kalimantan_aggregates(raw_rows))
    assign_canonical(processed)
    return processed


def dashboard_rows(rows):
    return [row for row in rows if row["territory"] in DASHBOARD_TERRITORIES]
