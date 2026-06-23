# Borneo Tracker — API Keys Setup & Status

> Real keys live in `.env` (git-ignored). This file tracks **status + how each was obtained + gotchas**. Never paste real key values here.

## Status (verified 2026-06-23)

| Source | Belongs to | Key needed? | Key in `.env` | Verified |
|---|---|---|---|---|
| **Global Forest Watch** | WRI (NGO) | yes (`x-api-key`) | `GFW_API_KEY` | ✅ live (auth OK; raster queries need a geometry) |
| **BPS Indonesia** | 🏛️ Indonesia gov (statistics) | yes (`key`) | `BPS_API_KEY` | ✅ live (Kaltim subjects returned) |
| **NASA FIRMS** | 🏛️ US gov (NASA) | yes (`MAP_KEY`) | `FIRMS_MAP_KEY` | ✅ live (data availability returned) |
| **WAQI / aqicn** | community | yes (`token`) | `WAQI_TOKEN` | ✅ live (Kuching AQI 29) |
| data.gov.my / OpenDOSM | 🏛️ Malaysia gov | **no** | — | n/a keyless |
| World Bank | World Bank | **no** | — | n/a keyless |
| UN SDG API | UN | **no** | — | n/a keyless |

## Where each key comes from
- **GFW** — https://data-api.globalforestwatch.org/ → `POST /auth/token` (email+pwd) → `POST /auth/apikey`. Key expires yearly (current: 2027-06-23), regenerate before expiry.
- **BPS** — https://webapi.bps.go.id/developer/ → register → create application → APPID = key.
- **FIRMS** — https://firms.modaps.eosdis.nasa.gov/api/map_key/ → email → MAP_KEY.
- **WAQI** — https://aqicn.org/data-platform/token/ → email → token.

## Gotchas (important)
- **BPS firewall (WAF):** bare `curl` is blocked with a "Perimeter WAF Block" page. **Send a browser `User-Agent` header** on every BPS request, e.g. `Mozilla/5.0 ...`. With a normal UA it returns JSON fine.
- **BPS var IDs are PER-DOMAIN, not global.** The same indicator has a different `var` id in each province (e.g. unemployment TPT = 59 in Kaltim, 51 in Kalbar, 37 in Kalsel). **Discover the var per domain by scanning its var list** (`model/var/domain/<dom>`) and matching the title — don't hard-code one id for all provinces. Titles also vary ("Menurut Kabupaten/Kota" vs "Kab/Kota" vs "Provinsi …"), so match loosely.
- **BPS data endpoint needs `th` (year), max 2 years/call.** Year id = `year - 1900` (2024 → 124, 2025 → 125). `datacontent` keys are `vervar+var+turvar+tahun+turtahun` concatenated.
- **BPS province-total region code is INCONSISTENT** — Kaltim uses `6499`, Kalbar uses `6100` (the domain itself). Do NOT assume `domain+99`. **Select the province-total region by matching the region LABEL to the province name** (e.g. label == "Kalimantan Barat"); falling back to a numeric code silently returns a regency value (wrong).
- **BPS per-province coverage is patchy** — the same indicator is published/named differently across provinces, so title-based discovery fills some provinces and not others. For a reliable per-province aggregate, build a verified var-id map per province per indicator rather than relying on auto-discovery.
- **GFW (several traps — see ingest_poc.py `pull_gfw`):**
  - Newly created keys take a few minutes to activate ("missing valid API key" at first).
  - The header is **case-sensitive**: must be lowercase `x-api-key` (urllib capitalizes to `X-api-key` → 403).
  - `latest` 307-redirects to a versioned path; resolve the version via the metadata endpoint `GET /dataset/<ds>/latest` (`.data.version`, currently `v20240118`) then query that explicit version.
  - GFW's **WAF 403s `urllib.request`** on longer queries — use stdlib **`http.client`** (or curl) instead; also send `Accept: */*` (an explicit `Accept: application/json` is rejected).
  - Summary tables have one row per canopy threshold — **filter `umd_tree_cover_density_2000__threshold=30`** or sums inflate.
  - Use **GADM adm1 summaries** for territories: MYS Sabah=13, Sarawak=14; IDN Kalimantan Barat=12, Selatan=13, Tengah=14, Timur=15, Utara=16; Brunei = whole ISO. Raster datasets (not these summaries) need a geometry.
- **World Bank:** use `mrv=N` (most-recent values) — `mrnev` is flaky (intermittent 400/timeout).
- **data.gov.my:** the catalogue URL 301-redirects to a trailing-slash path — follow redirects, and one dataset returns ALL states (filter `state` client-side).
- **All keys are backend-only.** Never ship them in the React frontend (CORS + key exposure). Backend pulls on schedule → writes the standard table → frontend reads the DB.

## Quick verify commands
```bash
# GFW (after ~30 min)
curl -H "x-api-key: $GFW_API_KEY" \
  "https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss/latest/query/json?sql=SELECT%20*%20LIMIT%201"

# BPS (note the User-Agent!)
curl -A "Mozilla/5.0" \
  "https://webapi.bps.go.id/v1/api/list/model/subject/lang/ind/domain/6400/key/$BPS_API_KEY/"

# FIRMS
curl "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/$FIRMS_MAP_KEY/VIIRS_NOAA20_NRT"

# WAQI
curl "https://api.waqi.info/feed/kuching/?token=$WAQI_TOKEN"
```

## Kalimantan BPS domain codes (for reference)
Kalbar 6100 · Kalteng 6200 · Kalsel 6300 · Kaltim 6400 · Kaltara 6500
