"""
Borneo Tracker — POC ingestion script.

Pulls REAL data from ALL 7 verified API sources across the 3 geographic levels
and writes one standard-schema CSV. Purpose: prove the data pipeline + schema
work end-to-end (ESG + SDG + Hexagon pillar coverage) before building the
DB/backend. Output is a throwaway test artifact, not production data.

Standard schema (single source of truth for the app):
    territory | indicator | year | value | unit | source | data_level

7 API sources & geo levels exercised:
    data.gov.my / OpenDOSM  -> Sabah, Sarawak        (state)     keyless
    World Bank              -> Brunei                 (national)  keyless
    UN SDG API             -> MY / IDN / BRN baseline (national)  keyless
    BPS Indonesia          -> 5 Kalimantan provinces (province)  key + User-Agent
    Global Forest Watch    -> per-territory (GADM)   (satellite) key + x-api-key
    NASA FIRMS             -> whole Borneo bbox       (satellite) key
    WAQI / aqicn           -> 4 capital cities        (city)      token

Stdlib only (urllib/json/csv) so it runs with a bare Python 3 — no pip install.
Keys are read from .env (never hard-coded).
"""

import csv
import http.client
import json
from pathlib import Path
import urllib.request
import urllib.error
from urllib.parse import quote, urlsplit

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


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Disable urllib's auto-redirect so we can re-send headers manually.
    (urllib drops custom headers like x-api-key on redirect; GFW's /latest/
    endpoint 307-redirects to a versioned path and would otherwise 403.)"""
    def redirect_request(self, *a, **k):
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def _fetch(url, headers=None, timeout=60, _depth=0):
    from urllib.parse import urljoin
    req = urllib.request.Request(url, headers=headers or {"User-Agent": UA})
    # urllib capitalizes header names to "X-api-key"; GFW's query endpoint is
    # case-sensitive and only accepts lowercase "x-api-key". Restore it.
    if "X-api-key" in req.headers:
        req.headers["x-api-key"] = req.headers.pop("X-api-key")
    try:
        return _OPENER.open(req, timeout=timeout).read()
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308) and _depth < 5:
            loc = e.headers.get("Location")
            if loc:
                return _fetch(urljoin(url, loc), headers, timeout, _depth + 1)
        raise


def get_json(url, headers=None, timeout=60):
    return json.loads(_fetch(url, headers, timeout))


def get_json_raw(url, headers=None, timeout=60):
    """Minimal http.client GET. GFW's WAF 403s urllib.request's request shape on
    longer queries but accepts a plain http.client request — use this for GFW."""
    u = urlsplit(url)
    conn = http.client.HTTPSConnection(u.netloc, timeout=timeout)
    try:
        conn.request("GET", u.path + (f"?{u.query}" if u.query else ""),
                     headers=headers or {})
        resp = conn.getresponse()
        body = resp.read()
    finally:
        conn.close()
    if resp.status != 200:
        raise RuntimeError(f"HTTP {resp.status}: {body[:120].decode('utf-8', 'replace')}")
    return json.loads(body)


def get_text(url, headers=None, timeout=60):
    return _fetch(url, headers, timeout).decode("utf-8", "replace")


def add(rows, territory, indicator, year, value, unit, source, data_level):
    rows.append({
        "territory": territory, "indicator": indicator, "year": str(year),
        "value": value, "unit": unit, "source": source, "data_level": data_level,
    })
    print(f"  [OK] {territory} | {indicator} = {value}{unit} ({year})")


# ---------------------------------------------------------------- 1. data.gov.my
def pull_datagovmy(rows):
    """Sabah & Sarawak — state level (keyless). ESG + pillar indicators."""
    states = ("Sabah", "Sarawak")

    def latest(recs, field, pred=lambda r: True):
        recs = [r for r in recs if pred(r) and r.get(field) is not None]
        if not recs:
            return None
        r = max(recs, key=lambda x: x["date"])
        return r["date"][:4], r[field]

    def sum_latest(recs, field, pred=lambda r: True):
        recs = [r for r in recs if pred(r) and r.get(field) is not None]
        if not recs:
            return None
        y = max(r["date"][:4] for r in recs)
        return y, round(sum(r[field] for r in recs if r["date"][:4] == y))

    # (dataset_id, indicator, unit, selector)
    specs = [
        ("water_access", "Clean water access", "%",
         lambda r: latest(r, "proportion", lambda x: x.get("strata") == "overall")),
        ("lfs_qtr_state", "Unemployment rate", "%",
         lambda r: latest(r, "u_rate")),
        ("gdp_state_real_supply", "GDP (real)", "RM mil",
         lambda r: latest(r, "value",
                          lambda x: x.get("sector") == "p0" and x.get("series") == "abs")),
        ("hospital_beds", "Hospital beds", "beds",
         lambda r: latest(r, "beds",
                          lambda x: x.get("type") == "all" and x.get("district") == "All Districts")),
        ("enrolment_school_district", "School enrolment", "students",
         lambda r: sum_latest(r, "students",
                              lambda x: x.get("sex") == "both" and x.get("district") == "All Districts")),
        ("crops_state", "Crop production (paddy)", "tonnes",  # Hexagon: Food
         lambda r: latest(r, "production", lambda x: x.get("crop_type") == "paddy")),
        ("hh_profile_state", "Households", "households",      # Hexagon: Shelter
         lambda r: latest(r, "households")),
    ]
    for ds, indicator, unit, sel in specs:
        try:
            data = get_json(f"https://api.data.gov.my/data-catalogue/?id={ds}&limit=20000")
        except Exception as e:
            print(f"  [data.gov.my:{ds}] FAILED: {e}")
            continue
        for state in states:
            res = sel([r for r in data if r.get("state") == state])
            if not res:
                print(f"  [data.gov.my:{ds}] no rows for {state}")
                continue
            year, value = res
            add(rows, state, indicator, year, value, unit,
                "data.gov.my / OpenDOSM", "state")


# ---------------------------------------------------------------- 2. World Bank
def pull_worldbank(rows):
    """Brunei — national level (keyless). Most-recent value per indicator."""
    pulls = [
        ("SH.H2O.BASW.ZS", "Clean water access", "%"),
        ("SL.UEM.TOTL.ZS", "Unemployment rate", "%"),
        ("NY.GDP.MKTP.KD.ZG", "GDP growth", "%"),
        ("NY.GDP.MKTP.CD", "GDP (current US$)", "US$"),
        ("SH.MED.BEDS.ZS", "Hospital beds (per 1k)", "/1k"),
        ("AG.LND.FRST.ZS", "Forest cover", "% land"),
        # Education via World Bank API (teammate's Brunei SDG doc) — fills the
        # Brunei education gap without PDF/admin entry.
        ("SE.PRM.ENRR", "School enrolment (primary, gross)", "%"),
        ("SE.SEC.ENRR", "School enrolment (secondary, gross)", "%"),
        ("SE.ADT.LITR.ZS", "Adult literacy", "%"),
        ("SH.STA.BASS.ZS", "Basic sanitation access", "%"),
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
        add(rows, "Brunei", indicator, rec["date"], rec["value"], unit,
            "World Bank", "national")


# ---------------------------------------------------------------- 3. UN SDG API
def pull_un_sdg(rows):
    """MY / IDN / BRN — national SDG baseline (keyless). Extreme poverty (SDG 1)."""
    areas = [("Malaysia", 458), ("Indonesia", 360), ("Brunei", 96)]
    series = "SI_POV_DAY1"  # poverty headcount ratio at $2.15/day
    for name, code in areas:
        url = (f"https://unstats.un.org/SDGAPI/v1/sdg/Series/Data"
               f"?seriesCode={series}&areaCode={code}&pageSize=1000")
        try:
            recs = [r for r in get_json(url).get("data", [])
                    if r.get("value") not in (None, "")]
        except Exception as e:
            print(f"  [UN SDG:{name}] FAILED: {e}")
            continue
        if not recs:
            print(f"  [UN SDG:{name}] no data")
            continue
        rec = max(recs, key=lambda r: float(r.get("timePeriodStart", 0)))
        add(rows, name, "Poverty headcount <$2.15/day (SDG1)",
            int(float(rec["timePeriodStart"])), rec["value"], "%",
            "UN SDG API", "national")


# ---------------------------------------------------------------- 4. BPS Indonesia
def bps_all_vars(domain, key):
    """Fetch the full (var_id, title) list for a domain once (paged). BPS var IDs
    are PER-DOMAIN, so this is cached per domain and matched locally."""
    out, page = [], 1
    while True:
        url = (f"https://webapi.bps.go.id/v1/api/list/model/var/lang/ind"
               f"/domain/{domain}/page/{page}/key/{key}/")
        try:
            d = get_json(url, headers={"User-Agent": UA})
        except Exception:
            break
        if not isinstance(d, dict) or d.get("status") != "OK":
            break
        meta = d["data"][0]
        out += [(r.get("var_id"), r.get("title", "")) for r in d["data"][1]]
        if page >= meta.get("pages", page):
            break
        page += 1
    return out


def bps_value(domain, var, key, pname):
    """Return (year, value) for the PROVINCE-TOTAL region of an annual variable.
    The province-total region code is inconsistent (Kaltim=6499, Kalbar=6100),
    so select it by matching the region LABEL to the province name."""
    url = (f"https://webapi.bps.go.id/v1/api/list/model/data/domain/{domain}"
           f"/var/{var}/th/124;125/key/{key}/")
    try:
        d = get_json(url, headers={"User-Agent": UA})
    except Exception:
        return None
    if not isinstance(d, dict) or d.get("status") != "OK":
        return None
    vervars = {v["val"]: v["label"].strip() for v in d.get("vervar", [])}
    p = pname.lower()
    prov_val = next((v for v, lbl in vervars.items() if lbl.lower() == p), None)
    if prov_val is None:  # e.g. "Provinsi Kalimantan Selatan"
        prov_val = next((v for v, lbl in vervars.items() if p in lbl.lower()), None)
    if prov_val is None:  # last resort: domain code, then domain+99
        prov_val = domain if domain in vervars else (
            domain + 99 if domain + 99 in vervars else None)
    if prov_val is None:
        return None
    dc = d.get("datacontent", {})
    for th in sorted((t["val"] for t in d.get("tahun", [])), reverse=True):
        k = f"{prov_val}{var}0{th}0"
        if k not in dc:
            pref = f"{prov_val}{var}"
            k = next((kk for kk in dc
                      if kk.startswith(pref) and str(th) in kk[len(pref):]), k)
        if k in dc:
            return 1900 + th, dc[k]
    return None


# Each indicator: (name, unit, title predicate). Var ids differ per province, so
# match by title. "menurut kabupaten/kota" vars expose a province-total region.
def _has(t, *subs):
    t = t.lower()
    return all(s in t for s in subs)


def _kabkota(t):
    return "kabupaten/kota" in t.lower() or "kab/kota" in t.lower()


BPS_INDICATORS = [
    ("Unemployment rate", "%",
     lambda t: _has(t, "tingkat pengangguran terbuka")
     and not any(b in t.lower() for b in
                 ("termasuk", "kelompok umur", "jenis kelamin", "usia kerja",
                  "triwulan", "partisipasi", "2018="))),
    ("Poverty rate (P0)", "%",
     lambda t: _has(t, "persentase penduduk miskin") and _kabkota(t)
     and "termasuk" not in t.lower()),
    ("Clean water access", "%",
     lambda t: _has(t, "air minum layak") and "termasuk" not in t.lower()),
    ("Mean years schooling (RLS)", "years",
     lambda t: _has(t, "rata-rata lama sekolah")
     and not any(b in t.lower() for b in ("laki", "perempuan", "termasuk"))),
    ("GDP growth (PDRB)", "%",
     lambda t: _has(t, "laju pertumbuhan pdrb") and _kabkota(t)),
    ("Hospital count", "units",
     lambda t: _has(t, "rumah sakit") and _kabkota(t)),
]


def pull_bps(rows, key):
    """Kalimantan 5 provinces — province level (key + User-Agent). Multiple ESG
    indicators; var ids discovered per-domain from a cached var list."""
    if not key:
        print("  [BPS] no BPS_API_KEY — skipped")
        return
    provinces = {
        6100: "Kalimantan Barat", 6200: "Kalimantan Tengah",
        6300: "Kalimantan Selatan", 6400: "Kalimantan Timur",
        6500: "Kalimantan Utara",
    }
    for domain, pname in provinces.items():
        catalog = bps_all_vars(domain, key)
        for name, unit, pred in BPS_INDICATORS:
            var = next((vid for vid, title in catalog if pred(title)), None)
            if var is None:
                continue  # indicator not published for this province
            res = bps_value(domain, var, key, pname)
            if res is None:
                continue
            add(rows, pname, name, res[0], res[1], unit, "BPS Indonesia", "province")


# ---------------------------------------------------------------- 5. GFW forest
# GADM adm1 codes verified live: MYS Sabah=13 Sarawak=14; IDN Kalimantan
# Barat=12 Selatan=13 Tengah=14 Timur=15 Utara=16; Brunei = whole ISO.
GFW_TERR = [
    ("Sabah", "MYS", 13, "state"),
    ("Sarawak", "MYS", 14, "state"),
    ("Brunei", "BRN", None, "national"),
    ("Kalimantan Barat", "IDN", 12, "province"),
    ("Kalimantan Selatan", "IDN", 13, "province"),
    ("Kalimantan Tengah", "IDN", 14, "province"),
    ("Kalimantan Timur", "IDN", 15, "province"),
    ("Kalimantan Utara", "IDN", 16, "province"),
]


def pull_gfw(rows, key):
    """Forest cover — satellite (key + x-api-key). Tree cover extent 2000 (ha) per
    territory via GADM admin summaries. Must pin a single canopy threshold (=30),
    else loss/extent sum across all thresholds and inflate."""
    if not key:
        print("  [GFW] no GFW_API_KEY — skipped")
        return
    # GFW sits behind a WAF that 403s urllib.request's request shape on longer
    # queries; get_json_raw (plain http.client) is accepted. Accept: */* too.
    hdr = {"x-api-key": key, "Accept": "*/*"}
    base = "https://data-api.globalforestwatch.org/dataset/gadm__tcl__{}_summary"
    # Resolve the query version per scope once (the query /latest 307-redirect is
    # mishandled; the metadata /latest returns the version cleanly).
    ver = {}
    for scope in ("iso", "adm1"):
        try:
            # metadata endpoint needs no key, so urllib (auto-follows redirect) is fine
            ver[scope] = get_json(base.format(scope) + "/latest", headers=hdr)["data"]["version"]
        except Exception as e:
            print(f"  [GFW] version lookup failed for {scope}: {e}")
            return
    for terr, iso, adm1, lvl in GFW_TERR:
        scope = "iso" if adm1 is None else "adm1"
        where = f"iso='{iso}' AND umd_tree_cover_density_2000__threshold=30"
        if adm1 is not None:
            where += f" AND adm1={adm1}"
        sql = ("SELECT SUM(umd_tree_cover_extent_2000__ha) AS ext, "
               "SUM(umd_tree_cover_loss__ha) AS loss FROM data WHERE " + where)
        url = f"{base.format(scope)}/{ver[scope]}/query/json?sql={quote(sql)}"
        try:
            d = get_json_raw(url, headers=hdr)
            r = d["data"][0]
        except Exception as e:
            print(f"  [GFW:{terr}] FAILED: {e}")
            continue
        add(rows, terr, "Forest extent (2000)", 2000, round(r["ext"]), "ha",
            "Global Forest Watch", "satellite")
        add(rows, terr, "Tree cover loss (cumulative)", "2001-2023",
            round(r["loss"]), "ha", "Global Forest Watch", "satellite")


# ---------------------------------------------------------------- 6. NASA FIRMS
def pull_firms(rows, key):
    """Whole Borneo — satellite (key). Active fire hotspot count, last 1 day."""
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
    reader = list(csv.DictReader([ln for ln in text.splitlines() if ln.strip()]))
    if not reader:
        print("  [FIRMS] empty response")
        return
    add(rows, "Borneo (all)", "Active fire hotspots (1d)",
        reader[0]["acq_date"][:4], len(reader), "count",
        "NASA FIRMS (VIIRS)", "satellite")


# ---------------------------------------------------------------- 7. WAQI
WAQI_CITIES = [
    ("kota kinabalu", "Sabah"),
    ("kuching", "Sarawak"),
    ("bandar seri begawan", "Brunei"),
    ("pontianak", "Kalimantan Barat"),
]


def pull_waqi(rows, token):
    """Air quality — city level (token). Live AQI for the 4 Borneo capitals."""
    if not token:
        print("  [WAQI] no WAQI_TOKEN — skipped")
        return
    for slug, terr in WAQI_CITIES:
        url = f"https://api.waqi.info/feed/{quote(slug)}/?token={token}"
        try:
            d = get_json(url)
        except Exception as e:
            print(f"  [WAQI:{slug}] FAILED: {e}")
            continue
        if d.get("status") != "ok":
            print(f"  [WAQI:{slug}] {d.get('data')}")
            continue
        data = d["data"]
        year = str(data.get("time", {}).get("s", ""))[:4] or "live"
        add(rows, terr, "Air quality (AQI, live)", year, data.get("aqi"),
            "AQI", "WAQI / aqicn", "city")


# ---------------------------------------------------------------- main
def main():
    env = load_env()
    rows = []
    print("1. data.gov.my (Sabah/Sarawak, state):")
    pull_datagovmy(rows)
    print("2. World Bank (Brunei, national):")
    pull_worldbank(rows)
    print("3. UN SDG API (country baseline, national):")
    pull_un_sdg(rows)
    print("4. BPS Indonesia (Kalimantan, province):")
    pull_bps(rows, env.get("BPS_API_KEY"))
    print("5. Global Forest Watch (per-territory, satellite):")
    pull_gfw(rows, env.get("GFW_API_KEY"))
    print("6. NASA FIRMS (Borneo, satellite):")
    pull_firms(rows, env.get("FIRMS_MAP_KEY"))
    print("7. WAQI / aqicn (4 cities, city):")
    pull_waqi(rows, env.get("WAQI_TOKEN"))

    fields = ["territory", "indicator", "year", "value", "unit", "source", "data_level"]
    out = OUT_CSV
    try:
        f = open(out, "w", newline="", encoding="utf-8")
    except PermissionError:
        out = OUT_CSV.with_suffix(".new.csv")
        print(f"\n  ! {OUT_CSV.name} is locked (open in Excel?) — writing {out.name} instead")
        f = open(out, "w", newline="", encoding="utf-8")
    with f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    print(f"\nWrote {len(rows)} rows -> {out.name}")
    levels, sources = {}, {}
    for r in rows:
        levels[r["data_level"]] = levels.get(r["data_level"], 0) + 1
        sources[r["source"]] = sources.get(r["source"], 0) + 1
    print("by data_level:", levels)
    print("by source:", sources)


if __name__ == "__main__":
    main()
