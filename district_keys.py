"""Shared district join-key rules for district rows and ADM2 geometry.

The dashboard joins ``districts.json`` rows to ``borneo_districts.geojson`` by
``(parent, key)``. Keep every data builder on these rules so geometry coverage is
auditable instead of repaired in the UI.
"""

import json
import math
import re

INDONESIA_NAME_JOIN_PARENTS = {"Kalimantan Utara"}

SABAH_GEOMETRY_ALIASES = {
    "kotabelud": "belud",
    "kotakinabalu": "kinabalu",
    "kotamarudu": "marudu",
}


def normalize_name_key(name):
    return re.sub(r"[^a-z0-9]", "", str(name or "").lower())


def district_identity(parent, key):
    """Return the canonical, parent-scoped identity used by data and geometry.

    A district key is not globally unique: consumers must always use this pair
    rather than a bare key.  Keeping the coercion here also means JSON numbers
    from a source cannot silently diverge from the string keys in GeoJSON.
    """
    return (str(parent or "").strip(), str(key or "").strip())


def usable_polygon_geometry(geometry):
    """Return ``(ok, reason)`` for a renderable GeoJSON Polygon/MultiPolygon.

    A feature with a key but null/empty/invalid coordinates is not a map boundary.
    Treating it as one makes the coverage metadata lie and can leave users with a
    selectable district that has nothing to render.
    """
    if not isinstance(geometry, dict):
        return False, "geometry is missing or not an object"
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if geometry_type not in {"Polygon", "MultiPolygon"}:
        return False, f"geometry type {geometry_type!r} is not Polygon/MultiPolygon"
    if not isinstance(coordinates, list) or not coordinates:
        return False, "geometry coordinates are empty"

    def position_is_valid(position):
        return (
            isinstance(position, (list, tuple))
            and len(position) >= 2
            and all(
                isinstance(value, (int, float))
                and not isinstance(value, bool)
                and math.isfinite(value)
                for value in position[:2]
            )
        )

    def ring_is_valid(ring):
        return (
            isinstance(ring, list)
            and len(ring) >= 4
            and all(position_is_valid(position) for position in ring)
            and ring[0][:2] == ring[-1][:2]
        )

    def polygon_is_valid(polygon):
        return isinstance(polygon, list) and bool(polygon) and all(ring_is_valid(ring) for ring in polygon)

    polygons = [coordinates] if geometry_type == "Polygon" else coordinates
    if not all(polygon_is_valid(polygon) for polygon in polygons):
        return False, "geometry coordinates do not contain closed, non-empty polygon rings"
    return True, ""


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
        district_identity(
            feature.get("properties", {}).get("parent"),
            feature.get("properties", {}).get("key"),
        )
        for feature in data.get("features", [])
        if feature.get("properties", {}).get("parent") and feature.get("properties", {}).get("key")
    }


def stamp_geometry_status(rows, geometry_keys):
    """Annotate rows so unjoined districts are explicit, not silently map-less."""
    for row in rows:
        key = str(row_join_key(row))
        row["key"] = key
        if district_identity(row.get("parent"), key) in geometry_keys:
            row["geometry_status"] = "match"
            row["has_geometry"] = True
        else:
            row["geometry_status"] = "no_geometry"
            row["has_geometry"] = False
    return rows
