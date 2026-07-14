# Borneo Tracker (T002)

A public, open-data **ESG / SDG / Resilience dashboard for Borneo Island** — Sabah, Sarawak (Malaysia), Brunei, and Kalimantan (Indonesia, 5 provinces rolled up). Every number is real, cited, and tagged with a confidence level; where data does not exist we show the gap instead of inventing a value.

**Stack:** Python data pipeline → SQLite → static JSON → React + Vite frontend (Leaflet map, ECharts).

## Features

| Page | Route | What it shows |
|---|---|---|
| Overview | `/` | Borneo map with snapshot overlays (forest, deforestation, air quality, fire, poverty) |
| Regional Detail | `/regions` | Per-territory dashboard: Resilience Index, cross-territory comparison, **real historical trend charts**, Hexagon/ESG coverage |
| ESG Indicators | `/esg` | E / S / G indicators per territory with confidence tags |
| SDG Progress | `/sdg` | Six UN SDGs (No Poverty, Quality Education, Clean Water, Economic Growth, Climate Action, Life on Land) |
| Community | `/community` | Discussion feed with search/filter, posting **with image/video/file attachments**, likes, comments, share, and delete-your-own-post (frontend-only — see limitations below) |

## Quick start

```bash
# 1. Build the database from the committed CSVs (no API keys needed)
python load_db.py

# 2. Export the JSON the frontend reads
python export_json.py
python compute_resilience.py

# 3. Run the frontend
npm install
npm run dev          # -> http://localhost:5173
npm run test         # -> Vitest (Community upload rules, storage & service)
```

## Login backend (local development)

The application now includes a PostgreSQL-backed authentication server. Start PostgreSQL and the local Mailpit inbox, apply migrations, then run the API, email worker and frontend:

```powershell
docker compose up -d
npm run db:generate
npm run db:deploy --workspace server
npm run dev:server
npm run dev:worker
npm run dev
```

The project database uses host port `5433` to avoid conflicts with existing Windows PostgreSQL installations. Mailpit is available at `http://localhost:8025`. Full backend instructions are in [`server/README.md`](server/README.md).

To re-pull fresh data from the live sources you need API keys (`cp .env.example .env` and fill in), then:

```bash
python run_pipeline.py   # ingest -> history -> SQLite -> JSON -> resilience (5 steps)
```

## Architecture

```
 8 open APIs + 1 cited manual layer
        │  ingest_poc.py (snapshot)  +  ingest_history.py (multi-year series)
        ▼
 borneo_tracker_poc.csv + borneo_tracker_history.csv   (committed)
        │  load_db.py  (validates before publishing)
        ▼
 borneo_tracker.db   — `indicators` (snapshot) + `indicator_observations` (per-year)
        │  export_json.py + compute_resilience.py
        ▼
 public/data/indicators.json + resilience.json          (committed)
        │  fetch()
        ▼
 React frontend (src/data/useIndicators.js — the only data entry point)
```

**Hard rule:** API keys are backend-only. The frontend never calls a source API — it reads only the exported JSON.

## Automated daily refresh

`.github/workflows/refresh-data.yml` runs the full pipeline every day at 05:00 MYT and commits refreshed data (which auto-redeploys any static host connected to this repo). Requires three repository secrets: `GFW_API_KEY`, `BPS_API_KEY`, `WAQI_TOKEN`.

## Data sources & rate limits

| Source | Used for | Auth | Official limit | Our daily use |
|---|---|---|---|---|
| data.gov.my / OpenDOSM | Sabah & Sarawak state stats | none | **4 req/min** (throttled in code) | ~15 |
| World Bank | Brunei national + inherited country series | none | none published | ~40 |
| UN SDG API | Extreme-poverty baseline | none | none published | 3 |
| BPS Indonesia | Kalimantan 5-province stats | key | none published (load-throttled) | ~40–70 |
| Global Forest Watch | Forest, deforestation (annual, 2001–2024), VIIRS fire | key | per-key quota | ~45 |
| WAQI / aqicn | Live city AQI | token | 1,000 req/sec | 7 |

## Data integrity rules

1. **No fabricated numbers** — missing data stays blank and is labelled a gap.
2. Every value carries a **confidence tag** (high = exact API / medium = inherited or averaged / manual = cited report) shown in the UI.
3. Trend charts need **≥ 3 real annual points** — no interpolation, no splitting cumulative ranges into fake yearly values.
4. Kalimantan roll-ups are labelled with province coverage (e.g. "sum of 4/5 provinces").

## Known limitations

- **Air quality**: live value only — the free WAQI API has no history, so no AQI trend.
- **River water quality**: PDF-only for MY/ID, none for Brunei → Clean Water *Access* is the SDG 6 metric.
- **Kalimantan Timur** is unmapped in GFW's VIIRS/TCL-change tables → Kalimantan fire & deforestation trends aggregate 4/5 provinces (labelled).
- **Governance** is country-level only (no sub-national score exists anywhere).

### Community attachments (frontend-only prototype)

The Community feature has **no backend**. Posts, comments, likes and uploaded attachments are stored **only in the current browser** — post/attachment metadata in `localStorage`, and attachment blobs in IndexedDB (`borneo-tracker-community`). Consequences:

- Content is **not shared** across devices or users; another visitor sees only the seed posts.
- Attachments survive a refresh **only while the browser keeps the storage** — browsers can evict IndexedDB under storage pressure (Safari especially). The app requests persistent storage best-effort, but persistence is **not guaranteed**.
- Front-end file validation (type / size / count) is for UX only — it is **not** a virus scan or content-signature check.
- A crash between the two storage writes can leave an orphan blob; v1 does best-effort cleanup at create/delete time and does **not** run a background reconciliation pass (that belongs on a future backend).
- Login integration records the authenticated `user.id` on local posts/comments and isolates ownership/likes between accounts that share a browser. This is still not a server authorization boundary. Local development permits the prototype; production builds keep Community writes disabled unless `VITE_ENABLE_COMMUNITY_WRITES=true` is deliberately set.

A real multi-user version needs a backend (auth, shared DB, object storage, malware scanning, moderation) — the migration path is in `docs/COMMUNITY_UPLOAD_IMPLEMENTATION_PLAN.md`.

## Key files

| File | Role |
|---|---|
| `ingest_poc.py` / `ingest_history.py` | Pull snapshot / multi-year data from the 8 sources |
| `data_model.py` | Concept mapping, canonical-flag & confidence logic |
| `load_db.py` | CSVs → SQLite with validation (fails loudly, never publishes a broken DB) |
| `export_json.py` / `compute_resilience.py` | DB → frontend JSON (snapshot + series / index scores) |
| `run_pipeline.py` | All five steps in one command |
| `src/data/useIndicators.js` | The frontend's single data module |
| `HANDOFF.md` / `PROGRESS_REPORT.md` | Project history & data-layer report |
