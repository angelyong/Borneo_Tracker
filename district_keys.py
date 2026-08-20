"""Shared district join-key rules for district rows and ADM2 geometry.

The dashboard joins ``districts.json`` rows to ``borneo_districts.geojson`` by
``(parent, key)``. Keep every data builder on these rules so geometry coverage is
auditable instead of repaired in the UI.
"""

import json
import re

INDONESIA_NAME_JOIN_PARENTS = {"Kalimantan Utara"}

SABAH_GEOMETRY_ALIASES = {
    "kotabelud": "belud",
    "kotakinabalu": "kinabalu",
    "kotamarudu": "marudu",
}


def normalize_name_key(name):
    return re.sub(r"[^a-z0-9]", "", str(name or "").lower())


def canonical_name_key(parent, name):
    key = normalize_name_key(name)
    if parent == "Sabah":
        return SABAH_GEOMETRY_ALIASES.get(key, key)
    return key


def usable_bps_code(parent, code):
    text = str(code or "").strip()
    if parent in INDONESIA_NAME_JOIN_PARENTS:
        return None
    if text and text.upper() != "NA" and text.isdigit() and len(text) >= 4:
        return text
    return None


def row_join_key(row):
    """Return the key a district data row should use."""
    parent = row.get("parent")
    return usable_bps_code(parent, row.get("code")) or canonical_name_key(parent, row.get("territory"))


def geometry_join_key(parent, name, iso=None, cc2=None):
    """Return the key a boundary polygon should use."""
    if iso == "IDN":
        code = usable_bps_code(parent, cc2)
        if code:
            return code
    return canonical_name_key(parent, name)


def load_geometry_key_set(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        (feature.get("properties", {}).get("parent"), str(feature.get("properties", {}).get("key")))
        for feature in data.get("features", [])
        if feature.get("properties", {}).get("parent") and feature.get("properties", {}).get("key")
    }


def stamp_geometry_status(rows, geometry_keys):
    """Annotate rows so unjoined districts are explicit, not silently map-less."""
    for row in rows:
        key = row_join_key(row)
        row["key"] = key
        if (row.get("parent"), str(key)) in geometry_keys:
            row["geometry_status"] = "match"
            row["has_geometry"] = True
        else:
            row["geometry_status"] = "no_geometry"
            row["has_geometry"] = False
    return rows
