"""
Borneo Tracker — POC ingestion script.

Pulls REAL data from 4 verified sources across the 3 geographic levels and
writes one standard-schema CSV. Purpose: prove the data pipeline + schema work
end-to-end before building the DB/backend.

Standard schema (single source of truth for the app):
    territory | indicator | year | value | unit | source | data_level

Sources & geo levels exercised:
    data.gov.my / OpenDOSM  -> Sabah, Sarawak        (data_level = state)     keyless
    World Bank              -> Brunei                 (data_level = national)  keyless
    BPS Indonesia          -> 5 Kalimantan provinces (data_level = province)  key + User-Agent
    NASA FIRMS             -> whole Borneo bbox       (data_level = satellite) key

Stdlib only (urllib/json/csv) so it runs with a bare Python 3 — no pip install.
Keys are read from .env (never hard-coded).
"""

import csv
import json
import os
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).parent
OUT_CSV = ROOT / "borneo_tracker_poc.csv"
UA = "Mozilla/5.0 (Borneo-Tracker-POC)"  # BPS firewall blocks bare clients


# ---------------------------------------------------------------- helpers
def load_env(path=ROOT / ".env"):
    env = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def get_json(url, headers=None, timeout=40):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def get_text(url, headers=None, timeout=40):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def year_of(date_str):
    return str(date_str)[:4]


# ---------------------------------------------------------------- sources
def pull_datagovmy(rows):
    """Sabah & Sarawak — state level (keyless). Latest record per state."""
    states = ("Sabah", "Sarawak")
    pulls = [
        # (dataset_id, value_field, indicator, unit, row_filter)
        ("water_access", "proportion", "Clean water access", "%",
         lambda r: r.get("strata") == "overall"),
        ("lfs_qtr_state", "u_rate", "Unemployment rate", "%", lambda r: True),
    ]
    for ds, field, indicator, unit, keep in pulls:
        try:
            data = get_json(f"https://api.data.gov.my/data-catalogue/?id={ds}")
        except Exception as e:
            print(f"  [data.gov.my:{ds}] FAILED: {e}")
            continue
        for state in states:
            recs = [r for r in data if r.get("state") == state and keep(r)
                    and r.get(field) is not None]
            if not recs:
                print(f"  [data.gov.my:{ds}] no rows for {state}")
                continue
            latest = max(recs, key=lambda r: r["date"])
            rows.append({
                "territory": state, "indicator": indicator,
                "year": year_of(latest["date"]), "value": latest[field],
                "unit": unit, "source": "data.gov.my / OpenDOSM",
                "data_level": "state",
            })
            print(f"  [OK] {state} {indicator} = {latest[field]}{unit} ({year_of(latest['date'])})")


def pull_worldbank(rows):
    """Brunei — national level (keyless). Most-recent value per indicator."""
    pulls = [
        ("SH.H2O.BASW.ZS", "Clean water access", "%"),
        ("SL.UEM.TOTL.ZS", "Unemployment rate", "%"),
        ("NY.GDP.MKTP.KD.ZG", "GDP growth", "%"),
    ]
    for code, indicator, unit in pulls:
        # mrv=5 (most-recent values) is reliable; mrnev is flaky. Pick latest non-null.
        url = (f"https://api.worldbank.org/v2/country/brn/indicator/{code}"
               f"?format=json&mrv=5")
        try:
            payload = get_json(url)
            series = [x for x in (payload[1] or []) if x.get("value") is not None]
            rec = max(series, key=lambda x: x["date"])
        except Exception as e:
            print(f"  [WorldBank:{code}] FAILED: {e}")
            continue
        rows.append({
            "territory": "Brunei", "indicator": indicator,
            "year": rec["date"], "value": rec["value"], "unit": unit,
            "source": "World Bank", "data_level": "national",
        })
        print(f"  [OK] Brunei {indicator} = {rec['value']}{unit} ({rec['date']})")


def bps_find_var(domain, key, predicate):
    """BPS var IDs are PER-DOMAIN, so discover the matching var id by scanning the
    domain's variable list (paged). Returns the first var_id whose title matches."""
    page = 1
    while True:
        url = (f"https://webapi.bps.go.id/v1/api/list/model/var/lang/ind"
               f"/domain/{domain}/page/{page}/key/{key}/")
        try:
            d = get_json(url, headers={"User-Agent": UA})
        except Exception:
            return None
        if not isinstance(d, dict) or d.get("status") != "OK":
            return None
        meta = d["data"][0]
        for r in d["data"][1]:
            if predicate(r.get("title", "")):
                return r.get("var_id")
        if page >= meta.get("pages", page):
            return None
        page += 1


def pull_bps(rows, key):
    """Kalimantan 5 provinces — province level (key + User-Agent).
    Unemployment rate (TPT). Var id discovered per-domain (they differ!)."""
    if not key:
        print("  [BPS] no BPS_API_KEY — skipped")
        return
    provinces = {
        6100: "Kalimantan Barat", 6200: "Kalimantan Tengah",
        6300: "Kalimantan Selatan", 6400: "Kalimantan Timur",
        6500: "Kalimantan Utara",
    }
    # Each province phrases the TPT variable differently ("Menurut Kabupaten/Kota",
    # "Menurut Kab/Kota", "Provinsi Kalimantan Selatan"...). Match the headline
    # annual TPT and exclude the disaggregated / combined variants.
    def is_tpt(t):
        t = t.lower()
        if "tingkat pengangguran terbuka" not in t:
            return False
        bad = ["termasuk", "kelompok umur", "jenis kelamin", "usia kerja",
               "triwulan", "partisipasi", "2018="]
        return not any(b in t for b in bad)

    for domain, pname in provinces.items():
        VAR = bps_find_var(domain, key, is_tpt)
        if VAR is None:
            print(f"  [BPS:{pname}] TPT variable not found")
            continue
        url = (f"https://webapi.bps.go.id/v1/api/list/model/data/domain/{domain}"
               f"/var/{VAR}/th/124;125/key/{key}/")
        try:
            d = get_json(url, headers={"User-Agent": UA})
        except Exception as e:
            print(f"  [BPS:{pname}] FAILED: {e}")
            continue
        if not isinstance(d, dict) or d.get("status") != "OK":
            print(f"  [BPS:{pname}] {d.get('message', d.get('status'))}")
            continue
        # province-total region: prefer vervar == domain+99, else label-match the
        # province name, else the single/last region (province-level vars list one).
        vervars = {v["val"]: v["label"] for v in d.get("vervar", [])}
        prov_val = domain + 99
        if prov_val not in vervars:
            prov_val = next((v for v, lbl in vervars.items()
                             if pname.lower() in lbl.lower()), None)
        if prov_val is None and vervars:
            prov_val = max(vervars)  # province total is usually the highest code
        years = sorted((t["val"] for t in d.get("tahun", [])), reverse=True)
        dc = d.get("datacontent", {})
        got = False
        for th in years:
            # key = vervar+var+turvar+tahun+turtahun; annual data uses 0/0, but
            # fall back to scanning for the year if turvar/turtahun differ.
            k = f"{prov_val}{VAR}0{th}0"
            if k not in dc:
                pref = f"{prov_val}{VAR}"
                k = next((kk for kk in dc
                          if kk.startswith(pref) and str(th) in kk[len(pref):]), k)
            if k in dc:
                rows.append({
                    "territory": pname, "indicator": "Unemployment rate",
                    "year": str(1900 + th), "value": dc[k], "unit": "%",
                    "source": "BPS Indonesia", "data_level": "province",
                })
                print(f"  [OK] {pname} Unemployment rate = {dc[k]}% ({1900 + th})")
                got = True
                break
        if not got:
            print(f"  [BPS:{pname}] no value found in datacontent")


def pull_firms(rows, key):
    """Whole Borneo — satellite level (key). Active fire hotspot count, last 1 day."""
    if not key:
        print("  [FIRMS] no FIRMS_MAP_KEY — skipped")
        return
    url = (f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}"
           f"/VIIRS_NOAA20_NRT/108,-4,119,7/1")
    try:
        text = get_text(url)
    except Exception as e:
        print(f"  [FIRMS] FAILED: {e}")
        return
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if len(lines) < 1:
        print("  [FIRMS] empty response")
        return
    reader = list(csv.DictReader(lines))
    count = len(reader)
    year = year_of(reader[0]["acq_date"]) if reader else ""
    rows.append({
        "territory": "Borneo (all)", "indicator": "Active fire hotspots (1d)",
        "year": year, "value": count, "unit": "count",
        "source": "NASA FIRMS (VIIRS)", "data_level": "satellite",
    })
    print(f"  [OK] Borneo fire hotspots = {count} (last 1 day, {year})")


# ---------------------------------------------------------------- main
def main():
    env = load_env()
    rows = []

    print("data.gov.my (Sabah/Sarawak, state):")
    pull_datagovmy(rows)
    print("World Bank (Brunei, national):")
    pull_worldbank(rows)
    print("BPS Indonesia (Kalimantan, province):")
    pull_bps(rows, env.get("BPS_API_KEY"))
    print("NASA FIRMS (Borneo, satellite):")
    pull_firms(rows, env.get("FIRMS_MAP_KEY"))

    fields = ["territory", "indicator", "year", "value", "unit", "source", "data_level"]
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    print(f"\nWrote {len(rows)} rows -> {OUT_CSV.name}")
    levels = {}
    for r in rows:
        levels[r["data_level"]] = levels.get(r["data_level"], 0) + 1
    print("by data_level:", levels)


if __name__ == "__main__":
    main()
