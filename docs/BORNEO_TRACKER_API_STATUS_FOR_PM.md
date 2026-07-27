# Borneo Tracker API Status Report

**Prepared for:** Project Manager  
**Verification date:** 27 July 2026 (Asia/Kuala_Lumpur)  
**Scope:** Dashboard ESG/SDG data pipeline, News pipeline, Supabase, map services, and API integrations

> Security note: This report intentionally contains no API keys, tokens, passwords, or Supabase service-role credentials.

## 1. How to read the statuses

To avoid treating every problem as an “API failure”, this report uses five different statuses:

| Status | Meaning |
|---|---|
| ✅ Working end-to-end | The service responds, the project can process it, and its data reaches the current application. |
| 🟡 Partially usable | The service works, but a region has no data, a station is unavailable, coverage is incomplete, or the result does not reach the Dashboard. |
| ⏸ Available but not currently used | The endpoint works, but the project intentionally disables it or does not need it in the current production flow. |
| 🔑 Not currently verifiable | The integration needs a secret/token that is not configured in the current local environment or GitHub Actions. This does not prove that the external API is dead. |
| ❌ Confirmed unavailable | The endpoint was tested correctly and still failed, with no working fallback. |

### What “partially usable” means

It can mean either:

1. **Regional partial coverage:** some territories or cities return data while another territory/city does not; or
2. **Integration partial coverage:** the API returns valid data, but the result is filtered out, not committed, or not shown in the Dashboard.

The exact reason is stated for every partially usable source below.

## 2. Executive conclusion

The latest checks did **not** identify any core external platform that is permanently dead.

The main problems are:

- some sources have incomplete regional coverage;
- some credentials are not configured;
- some successful API results are discarded before reaching the Dashboard;
- some optional sources are intentionally disabled;
- DirectAdmin Production does not automatically receive GitHub’s latest static data files.

The latest successful automated runs were:

- [Dashboard data refresh — successful](https://github.com/angelyong/Borneo_Tracker/actions/runs/30222256621)
- [News digest and Supabase upload — successful](https://github.com/angelyong/Borneo_Tracker/actions/runs/30224359652)

## 3. APIs confirmed working end-to-end

| Service | Project use | Evidence | Status |
|---|---|---|---|
| data.gov.my / OpenDOSM | Sabah and Sarawak poverty, employment, education, healthcare, water, electricity and GDP | Live pull returned HTTP 200 with data; latest scheduled pipeline succeeded; rows appear in `indicators.json` | ✅ |
| World Bank API / WGI | Brunei indicators, governance, renewable electricity and national baselines | Live pull returned HTTP 200 with a current value; rows appear in `indicators.json` | ✅ |
| BPS Indonesia WebAPI | Statistics for the five Kalimantan provinces and districts | Latest keyed GitHub Actions run completed successfully; BPS rows appear in the Dashboard and district output | ✅ |
| Global Forest Watch | Forest cover and tree-cover loss | Latest keyed GitHub Actions run completed successfully; GFW rows appear in the Dashboard | ✅ |
| Global Forest Watch VIIRS | Annual fire alerts by territory | Latest keyed GitHub Actions run completed successfully; this is the fire-alert source currently shown in the Dashboard | ✅ |
| UNESCO World Heritage XML | Heritage-site count by Borneo territory | Live XML pull returned HTTP 200; project parser produced Sabah 1, Sarawak 2, Brunei 0 and Kalimantan 0 | ✅ |
| Gemini API | News relevance filtering, translation and rewriting | Latest workflow used `gemini-3.6-flash`, made 3 Gemini calls and completed successfully | ✅ |
| Supabase REST / PostgREST | Stores pending news drafts | Latest workflow inserted 3 pending drafts and received HTTP 201 | ✅ |
| Supabase Auth and database | Login, registration, password reset, profiles, roles and news administration | Production bundle contains the Supabase URL and publishable key; backend service-role key is not included in the frontend | ✅ |
| OpenStreetMap tiles | Dashboard map background | Live tile request returned HTTP 200 | ✅ |
| cdnjs Leaflet assets | Map marker images | Live asset request returned HTTP 200 | ✅ |

## 4. Partially usable APIs

### 4.1 WAQI / aqicn

**Type of partial availability:** regional/station coverage.

- Sabah, Sarawak, Brunei and several Kalimantan city requests succeeded in the latest workflow.
- The Banjarmasin query did not resolve to a usable station.
- One Kalimantan station returned a 2023 timestamp, so not every value labelled “live” is actually current.
- The Kalimantan Dashboard value is a mean of the available cities, not complete five-province air-quality coverage.

**Conclusion:** Keep WAQI, but fix the city/station mapping and reject or clearly label stale readings.

### 4.2 UN SDG API

**Type of partial availability:** regional coverage and Dashboard integration.

Live test of series `SI_POV_DAY1`:

| Area | HTTP result | Non-empty observations |
|---|---:|---:|
| Malaysia | 200 | 42 |
| Indonesia | 200 | 110 |
| Brunei | 200 | 0 |

The project parser successfully produced Malaysia and Indonesia rows, but no Brunei row.

The two successful rows currently use the territories `Malaysia` and `Indonesia`. The Dashboard exporter only accepts:

- Sabah
- Sarawak
- Brunei
- Kalimantan

Therefore, the API works but **zero UN SDG API rows reach the current Dashboard**.

**Conclusion:** This is not a dead API. Keep it only if the team will implement an honest national-baseline-to-territory mapping. Otherwise, remove it from the daily pipeline because it currently adds no visible Dashboard value.

### 4.3 NASA FIRMS

**Type of partial availability:** keyed configuration and Dashboard integration.

- The GitHub workflow does not currently provide `FIRMS_MAP_KEY`.
- The code automatically falls back to NASA’s official keyless Southeast Asia 24-hour CSV.
- The live fallback test returned HTTP 200 with approximately 5,070 Southeast Asia rows.
- After filtering to the Borneo bounding box, the project parser found **769 Borneo hotspots** during this verification.
- The result is stored under the territory `Borneo (all)`.
- The Dashboard only accepts Sabah, Sarawak, Brunei and Kalimantan, so the FIRMS row is filtered out.

The current Dashboard already uses **GFW VIIRS** for territory-level fire alerts.

**Conclusion:** FIRMS is technically working, but it currently provides no visible Dashboard value. The team should either:

1. remove FIRMS from the current daily pipeline and use GFW VIIRS as the single fire source; or
2. retain FIRMS as an independent validation/live-fire source and implement territory-level spatial allocation.

### 4.4 BPS Indonesia coverage

**Type of partial availability:** data coverage, not API failure.

The BPS API and key are working. However, not every statistical variable is available consistently for all five Kalimantan provinces. Some generated aggregates are based on:

- 1/5 provinces;
- 2/5 provinces;
- 4/5 provinces; or
- all 5/5 provinces.

**Conclusion:** Keep BPS. The source and coverage count must remain visible so partial aggregates are not mistaken for complete Kalimantan statistics.

### 4.5 Publisher RSS feeds

**Type of partial availability:** intermittent source reliability and regional balance.

The latest News workflow temporarily received HTTP errors from:

- The Borneo Post;
- The Vibes.

Both feeds were tested again on 27 July 2026 and returned:

- HTTP 200;
- valid RSS items.

Therefore, they are **not permanently dead**. Their earlier errors were temporary or intermittent.

The latest workflow collected 16 news items, but all 16 were classified under Kalimantan. This means the pipeline works, but the latest Sabah, Sarawak and Brunei coverage was weak.

**Conclusion:** Keep the feeds, add retries, and monitor coverage by territory.

## 5. Available but not currently used

| Service | Live verification | Why it is not currently used |
|---|---|---|
| Google News RSS | HTTP 200 with valid RSS items | The collector defaults to `--google=false` because Google News results are noisier, headline-only and often use redirect links |
| GADM boundary download | Existing project utility and committed GeoJSON | Used when building geographical boundaries, not during normal Production runtime |
| NASA FIRMS keyed area endpoint | Not currently tested with a configured secret | The project currently reaches FIRMS through the keyless official CSV fallback |

**Recommendation for Google News:** Keep it disabled by default. Use it only as a fallback when native publisher feeds do not provide enough Sabah, Sarawak or Brunei coverage.

## 6. Not currently verifiable because credentials are missing

### 6.1 Global Data Lab

The current GitHub dashboard workflow does not provide `GDL_API_TOKEN`, and the local `.env` does not contain an active token.

This does not mean the API is dead:

- the repository contains a cache fetched successfully on **9 July 2026**;
- that cache contains 1,610 rows;
- it contains current target rows for Sabah, Sarawak and Brunei;
- the latest target year is 2023.

Without a token, a new GDL download does not return the dataset. The current pipeline therefore prints that GDL is skipped.

The current Dashboard still contains fixed fallback schooling values for Sabah and Sarawak, but those are not a fresh GDL API pull.

**Conclusion:** GDL is useful for the Education pillar, but it is not currently active. Add a valid GitHub Actions secret if automatic refresh is required. For a university demonstration, the cited fixed values may be sufficient if clearly labelled.

### 6.2 Secondary Gemini key

`GEMINI_API_KEY_2` is empty in the latest workflow.

The primary Gemini key is working, so this does not break the News pipeline. The second key is only an optional fallback for quota or availability problems.

### 6.3 Keyed FIRMS endpoint

`FIRMS_MAP_KEY` is not passed into the current GitHub dashboard workflow.

The keyless official CSV fallback works, so the fire-data pull does not fail. However, the project has not reverified the keyed area endpoint using the current GitHub environment.

## 7. Data gaps that do not currently have a complete API integration

These should not be described as broken APIs because the project has not integrated a consistent API for them.

| Data gap | Current position |
|---|---|
| River water quality / WQI / IKA | No consistent Borneo-wide API. Malaysia and Indonesia data are often in reports/PDFs; Brunei coverage is limited. Use Clean Water Access as the main SDG 6 metric. |
| Flood risk | No consistent comparable Borneo-wide API integrated. Treat it as an event/risk flag unless a verified methodology is added. |
| FAOSTAT food data | Planned but not connected to the current pipeline. |
| Some Brunei annual indicators | Use cited DEPS/government reports or admin-reviewed manual values where no comparable API exists. |

## 8. Successful API output that currently gets lost

### 8.1 UN SDG rows

The API produces Malaysia and Indonesia rows, but they are excluded because their territory names are not part of the four Dashboard territories.

### 8.2 NASA FIRMS row

The API/fallback produces a `Borneo (all)` row, but that territory is excluded by the Dashboard exporter.

### 8.3 District refresh output

The daily pipeline successfully generates `public/data/districts.json` with 987 district rows.

However, `.github/workflows/refresh-data.yml` does not include this file in its `git add` command. The new file is therefore discarded when the workflow finishes.

This is a workflow problem, not a BPS or GFW API failure.

## 9. Recommended keep/remove decisions

### Keep as core Production sources

- data.gov.my / OpenDOSM
- World Bank API / WGI
- BPS Indonesia
- Global Forest Watch
- GFW VIIRS
- WAQI, after station and freshness fixes
- UNESCO
- Gemini
- Supabase
- native publisher RSS feeds
- OpenStreetMap

### Keep only if the missing integration is implemented

- **UN SDG API:** keep if national baseline data will be mapped and clearly labelled; otherwise it currently adds no visible value.
- **NASA FIRMS:** keep if it will become an independent live-fire/validation layer; otherwise GFW VIIRS already fulfils the current Dashboard requirement.
- **Global Data Lab:** keep if a valid token and refresh policy are added; otherwise use the existing cited fallback for the university demonstration.

### Leave disabled or development-only

- Google News RSS: optional coverage fallback only.
- GADM download: build utility only.
- Secondary Gemini key: optional resilience/quota fallback.

## 10. Required actions

1. Add `public/data/districts.json` to the dashboard workflow’s commit step.
2. Decide whether NASA FIRMS is redundant or will become a real territory-level live-fire layer.
3. Decide whether UN SDG national baselines should be mapped into the four-territory model.
4. Correct the WAQI Banjarmasin station and enforce freshness checks.
5. Add `GDL_API_TOKEN` only if automatic schooling-data refresh is required.
6. Add retry/backoff monitoring for publisher RSS feeds.
7. Monitor news counts separately for Sabah, Sarawak, Brunei and Kalimantan.
8. Continue displaying `data_level`, source, year, confidence and province-coverage information so partial data is never presented as complete.

## 11. Final classification

### Confirmed working

OpenDOSM, World Bank, BPS, Global Forest Watch, GFW VIIRS, UNESCO, Gemini, Supabase, OpenStreetMap and cdnjs.

### Working with limitations

WAQI, UN SDG, NASA FIRMS, partial BPS indicators and publisher RSS feeds.

### Available but intentionally not used

Google News RSS and GADM runtime downloads.

### Not active because current credentials are missing

Global Data Lab, keyed NASA FIRMS path and the secondary Gemini key.

### Confirmed permanently dead

**None identified during this verification.**

