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
import time
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
        # GDP GROWTH % — consistent metric across all 4 territories (Brunei + Kalimantan
        # are growth %, so Malaysia must be growth % too, not absolute RM). Series
        # 'growth_yoy' is published directly, no need to compute.
        ("gdp_state_real_supply", "GDP growth", "%",
         lambda r: latest(r, "value",
                          lambda x: x.get("sector") == "p0" and x.get("series") == "growth_yoy")),
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
        ("hh_poverty_state", "Poverty rate (absolute)", "%",
         lambda r: latest(r, "poverty_absolute")),
        ("electricity_access", "Electricity access", "households",  # Hexagon: Energy
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
        ("SP.DYN.LE00.IN", "Life expectancy", "years"),  # consistent healthcare metric
        ("AG.LND.FRST.ZS", "Forest cover", "% land"),
        # Education via World Bank API (teammate's Brunei SDG doc) — fills the
        # Brunei education gap without PDF/admin entry.
        ("SE.PRM.ENRR", "School enrolment (primary, gross)", "%"),
        ("SE.SEC.ENRR", "School enrolment (secondary, gross)", "%"),
        ("SE.ADT.LITR.ZS", "Adult literacy", "%"),
        ("SH.STA.BASS.ZS", "Basic sanitation access", "%"),
        # Hexagon pillars for Brunei
        ("EG.ELC.ACCS.ZS", "Electricity access", "%"),         # Energy
        ("ST.INT.ARVL", "Tourist arrivals", "arrivals"),       # Entertainment
        ("AG.LND.AGRI.ZS", "Agricultural land", "% land"),     # Food
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


# ---------------------------------------------------------------- 2b. Governance (WGI)
def pull_governance(rows):
    """Governance (G) — World Bank WGI Control of Corruption (0-100). No sub-national
    score exists anywhere, so it is country-level: territories inherit their country's
    value (Sabah/Sarawak=Malaysia, Kalimantan=Indonesia, Brunei=Brunei)."""
    wgi = {}
    for iso in ("MYS", "IDN", "BRN"):
        url = (f"https://api.worldbank.org/v2/country/{iso}/indicator/"
               f"GOV_WGI_CC.SC?format=json&mrv=5")
        try:
            payload = get_json(url)
            series = [x for x in (payload[1] or []) if x.get("value") is not None]
            wgi[iso] = max(series, key=lambda x: x["date"])
        except Exception as e:
            print(f"  [WGI:{iso}] FAILED: {e}")
    for terr, iso in [("Sabah", "MYS"), ("Sarawak", "MYS"),
                      ("Brunei", "BRN"), ("Kalimantan", "IDN")]:
        if iso in wgi:
            r = wgi[iso]
            add(rows, terr, "Control of Corruption (WGI)", r["date"],
                round(r["value"], 1), "score/100", "World Bank WGI", "national")


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
def bps_get(url, retries=3):
    """BPS is flaky under load (timeouts); retry with small backoff so a transient
    failure doesn't silently drop an indicator. Returns parsed JSON or None."""
    for attempt in range(retries):
        try:
            return get_json(url, headers={"User-Agent": UA})
        except Exception:
            if attempt < retries - 1:
                time.sleep(0.5 * (attempt + 1))
    return None


def bps_all_vars(domain, key):
    """Fetch the full (var_id, title) list for a domain (paged). BPS var IDs are
    PER-DOMAIN. A failed page is SKIPPED (not break) so one flaky page doesn't
    silently truncate the whole catalog — that truncation was the real cause of
    patchy coverage. (For production, prefer the hardcoded var-id map below.)"""
    out, page, pages = [], 1, None
    while True:
        url = (f"https://webapi.bps.go.id/v1/api/list/model/var/lang/ind"
               f"/domain/{domain}/page/{page}/key/{key}/")
        d = bps_get(url, retries=5)
        if not isinstance(d, dict) or d.get("status") != "OK":
            if pages and page < pages:   # skip the bad page, keep going
                page += 1
                continue
            break
        meta = d["data"][0]
        pages = meta.get("pages", pages)
        out += [(r.get("var_id"), r.get("title", "")) for r in d["data"][1]]
        if pages and page >= pages:
            break
        page += 1
        time.sleep(0.25)  # ease BPS rate-limiting so pages don't fail -> truncate
    return out


def bps_value(domain, var, key, pname):
    """Return (year, value) for the PROVINCE-TOTAL region of an annual variable.
    - Province-total region code is inconsistent (Kaltim=6499, Kalbar=6100), so
      select it by matching the region LABEL to the province name.
    - Indicators have different recency (some 2025, some 2016), and BPS allows max
      2 years per call, so try year-pairs newest-first and take the first with data.
    """
    p = pname.lower()
    for thpair in ("125;124", "123;122", "121;120", "119;118", "117;116"):
        url = (f"https://webapi.bps.go.id/v1/api/list/model/data/domain/{domain}"
               f"/var/{var}/th/{thpair}/key/{key}/")
        d = bps_get(url)
        if not isinstance(d, dict) or d.get("status") != "OK" or not d.get("tahun"):
            continue
        vervars = {v["val"]: v["label"].strip() for v in d.get("vervar", [])}
        prov_val = next((v for v, lbl in vervars.items() if lbl.lower() == p), None)
        if prov_val is None:  # e.g. "Provinsi Kalimantan Selatan"
            prov_val = next((v for v, lbl in vervars.items() if p in lbl.lower()), None)
        if prov_val is None:  # last resort: domain code, then domain+99
            prov_val = domain if domain in vervars else (
                domain + 99 if domain + 99 in vervars else None)
        if prov_val is None:
            continue
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
    # Hexagon pillars
    ("Electrification ratio", "%",
     lambda t: _has(t, "rasio elektrifikasi")),                       # Energy
    ("Crop production (paddy)", "tonnes",
     lambda t: _has(t, "produksi padi")),                            # Food
    ("Households", "households",
     lambda t: _has(t, "jumlah rumah tangga") and "kabupaten" in t.lower()
     and "perikanan" not in t.lower()),                              # Shelter
    ("Tourist trips (domestic)", "trips",
     lambda t: _has(t, "perjalanan wisatawan nusantara", "tujuan")),  # Entertainment
    ("Life expectancy", "years",                                     # Healthcare
     lambda t: _has(t, "harapan hidup")
     and not any(b in t.lower() for b in ("laki", "perempuan", "termasuk"))),
]


# Verified BPS var-id map: province domain -> {indicator: var_id}. Discovered
# 2026-06 against FULL (non-truncated) catalogs (307/436/143/698/437 vars). Using a
# hardcoded map instead of scanning each domain's catalog every run is (a) robust —
# the catalog-truncation that caused patchy coverage can't happen, and (b) ~30x
# fewer requests. IMPORTANT (integrity): a cell absent here is genuinely NOT
# published in that province's BPS regional portal (verified against the full
# catalog), NOT dropped to fake a gap. Re-run discover_bps_map.py to refresh.
# NOTE: 'Clean water access' is intentionally NOT in this per-province map. The
# province portals only published it for 3/5 provinces; pull_bps_water_national()
# instead pulls all 5 from the BPS national by-province table (var 854) — one source,
# one vintage, 5/5.
BPS_VAR_MAP = {
    6100: {'Unemployment rate': 51, 'Mean years schooling (RLS)': 85, 'GDP growth (PDRB)': 44, 'Crop production (paddy)': 199, 'Tourist trips (domestic)': 441, 'Life expectancy': 30},
    6200: {'Unemployment rate': 389, 'Poverty rate (P0)': 69, 'Mean years schooling (RLS)': 45, 'Crop production (paddy)': 991, 'Households': 449, 'Tourist trips (domestic)': 1018, 'Life expectancy': 958},
    6300: {'Unemployment rate': 37, 'Poverty rate (P0)': 103, 'Mean years schooling (RLS)': 62, 'Crop production (paddy)': 344, 'Tourist trips (domestic)': 386, 'Life expectancy': 60},
    6400: {'Unemployment rate': 59, 'Poverty rate (P0)': 111, 'Mean years schooling (RLS)': 65, 'GDP growth (PDRB)': 95, 'Electrification ratio': 399, 'Crop production (paddy)': 320, 'Households': 300, 'Tourist trips (domestic)': 1014, 'Life expectancy': 130},
    6500: {'Unemployment rate': 115, 'Poverty rate (P0)': 71, 'Mean years schooling (RLS)': 65, 'Crop production (paddy)': 312, 'Tourist trips (domestic)': 600, 'Life expectancy': 64},
}
BPS_PROV = {6100: "Kalimantan Barat", 6200: "Kalimantan Tengah",
            6300: "Kalimantan Selatan", 6400: "Kalimantan Timur",
            6500: "Kalimantan Utara"}
BPS_UNIT = {name: unit for name, unit, _ in BPS_INDICATORS}


def pull_bps(rows, key):
    """Kalimantan 5 provinces — province level (key + User-Agent). Uses the verified
    hardcoded BPS_VAR_MAP (no per-run catalog scan, so no truncation gaps)."""
    if not key:
        print("  [BPS] no BPS_API_KEY — skipped")
        return
    for domain, pname in BPS_PROV.items():
        for name, vid in BPS_VAR_MAP.get(domain, {}).items():
            res = bps_value(domain, vid, key, pname)
            if res is None:
                # value temporarily unfetchable; load_db keeps the last-good row.
                print(f"  [BPS] {pname} | {name} (var {vid}) — no value this run")
                continue
            add(rows, pname, name, res[0], res[1],
                BPS_UNIT.get(name, ""), "BPS Indonesia", "province")


def pull_bps_water_national(rows, key):
    """Clean water (% households with access to a proper drinking-water source) for
    ALL 5 Kalimantan provinces from the BPS NATIONAL by-province table (domain 0000,
    var 854). The 5 provincial portals only carried this for 3/5; the national table
    gives all 5 from one consistent source and vintage."""
    if not key:
        return
    var = 854
    for thpair in ("125;124", "123;122", "121;120"):
        url = (f"https://webapi.bps.go.id/v1/api/list/model/data/domain/0000"
               f"/var/{var}/th/{thpair}/key/{key}/")
        d = bps_get(url)
        if not isinstance(d, dict) or d.get("status") != "OK" or not d.get("tahun"):
            continue
        vervar = {v["val"]: v["label"].strip() for v in d.get("vervar", [])}
        dc = d.get("datacontent", {})
        years = sorted((t["val"] for t in d["tahun"]), reverse=True)
        n = 0
        for vv, lbl in vervar.items():
            if "kalimantan" not in lbl.lower():
                continue
            name = " ".join(w.capitalize() for w in lbl.split())  # KALIMANTAN BARAT -> Kalimantan Barat
            for th in years:
                pref = f"{vv}{var}"
                k = next((kk for kk in dc if kk.startswith(pref) and str(th) in kk[len(pref):]), None)
                if k:
                    add(rows, name, "Clean water access", 1900 + th, dc[k], "%",
                        "BPS Indonesia (national by-province)", "province")
                    n += 1
                    break
        if n:
            return


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


# ------------------------------------------------ 5b. GFW fire alerts (per terr)
def pull_gfw_fire(rows, key):
    """Fire — VIIRS active-fire ALERTS per territory via GFW (uses our GFW key, so
    it works even when NASA FIRMS is down). Alert counts are partitioned by canopy-
    density bucket, so SUM over all thresholds = the true total (no double-count,
    unlike the cumulative tree-cover tables). Reports the latest COMPLETE year so a
    half-finished current year doesn't look artificially low."""
    if not key:
        print("  [GFW-fire] no GFW_API_KEY — skipped")
        return
    hdr = {"x-api-key": key, "Accept": "*/*"}
    dsa = "gadm__viirs__adm1_weekly_alerts"
    dsi = "gadm__viirs__iso_weekly_alerts"
    try:
        va = get_json(f"https://data-api.globalforestwatch.org/dataset/{dsa}/latest", headers=hdr)["data"]["version"]
        vi = get_json(f"https://data-api.globalforestwatch.org/dataset/{dsi}/latest", headers=hdr)["data"]["version"]
    except Exception as e:
        print(f"  [GFW-fire] version lookup failed: {e}")
        return
    # NOTE on GADM codes: the VIIRS alert tables use a different GADM version than the
    # tree-cover summary. Verified by area+location (GFW geostore): MYS 13=Sabah,
    # 14=Sarawak; IDN 12=Kalbar, 13=Kalsel, 14=Kalteng, 16=Kaltara all map correctly.
    # IDN 15 (Kaltim in the forest table) is EMPTY here — Kaltim sits under a different
    # adm1 code in this version that can't be confirmed by name via the API, so it is
    # deliberately left out rather than guessed (would risk misattributing a value).
    # Result: Kalimantan fire rolls up 4/5 provinces (honestly labelled by aggregate).
    for terr, iso, adm1, lvl in GFW_TERR:
        if adm1 is None:
            ds, ver, where = dsi, vi, f"iso='{iso}'"
        else:
            ds, ver, where = dsa, va, f"iso='{iso}' AND adm1={adm1}"
        got = None
        for yr in (2025, 2024, 2023):
            sql = f"SELECT SUM(alert__count) AS n FROM data WHERE {where} AND alert__year={yr}"
            url = f"https://data-api.globalforestwatch.org/dataset/{ds}/{ver}/query/json?sql={quote(sql)}"
            try:
                n = get_json_raw(url, headers=hdr)["data"][0]["n"]
            except Exception as e:
                print(f"  [GFW-fire:{terr}] {e}")
                n = None
            if n:
                got = (yr, int(n))
                break
        if got:
            add(rows, terr, "Fire alerts (VIIRS, annual)", got[0], got[1], "count",
                "Global Forest Watch (VIIRS)", "satellite")


# ---------------------------------------------------------------- 6. NASA FIRMS
def _firms_parse(text):
    return list(csv.DictReader([ln for ln in text.splitlines() if ln.strip()]))


def _in_borneo(r):
    try:
        return 108 <= float(r["longitude"]) <= 119 and -4 <= float(r["latitude"]) <= 7
    except (KeyError, ValueError, TypeError):
        return False


def pull_firms(rows, key):
    """Whole Borneo — satellite. Active fire hotspot count, last 1 day.
    Primary: the FIRMS area API (needs key). Fallback: NASA's static regional
    24h CSV (same VIIRS NOAA-20 product, no key) filtered to the Borneo bbox —
    used when the API service is down (it 403s/hangs intermittently)."""
    reader, source = None, "NASA FIRMS (VIIRS)"
    # 1. primary — area API (precise bbox + day)
    if key:
        api = (f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}"
               f"/VIIRS_NOAA20_NRT/108,-4,119,7/1")
        try:
            reader = _firms_parse(get_text(api, timeout=30))
        except Exception as e:
            print(f"  [FIRMS] API down ({e}); trying static CSV fallback")
    # 2. fallback — static regional CSV, filtered to Borneo (retry: NASA is flaky)
    if not reader:
        static = ("https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
                  "noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv")
        for attempt in range(3):
            try:
                reader = [r for r in _firms_parse(get_text(static, timeout=120))
                          if _in_borneo(r)]
                source = "NASA FIRMS (VIIRS, regional CSV)"
                break
            except Exception as e:
                if attempt < 2:
                    time.sleep(2 * (attempt + 1))
                else:
                    print(f"  [FIRMS] both API and static CSV failed: {e} "
                          "(NASA outage — DB keeps last good value)")
                    return
    if not reader:
        print("  [FIRMS] empty response")
        return
    add(rows, "Borneo (all)", "Active fire hotspots (1d)",
        reader[0]["acq_date"][:4], len(reader), "count", source, "satellite")


# ---------------------------------------------------------------- 7. WAQI
WAQI_CITIES = [
    ("kota kinabalu", "Sabah"),
    ("kuching", "Sarawak"),
    ("bandar seri begawan", "Brunei"),
    # Kalimantan: several provincial capitals so the territory-level figure isn't a
    # single city. Each maps to its province; a "Kalimantan" mean is added after.
    ("pontianak", "Kalimantan Barat"),
    ("banjarmasin", "Kalimantan Selatan"),
    ("samarinda", "Kalimantan Timur"),
    ("palangkaraya", "Kalimantan Tengah"),
]


def pull_waqi(rows, token):
    """Air quality — city level (token). Live AQI for Borneo capitals. For the other
    3 territories one capital IS the territory proxy; Kalimantan gets a mean of its
    available provincial-capital AQIs so it has a comparable territory-level value."""
    if not token:
        print("  [WAQI] no WAQI_TOKEN — skipped")
        return
    kal_aqi, kal_year = [], "live"
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
        aqi = data.get("aqi")
        add(rows, terr, "Air quality (AQI, live)", year, aqi,
            "AQI", "WAQI / aqicn", "city")
        if terr.startswith("Kalimantan") and isinstance(aqi, (int, float)):
            kal_aqi.append(aqi)
            kal_year = year
    if kal_aqi:
        add(rows, "Kalimantan", "Air quality (AQI, live)", kal_year,
            round(sum(kal_aqi) / len(kal_aqi)), "AQI",
            f"WAQI / aqicn (mean of {len(kal_aqi)} Kalimantan cities)", "city")


# ---------------------------------------------------------------- main
# Units that aggregate by SUM (counts/areas); everything else (rates, indices,
# years) aggregates by unweighted MEAN — which is an APPROXIMATION (not pop-weighted)
# and is labelled as such in the source string so it's never mistaken for exact.
_SUM_UNITS = {"tonnes", "households", "trips", "ha", "count", "arrivals", "people"}


def aggregate_kalimantan(rows):
    """Roll the 5 Kalimantan province rows up into a single 'Kalimantan' figure per
    indicator, KEEPING the province rows too (per requirement). Counts -> sum (exact);
    rates/indices -> unweighted mean (approx, labelled). City-level points (e.g. one
    city's air quality) are NOT rolled up — a single city isn't a provincial value."""
    from collections import defaultdict
    groups = defaultdict(list)
    for r in rows:
        t = r["territory"]
        if (t.startswith("Kalimantan ") and t != "Kalimantan"
                and r["data_level"] in ("province", "satellite")):
            groups[(r["indicator"], r["unit"])].append(r)
    made = 0
    for (indicator, unit), rs in groups.items():
        vals = []
        for r in rs:
            try:
                vals.append(float(r["value"]))
            except (ValueError, TypeError):
                pass
        if not vals:
            continue
        n = len(vals)
        year = max(r["year"] for r in rs)
        src = rs[0]["source"]
        if unit in _SUM_UNITS:
            value = round(sum(vals), 2)
            note = f"{src} (sum of {n}/5 provinces)"
        else:
            value = round(sum(vals) / n, 2)
            note = f"{src} (unweighted mean of {n}/5 provinces, approx)"
        add(rows, "Kalimantan", indicator, year, value, unit, note, "territory")
        made += 1
    print(f"  [aggregate] added {made} Kalimantan roll-up rows (province rows kept)")


def main():
    env = load_env()
    rows = []
    print("1. data.gov.my (Sabah/Sarawak, state):")
    pull_datagovmy(rows)
    print("2. World Bank (Brunei, national):")
    pull_worldbank(rows)
    print("2b. Governance — World Bank WGI (national, inherited):")
    pull_governance(rows)
    print("3. UN SDG API (country baseline, national):")
    pull_un_sdg(rows)
    print("4. BPS Indonesia (Kalimantan, province):")
    pull_bps(rows, env.get("BPS_API_KEY"))
    print("4b. BPS national by-province (clean water, 5/5):")
    pull_bps_water_national(rows, env.get("BPS_API_KEY"))
    print("5. Global Forest Watch (per-territory, satellite):")
    pull_gfw(rows, env.get("GFW_API_KEY"))
    print("5b. GFW VIIRS fire alerts (per-territory, satellite):")
    pull_gfw_fire(rows, env.get("GFW_API_KEY"))
    print("6. NASA FIRMS (Borneo, satellite):")
    pull_firms(rows, env.get("FIRMS_MAP_KEY"))
    print("7. WAQI / aqicn (4 cities, city):")
    pull_waqi(rows, env.get("WAQI_TOKEN"))
    # Reference figure (official census, not an API): Brunei household count. DEPS
    # publishes it only in the census report, so it's cited here, not auto-pulled.
    print("7b. Reference data (cited, non-API):")
    add(rows, "Brunei", "Households", 2021, 87137, "households",
        "DEPS Brunei Population & Housing Census 2021", "national")
    print("8. Kalimantan roll-up (province -> territory aggregate):")
    aggregate_kalimantan(rows)

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
