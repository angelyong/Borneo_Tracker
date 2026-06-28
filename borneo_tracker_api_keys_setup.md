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
- **BPS per-province coverage is patchy** — the same indicator is published/named differently across provinces, so title-based discovery fills some provinces and not others. **DONE: a verified var-id map (`BPS_VAR_MAP` in `ingest_poc.py`) is now hardcoded** — discovered 2026-06 against full (non-truncated) catalogs via `discover_bps_map.py`. `pull_bps` fetches only the mapped var per province (robust, no catalog scan). Per-indicator availability across the 5 provinces (verified against full catalogs, NOT truncation — a blank cell = genuinely not in that province's BPS regional portal):
  - 5/5: Unemployment, Mean-years-schooling, Paddy production, Tourist trips, Life expectancy
  - 4/5: Poverty rate (no Kalbar)
  - 3/5: Clean water (Kalbar, Kaltim, Kaltara)
  - 2/5: GDP growth (Kalbar, Kaltim); Households (Kalteng, Kaltim)
  - 1/5: Electrification (Kaltim only)
  Gaps could later be filled from the BPS **national domain (0000)** province-disaggregated tables (e.g. electrification via Ministry of Energy, clean water via SUSENAS) — not yet wired.
- **Kalimantan roll-up** — `aggregate_kalimantan()` adds a single `Kalimantan` row per indicator alongside the 5 province rows: **counts summed (exact)**, **rates/indices unweighted-mean (approx, labelled in the source string and flagged `confidence=medium`)**. Single-city points (air quality) are NOT rolled up. An aggregate over N<5 provinces is labelled "mean/sum of N/5 provinces".
- **BPS indicator recency varies** — latest year differs per indicator (unemployment 2025, electrification 2022, households 2019…), and BPS allows max 2 years/call, so `bps_value` tries year-pairs newest-first (125;124 → 123;122 → …) and takes the first with data.
- **BPS is flaky under load** — a heavy run (many indicators × year-pairs × 5 provinces) hits transient timeouts that silently drop indicators (coverage looked patchy until fixed). `bps_get` retries 3× with backoff. Production should also cache the verified var-id map to cut request volume.
- **BPS national domain (0000) holds the "by province" environmental indices** — IKLH (var 2531) and its components incl. water quality IKA (var 2532 / turvar 2176). This is how Kalimantan water quality is reachable by API (the project docs wrongly called it PDF-only).
- **Pillar data added** — Energy (electrification %), Food (paddy), Shelter (households), Entertainment (domestic tourist trips), Healthcare (life expectancy, since BPS has no hospital-beds metric).
- **GFW (several traps — see ingest_poc.py `pull_gfw`):**
  - Newly created keys take a few minutes to activate ("missing valid API key" at first).
  - The header is **case-sensitive**: must be lowercase `x-api-key` (urllib capitalizes to `X-api-key` → 403).
  - `latest` 307-redirects to a versioned path; resolve the version via the metadata endpoint `GET /dataset/<ds>/latest` (`.data.version`, currently `v20240118`) then query that explicit version.
  - GFW's **WAF 403s `urllib.request`** on longer queries — use stdlib **`http.client`** (or curl) instead; also send `Accept: */*` (an explicit `Accept: application/json` is rejected).
  - Summary tables have one row per canopy threshold — **filter `umd_tree_cover_density_2000__threshold=30`** or sums inflate.
  - Use **GADM adm1 summaries** for territories: MYS Sabah=13, Sarawak=14; IDN Kalimantan Barat=12, Selatan=13, Tengah=14, Timur=15, Utara=16; Brunei = whole ISO. Raster datasets (not these summaries) need a geometry.
- **World Bank:** use `mrv=N` (most-recent values) — `mrnev` is flaky (intermittent 400/timeout).
- **World Bank WGI (governance) codes were renamed** — the old `CC.EST` / `CC.PER.RNK` now 404. Use the new `GOV_WGI_*` codes, e.g. `GOV_WGI_CC.SC` = Control of Corruption (0-100 score). Governance has no sub-national value anywhere, so territories inherit their country's score.
- **NASA FIRMS can be transiently unreachable** (WinError 10051 / http 000). The pipeline logs the failure and continues; re-run when it recovers — the fire row repopulates.
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

## Verified sources for previously-"gap" items (real, cited — not fabricated)

**Fire hotspots (FIRMS) — backup when the API is down.** Primary = area API
(`/api/area/csv/{KEY}/VIIRS_NOAA20_NRT/108,-4,119,7/1`). When it 403s/hangs,
`pull_firms` falls back to NASA's **static regional 24h CSV** (no key):
`https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv`
filtered to the Borneo bbox. Same VIIRS NOAA-20 product. Verified working (returned
171 Borneo hotspots when the API was down). DB also keeps the last-good value.

**Brunei river water quality — data DOES exist (corrects "no data").** Not a public
API/dataset, but valid published sources:
- Monitoring authority: **JASTRe** (Dept. of Environment, Parks & Recreation, Ministry
  of Development) samples Sungai Brunei at ~10 stations, twice monthly.
- Peer-reviewed: *"Assessment of Pollution Status in Brunei River Using Water Quality
  Indices, Brunei Darussalam"*, Water 2024, 16(17):2439 (MDPI),
  https://www.mdpi.com/2073-4441/16/17/2439 — Brunei River = **"slightly polluted"
  (Malaysia DOE WQI)** / "moderately polluted" (NSF WQI), 8 stations, 16 parameters.
- Peer-reviewed: *"Importance of baseline assessments: monitoring of Brunei River's
  water quality"*, H2Open Journal 6(4):518, 2023 (IWA), https://iwaponline.com/h2open/article/6/4/518/98216
- Handling: exact numeric WQI must be read from the paper PDF → **admin back-office**
  (publishers block automated fetch). The *class* ("slightly polluted") is citable now.

**Flood risk — valid official sources (event/risk-based, treat as risk flag).**
- Indonesia (Kalimantan): **BNPB** — DIBI event database https://dibi.bnpb.go.id/ ·
  InaRISK flood **hazard/risk index per district** https://inarisk.bnpb.go.id/ ·
  Satu Data portal https://data.bnpb.go.id/ (downloadable).
- Malaysia (Sabah/Sarawak): **JPS Public InfoBanjir** https://publicinfobanjir.water.gov.my/
  (~200 hydrological stations, real-time) + NADMA.
- Brunei: National Disaster Management Centre (NDMC).
- No clean annual cross-territory index exists, so use as a risk flag; the most
  systematic metric is BNPB InaRISK's per-district flood hazard index for Kalimantan.
