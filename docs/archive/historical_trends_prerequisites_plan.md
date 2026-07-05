# Historical Trends Prerequisites and Implementation Plan

> ## ✅ STATUS: WAVE 1 SHIPPED (2026-07-06, commit `9c30add`)
> Phases 1–7 executed in reduced-scope form: DB repair done; `indicator_observations` table (the "safer
> recommendation" below) chosen over a key change; `ingest_history.py` pulls real multi-year series
> (256 observations, 16 series); JSON exports `series` + `trendReady`; the frontend charts a trend only
> when ≥3 real annual points exist. Known holes: WB-sourced Brunei/Kalimantan series back-fill via the
> daily workflow; Kalimantan Timur unmapped in GFW change tables (4/5 provinces, labelled).
> Kept as history — the full eligibility-matrix process was deliberately trimmed to the wave-1 subset.

This document records what is currently missing before Borneo Tracker can implement real Historical Trends, what the team should do, and the concrete execution plan.

Current recommendation:

> Do not enable real trend charts yet. First complete database setup repair, then build the historical data foundation safely.

---

## 1. Current Status

The project currently supports a real-data snapshot dashboard.

Historical Trends are not ready yet because the current data pipeline, database, JSON export, and frontend helper are designed around latest/snapshot values.

Confirmed evidence:

- `HANDOFF.md` says trends require a schema change.
- `load_db.py` currently uses `PRIMARY KEY (territory, indicator)`, so it cannot keep multiple years for the same indicator.
- `borneo_tracker_poc.csv` and `manual_overrides.csv` do not currently contain repeated multi-year rows for the same `territory + indicator`.
- `export_json.py` currently exports flat `rows` and sets `trendReady` to `False`.
- The frontend correctly shows `Snapshot only` / `Historical series not enabled yet`.

This means the frontend is not the main blocker. The missing foundation is in the data and backend pipeline.

---

## 2. What We Are Missing

### 2.1 Stable Database Setup

Before adding trend schema, `python load_db.py` must reliably create a valid `borneo_tracker.db`.

Missing now:

- Stable publish from generated DB to `borneo_tracker.db`.
- Validation before publishing.
- Clear failure when the DB cannot be safely written.
- No silent fallback hiding DB setup problems.

Why this matters:

If the current DB setup is unstable, adding historical tables will make the problem harder to debug.

---

### 2.2 Historical Data Source Audit

We do not yet have proof that each candidate indicator has usable yearly history.

Missing now:

- A source-by-source check for available historical years.
- Confirmation that each yearly series uses the same unit and definition.
- Confirmation that source APIs can return multi-year data.
- Confirmation of which sources need API keys.
- Confirmation of which manual indicators can be backed by multi-year reports.

Required output:

- A `trend eligibility matrix`.

Suggested fields:

- `dashboard_concept`
- `indicator`
- `territory`
- `source`
- `metric_definition`
- `unit`
- `frequency`
- `available_year_start`
- `available_year_end`
- `year_count`
- `missing_years`
- `min_years_required`
- `trend_ready`
- `blocking_reason`
- `confidence`
- `source_url`
- `retrieved_date`
- `notes`

---

### 2.3 Time-Series Database Schema

The current `indicators` table stores one latest value per `territory + indicator`.

Missing now:

- A schema that can store multiple years.
- A clear difference between snapshot rows and historical observation rows.
- Period fields for yearly, range, cumulative, and live data.
- Rules for duplicate yearly values from multiple sources.
- Series-level provenance.

Recommended direction:

- Keep the current snapshot output stable for existing frontend pages.
- Add a time-series structure, either:
  - upgrade the key to include `year`, or
  - add a dedicated `indicator_observations` table.

Safer recommendation:

> Add `indicator_observations` and keep snapshot export compatible.

---

### 2.4 Historical Ingestion Logic

The current ingestion script often picks the newest/latest available value.

Missing now:

- Multi-year pull logic in `ingest_poc.py`.
- Source-specific historical collection rules.
- Annual value normalization.
- Avoiding partial-year values unless clearly labelled.
- Keeping live data separate from annual trend data.

Examples:

- `data.gov.my` currently uses latest-style selection.
- World Bank calls currently use most-recent values.
- BPS logic currently searches newest years first.
- GFW fire logic currently finds the latest complete year.
- WAQI AQI is live data and should not become a historical trend unless a proper historical AQI source is added.

---

### 2.5 JSON Series Contract

The frontend currently receives only flat snapshot rows.

Missing now:

- A stable JSON contract for trend series.
- `series` points per indicator.
- `trendStatus` and `trendReason`.
- A top-level `trendReady` value calculated from real available series.
- Backward compatibility with current `rows`.

Recommended rule:

> Keep `rows` for snapshot pages. Add `series` only when real historical points exist.

---

### 2.6 Frontend Trend Rules

The frontend should not invent or estimate trends.

Missing now:

- Helper functions to read trend series.
- Eligibility checks before showing a trend chart.
- Clear empty-state messages when history is unavailable.
- Rules for live, cumulative, range, static, or manual one-point indicators.

Display rule:

> Only show a historical trend chart when the data has enough real annual points using the same unit and definition.

Recommended minimum:

- At least 3 annual points for a normal trend.
- No interpolation.
- No fake points.
- No splitting cumulative range values like `2001-2023` into annual values.

---

### 2.7 Kalimantan Historical Aggregation Rules

Kalimantan is built from multiple provinces and needs stricter trend handling.

Missing now:

- Per-year aggregation rules.
- Required province coverage per year.
- Whether 4/5 provinces is acceptable.
- Whether to use sum, unweighted mean, population weighting, or area weighting.
- How to label partial coverage.

Recommendation:

> Do not mix complete and partial Kalimantan years without clearly marking coverage.

---

### 2.8 Validation and Testing

Historical Trends need stronger validation than snapshot data.

Missing now:

- DB integrity checks.
- Series uniqueness checks.
- JSON schema checks.
- No-fabricated-values checks.
- Frontend eligibility checks.
- Regression checks to make sure snapshot pages still work.

---

## 3. What We Should Do

Recommended implementation order:

1. Finish DB Setup Repair Plan first.
2. Create the trend eligibility matrix.
3. Choose a small MVP set of trend indicators.
4. Design and agree on the time-series schema.
5. Update ingestion to collect real yearly history for MVP indicators.
6. Update database loading to preserve historical observations.
7. Update JSON export to include series data.
8. Update frontend helpers and UI to show trends only when eligible.
9. Run validation and review.

This keeps the current snapshot dashboard stable while adding historical capability safely.

---

## 4. Suggested MVP Trend Indicators

These are candidates only. They still need source-history audit before implementation.

### Stronger Candidates

- `Fire alerts (VIIRS, annual)`
- `Unemployment rate`
- `GDP growth` / `GDP growth (PDRB)`
- `Life expectancy`
- `Clean water access`

### Possible Candidates With Extra Checks

- `Crop production (paddy)`
- `Mean years schooling (RLS)`
- `Poverty rate`
- `Control of Corruption (WGI)`
- `Tree cover loss`, only if changed from cumulative to true annual loss

### Not Recommended For First Trend MVP

- `Air quality (AQI, live)`, because it is live snapshot data.
- `National parks`, because it is more like a static inventory count.
- `UNESCO sites`, because it is more like a static inventory count.
- `Tourist arrivals`, unless the team confirms one comparable definition across territories.
- `Electrification ratio`, because current coverage is incomplete.

---

## 5. Concrete Implementation Plan

### Phase 1: Repair DB Setup

Files:

- `load_db.py`
- `export_json.py`
- `run_pipeline.py`

Actions:

- Stop merging old broken DB rows by default.
- Build DB deterministically from CSV + manual overrides + data model.
- Add `PRAGMA quick_check`.
- Validate that `indicators` exists and has valid rows.
- Fail clearly if `borneo_tracker.db` cannot be published.
- Stop deleting SQLite journal files manually.
- Make model fallback in `export_json.py` explicit.

Impact:

- Makes the handoff requirement reliable.
- Reduces risk before adding historical schema.
- Existing frontend should still read the same JSON path.

---

### Phase 2: Create Trend Eligibility Matrix

Files:

- New file, recommended: `trend_eligibility_matrix.csv` or `trend_eligibility_matrix.md`

Actions:

- List all candidate indicators.
- Record available historical years.
- Record source, unit, definition, confidence, and blocking reason.
- Mark each indicator as `ready`, `blocked`, or `needs_review`.

Impact:

- Prevents the team from implementing fake or weak trends.
- Makes missing data visible to teammates.

---

### Phase 3: Design Time-Series Schema

Files:

- `load_db.py`
- possibly `data_model.py`
- possibly a schema note file

Actions:

- Add time-series storage.
- Preserve current snapshot rows.
- Add period fields:
  - `period_type`
  - `period_start_year`
  - `period_end_year`
  - `period_label`
- Add provenance fields:
  - `source`
  - `source_url`
  - `retrieved_date`
  - `confidence`
- Add trend fields:
  - `trend_eligible`
  - `trend_blocked_reason`

Impact:

- Enables multiple years per indicator.
- Avoids breaking existing frontend pages.

---

### Phase 4: Update Historical Ingestion

Files:

- `ingest_poc.py`
- possibly `manual_overrides.csv`

Actions:

- Change latest-only source pulls into multi-year pulls for MVP indicators.
- Keep live values out of historical annual trends.
- Add one row per territory, indicator, and year.
- For manual data, require one cited row per year.

Impact:

- Creates real historical observations.
- Avoids fabricated or interpolated trend values.

---

### Phase 5: Export Trend JSON

Files:

- `export_json.py`
- `public/data/indicators.json`

Actions:

- Keep existing `rows`.
- Add `series` data for eligible indicators.
- Add `trendStatus`.
- Add `trendReason`.
- Calculate top-level `trendReady`.

Impact:

- Current snapshot UI remains compatible.
- Frontend can safely detect which trends are real.

---

### Phase 6: Frontend Trend Display

Files:

- `src/data/useIndicators.js`
- `src/pages/dashboard/Regional_Detail.jsx`
- possibly `src/pages/ESG/esg_indicator.jsx`

Actions:

- Add helper functions for trend series.
- Show trend charts only when `trendStatus` is `ready`.
- Otherwise show a clear explanation such as `Historical data not available yet`.
- Keep snapshot charts visible.

Impact:

- Users see honest trend availability.
- No fake trend chart is displayed.

---

### Phase 7: Validation

Files:

- Existing scripts or new validation script

Actions:

- Confirm DB is readable.
- Confirm historical rows are not overwritten.
- Confirm every trend series has enough real points.
- Confirm JSON contains valid `rows` and valid `series`.
- Confirm frontend still loads.
- Confirm no API key is exposed to frontend.

Impact:

- Gives the team confidence before presenting or pushing.

---

## 6. What Cannot Be Completed Yet

The following cannot be completed until missing data or decisions are provided.

### 6.1 Full Historical Trends For All Indicators

Missing:

- Confirmed historical source availability for all indicators.
- Multi-year data in the project files.
- Time-series database schema.

Why blocked:

- Current CSV/manual data only supports snapshot display.

---

### 6.2 Historical AQI Trend

Missing:

- A proper historical AQI data source or API access.

Why blocked:

- Current AQI is live snapshot data.

---

### 6.3 Annual Tree Cover Loss Trend

Missing:

- Annual tree cover loss data, not only cumulative `2001-2023`.

Why blocked:

- A cumulative range cannot be honestly displayed as yearly points.

---

### 6.4 Kalimantan Full Historical Series

Missing:

- Per-year province coverage rules.
- Decision on partial province coverage.
- Decision on weighting method.

Why blocked:

- Aggregated trend values can be misleading if province coverage changes by year.

---

### 6.5 Resilience Index Trend

Missing:

- Final index calculation method.
- Normalization targets.
- Weights.
- Missing-data rules.
- Historical re-calculation rules.

Why blocked:

- Indicator trends and Resilience Index trends are different features.

---

## 7. Recommended Next Step

Proceed in this order:

1. Discuss and implement `db_setup_repair_plan.md`.
2. After DB setup is stable, create the trend eligibility matrix.
3. Choose 2-3 MVP trend indicators.
4. Only then start time-series implementation.

Final recommendation:

> Treat Historical Trends as the next backend/data milestone after DB setup repair, not as a frontend-only chart task.
