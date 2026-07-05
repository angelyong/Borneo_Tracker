"""
Borneo Tracker — historical trend series ingestion (wave 1).

Pulls REAL multi-year series for the trend-MVP indicators and writes
borneo_tracker_history.csv (one row per territory + indicator + year).
The snapshot pipeline (ingest_poc.py -> borneo_tracker_poc.csv) is untouched;
this file only feeds the indicator_observations table in load_db.py.

Wave-1 series and sources (same APIs as the snapshot layer):
  - Clean water access      Sabah/Sarawak: data.gov.my   Brunei/Kalimantan: World Bank
  - Unemployment rate       Sabah/Sarawak: data.gov.my (annual avg of quarters)
                            Brunei/Kalimantan: World Bank
  - GDP growth              Sabah/Sarawak: data.gov.my   Brunei/Kalimantan: World Bank
  - Poverty rate            Sabah/Sarawak: data.gov.my   Kalimantan: World Bank (IDN)
  - Life expectancy         Brunei: World Bank           others: country value inherited
  - Fire alerts (VIIRS)     all territories: GFW, per alert year
  - Tree cover loss         all territories: GFW, per loss year (true annual, not cumulative)

Integrity rules: no interpolation, no fabricated points. Country-level series
inherited by a territory are labelled data_level=national / confidence=medium,
the same convention as the snapshot layer (governance, renewable).

Run:  python ingest_history.py     (needs .env / env vars for the GFW pull)
"""

import csv
import datetime
import time
from urllib.parse import quote

from ingest_poc import (
    GFW_TERR,
    ROOT,
    get_json,
    get_json_raw,
    load_env,
)

OUT_CSV = ROOT / "borneo_tracker_history.csv"
TODAY = datetime.date.today().isoformat()
MIN_YEAR = 2000

FIELDNAMES = [
    "territory", "indicator", "dashboard_concept", "year", "value", "unit",
    "source", "data_level", "confidence", "retrieved_date",
]


def add(rows, territory, indicator, concept, year, value, unit, source, data_level, confidence):
    rows.append({
        "territory": territory,
        "indicator": indicator,
        "dashboard_concept": concept,
        "year": str(year),
        "value": value,
        "unit": unit,
        "source": source,
        "data_level": data_level,
        "confidence": confidence,
        "retrieved_date": TODAY,
    })


# ---------------------------------------------------------------- data.gov.my
def pull_datagovmy_history(rows):
    """Sabah & Sarawak state-level annual series (keyless). Same datasets as the
    snapshot layer; instead of picking the latest record we keep every year."""
    states = ("Sabah", "Sarawak")

    def yearly(recs, field, pred=lambda r: True):
        """{year: value} taking the latest record within each year."""
        out = {}
        for r in sorted((x for x in recs if pred(x) and x.get(field) is not None),
                        key=lambda x: x["date"]):
            out[r["date"][:4]] = r[field]
        return out

    def yearly_mean(recs, field, pred=lambda r: True):
        """{year: mean of records in that year} — for quarterly series."""
        buckets = {}
        for r in (x for x in recs if pred(x) and x.get(field) is not None):
            buckets.setdefault(r["date"][:4], []).append(r[field])
        return {y: round(sum(vals) / len(vals), 2) for y, vals in buckets.items()}

    specs = [
        ("water_access", "Clean water access", "clean_water_access", "%",
         lambda recs: yearly(recs, "proportion", lambda x: x.get("strata") == "overall"),
         "data.gov.my / OpenDOSM"),
        ("lfs_qtr_state", "Unemployment rate", "unemployment_rate", "%",
         lambda recs: yearly_mean(recs, "u_rate"),
         "data.gov.my / OpenDOSM (annual avg of quarters)"),
        ("gdp_state_real_supply", "GDP growth", "economy", "%",
         lambda recs: yearly(recs, "value",
                             lambda x: x.get("sector") == "p0" and x.get("series") == "growth_yoy"),
         "data.gov.my / OpenDOSM"),
        ("hh_poverty_state", "Poverty rate (absolute)", "poverty", "%",
         lambda recs: yearly(recs, "poverty_absolute"),
         "data.gov.my / OpenDOSM"),
    ]
    for index, (ds, indicator, concept, unit, extract, source) in enumerate(specs):
        if index:
            time.sleep(16)  # official limit is 4 requests/minute (429 otherwise)
        try:
            data = get_json(f"https://api.data.gov.my/data-catalogue/?id={ds}&limit=20000")
        except Exception as e:
            print(f"  [history:data.gov.my:{ds}] FAILED: {e}")
            continue
        for state in states:
            series = extract([r for r in data if r.get("state") == state])
            for year, value in sorted(series.items()):
                if int(year) >= MIN_YEAR:
                    add(rows, state, indicator, concept, year, value, unit,
                        source, "state", "high")
            print(f"  [history] {state} | {indicator}: {len(series)} years")


# ---------------------------------------------------------------- World Bank
# (iso3, territory, data_level, confidence): direct country rows are high;
# a country value inherited by a sub-national territory is medium.
WB_TARGETS = {
    "BRN": [("Brunei", "national", "high")],
    "IDN": [("Kalimantan", "national", "medium")],
    "MYS": [],  # Sabah/Sarawak get state series from data.gov.my instead
}

WB_SERIES = [
    ("SL.UEM.TOTL.ZS", "Unemployment rate", "unemployment_rate", "%"),
    ("NY.GDP.MKTP.KD.ZG", "GDP growth", "economy", "%"),
    ("SH.H2O.BASW.ZS", "Clean water access", "clean_water_access", "%"),
    ("SP.DYN.LE00.IN", "Life expectancy", "healthcare", "years"),
]

WB_EXTRA = {
    # Poverty: national poverty line headcount — only meaningful for IDN here
    # (Brunei publishes no poverty series).
    "IDN": [("SI.POV.NAHC", "Poverty rate (national line)", "poverty", "%")],
}


def _wb_series(url, label, retries=3):
    """World Bank API with retry/backoff — the API intermittently times out or
    502s under load. Returns the non-null series list, or None after all retries."""
    for attempt in range(retries):
        try:
            payload = get_json(url, timeout=90)
            return [x for x in (payload[1] or []) if x.get("value") is not None]
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
            else:
                print(f"  [history:WB:{label}] FAILED after {retries} tries: {e}")
    return None


def pull_worldbank_history(rows):
    """Full annual series per country (keyless). One call returns all years."""
    for iso, targets in WB_TARGETS.items():
        series_list = WB_SERIES + WB_EXTRA.get(iso, [])
        if not targets:
            continue
        for code, indicator, concept, unit in series_list:
            url = (f"https://api.worldbank.org/v2/country/{iso.lower()}/indicator/{code}"
                   f"?format=json&per_page=200&date={MIN_YEAR}:2030")
            series = _wb_series(url, f"{iso}:{code}")
            if series is None:
                continue
            for rec in sorted(series, key=lambda x: x["date"]):
                for territory, data_level, confidence in targets:
                    add(rows, territory, indicator, concept, rec["date"],
                        round(rec["value"], 2), unit, "World Bank", data_level, confidence)
            print(f"  [history] {iso} | {indicator}: {len(series)} years")

    # Life expectancy for Sabah/Sarawak: no comparable state-level annual series in
    # the open APIs, so inherit the Malaysia national series (labelled medium) —
    # the same inheritance convention the snapshot layer uses for governance.
    url = (f"https://api.worldbank.org/v2/country/mys/indicator/SP.DYN.LE00.IN"
           f"?format=json&per_page=200&date={MIN_YEAR}:2030")
    series = _wb_series(url, "MYS:SP.DYN.LE00.IN")
    if series is not None:
        for rec in sorted(series, key=lambda x: x["date"]):
            for state in ("Sabah", "Sarawak"):
                add(rows, state, "Life expectancy", "healthcare", rec["date"],
                    round(rec["value"], 2), "years", "World Bank", "national", "medium")
        print(f"  [history] MYS->Sabah/Sarawak | Life expectancy: {len(series)} years")


# ---------------------------------------------------------------- GFW (yearly)
KALIMANTAN_PROVINCES = {t for t, iso, adm1, lvl in GFW_TERR if iso == "IDN"}

# Kalimantan Timur (adm1=15) has NO rows in GFW's gadm__viirs / gadm__tcl__*_change
# tables (verified 2026-07: codes 1-35 all present EXCEPT 15, at adm1 and adm2 level).
# Workaround: the geostore endpoint's GADM 3.6 boundary for IDN/15 is the PRE-2012
# East Kalimantan (19.7M ha = modern Kaltim + Kaltara; fingerprint-verified: its
# on-the-fly 2001-2023 loss of 3.787M ha matches summary-table Kaltim+Kaltara
# 3.780M ha to 0.2%). So the full-coverage formula is:
#   Kalimantan = table(Kalbar 12 + Kalsel 13 + Kalteng 14) + on-the-fly(old Kaltim)
# — every province counted exactly once (table's 16 = Kaltara is INSIDE old Kaltim,
# so it must be EXCLUDED when the on-the-fly result is used).
OLD_KALTIM_ADMIN = ("IDN", 15)  # geostore GADM 3.6 = East Kalimantan incl. North
KALTARA_ADM1 = 16               # in the data tables, 16 = Kalimantan Utara


def _old_kaltim_geostore(hdr):
    """Resolve the old-East-Kalimantan geostore hash, with a name sanity check."""
    iso, adm1 = OLD_KALTIM_ADMIN
    try:
        attrs = get_json(
            f"https://data-api.globalforestwatch.org/geostore/admin/{iso}/{adm1}",
            headers=hdr)["data"]["attributes"]
        if attrs["info"]["name"] != "Kalimantan Timur":
            raise RuntimeError(f"geostore {iso}/{adm1} is {attrs['info']['name']}, not Kalimantan Timur")
        return attrs["hash"]
    except Exception as e:
        print(f"  [history:GFW] old-Kaltim geostore unavailable ({e}) — falling back to 4/5 provinces")
        return None


def _otf_kaltim_tcl(hdr, geostore):
    """On-the-fly yearly tree cover loss for the old-Kaltim geometry ({year: ha})."""
    base = "https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss"
    try:
        version = get_json(base + "/latest", headers=hdr)["data"]["version"]
        sql = ("SELECT umd_tree_cover_loss__year AS year, SUM(area__ha) AS n FROM results "
               "WHERE umd_tree_cover_density_2000__threshold >= 30 "
               "GROUP BY umd_tree_cover_loss__year")
        url = f"{base}/{version}/query/json?sql={quote(sql)}&geostore_id={geostore}&geostore_origin=rw"
        data = get_json_raw(url, headers=hdr, timeout=120)["data"]
        return {int(r["year"]): r["n"] for r in data if r.get("year") is not None and r.get("n") is not None}
    except Exception as e:
        print(f"  [history:GFW] on-the-fly Kaltim tree loss FAILED: {e}")
        return {}


def _otf_kaltim_fire(hdr, geostore, years):
    """On-the-fly yearly VIIRS alert counts for the old-Kaltim geometry.
    Returns ({year: count}, last_complete_year). The alert dataset version string
    (vYYYYMMDD) tells us how fresh it is — its version year is incomplete."""
    base = "https://data-api.globalforestwatch.org/dataset/nasa_viirs_fire_alerts"
    try:
        version = get_json(base + "/latest", headers=hdr)["data"]["version"]
        last_complete = int(version[1:5]) - 1  # e.g. v20240815 -> complete through 2023
    except Exception as e:
        print(f"  [history:GFW] VIIRS OTF version lookup FAILED: {e}")
        return {}, None
    out = {}
    for year in sorted(y for y in years if y <= last_complete):
        sql = (f"SELECT COUNT(*) AS n FROM results "
               f"WHERE alert__date >= '{year}-01-01' AND alert__date <= '{year}-12-31'")
        url = f"{base}/{version}/query/json?sql={quote(sql)}&geostore_id={geostore}&geostore_origin=rw"
        try:
            out[year] = get_json_raw(url, headers=hdr, timeout=120)["data"][0]["n"]
        except Exception as e:
            print(f"  [history:GFW] on-the-fly Kaltim fire {year} FAILED: {e}")
            return {}, last_complete  # partial OTF would understate — all or nothing
    return out, last_complete


def _gfw_yearly(url_builder, hdr, label):
    """Run a GROUP BY year GFW query; return {year: value} or {} on failure."""
    try:
        data = get_json_raw(url_builder, headers=hdr)["data"]
    except Exception as e:
        print(f"  [history:GFW:{label}] FAILED: {e}")
        return {}
    out = {}
    for rec in data:
        year, value = rec.get("year"), rec.get("n")
        if year is not None and value is not None:
            out[int(year)] = out.get(int(year), 0) + value
    return out


def pull_gfw_history(rows, key):
    """Fire alerts and tree cover loss, per territory per year. Kalimantan is the
    sum of its provinces per year (fire: 4/5 provinces — Kaltim is unmapped in the
    VIIRS table, same known limitation as the snapshot layer)."""
    if not key:
        print("  [history:GFW] no GFW_API_KEY — skipped")
        return
    hdr = {"x-api-key": key, "Accept": "*/*"}
    base = "https://data-api.globalforestwatch.org/dataset/{}"

    def latest_version(dataset):
        return get_json(base.format(dataset) + "/latest", headers=hdr)["data"]["version"]

    # --- Fire alerts (VIIRS weekly alert tables, grouped by alert year) ---
    try:
        va = latest_version("gadm__viirs__adm1_weekly_alerts")
        vi = latest_version("gadm__viirs__iso_weekly_alerts")
    except Exception as e:
        print(f"  [history:GFW-fire] version lookup failed: {e}")
        va = vi = None
    if va and vi:
        core3_fire = {}      # Kalbar(12) + Kalsel(13) + Kalteng(14)
        kaltara_fire = {}    # table adm1=16 — used only in the 4/5 fallback
        for terr, iso, adm1, lvl in GFW_TERR:
            if adm1 is None:
                ds, ver, where = "gadm__viirs__iso_weekly_alerts", vi, f"iso='{iso}'"
            else:
                ds, ver, where = "gadm__viirs__adm1_weekly_alerts", va, f"iso='{iso}' AND adm1={adm1}"
            sql = ("SELECT alert__year AS year, SUM(alert__count) AS n FROM data "
                   f"WHERE {where} GROUP BY alert__year")
            url = f"{base.format(ds)}/{ver}/query/json?sql={quote(sql)}"
            series = _gfw_yearly(url, hdr, f"fire:{terr}")
            if terr in KALIMANTAN_PROVINCES:
                target = kaltara_fire if adm1 == KALTARA_ADM1 else core3_fire
                for year, value in series.items():
                    target[year] = target.get(year, 0) + value
            else:
                for year, value in sorted(series.items()):
                    add(rows, terr, "Fire alerts (VIIRS, annual)", "fire_hotspots",
                        year, int(value), "count", "Global Forest Watch (VIIRS)",
                        "satellite", "high")
            print(f"  [history] {terr} | fire alerts: {len(series)} years")

        geostore = _old_kaltim_geostore(hdr)
        otf_fire, _ = _otf_kaltim_fire(hdr, geostore, core3_fire.keys()) if geostore else ({}, None)
        if otf_fire:
            # Full coverage: 3 core provinces (table) + old East Kalimantan incl.
            # North (on-the-fly). Limited to years the OTF dataset fully covers.
            kalimantan_fire = {y: core3_fire[y] + otf_fire[y] for y in core3_fire if y in otf_fire}
            fire_label = "Global Forest Watch (VIIRS), sum of 5/5 provinces (E+N Kalimantan via satellite geometry)"
            fire_confidence = "high"
            print(f"  [history] Kalimantan | fire alerts 5/5 for {len(kalimantan_fire)} years (OTF-capped)")
        else:
            kalimantan_fire = dict(core3_fire)
            for year, value in kaltara_fire.items():
                kalimantan_fire[year] = kalimantan_fire.get(year, 0) + value
            fire_label = "Global Forest Watch (VIIRS), sum of 4/5 provinces (Kaltim missing from GFW tables)"
            fire_confidence = "medium"
        for year, value in sorted(kalimantan_fire.items()):
            add(rows, "Kalimantan", "Fire alerts (VIIRS, annual)", "fire_hotspots",
                year, int(value), "count", fire_label, "satellite", fire_confidence)

    # --- Tree cover loss per year (true annual loss, threshold=30) ---
    # NOTE: the *_summary tables aggregate across years (no year column); the
    # *_change tables carry umd_tree_cover_loss__year — that is the annual series.
    tcl = "gadm__tcl__{}_change"
    ver = {}
    for scope in ("iso", "adm1"):
        try:
            ver[scope] = latest_version(tcl.format(scope))
        except Exception as e:
            print(f"  [history:GFW-tcl] version lookup failed for {scope}: {e}")
            return
    core3_loss = {}
    kaltara_loss = {}
    for terr, iso, adm1, lvl in GFW_TERR:
        scope = "iso" if adm1 is None else "adm1"
        where = f"iso='{iso}' AND umd_tree_cover_density_2000__threshold=30"
        if adm1 is not None:
            where += f" AND adm1={adm1}"
        sql = ("SELECT umd_tree_cover_loss__year AS year, "
               "SUM(umd_tree_cover_loss__ha) AS n FROM data "
               f"WHERE {where} GROUP BY umd_tree_cover_loss__year")
        url = f"{base.format(tcl.format(scope))}/{ver[scope]}/query/json?sql={quote(sql)}"
        series = _gfw_yearly(url, hdr, f"tcl:{terr}")
        series.pop(None, None)
        if terr in KALIMANTAN_PROVINCES:
            target = kaltara_loss if adm1 == KALTARA_ADM1 else core3_loss
            for year, value in series.items():
                target[year] = target.get(year, 0) + value
        else:
            for year, value in sorted(series.items()):
                add(rows, terr, "Tree cover loss (annual)", "deforestation",
                    year, round(value), "ha", "Global Forest Watch", "satellite", "high")
        print(f"  [history] {terr} | tree cover loss: {len(series)} years")

    geostore = _old_kaltim_geostore(hdr)
    otf_loss = _otf_kaltim_tcl(hdr, geostore) if geostore else {}
    if otf_loss:
        # Cap at years present in the table series — the OTF raster can expose a
        # newer (partial) loss year than the published change tables.
        kalimantan_loss = {y: core3_loss[y] + otf_loss[y] for y in core3_loss if y in otf_loss}
        loss_label = "Global Forest Watch, sum of 5/5 provinces (E+N Kalimantan via satellite geometry)"
        loss_confidence = "high"
        print(f"  [history] Kalimantan | tree cover loss 5/5 for {len(kalimantan_loss)} years")
    else:
        kalimantan_loss = dict(core3_loss)
        for year, value in kaltara_loss.items():
            kalimantan_loss[year] = kalimantan_loss.get(year, 0) + value
        loss_label = "Global Forest Watch, sum of 4/5 provinces (Kaltim missing from GFW tables)"
        loss_confidence = "medium"
    for year, value in sorted(kalimantan_loss.items()):
        add(rows, "Kalimantan", "Tree cover loss (annual)", "deforestation",
            year, round(value), "ha", loss_label, "satellite", loss_confidence)


# ---------------------------------------------------------------- main
def validate(rows):
    if not rows:
        raise RuntimeError("No historical rows were collected — refusing to write an empty CSV.")
    bad = [r for r in rows
           if not r["territory"] or not r["indicator"] or not str(r["year"]).isdigit()
           or r["value"] is None]
    if bad:
        raise RuntimeError(f"{len(bad)} invalid history rows (missing key fields), e.g. {bad[0]}")
    seen = set()
    for r in rows:
        k = (r["territory"], r["indicator"], r["year"])
        if k in seen:
            raise RuntimeError(f"Duplicate history row: {k}")
        seen.add(k)


def main():
    env = load_env()
    rows = []
    print(">>> [history 1/3] data.gov.my annual series")
    pull_datagovmy_history(rows)
    print(">>> [history 2/3] World Bank annual series")
    pull_worldbank_history(rows)
    print(">>> [history 3/3] GFW yearly fire + tree cover loss")
    pull_gfw_history(rows, env.get("GFW_API_KEY"))
    validate(rows)
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    territories = sorted({r["territory"] for r in rows})
    indicators = sorted({r["indicator"] for r in rows})
    print(f"Wrote {len(rows)} observation rows -> {OUT_CSV.name}")
    print(f"  territories: {', '.join(territories)}")
    print(f"  indicators:  {', '.join(indicators)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"ERROR: {error}")
        raise SystemExit(1)
