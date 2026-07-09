"""
Kalimantan kabupaten/kota (ADM2) indicators from BPS Indonesia.

Reuses the verified per-province var-id map from ingest_poc, but iterates EVERY
region (vervar) in each table instead of only the province total — so any BPS
table published "menurut kabupaten/kota" expands into one row per regency. Tables
that only carry a province total yield nothing here (returned as []), so we never
fabricate a district breakdown that BPS didn't publish.

Exposes build_bps_districts(key) -> list[row] in the districts.json schema, with
`territory` = kabupaten/kota name and `parent` = province.
"""

import time

try:
    from ingest_poc import bps_get, BPS_VAR_MAP, BPS_PROV
except Exception:  # pragma: no cover - ingest_poc must be importable
    bps_get, BPS_VAR_MAP, BPS_PROV = None, {}, {}

from data_model import dashboard_concept, esg_pillar, sdg_goal, hexagon_pillar

# Indicator -> unit. Only indicators BPS publishes with a kabupaten/kota breakdown
# will actually produce rows; the rest simply don't expand.
UNITS = {
    "Poverty rate (P0)": "%",
    "GDP growth (PDRB)": "%",
    "Mean years schooling (RLS)": "years",
    "Life expectancy": "years",
    "Unemployment rate": "%",
}

# BPS year code -> calendar year (th 124 -> 2024, 125 -> 2025).
def _cal_year(th):
    return 1900 + int(th)


def _is_province_total(label, province):
    ll = label.lower()
    p = province.lower()
    return ll == p or p in ll or ll.startswith("prov") or "kalimantan" in ll


def bps_kabupaten_values(domain, var, key):
    """Return [(kabupaten_label, year, value)] for a variable, newest year per
    region. Empty if the table has no sub-province (kabupaten) breakdown."""
    province = BPS_PROV[domain]
    for thpair in ("125;124", "123;122", "121;120", "119;118", "117;116"):
        url = (f"https://webapi.bps.go.id/v1/api/list/model/data/domain/{domain}"
               f"/var/{var}/th/{thpair}/key/{key}/")
        d = bps_get(url)
        if not isinstance(d, dict) or d.get("status") != "OK" or not d.get("tahun"):
            continue
        vervars = {v["val"]: v["label"].strip() for v in d.get("vervar", [])}
        # < 3 regions means province-total only (no kabupaten breakdown).
        if len(vervars) < 3:
            return []
        dc = d.get("datacontent", {})
        years = sorted((t["val"] for t in d.get("tahun", [])), reverse=True)
        out = []
        for val, label in vervars.items():
            if _is_province_total(label, province):
                continue
            for th in years:
                k = f"{val}{var}0{th}0"
                if k not in dc:
                    pref = f"{val}{var}"
                    k = next((kk for kk in dc
                              if kk.startswith(pref) and str(th) in kk[len(pref):]), None)
                if k and k in dc and dc[k] not in (None, ""):
                    # `val` is the BPS region code (== GADM CC_2) — the unambiguous
                    # cross-source join key for Indonesian districts.
                    out.append((label, str(val), _cal_year(th), dc[k]))
                    break
        return out
    return []


def build_bps_districts(key):
    if not key:
        print("  [districts:BPS] no BPS_API_KEY — skipped")
        return []
    if bps_get is None:
        print("  [districts:BPS] ingest_poc unavailable — skipped")
        return []

    rows = []
    print("  [districts:BPS] pulling Kalimantan kabupaten/kota…")
    for domain, province in BPS_PROV.items():
        var_map = BPS_VAR_MAP.get(domain, {})
        for indicator, unit in UNITS.items():
            var = var_map.get(indicator)
            if not var:
                continue
            values = bps_kabupaten_values(domain, var, key)
            for label, code, year, value in values:
                try:
                    numeric = float(value)
                except (TypeError, ValueError):
                    continue
                rows.append({
                    "territory": label,
                    "parent": province,
                    "code": code,
                    "indicator": indicator,
                    "dashboard_concept": dashboard_concept(indicator),
                    "year": str(year),
                    "value": round(numeric, 4),
                    "unit": unit,
                    "source": f"BPS Indonesia ({province}, by kabupaten/kota)",
                    "data_level": "district",
                    "esg_pillar": esg_pillar(indicator),
                    "sdg_goal": sdg_goal(indicator),
                    "hexagon_pillar": hexagon_pillar(indicator),
                    "confidence": "high",
                    "canonical": 1,
                })
            time.sleep(0.2)  # ease BPS rate-limiting between vars
    print(f"  [districts:BPS] {len(rows)} kabupaten rows")
    return rows


if __name__ == "__main__":
    from ingest_districts import load_env
    import json
    out = build_bps_districts(load_env().get("BPS_API_KEY"))
    print(json.dumps(out[:8], indent=2, ensure_ascii=False))
    print("parents:", sorted({r["parent"] for r in out}))
    print("sample districts:", sorted({r["territory"] for r in out})[:15])
