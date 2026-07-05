# Borneo Tracker (T002) — Data Layer Progress Report

**Phase 3 — Data Collection & Pipeline**
**Status:** Substantially complete · **Report date:** 2026-06-29
**Prepared by:** Henry (data layer)

---

## 摘要 (Executive summary, 中文)

本报告记录 Borneo Tracker 数据层(Phase 3)已收集到的所有资源。我们为 **4 个地区**(Sabah、Sarawak、Brunei、Kalimantan)× **三套框架**(ESG / UN SDG / True Wealth Hexagon)建立了一条**全自动、可追溯、口径统一**的数据管道:**7 个 API + 1 个手录层 → 标准表 → SQLite 数据库**。

- **数据库:145 行,32 个指标,12 个地区单位;canonical(统一主指标)105 行。**
- **可信度:high 109 / medium 18 / manual 18** —— 每个数字都标了成色,绝无伪造。
- **覆盖:Hexagon 6 支柱全覆盖;ESG 三类齐;SDG 11 个目标(原定 6 个,超额)。**
- **真缺口仅 2 个**(数据源确实没有):Brunei 贫困率、Sabah 电气化%。
- **暂缓 (Phase 2):** 河流水质(已取消,SDG6 由清洁水覆盖)、洪水风险、道路里程、自给率 —— 数据为事件型/仅全国/陈旧,达不到 4 地区可比标准。

---

## 1. Scope

| Dimension | Coverage |
|---|---|
| **Territories (4)** | Sabah, Sarawak (Malaysia) · Brunei · Kalimantan (Indonesia, 5 provinces rolled up) |
| **Frameworks (3)** | ESG (E/S/G) · UN SDG · True Wealth Hexagon (6 pillars) |
| **Goal** | One auto-pullable, cited, consistent dataset feeding the Resilience Index dashboard |

## 2. Architecture

```
  7 scheduled API pulls ─┐
  1 manual layer (cited) ─┼─► standard table ─► SQLite (keep-last-good, canonical flag) ─► frontend reads
                          │     territory | indicator | year | value | unit | source | data_level
                          │     + esg_pillar | sdg_goal | hexagon_pillar | confidence | last_updated | canonical
```

**Rule:** API keys are backend-only; the frontend never calls a source API (CORS + key-exposure). The backend pulls on schedule, writes the standard table, and the frontend reads the database.

## 3. Data sources inventory

| # | Source | Owner | Key? | Used for | Access |
|---|---|---|---|---|---|
| 1 | **data.gov.my / OpenDOSM** | 🏛️ Malaysia gov | no | Sabah/Sarawak state indicators | keyless API |
| 2 | **World Bank** (+ WGI) | World Bank | no | Brunei national + governance + renewable | keyless API |
| 3 | **UN SDG API** | UN | no | national SDG baseline | keyless API |
| 4 | **BPS Indonesia** | 🏛️ Indonesia gov | yes | Kalimantan 5 provinces (verified var-id map) | key + User-Agent |
| 5 | **Global Forest Watch** | WRI | yes | forest extent/loss + VIIRS fire alerts | key (`x-api-key`) |
| 6 | **NASA FIRMS** | 🏛️ US gov | yes | fire hotspots (backup; GFW is primary) | key |
| 7 | **WAQI / aqicn** | community | yes | live city air quality | token |
| 8 | **Manual layer** (`manual_overrides.csv`) | DOSM/UNDP/FAO/GDL/agencies | — | report-only figures, each cited | manual + provenance |

## 4. Indicator coverage (canonical / unified metric per concept)

> `(year, confidence)` — **h**=high (exact API) · **m**=medium (national-inherited or 5-province mean) · **R**=manual (cited report). GAP = no data exists.

| Concept | ESG·SDG·Hexagon | Sabah | Sarawak | Brunei | Kalimantan |
|---|---|---|---|---|---|
| Forest cover (ha) | E·SDG15 | 6.68M (h) | 11.64M (h) | 0.53M (h) | 49.93M (h) |
| Fire alerts (count) | E·SDG13 | 697 (h) | 3,326 (h) | 128 (h) | 27,652 (h)¹ |
| Air quality (AQI) | E·SDG13 | 38 (m) | 39 (m) | 7 (m) | 56 (m) |
| Clean water (%) | S·SDG6 | 80.5 (h) | 83.7 (h) | 100 (h) | 89.4 (m) |
| Employment / unemployment (%) | S·SDG8 | 5.7 (h) | 3.1 (h) | 5.3 (h) | 4.3 (m) |
| GDP growth (%) | S·SDG8 | 1.3 (h) | 1.2 (h) | 4.1 (h) | 4.5 (m) |
| Healthcare — life expectancy (yrs) | S·SDG3·Hex | 75.3 (R) | 75.4 (R) | 75.5 (h) | 72.3 (m) |
| Education — mean yrs schooling | S·SDG4·Hex | 8.7 (R) | 8.7 (R) | 9.3 (R) | 9.1 (m) |
| Poverty (%) | S·SDG1 | 19.7 (h) | 10.8 (h) | **GAP** | 5.1 (m) |
| Governance — WGI (score) | G·SDG16 | 57.9 (m) | 57.9 (m) | 71.9 (m) | 36.8 (m) |
| Food — paddy (tonnes) | S·SDG2·Hex | 107,565 (h) | 147,272 (h) | 3,700 (R) | 1.62M (h) |
| Energy — electrification (%) | S·SDG7·Hex | **GAP** | 99.4 (R) | 100 (h) | 93.1 (m) |
| Shelter — households (count) | S·SDG11·Hex | 806,300 (h) | 656,300 (h) | 87,137 (h) | 1.63M (h) |
| Tourism — visitors | S·SDG8·Hex | 3.2M (R) | 4.83M (R) | 678,037 (R) | 4.74M (h)² |

¹ Kalimantan fire = 4/5 provinces (Kaltim's GADM adm1 code in the GFW fire dataset is unverifiable by name; excluded rather than guessed).
² Kalimantan tourism = domestic trips; the other three = visitor arrivals. Comparable in scale, different in definition (documented).

**Support indicators** (enrich pillars, `canonical=0`): Renewable electricity % (WB, national-inherited) · UNESCO World Heritage Sites (Sabah 1, Sarawak 2, Brunei 0, Kalimantan 0) · National parks count (Sabah 9, Sarawak 30, Brunei 1, Kalimantan 8 — definition differs per jurisdiction, not scale-comparable).

## 5. Framework coverage

- **Hexagon — 6/6 pillars:** Food · Energy · Education · Shelter · Healthcare · Entertainment. ✅ All have an anchor indicator; several have support indicators.
- **ESG — 3/3 categories:** Environment (5 indicators), Social (majority), Governance (WGI). ✅
- **UN SDG — 11/17 goals covered:** SDG 1, 2, 3, 4, 6, 7, 8, 11, 13, 15, 16. The original plan scoped 6 goals (1,4,6,8,13,15) — all met and exceeded. Not covered: SDG 5, 9, 10, 12, 14, 17.

## 6. Data quality & integrity

- **Confidence layer (145 rows):** high 109 · medium 18 · manual 18. Every value carries a confidence tag; the dashboard shows score **and** confidence (the ABCDE "Ethics" pillar).
  - **high** = exact sub-national value from a live API.
  - **medium** = national figure inherited to a territory, or an unweighted mean of the 5 Kalimantan provinces (an approximation, labelled).
  - **manual** = figure from an official report/PDF (no API), recorded with `source_doc / source_url / retrieved_date / note` so it is fully auditable.
- **Integrity measures:** verified BPS var-id map (no silent catalog truncation) · keep-last-good upsert (a source being down does not wipe its last value) · GFW fire (FIRMS-independent) · no fabricated numbers — gaps are left blank and documented, manual figures are cited, approximations are labelled.

## 7. Known gaps & deferred work

**Genuine gaps (no public data exists):**
| Gap | Reason |
|---|---|
| Poverty — Brunei | High-income country; no comparable national poverty-line rate published |
| Energy % — Sabah | No statewide electrification % ever published (only a 2030 target) |

**Deferred (Phase 2 — data not ready for cross-territory scoring), verified 2026-06-29:**
| Item | Reality |
|---|---|
| River water quality | **Dropped.** No comparable data (Kalimantan API, Malaysia DOE PDF, Brunei only a class). SDG6 already covered by clean-water access. |
| Flood risk | Real index only for Indonesia (BNPB InaRISK per district). Malaysia/Brunei have no equivalent → not cross-territory comparable. |
| Road length | Findable for all 4 but stale (Malaysia 2016) and from mixed sources/years; better expressed as road density. |
| Self-sufficiency ratio (Food) | Published **national only** (MY rice 56.2% 2023, Brunei ~8%); no official sub-national figure. |
| AI forecasting · Blockchain verification | ABCDE "A" & "B" — future technical features. |

## 8. Code & document inventory

| File | Role |
|---|---|
| `ingest_poc.py` | Main pipeline — 7 source pulls + Kalimantan roll-up |
| `load_db.py` | CSV → SQLite, keep-last-good upsert, manual layer, canonical flag |
| `manual_overrides.csv` | Cited report-only figures (provenance per row) |
| `discover_bps_map.py` | Rebuilds the verified BPS var-id map |
| `poc_progress.py` | Coverage RAG report |
| `run_pipeline.py` | One-command refresh (ingest → load_db) + scheduling notes |
| `borneo_tracker.db` | The standard table the frontend reads |
| `borneo_tracker_api_keys_setup.md` | Key status, gotchas, consistency & gap documentation |
| `borneo_tracker_data_coverage_matrix.md` · `_hexagon_pillar_data.md` | Original sourcing plan (Phase-2 research) |
| `borneo_tracker_resilience_index_methodology.md` | How indicators become the Resilience Index |

## 9. Next steps

1. **Resilience Index computation** — implement methodology Steps 1–4 (normalize to 0–100 vs targets → pillar scores → index + weakest pillar → RAG). ✅ *Done 2026-07-06 (`compute_resilience.py`)*
2. **Phase 4 — frontend dashboard** — read the SQLite DB into the three views (ESG / SDG / Hexagon) + Resilience Index, showing each value with its confidence tag. ✅ *Done 2026-07-05/06*
3. **Optional fills** — Sabah electrification % (write to ECoS) · road/SSR as national-inherited or Phase-2 risk flags.

## 10. Phase 4–5 update (2026-07-06, commit `9c30add`)

- **Frontend ↔ backend bridge (Phase 4)** — all mock data replaced: `export_json.py` → `public/data/indicators.json` → `src/data/useIndicators.js`; Overview / Regional Detail / ESG read real data with visible confidence tags. DB setup hardened: validation before publish, loud failures, model fallback now requires an explicit `--allow-model-fallback` flag.
- **Real historical trends (Phase 5)** — new `ingest_history.py` pulls multi-year series (256 observations) into a new `indicator_observations` table (PK `territory+indicator+year`); `export_json.py` exports 16 per-territory series (each ≥3 real annual points); Regional Detail gained a working **Trend** tab. Headline: **annual tree-cover loss 2001–2024 for all four territories** (GFW `_change` tables — the `_summary` tables only hold cumulative totals), VIIRS fire alerts since 2012, plus Sabah/Sarawak state-level series (clean water, unemployment, GDP growth, poverty). Brunei/Kalimantan socioeconomic series pending — World Bank API was down 2026-07-05; the daily workflow back-fills automatically.
- **Resilience Index** — `compute_resilience.py`: linear 0–100 vs documented bounds → hexagon-pillar means → index + weakest pillar + RAG. Current: Brunei 81.2 🟢 · Kalimantan 69.2 🟢 · Sarawak 58.6 🟡 · Sabah 56.9 🟡 (weakest pillar everywhere: Education). Only ratio/percent/years indicators are scored; unscored pillars are excluded and labelled, never imputed. *The original methodology file was removed from the repo — the bounds table in `compute_resilience.py` is a reconstruction awaiting review.*
- **SDG page** — `/sdg` is now a real page (the 6 client-required goals, region selector, confidence tags).
- **Automated refresh** — `.github/workflows/refresh-data.yml` runs the 5-step pipeline daily at 05:00 MYT and commits changed data. data.gov.my calls are throttled to respect its official **4 requests/minute** limit.

---

*Integrity note: every figure in this report is real and sourced. Where a number comes from a report rather than an API it is tagged `manual` and cited in `manual_overrides.csv`; where data does not exist it is left as a documented gap, not estimated.*
