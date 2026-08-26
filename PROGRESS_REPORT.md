# Borneo Tracker (T002) — Data Layer Progress Report

_Last updated: 2026-08-24_

**Phase 3 — Data Collection & Pipeline**
**Status:** Substantially complete · **Report date:** 2026-06-29
**Prepared by:** Henry (data layer)

> **Note (2026-07-20):** This report captures an **early phase** (late June 2026), focused on the data layer. Features added **afterward** are not covered in the body below and include: **News & Insights** (Borneo Pulse — RSS → rephrase → Supabase drafts → `/admin/news` → public `/news`), the **district (ADM2) drill-down** (`ingest_districts.py` → `public/data/districts.json`), and **Supabase-backed authentication** (login/register/profile + admin roles). Section 10 has been refreshed to the current Resilience Index and hexagon methodology.

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
- **Resilience Index** — `compute_resilience.py`: linear 0–100 vs documented bounds → hexagon-pillar means → index + weakest pillar + RAG (RAG unified to **Green ≥ 70 / Amber ≥ 40**). Current (`resilience.json`, generated 2026-07-20): **Brunei 79.0 🟢** (weakest: Food) · **Sarawak 72.5 🟢** (weakest: Education) · **Kalimantan 68.5 🟡** (weakest: Education) · **Sabah 63.7 🟡** (weakest: Food). A strict geometric-mean variant (`indexStrict`, weakest-link mode) is also exported. Only ratio/percent/years indicators are scored; unscored pillars are excluded and labelled, never imputed. The original methodology file (`borneo_tracker_resilience_index_methodology.md`) **is present in the repo**; the bounds table in `compute_resilience.py` follows it.
- **Hexagon reframe (2026-07-15/16)** — the hexagon and pillar scoring were reworked for credibility: clean-water access **re-tagged from Clean Water to the Shelter pillar**, a new **Internet-use Entertainment proxy**, **paddy-production-per-capita** used for Food scoring, and RAG thresholds **unified to 70/40** across the app. All four territories now populate **6/6 pillars**.
- **SDG page** — `/sdg` is now a real page (the 6 client-required goals, region selector, confidence tags).
- **Automated refresh** — `.github/workflows/refresh-data.yml` runs the pipeline daily at 05:00 MYT and commits changed data. data.gov.my calls are throttled to respect its official **4 requests/minute** limit. *(The pipeline has since grown to **6 steps** — the 6th builds the district ADM2 drill-down `public/data/districts.json`.)*
- **Indicator coverage (current)** — the frontend JSON (`public/data/indicators.json`) now carries **~35 distinct indicators across the 4 territories** (Sabah, Sarawak, Brunei, Kalimantan), up from the 32 recorded in the late-June DB snapshot above.

---

## 11. Wave 3 update (2026-08-24) — momentum, drill-down, decision framing

Wave 3 answers the client's 2026-08-15 review (`docs/CLIENT_FEEDBACK_2026-08-15_ACTION_PLAN.md`); the execution plan is `docs/WAVE_3_EXECUTION_AND_FIXING_PLAN.md`. Twelve cards, delivered in four stages:

| Card | Delivered |
|---|---|
| BT-25 | Plural-aware i18n parity test (`src/test/i18nParity.test.js`) — normalises `_one`/`_other` and honours each locale's `Intl.PluralRules`, because Malay correctly has only `other`. There was never any translation debt to fix. |
| BT-24 | Positioning copy ("Measure Borneo. Understand Borneo. Strengthen Borneo.") on the About hero and the auth layout — deliberately **not** in the 20px fixed-height footer. |
| BT-14 | Repository implementation routes a non-place query to BorneoBot with the question pre-filled and handles the shared Edge Function quota (`AI_CHAT_QUOTA_EXHAUSTED`, 429). Production frontend endpoint wiring and browser E2E verification remain open. |
| BT-12 | Radar pillars are clickable (mouse + keyboard) and open `PillarDrilldownModal` with the exact indicators, values, years and confidence behind that pillar. An unscored pillar shows an honest "no comparable data" card, never a zero. |
| BT-16b | `sources_registry.py` → `public/data/sources.json`: 16 authoritative sources with publisher, licence, official URL, cadence, territories and pillars. |
| BT-20 | A real Sources section on `/data-sources`, kept visually and conceptually separate from the cryptographic hash ledger, with loading / error / retry / empty states. |
| BT-18 | `build_resilience_history.py` → `public/data/resilience_history.json`: the index series reconstructed from committed `resilience.json` snapshots, keyed by each artifact's own `generatedAt` (not the UTC commit date) and tagged with the methodology in force. |
| BT-19 | `src/utils/momentum.js` + `MomentumBadge` — signed delta, biggest movers and an inline sparkline. |
| BT-22 | `AnswerStrip` — one compact strip answering what / where / why / what next, mounted at the top of the Dashboard resilience card. |
| BT-23 | The same strip on Regional Details, ESG and SDG, wired through one shared hook (`src/data/useAnswerStrip.js`). |
| BT-26 | Tests for all of the above: the JS suite went 56 files / 941 tests → **63 files / 1,012 tests**; Python stayed at **130 tests**. |
| BT-27 | This section, the README update and the client-facing note (`docs/CLIENT_FEEDBACK_RESPONSE_2026-08-24.md`). |

### Three honesty rules this wave enforces in code

1. **No delta across a methodology break.** The 2026-08-03 education-loss defect and its 2026-08-17 correction move the published number without anything changing in Borneo. `computeMomentum` only compares points that share a `methodologyTag`; the first reading after a break reports "first reading on the current method" and no delta at all.
2. **A flat day is stated in words, not as `+0.0`.** Upstream macro data is annual or quarterly while the pipeline republishes daily, so most days genuinely do not move. The badge renders "No change since &lt;date&gt;" and the aggregate scope lists no movers rather than four zeroes.
3. **The manifest still hashes exactly six files.** `sources.json` and `resilience_history.json` are auxiliary (Option A). A seventh hashed file would make every already-published client report `INVALID`. Both `tests/test_wave3_auxiliary_outputs.py` and `tests/test_workflow_contract.py` assert they stay out of `DATASET_PATHS` and inside the refresh workflow's commit list.

### Client-review follow-up (2026-08-25)

A line-by-line re-read of the 2026-08-15 review against the running product found four clauses answered in spirit but not in fact. All four are closed:

- **§1.2** — `ScoreExplainer` was built but mounted only on Regional Details, while both scores appear together on the Dashboard. It is now mounted beside the Strict score using `scoreExplainer.strictOpenLabel`, a string that had been written and translated but never wired to anything. The popover heading now uses the client's own words, *"Why are these scores different?"*.
- **§3.4** — the client's sentence *"Resilience is only as strong as its weakest essential pillar"* appeared nowhere a user could see it. BT-13 had been down-scoped S → XS on the claim that it "already exists as `about.resilienceByPillarBody`"; **that claim was false** — that key describes the widget, not the principle. `WeakestLinkBars` now takes a distinct `principle` prop rendered above the description.
- **§3.3** — the layer picker rendered twelve flat radios whose labels were derived from the object keys by regex, bypassing `labelKey` entirely. `LAYER_GROUPS` (already defined, and already covered by a passing test) had never been rendered anywhere. The picker is now grouped, every surface reads the layer name from `labelKey`, and the active layer states its `captionKey` question and `directionKey`.
- **§4.2** — `biggestMovers` ranked by absolute magnitude and sliced to three, so three rises and one fall hid the only decline. It now reserves a slot for the largest rise and the largest fall. The badge and the movers list were also mutually exclusive by scope, so the client's score → direction → movers sequence never appeared on one screen; the movers list now renders in every scoped view, and the aggregate scope shows direction counts (`movementSummary`) because no Borneo-wide delta is derivable from a per-territory history.

Still not delivered, by decision: **ESG and SDG map layers** (no defensible composite score exists — the ESG panel reports indicator counts) and the **full natural-language query engine** (per-query LLM routing; the client marked token-cost items KIV).

### Pipeline

`run_pipeline.py` is now **8 steps** (ingest → history → load_db → export → resilience → resilience history → districts → provenance). Step 6 is degradable: a shallow checkout that cannot read the snapshot history keeps the previous history JSON and records the degradation rather than invalidating the six anchored datasets. `refresh-data.yml` checks out with `fetch-depth: 0` for exactly that reason.

Per BT-28's release-sequencing contract, feature branches carry **code only** — the two auxiliary JSON files are generated on master by `refresh-data.yml` and stamped by `anchor.yml`.

---

*Integrity note: every figure in this report is real and sourced. Where a number comes from a report rather than an API it is tagged `manual` and cited in `manual_overrides.csv`; where data does not exist it is left as a documented gap, not estimated.*
