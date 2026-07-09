"""
Global Forest Watch ADM2 (district) satellite indicators for all matchable Borneo
districts: forest extent (2000), cumulative tree-cover loss, and VIIRS fire alerts.

The safety problem: GFW's summary tables key on GADM admin INTEGERS, but different
GFW datasets pin different GADM versions (the tree-cover table still uses the 3.6
numbering where Kalimantan Timur=15, while our boundary GeoJSON is 4.1 where
Timur=34). Blindly trusting the integer join would misattribute a district's data.

The guard: for each parent we query GFW grouped by adm2, and ONLY emit rows when
the set of adm2 integers GFW returns is IDENTICAL to the set in our GeoJSON for
that parent. When the versions disagree (Kaltim/Kaltara on the tree-cover table),
the sets differ and we skip that parent for that dataset — an honest, logged gap
rather than a wrong number. adm2 -> district name comes from our GeoJSON so the
join is by verified geometry, not by fuzzy string matching.

Exposes build_gfw_districts(key) -> list[row] in the districts.json schema.
"""

import json
from pathlib import Path
from urllib.parse import quote

try:
    from ingest_poc import get_json, get_json_raw
except Exception:  # pragma: no cover
    get_json = get_json_raw = None

from data_model import dashboard_concept, esg_pillar, sdg_goal, hexagon_pillar

ROOT = Path(__file__).parent
GEOJSON = ROOT / "public" / "data" / "borneo_districts.geojson"
API = "https://data-api.globalforestwatch.org/dataset/{ds}"

TCL = "gadm__tcl__adm2_summary"
FIRE = "gadm__viirs__adm2_weekly_alerts"  # weekly table carries alert__year (daily is by date)

# Fallback path for provinces whose adm2 codes disagree between the tree-cover
# summary's GADM version and our 4.1 GeoJSON (Kalimantan Timur/Utara). We fetch
# each district's exact GADM-4.1 geometry as a GFW geostore and run the forest
# analysis on that geometry — version-independent, so it can't misattribute.
BND = "gadm_administrative_boundaries"      # v4.1 → per-district gfw_geostore_id
LOSS_DS = "umd_tree_cover_loss"             # cumulative tree-cover loss (results table)
EXTENT_DS = "umd_tree_cover_density_2000"   # tree-cover extent 2000 (results table)


def _adm2_from_gid2(gid2):
    # "IDN.34.6_1" or "IDN.35.4" -> 6 / 4
    try:
        return int(str(gid2).split(".")[2].split("_")[0])
    except (IndexError, ValueError):
        return None


def _query_geostore(ds, ver, sql, geostore, hdr):
    url = (f"{API.format(ds=ds)}/{ver}/query/json?sql={quote(sql)}"
           f"&geostore_id={geostore}&geostore_origin=rw")
    return get_json_raw(url, headers=hdr, timeout=120)["data"]


def _geo_index():
    """parent -> {iso, adm1, adm2: {adm2_int: (name, code)}} where code is the BPS/
    GADM CC_2 for Indonesia (the cross-source join key), else None for Malaysia."""
    gj = json.loads(GEOJSON.read_text(encoding="utf-8"))
    idx = {}
    for feat in gj["features"]:
        p = feat["properties"]
        if p.get("adm1") is None or p.get("adm2") is None:
            continue
        iso = str(p["gid1"]).split(".")[0]
        code = str(p["cc2"]) if iso == "IDN" and p.get("cc2") not in (None, "NA", "") else None
        entry = idx.setdefault(p["parent"], {"iso": iso, "adm1": p["adm1"], "adm2": {}})
        entry["adm2"][p["adm2"]] = (p["name"], code)
    return idx


def _version(ds, hdr):
    return get_json(API.format(ds=ds) + "/latest", headers=hdr)["data"]["version"]


def _query(ds, ver, sql, hdr):
    url = f"{API.format(ds=ds)}/{ver}/query/json?sql={quote(sql)}"
    return get_json_raw(url, headers=hdr)["data"]


def _emit(rows, name, parent, district, year, value, unit, source):
    district_name, code = district
    rows.append({
        "territory": district_name,
        "parent": parent,
        "code": code,
        "indicator": name,
        "dashboard_concept": dashboard_concept(name),
        "year": str(year),
        "value": round(float(value), 2),
        "unit": unit,
        "source": source,
        "data_level": "district",
        "esg_pillar": esg_pillar(name),
        "sdg_goal": sdg_goal(name),
        "hexagon_pillar": hexagon_pillar(name),
        "confidence": "high",
        "canonical": 1,
    })


def _forest_via_geostore(parent, info, versions, hdr, rows):
    """Version-proof forest fallback: pull each district's GADM-4.1 geostore and run
    the loss/extent analysis on that exact geometry. Used for Kaltim/Kaltara, whose
    adm2 codes disagree between the summary table's GADM version and our 4.1 GeoJSON."""
    iso, adm1, adm2map = info["iso"], info["adm1"], info["adm2"]
    bnd_ver, loss_ver, ext_ver = versions

    sql = (f"SELECT gid_2, gfw_geostore_id FROM data "
           f"WHERE gid_2 LIKE '{iso}.{adm1}.%'")
    url = f"{API.format(ds=BND)}/{bnd_ver}/query/json?sql={quote(sql)}"
    districts = get_json_raw(url, headers=hdr)["data"]

    emitted = 0
    for d in districts:
        adm2 = _adm2_from_gid2(d.get("gid_2"))
        geostore = d.get("gfw_geostore_id")
        if adm2 not in adm2map or not geostore:
            continue
        try:
            loss = _query_geostore(
                LOSS_DS, loss_ver,
                "SELECT SUM(area__ha) AS loss FROM results "
                "WHERE umd_tree_cover_density_2000__threshold >= 30",
                geostore, hdr)
            ext = _query_geostore(
                EXTENT_DS, ext_ver,
                "SELECT SUM(area__ha) AS ext FROM results "
                "WHERE umd_tree_cover_density_2000__threshold >= 30",
                geostore, hdr)
        except Exception as e:
            print(f"  [districts:GFW] {parent}: geostore forest failed for adm2 {adm2}: {e}")
            continue
        ext_ha = ext[0].get("ext") if ext else None
        loss_ha = loss[0].get("loss") if loss else None
        if ext_ha is not None:
            _emit(rows, "Forest extent (2000)", parent, adm2map[adm2], 2000,
                  ext_ha, "ha", "Global Forest Watch (geostore)")
        if loss_ha is not None:
            _emit(rows, "Tree cover loss (cumulative)", parent, adm2map[adm2], "2001-2023",
                  loss_ha, "ha", "Global Forest Watch (geostore)")
        emitted += 1
    print(f"  [districts:GFW] {parent}: forest via geostore for {emitted} districts")


def build_gfw_districts(key):
    if not key:
        print("  [districts:GFW] no GFW_API_KEY — skipped")
        return []
    if get_json is None:
        print("  [districts:GFW] ingest_poc unavailable — skipped")
        return []
    if not GEOJSON.exists():
        print("  [districts:GFW] borneo_districts.geojson missing — run build_geojson.py first")
        return []

    hdr = {"x-api-key": key, "Accept": "*/*"}
    idx = _geo_index()
    rows = []

    try:
        tcl_ver = _version(TCL, hdr)
        fire_ver = _version(FIRE, hdr)
        geostore_versions = ("v4.1", _version(LOSS_DS, hdr), _version(EXTENT_DS, hdr))
    except Exception as e:
        print(f"  [districts:GFW] version lookup failed: {e}")
        return []

    print("  [districts:GFW] pulling ADM2 forest + fire (set-equality guarded)…")
    for parent, info in idx.items():
        iso, adm1, adm2map = info["iso"], info["adm1"], info["adm2"]
        expected = set(adm2map)

        # --- Forest extent + tree-cover loss ---
        try:
            sql = ("SELECT adm2, SUM(umd_tree_cover_extent_2000__ha) AS ext, "
                   "SUM(umd_tree_cover_loss__ha) AS loss FROM data "
                   f"WHERE iso='{iso}' AND adm1={adm1} "
                   "AND umd_tree_cover_density_2000__threshold=30 GROUP BY adm2")
            data = _query(TCL, tcl_ver, sql, hdr)
            got = {r["adm2"] for r in data}
            if data and got == expected:
                for r in data:
                    dname = adm2map[r["adm2"]]
                    if r.get("ext") is not None:
                        _emit(rows, "Forest extent (2000)", parent, dname, 2000,
                              r["ext"], "ha", "Global Forest Watch")
                    if r.get("loss") is not None:
                        _emit(rows, "Tree cover loss (cumulative)", parent, dname, "2001-2023",
                              r["loss"], "ha", "Global Forest Watch")
            else:
                # adm2 codes disagree with our 4.1 GeoJSON — fall back to the
                # geometry-based geostore analysis (version-proof).
                print(f"  [districts:GFW] {parent}: forest adm2 set mismatch "
                      f"(GFW {len(got)} vs GeoJSON {len(expected)}) — using geostore fallback")
                _forest_via_geostore(parent, info, geostore_versions, hdr, rows)
        except Exception as e:
            print(f"  [districts:GFW] {parent}: forest query failed: {e}")

        # --- VIIRS fire alerts (latest year with data) ---
        # The fire table is GADM 4.1 (same as our GeoJSON), so a returned adm2 that
        # is within `expected` IS that district. Per-year data is naturally partial
        # (districts with no alerts have no row), so the guard is subset, not equality —
        # but a wrong-version code would fall OUTSIDE `expected`, so `got <= expected`
        # still rejects a version mismatch. Newest year with any data wins.
        try:
            emitted_fire = False
            for yr in (2025, 2024, 2023):
                sql = ("SELECT adm2, SUM(alert__count) AS n FROM data "
                       f"WHERE iso='{iso}' AND adm1={adm1} AND alert__year={yr} GROUP BY adm2")
                data = _query(FIRE, fire_ver, sql, hdr)
                got = {r["adm2"] for r in data if r.get("n")}
                if got and got <= expected:
                    for r in data:
                        if r.get("n"):
                            _emit(rows, "Fire alerts (VIIRS, annual)", parent, adm2map[r["adm2"]],
                                  yr, r["n"], "count", "Global Forest Watch (VIIRS)")
                    emitted_fire = True
                    break
            if not emitted_fire:
                print(f"  [districts:GFW] {parent}: no matchable fire alerts — skipped")
        except Exception as e:
            print(f"  [districts:GFW] {parent}: fire query failed: {e}")

    print(f"  [districts:GFW] {len(rows)} satellite district rows")
    return rows


if __name__ == "__main__":
    from ingest_districts import load_env
    out = build_gfw_districts(load_env().get("GFW_API_KEY"))
    from collections import Counter
    print("by indicator:", dict(Counter(r["indicator"] for r in out)))
    print("by parent:", dict(Counter(r["parent"] for r in out)))
    print("sample:", json.dumps(out[:3], indent=2))
