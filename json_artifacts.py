"""Cross-platform writer for published Borneo Tracker JSON artifacts.

The deployment manifest hashes file bytes, not parsed JSON.  On Windows the
default text writer translates ``\n`` to CRLF, while GitHub's Linux runner and
the production bundle use LF.  Keeping the published artifacts LF-only makes
the manifest a portable, verifiable claim across both environments.
"""

import json
import re
from pathlib import Path
from typing import Any

ARTIFACT_META_SCHEMA_VERSION = 1


def _without_volatile_generated_at(payload: Any) -> Any:
    """Only the artifact-level build clock is volatile; source dates remain data."""
    if not isinstance(payload, dict):
        return payload
    return {key: value for key, value in payload.items() if key != "generatedAt"}


def _year_num(value: Any) -> int | None:
    years = [int(match) for match in re.findall(r"\d{4}", str(value or ""))]
    return max(years) if years else None


def _clean_source(value: Any) -> str:
    return " ".join(str(value or "").split())


def source_count_from_rows(rows: list[dict[str, Any]]) -> int:
    """Count distinct non-empty source strings already present in row data."""
    return len({_clean_source(row.get("source")) for row in rows if _clean_source(row.get("source"))})


def latest_year_from_rows(rows: list[dict[str, Any]]) -> int | None:
    years = [_year_num(row.get("year")) for row in rows]
    years = [year for year in years if year is not None]
    return max(years) if years else None


def update_cadence_from_rows(rows: list[dict[str, Any]]) -> str:
    cadences = set()
    for row in rows:
        label = f"{row.get('indicator', '')} {row.get('year', '')} {row.get('source', '')}".lower()
        if re.search(r"\d{4}-\d{2}-\d{2}", label) or "live" in label or "24h" in label or "nrt" in label:
            cadences.add("daily")
        elif _year_num(row.get("year")) is not None:
            cadences.add("annual")
    if len(cadences) > 1:
        return "mixed"
    if cadences:
        return next(iter(cadences))
    return "unknown"


def build_indicators_meta(
    rows: list[dict[str, Any]],
    territories: list[str],
    series: dict[str, Any],
) -> dict[str, Any]:
    coverage = {}
    for territory in territories:
        territory_rows = [row for row in rows if row.get("territory") == territory]
        canonical_rows = [row for row in territory_rows if row.get("canonical") == 1]
        coverage[territory] = {
            "rows": len(territory_rows),
            "canonicalRows": len(canonical_rows),
            "concepts": len({row.get("dashboard_concept") for row in canonical_rows if row.get("dashboard_concept")}),
            "latestYear": latest_year_from_rows(territory_rows),
        }
    return {
        "schemaVersion": ARTIFACT_META_SCHEMA_VERSION,
        "updateCadence": update_cadence_from_rows(rows),
        "sourceCount": source_count_from_rows(rows),
        "coverage": {
            "territories": coverage,
            "totalRows": len(rows),
            "canonicalRows": sum(1 for row in rows if row.get("canonical") == 1),
            "trendSeries": sum(len(concepts) for concepts in (series or {}).values()),
        },
    }


def build_districts_meta(
    rows: list[dict[str, Any]],
    parents: dict[str, list[str]],
) -> dict[str, Any]:
    coverage = {}
    for parent, districts in parents.items():
        parent_rows = [row for row in rows if row.get("parent") == parent]
        coverage[parent] = {
            "districts": len(districts),
            "rows": len(parent_rows),
            "latestYear": latest_year_from_rows(parent_rows),
        }
    return {
        "schemaVersion": ARTIFACT_META_SCHEMA_VERSION,
        "updateCadence": update_cadence_from_rows(rows),
        "sourceCount": source_count_from_rows(rows),
        "coverage": {
            "parents": coverage,
            "totalDistricts": sum(len(districts) for districts in parents.values()),
            "totalRows": len(rows),
            "withGeometry": sum(1 for row in rows if row.get("has_geometry") is True),
            "withoutGeometry": sum(1 for row in rows if row.get("has_geometry") is False),
        },
    }


def build_resilience_meta(
    territories: dict[str, dict[str, Any]],
    pillars: list[str],
) -> dict[str, Any]:
    coverage = {}
    unscored = {}
    sources = set()
    rows = []
    scored_indicator_count = 0
    for territory, data in territories.items():
        detail = data.get("detail") or {}
        territory_scored_indicators = sum(len(entries) for entries in detail.values())
        scored_indicator_count += territory_scored_indicators
        for entries in detail.values():
            for entry in entries:
                rows.append(entry)
                source = _clean_source(entry.get("source"))
                if source:
                    sources.add(source)
        unscored[territory] = list(data.get("unscoredPillars") or [])
        coverage[territory] = {
            "scoredPillars": len(data.get("scoredPillars") or []),
            "unscoredPillars": len(data.get("unscoredPillars") or []),
            "scoredIndicators": territory_scored_indicators,
        }
    return {
        "schemaVersion": ARTIFACT_META_SCHEMA_VERSION,
        "updateCadence": update_cadence_from_rows(rows),
        "sourceCount": len(sources),
        "coverage": {
            "territories": coverage,
            "pillarCount": len(pillars),
            "scoredIndicators": scored_indicator_count,
        },
        "unscoredPillars": unscored,
    }


def write_json_lf(path: Path, payload: Any, *, indent: int = 2) -> bool:
    """Serialize *payload* exactly like ``json.dumps(..., indent=2)`` with LF.

    No trailing newline is added because the historical published artifact
    contract did not include one.  ``newline='\n'`` is the important part: it
    prevents Windows from silently changing the bytes after hashing.
    """
    body = json.dumps(payload, indent=indent)
    # A daily run whose only delta is the generatedAt clock must preserve the
    # exact old bytes. Otherwise every refresh creates a needless new data
    # version and provenance entry despite unchanged substantive values.
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
            if _without_volatile_generated_at(existing) == _without_volatile_generated_at(payload):
                return False
        except (OSError, ValueError):
            pass
    path.write_text(body, encoding="utf-8", newline="\n")
    return True
