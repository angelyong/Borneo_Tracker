# Borneo Tracker — Handoff to Integration Developer

> **Your mission:** connect the data we collected to the frontend, and get the database set up.
> This doc explains what already exists, how to run it, and exactly what you need to build.
> Written by the data-layer author (Henry). Ask me anything that's unclear.

---

## 0. TL;DR — what you're taking over

We (the data layer / Phase 3) have already:
- Collected **real, cited data** for 4 territories × 3 frameworks from 8 sources.
- Built a **Python pipeline** that writes a **SQLite database** (`borneo_tracker.db`) with one clean table.
- Built the **frontend UI shell** (React + Vite) — but its pages currently show **hardcoded mock data**.

**Your job:**
1. **Set up the database** (one command — see §2).
2. **Connect frontend ↔ backend**: expose the database to the frontend and **replace all mock data with the real database values**.
3. (Together with me) decide snapshot-only vs historical trends (see §6).

---

## 1. The architecture (the rule you must follow)

```
  Python pipeline (backend)            Frontend (React + Vite, static)
  ────────────────────────             ───────────────────────────────
  ingest_poc.py  → pulls 8 sources
        ↓ writes
  borneo_tracker_poc.csv  (committed to git)
        ↓ load_db.py
  borneo_tracker.db  (SQLite, the standard table)
        ↓  ← YOU build this bridge →   fetch JSON  →  map / charts / scorecards
```

**Hard rule:** API keys are **backend-only**. The frontend must **never** call a source API directly (CORS + key exposure). The frontend reads only **our database / an export of it**.

---

## 2. Setting up the database (start here)

You do **not** need any API keys to get the database, because the data CSV is committed.

```bash
# 1. Python deps (standard library only for load_db; pipeline uses urllib/http.client)
python --version            # 3.10+ recommended

# 2. Build the database from the committed CSV + manual layer:
python load_db.py
# → creates borneo_tracker.db (and prints row counts + coverage)
```

That's it — `borneo_tracker.db` now exists with ~145 rows.

**Only if you want to re-pull fresh data from the live sources** (not required to start):
```bash
cp .env.example .env        # then ask Henry for the real key values
python run_pipeline.py      # ingest_poc.py (needs keys) → load_db.py
```
Keys needed are listed in `.env.example` (GFW, BPS, FIRMS, WAQI; data.gov.my / World Bank / UN are keyless). The real `.env` is git-ignored — get it from me.

---

## 3. The database — schema you'll query

One table, `indicators`. One row = one measurement.

| Column | Meaning |
|---|---|
| `territory` | Sabah / Sarawak / Brunei / Kalimantan (+ 5 Kalimantan provinces, + some country rows) |
| `indicator` | e.g. "Life expectancy", "Fire alerts (VIIRS, annual)" |
| `year` | year of the value (string) |
| `value` | the number (REAL) |
| `unit` | %, years, tonnes, ha, count, AQI, households, arrivals… |
| `source` | provenance text (incl. citation for manual figures) |
| `data_level` | state / province / national / satellite / city / territory / report |
| `esg_pillar` | E / S / G |
| `sdg_goal` | SDG1…SDG16 |
| `hexagon_pillar` | Food / Energy / Education / Shelter / Healthcare / Entertainment |
| `confidence` | **high** (exact API) / **medium** (inherited or province-average) / **manual** (cited report) |
| `last_updated` | ISO date the row was written |
| `canonical` | **1 = the unified metric for its concept** (use this!), else 0 |

**Primary key:** `(territory, indicator)`.

### The most important query for you
The dashboard's 4-territory comparison view = **canonical rows for the 4 territories**:
```sql
SELECT territory, indicator, value, unit, year, confidence,
       esg_pillar, sdg_goal, hexagon_pillar
FROM indicators
WHERE canonical = 1
  AND territory IN ('Sabah','Sarawak','Brunei','Kalimantan');
```
Filter by `esg_pillar='E'`, `sdg_goal='SDG6'`, or `hexagon_pillar='Food'` to drive each view.

Inspect quickly: `python poc_progress.py` prints a coverage table; or open the `.db` in DB Browser for SQLite.

---

## 4. Connecting backend → frontend (the main task)

The frontend is a **static Vite SPA** — it **cannot read a SQLite file** in the browser. Pick one bridge:

### Option A (recommended — simplest, no server): export DB → JSON
Write a small script `export_json.py` that reads `borneo_tracker.db` and writes
`public/data/indicators.json` (or `src/data/`). The frontend then `fetch('/data/indicators.json')`.
- Pros: no backend server, works on any static host, fits our architecture.
- Add it as a final step in `run_pipeline.py` so the JSON refreshes with the data.
- Suggested JSON shape:
```json
[
  {"territory":"Sabah","indicator":"Life expectancy","value":75.3,"unit":"years",
   "year":"2024","confidence":"manual","esg":"S","sdg":"SDG3","hexagon":"Healthcare","canonical":1},
  ...
]
```
(or grouped by territory/pillar — your call).

### Option B: a small API (Flask / FastAPI)
Serve `GET /api/indicators?canonical=1&framework=esg`. Only worth it if you want live queries.
Keep it backend-side; the frontend calls your API, never the source APIs.

**Recommendation: Option A.** It's the least work and matches "frontend reads the database".

---

## 5. Replacing the mock data (and removing fake numbers)

The UI is built but every page uses **hardcoded sample data that is NOT real** — some values are even invented (e.g. ESG page shows Kalimantan life expectancy 65.8; the real value is 72.3). **These must be replaced**, both for correctness and because the project's rule is *no fake data*.

| File | What it is | What to do |
|---|---|---|
| `src/pages/dashboard/OverviewDashboard.jsx` | Leaflet map + layer toggles (toggles not wired) | Color/overlay territories from real data per selected layer |
| `src/pages/ESG/esg_indicator.jsx` | Region dropdown + E/S/G tabs + scorecards | Replace the big `esgData` mock object with fetched real data |
| `src/pages/dashboard/Regional_Detail.jsx` | **ECharts: trend line + Hexagon radar + bar** | Replace the `Sample data` consts with fetched real data |
| `src/components/sidebar.jsx`, `src/App.jsx` | Nav + routes (5 routes still "Coming Soon") | Build out `/sdg`, `/social`, etc. if in scope |

Suggested pattern: one small data module (e.g. `src/data/useIndicators.js`) that fetches the JSON once and exposes helpers like `getByTerritory(t)`, `getPillar(p)`, `getCanonical()`. Every page reads from it — no more inline mock objects.

**Always show the `confidence` tag** next to a value (high/medium/manual). It's a core project requirement (the "Ethics" pillar) — the dashboard must show how trustworthy each number is.

### Exact mock variables to replace (verified against the current code)
- `esg_indicator.jsx` → the `esgData` object (lines ~14–203). Some values are invented — replace entirely.
- `Regional_Detail.jsx` → `resilienceScores`, `regionScores`, `pillarData`, `cropProduction`, `agriculturalLand`, `years`, `currentScore`, `trend` (the "Sample data" block, lines ~18–45). These feed the line, radar, and bar charts.
- `OverviewDashboard.jsx` → the `layers` toggles exist but drive nothing; wire them to color/overlay territories from real data.
- `App.jsx` routes: `/`, `/regions`, `/esg` are real pages; `/sdg`, `/environmental`, `/social`, `/data-sources`, `/about` are still "Coming Soon" placeholders (5 routes). `sidebar.jsx` already links all 8.

### 🐞 Known bug to fix first — filename case mismatch
The file is `src/components/sidebar.jsx` (lowercase **s**), but all three pages import `'../../components/Sidebar'` (capital **S**). This works on Windows (case-insensitive) but **will fail the build on Linux/macOS / most deploy hosts** (Vercel, Netlify, CI). Fix one way:
- rename the file to `Sidebar.jsx`, **or**
- change the 3 imports to `'../../components/sidebar'`.
(Pick one and be consistent.)

---

## 6. Snapshot vs. trends — one decision to make with me

Right now the DB keeps **only the latest value per indicator** (PK is `territory + indicator`), so the trend line in `Regional_Detail.jsx` can't be real yet.

The team wants **both** snapshot and trends. To enable trends:
- Change the key to `(territory, indicator, year)` and have `load_db.py` keep per-year rows.
- This is a **backend change** — coordinate with me before you build charts on the schema, so you don't build twice.

Until then: snapshot views (scorecards, radar, map, RAG status) work fully; trend lines need the schema change.

---

## 7. Still to be built (may be yours or shared)

- **Resilience Index calculation** — the headline 0–100 score per pillar/territory. Method is fully specified in `borneo_tracker_resilience_index_methodology.md` (normalize each indicator to 0–100 vs a target → average 6 pillars → show weakest). Not yet coded. Decide who owns this.
- **Historical trends** (see §6).
- The 5 placeholder routes in `App.jsx`.

---

## 8. Integrity rules (please keep)

1. **No fabricated numbers.** If data is missing, leave it blank/null — don't invent or estimate.
2. **Keep the `confidence` tag visible** in the UI.
3. **Don't hardcode data in the frontend** — always read from the DB/JSON, so it stays in sync.
4. **Never put API keys in the frontend.**

---

## 9. File map

| File | Role |
|---|---|
| `ingest_poc.py` | Pulls all 8 sources → CSV (backend, needs keys) |
| `load_db.py` | CSV + manual layer → SQLite, adds tags/confidence/canonical |
| `run_pipeline.py` | Runs ingest + load in one command (+ add JSON export here) |
| `borneo_tracker_poc.csv` | The collected data (committed — DB is built from this) |
| `manual_overrides.csv` | Cited report-only figures (provenance per row) |
| `borneo_tracker.db` | The SQLite DB (git-ignored; you generate it) |
| `poc_progress.py` | Coverage report (sanity-check tool) |
| `discover_bps_map.py` | Rebuilds the BPS variable map (advanced, rarely needed) |
| `src/` | The React frontend (pages, sidebar, App router) |
| `PROGRESS_REPORT.md` / `.docx` | Full data-layer report |
| `borneo_tracker_api_keys_setup.md` | Key status, source gotchas, consistency & gaps |
| `borneo_tracker_resilience_index_methodology.md` | How to compute the Resilience Index |

---

## 10. Your starter checklist

- [ ] `python load_db.py` → confirm `borneo_tracker.db` is created
- [ ] Open the DB / run `python poc_progress.py` → see the real data
- [ ] Write `export_json.py` (DB → `public/data/indicators.json`) and add it to `run_pipeline.py`
- [ ] Build `src/data/useIndicators.js` to fetch + expose the data
- [ ] Replace mock data in `Regional_Detail.jsx`, `esg_indicator.jsx`, `OverviewDashboard.jsx`
- [ ] Show the `confidence` tag on every value
- [ ] Decide snapshot-only vs trends with Henry (schema change if trends)
- [ ] Agree who builds the Resilience Index calculation

Welcome aboard — the data is real, cited, and ready. The main work is the bridge + swapping mock → real. — Henry
