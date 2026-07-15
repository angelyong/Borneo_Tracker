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

# Latest official population, for per-capita normalisation (Phase 1, C3).
# Sources tracked in docs/ABCDE_HEXAGON_REFRAME_PLAN.md.
POPULATION = {
    "Sabah": 3_751_000,        # DOSM Current Population Estimates 2024 (~11.0% of 34.1M)
    "Sarawak": 2_907_500,      # DOSM 2024 estimate
    "Brunei": 455_500,         # DEPS 2024
    "Kalimantan": 17_259_155,  # BPS 2024 (mid-2023, 5 provinces combined)
}

# Internet use — the Entertainment-pillar proxy (Phase 1, C2=B). % of individuals
# using the internet. Multi-agency sources with slightly different definitions, so
# scored but flagged (confidence follows data_level): value, source, data_level.
INTERNET_USE = {
    "Sabah": (98.0, "DOSM ICT Use & Access Survey 2024 (Malaysia national 98.0%, applied to state)", "national"),
    "Sarawak": (98.0, "DOSM ICT Use & Access Survey 2024 (Malaysia national 98.0%, applied to state)", "national"),
    "Brunei": (99.0, "ITU / World Bank — individuals using the Internet (% of population), 2023", "national"),
    "Kalimantan": (76.1, "BPS — Kalimantan region internet access, 2024", "national"),
}

# Sourced state indicators filling scoreable gaps with valid official figures
# (Phase 1). Sabah/Sarawak previously had Energy as a household COUNT and Education
# as an enrolment COUNT — neither comparable. These add the %/years equivalents so
# the pillars score, using the SAME indicators as the other territories.
# (territory, indicator, value, unit, year, source, data_level)
SOURCED_ROWS = [
    # Sarawak electrification (99.4%) already lives in manual_overrides.csv; it becomes
    # canonical via the CONCEPT_PRIORITY reorder + canonical_sort_key fix below.
    ("Sabah", "Mean years schooling (RLS)", 8.7, "years", "2023",
     "Global Data Lab — Subnational HDI, mean years schooling, 2023", "modeled"),
    ("Sarawak", "Mean years schooling (RLS)", 8.7, "years", "2023",
     "Global Data Lab — Subnational HDI, mean years schooling, 2023", "modeled"),
    # Sabah electricity access as a % (replaces the CSV household COUNT of the same name).
    ("Sabah", "Electricity access", 87.6, "%", "2022",
     "data.gov.my / DOSM — Access to Basic Amenities (% households with electricity, all districts)", "state"),
]

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
    # 2026-07-15 (Phase 1): prefer the %-based electrification ratio over the absolute
    # "Electricity access" household COUNT, so the scoreable indicator wins canonical.
    "energy": ["Electrification ratio", "Electricity access", "Renewable electricity (% output)"],
    # 2026-07-15 (Phase 1): prefer the scoreable sanitation % over the household COUNT.
    "shelter": ["Basic sanitation access", "Households"],
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
    if indicator == "Paddy production per capita":
        return "food_percapita"
    if indicator == "Internet use":
        return "internet_use"
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
        "food_percapita": "SDG2",
        "internet_use": "SDG9",
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
        "food_percapita": "Food",
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
        "internet_use": "Entertainment",
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
    # 2026-07-15 (Phase 1): rank the curated per-concept indicator priority BEFORE data
    # level, so a scoreable %/years indicator wins over an absolute count that merely
    # happens to sit at a more-local data level (e.g. Electrification ratio > Electricity
    # access households; Mean years schooling > School enrolment count). is_derived stays
    # first so real rows still beat derived aggregates.
    return (
        row.get("is_derived", 0),
        indicator_rank(row),
        data_level_rank(row),
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


def build_internet_rows():
    """Entertainment-pillar proxy (Phase 1, C2=B): % individuals using the internet.
    A distinct concept ('internet_use') so it forms its own canonical group and is
    scored, instead of competing with the tourism/heritage rows."""
    rows = []
    for territory, (value, source, data_level) in INTERNET_USE.items():
        rows.append(
            build_processed_row(
                {
                    "indicator": "Internet use",
                    "territory": territory,
                    "year": "2024",
                    "value": str(value),
                    "unit": "%",
                    "source": source,
                    "data_level": data_level,
                }
            )
        )
    return rows


def build_sourced_rows():
    """Valid official figures added to fill scoreable pillar gaps (Phase 1). Uses the
    same indicator names as other territories so they share BOUNDS and are comparable
    at the normalised 0-100 score level."""
    rows = []
    for territory, indicator, value, unit, year, source, data_level in SOURCED_ROWS:
        rows.append(
            build_processed_row(
                {
                    "indicator": indicator,
                    "territory": territory,
                    "year": year,
                    "value": str(value),
                    "unit": unit,
                    "source": source,
                    "data_level": data_level,
                }
            )
        )
    return rows


def build_percapita_food_rows(rows):
    """Food-pillar (Phase 1, C1=A): paddy production is stored in tonnes (an absolute
    count that can't be compared across territories). Divide by population to get a
    comparable kg/capita self-sufficiency proxy. A distinct concept ('food_percapita')
    so it is its own canonical group and gets scored, while the tonnes row stays as
    coverage. Must run AFTER the Kalimantan paddy aggregate exists."""
    derived_rows = []
    for territory in DASHBOARD_TERRITORIES:
        population = POPULATION.get(territory)
        if not population:
            continue
        candidates = [
            row
            for row in rows
            if row["territory"] == territory
            and row["indicator"] == "Crop production (paddy)"
            and (row["unit"] or "").strip() == "tonnes"
            and row["value"] is not None
        ]
        if not candidates:
            continue
        source_row = min(candidates, key=canonical_sort_key)
        kg_per_capita = round(source_row["value"] * 1000.0 / population, 1)
        derived = build_processed_row(
            {
                "indicator": "Paddy production per capita",
                "territory": territory,
                "year": source_row["year"],
                "value": str(kg_per_capita),
                "unit": "kg/capita",
                "source": f"Derived: {source_row['source']} ÷ population {population:,}",
                "data_level": "territory",
            }
        )
        derived["is_derived"] = 1
        derived["derived_from"] = "Crop production (paddy)"
        derived["confidence"] = confidence_for_row(derived)
        derived_rows.append(derived)
    return derived_rows


def load_indicator_rows():
    raw_rows = load_csv_rows()
    processed = [build_processed_row(raw_row) for raw_row in raw_rows]
    processed.extend(build_manual_processed_rows(load_manual_rows()))
    processed.extend(build_kalimantan_aggregates(raw_rows))
    processed.extend(build_internet_rows())
    processed.extend(build_sourced_rows())
    processed.extend(build_percapita_food_rows(processed))
    assign_canonical(processed)
    return processed


def dashboard_rows(rows):
    return [row for row in rows if row["territory"] in DASHBOARD_TERRITORIES]
