"""Authoritative-source registry for Borneo Tracker's public data layer.

This is intentionally an auxiliary publication artifact: it makes cadence,
coverage and licensing reviewable, but is not part of the six-file integrity
manifest.  The data refresh workflow publishes it after merge, alongside the
anchored datasets; a feature branch must not commit its generated JSON.
"""

from pathlib import Path

from json_artifacts import write_json_lf
from project_time import project_today_iso

ROOT = Path(__file__).parent
OUTPUT = ROOT / "public" / "data" / "sources.json"
TERRITORIES = ("Sabah", "Sarawak", "Brunei", "Kalimantan")
PILLARS = ("Food", "Energy", "Education", "Shelter", "Healthcare", "Entertainment")
CADENCES = {"daily", "weekly", "monthly", "quarterly", "annual", "irregular"}


def source(source_id, display_name, publisher, cadence, interval, licence, url, territories, pillars):
    return {
        "source_id": source_id,
        "display_name": display_name,
        "publisher": publisher,
        "cadence": cadence,
        "expected_interval_days": interval,
        "licence": licence,
        "official_url": url,
        "territories": list(territories),
        "pillars": list(pillars),
    }


# Keep this registry intentionally source-level rather than indicator-level. It
# describes the publishers a reviewer can audit, including fixed official
# publications entered through the reviewed manual intake path.
SOURCES_REGISTRY = {
    "dosm": source("dosm", "Department of Statistics Malaysia (DOSM / OpenDOSM)", "Government of Malaysia", "annual", 365, "Open Government Licence - Malaysia", "https://open.dosm.gov.my/", ("Sabah", "Sarawak"), ("Food", "Energy", "Education", "Shelter", "Healthcare", "Entertainment")),
    "world_bank": source("world_bank", "World Bank Open Data", "World Bank", "annual", 365, "World Bank Terms of Use", "https://data.worldbank.org/", TERRITORIES, ("Food", "Energy", "Education", "Shelter", "Healthcare", "Entertainment")),
    "un_sdg": source("un_sdg", "United Nations SDG Indicators Database", "United Nations Statistics Division", "annual", 365, "UN Data Terms of Use", "https://unstats.un.org/sdgs/dataportal", TERRITORIES, ("Food", "Shelter", "Healthcare")),
    "bps": source("bps", "Statistics Indonesia (BPS)", "Badan Pusat Statistik", "annual", 365, "BPS Open Data Terms", "https://www.bps.go.id/", ("Kalimantan",), PILLARS),
    "esdm": source("esdm", "Indonesia Electricity Statistics", "Ministry of Energy and Mineral Resources (ESDM)", "annual", 365, "Government of Indonesia Open Data", "https://gatrik.esdm.go.id/", ("Kalimantan",), ("Energy",)),
    "global_forest_watch": source("global_forest_watch", "Global Forest Watch", "World Resources Institute", "monthly", 30, "CC BY 4.0 (platform data terms apply)", "https://www.globalforestwatch.org/", TERRITORIES, ("Shelter", "Energy")),
    "nasa_firms": source("nasa_firms", "NASA FIRMS (VIIRS Active Fires)", "NASA LANCE / EOSDIS", "daily", 1, "Public Domain / NASA Open Data Policy", "https://firms.modaps.eosdis.nasa.gov/", TERRITORIES, ("Shelter", "Energy")),
    "waqi": source("waqi", "World Air Quality Index", "WAQI Project", "daily", 1, "WAQI Terms of Service", "https://aqicn.org/api/", TERRITORIES, ("Healthcare", "Shelter")),
    "unesco": source("unesco", "UNESCO World Heritage List", "UNESCO World Heritage Centre", "irregular", 365, "UNESCO Website Terms of Use", "https://whc.unesco.org/en/list/", TERRITORIES, ("Entertainment",)),
    "global_data_lab": source("global_data_lab", "Global Data Lab Subnational HDI", "Global Data Lab", "annual", 365, "Global Data Lab Terms of Use", "https://globaldatalab.org/", TERRITORIES, ("Education", "Healthcare")),
    "fao": source("fao", "FAOSTAT", "Food and Agriculture Organization of the United Nations", "annual", 365, "CC BY 4.0", "https://www.fao.org/faostat/", TERRITORIES, ("Food",)),
    "sarawak_energy": source("sarawak_energy", "Sarawak Energy", "Sarawak Energy Berhad", "annual", 365, "Sarawak Energy Website Terms", "https://www.sarawakenergy.com/", ("Sarawak",), ("Energy",)),
    "brunei_agriculture": source("brunei_agriculture", "Brunei Department of Agriculture and Agrifood", "Government of Brunei Darussalam", "annual", 365, "Government of Brunei Website Terms", "https://www.agriculture.gov.bn/", ("Brunei",), ("Food",)),
    "brunei_tourism": source("brunei_tourism", "Brunei Tourism Development Department", "Government of Brunei Darussalam", "annual", 365, "Government of Brunei Website Terms", "https://www.tourism.gov.bn/", ("Brunei",), ("Entertainment",)),
    "sabah_parks": source("sabah_parks", "Sabah Parks", "Government of Sabah", "annual", 365, "Sabah Parks Website Terms", "https://www.sabahparks.org.my/", ("Sabah",), ("Shelter", "Entertainment")),
    "sarawak_forestry": source("sarawak_forestry", "Forest Department Sarawak", "Government of Sarawak", "annual", 365, "Sarawak Government Website Terms", "https://forestry.sarawak.gov.my/", ("Sarawak",), ("Shelter", "Entertainment")),
}


def validate_registry(registry=SOURCES_REGISTRY):
    if not 14 <= len(registry) <= 18:
        raise ValueError("registry must contain 14–18 authoritative sources")
    required = {"source_id", "display_name", "publisher", "cadence", "expected_interval_days", "licence", "official_url", "territories", "pillars"}
    for key, item in registry.items():
        if set(item) != required or item["source_id"] != key:
            raise ValueError(f"invalid source schema for {key}")
        if item["cadence"] not in CADENCES or not isinstance(item["expected_interval_days"], int) or item["expected_interval_days"] < 1:
            raise ValueError(f"invalid cadence for {key}")
        if not all(isinstance(item[field], str) and item[field].strip() for field in ("display_name", "publisher", "licence")):
            raise ValueError(f"missing attribution for {key}")
        if not item["official_url"].startswith("https://"):
            raise ValueError(f"official_url must be HTTPS for {key}")
        if not item["territories"] or not set(item["territories"]).issubset(TERRITORIES):
            raise ValueError(f"invalid territory coverage for {key}")
        if not item["pillars"] or not set(item["pillars"]).issubset(PILLARS):
            raise ValueError(f"invalid pillar coverage for {key}")
    return True


def build_payload(registry=SOURCES_REGISTRY, generated_at=None):
    validate_registry(registry)
    return {
        "schemaVersion": 1,
        "generatedAt": generated_at or project_today_iso(),
        "sources": [registry[source_id] for source_id in sorted(registry)],
    }


def export_json(output=OUTPUT):
    payload = build_payload()
    output.parent.mkdir(parents=True, exist_ok=True)
    write_json_lf(output, payload)
    try:
        label = output.relative_to(ROOT)
    except ValueError:
        label = output
    print(f"Wrote {len(payload['sources'])} source records -> {label}")
    return payload


def main():
    export_json()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
