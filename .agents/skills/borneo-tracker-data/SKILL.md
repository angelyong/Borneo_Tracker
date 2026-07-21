---
name: borneo-tracker-data
description: Entry point for the Borneo Tracker (T002) ESG/SDG data work — territory mapping, verified data sources & APIs per indicator, the known data gap, the standard dataset schema, and where each archived document lives. Use when working on Borneo Tracker data sourcing, the dashboard, ingestion/ETL, or continuing this project.
---

# Borneo Tracker — Data Work (T002)

A public ESG + UN SDG dashboard for **Borneo Island**. "Data speaks" project — confirming real, auto-pullable data per indicator was the focus before building. Stack: **React 19 + Vite 8** (scaffold already in `src/`, `public/`).

> **⚠️ Think ABCDE-first.** This skill is the *operational data reference* — it is the **D
> (Data)** layer of the supervisor's **ABCDE Framework**, and the "data-confidence" tags are the
> **E (Ethics)**. Before doing data work, read the **`borneo-abcde-framework`** skill (the primary
> thinking lens): it holds the framework, the build-maturity scorecard, and the business logic
> (EUDR / carbon & biodiversity dMRV / the ESG-data market → `docs/BUSINESS_CASE_ABCDE.md`).
> The Resilience Index here *is* the framework applied; ESG/SDG are reporting lenses on it, not the hero.
> Supervisor **Mr. Koh How Sze** is (near-certainly) the ABCDE author **Koh How Tze** — his framework, his rubric.

## Territory model (the core complication)

Borneo spans 3 jurisdictions, so data is collected per-territory then combined. The territories arrive at **3 different geographic levels** — this is the central design challenge:

| Territory | Level | Authority |
|---|---|---|
| Sabah | MY state | DOSM / OpenDOSM |
| Sarawak | MY state | DOSM / OpenDOSM |
| Brunei | country | DEPS + World Bank |
| Kalimantan | 5 IDN provinces (Barat/Tengah/Selatan/Timur/Utara) | BPS Indonesia |

→ Every data point is tagged with a **`data_level`** label (state / province / national / proxy / satellite). That label is what makes the dashboard "trustworthy" per the brief.

## Standard dataset schema (single source of truth for the app)

All ingestion writes to one table; the frontend reads only this:

```
territory | indicator | year | value | unit | source | data_level
```

## Data status at a glance

- 🟢 **Auto-pullable now (≈80% of ESG/SDG):** forest cover, deforestation, fire hotspots, employment, education, healthcare, clean water, GDP.
- 🟡 **Usable with a label:** poverty (Brunei = proxy, no official figure), air quality (city-level only), governance (country-level only — no sub-national score exists anywhere).
- 🔴 **The one ESG gap:** river water quality (WQI/IKA) — PDF-only for MY/Kalimantan, nonexistent for Brunei. **Handling: use Clean Water Access as the primary SDG 6 metric**, water quality secondary "limited data".

**Hexagon pillars (round 2 done):** all 6 pillars buildable — each has ≥1 green anchor indicator. Food→crop production, Energy→electricity access (+ Sarawak hydro), Education→enrolment, Shelter→housing count, Healthcare→hospital beds, Entertainment→tourism arrivals. Flood risk is the only 🔴 (event-based; treat as risk flag). Detail in `borneo_tracker_hexagon_pillar_data.md`.

## API quick reference (all free)

| Source | Indicators | Key? | Base |
|---|---|---|---|
| data.gov.my / OpenDOSM | Sabah/Sarawak: poverty, jobs, education, health, water, GDP | no | `api.data.gov.my/data-catalogue?id={ID}` |
| World Bank | Brunei + governance + country baseline | no | `api.worldbank.org/v2/country/{iso3}/indicator/{CODE}` |
| BPS WebAPI | Kalimantan (5 provinces) | yes | `webapi.bps.go.id/v1/api/list?model=data&domain={prov}&var={id}&key=` |
| Global Forest Watch | forest cover, deforestation | yes | `data-api.globalforestwatch.org/dataset/{ds}/{ver}/query/json` (header x-api-key) |
| NASA FIRMS | fire hotspots | yes (MAP_KEY) | `firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/VIIRS_NOAA20_NRT/108,-4,119,7/1` |
| WAQI / aqicn | air quality PM2.5 (cities) | yes (token) | `api.waqi.info/feed/{city}/?token=` |
| UN SDG API | SDG country baseline | no | `unstats.un.org/SDGAPI/v1/sdg/Series/Data?seriesCode=&areaCode=` (MY 458, IDN 360, BRN 96) |

**Architecture rule:** never call these from the frontend (CORS + key exposure). Backend pulls on a schedule (data updates yearly/quarterly — daily/weekly pull is plenty) → writes the standard table → frontend reads the DB. PDF-only national figures (Brunei literacy/hospitals/poverty-proxy, water quality) go through the admin back-office (a required project feature).

## Ingestion decision tree (which method per data format)

Don't default to web scraping — it's rarely the right tool here. Pick by format:

```
What format is this indicator's data in?
├─ Has an API (MY data.gov.my, IDN BPS, most of Brunei via World Bank, satellite) → pull programmatically ✅
├─ Downloadable CSV → just read_csv / load directly (already machine-readable; NO scraping) ✅
├─ PDF + few numbers + updates yearly (Brunei literacy, hospital/doctor counts, poverty proxy; water-quality WQI) → read once, type into admin back-office ✅
├─ PDF + many numbers / frequent updates → PDF parsing (fragile — avoid unless necessary)
└─ HTML page, no API & no download → THEN web scraping (Borneo case almost never hits this)
```

Key correction the team should internalise: **Brunei is NOT "scraping only".** ~80% of Brunei comes from the keyless World Bank API; only a handful of yearly PDF figures remain, and those go through the **admin back-office** (a required project feature — manual verify/enter is by design, not a hack). CSV ≠ scraping ≠ PDF: CSV is already structured (just load it); scraping is only for HTML pages with no API. Data updates yearly/quarterly, so automating rare PDF extraction isn't worth it. The dashboard only visualises numbers — no heavy "analysis" needed; API/CSV give ready values, PDF just needs the figure picked out.

## Archived documents (source of truth — read these for detail)

> Note: the old `borneo_tracker_api_integration_guide.md` (detailed curl/endpoint guide) and the `make_*.py` doc-generator scripts were deleted in cleanup. The key endpoints survive in the **API quick reference** section above + the new OpenDOSM dataset IDs in **Where to continue** below + the Word tables.

| File | What it is |
|---|---|
| `borneo_tracker_resilience_index_methodology.md` | **How the Resilience Index is scored** — target-based normalization, equal-weight hexagon, weakest-pillar surfacing, RAG, data-confidence (Ethics). Aligned to the supervisor's book. The project's core methodology. |
| `borneo_tracker_resilience_demo.md` | Worked demo of the index on real data (4 territories). Key insight: Brunei money-rich but food-self-sufficiency 8.4% → fragile True Wealth ("paper wealth ≠ true wealth"). |
| `borneo_tracker_hexagon_pillar_data.md` | **Round-2 sourcing** for the 4 pillars ESG/SDG didn't cover (Food/Energy/Shelter/Entertainment). Confirms all 6 Hexagon pillars are buildable + new OpenDOSM/World Bank datasets. |
| `borneo_tracker_data_coverage_matrix.md` | Internal completeness proof — each ESG/SDG indicator × territory with a real verified sample value + access type. |
| `borneo_tracker_data_sources_proposal.md` | Clean proposal-ready writeup of all sources. |
| `Borneo_Tracker_ESG_SDG_API_Table.docx` | ESG + SDG data-source table by territory (Word, presentable, clickable links). |
| `Borneo_Tracker_Hexagon_Pillar_Table.docx` | 6 pillars × 4 territories data-source table (Word, presentable). |
| `Borneo_Tracker_Data_Sources_by_Territory.docx` | Per-territory source table (ESG + SDG) Word doc. |
| `Team Project June 2026(Project Details) (1).csv` | The original assignment brief (T002 row). |

## Project facts
- Supervisor: **Mr. Koh How Sze** (60122733168). Team size 4 (Henry Chin + Tay Yong Sheng, Tee Zhi Ying, Angel Yap).
- Required features: Borneo map · ESG indicators · SDG progress · dashboard (red/yellow/green) · open data · admin back-office · mobile app (alerts + citizen reports).
- ESG→SDG mapping: poverty→SDG1, education→SDG4, clean water→SDG6, employment+GDP→SDG8, fire+air→SDG13, forest→SDG15.

## Status: BUILD phase in progress (updated 2026-07-10)
Scope confirmed 2026-06-21; supervisor approved the team's plan. **Done:** data pipeline (~80% auto), the standard table, `indicators.json` / `resilience.json` (3/6 pillars *scored*, all 6 buildable), Overview dashboard (Borneo map + Resilience gauge + Hexagon + ESG cards + live layers), Regional Detail, ESG & SDG pages, **ADM2 district drill-down**, trends (27 series), de-manual pass (UNESCO + GDL pullers done; FAOSTAT pending). **Not done:** Development Impact Simulator (A), admin back-office (on figma branch), mobile app (alerts + citizen reports), and the whole B/C stack.
→ ABCDE maturity & the honest posture live in the **`borneo-abcde-framework`** skill (§3). D ≈ 75%, E ≈ 45%, C ≈ 20%, A ≈ 10% (designed), B = 0%.

## Core feature: Development Impact Simulator (the differentiator)
User-proposed signature feature that turns the platform from passive monitoring into an active decision tool: a developer picks a location + development type + scale (e.g. "+50,000 ha plantation"), the system estimates the impact on the relevant pillars (forest↓, food↓, jobs↑, GDP↑), recomputes the Resilience Index, and shows a before/after + **red alert if it lowers Borneo's True Wealth** (harm > benefit). Directly embodies the book's "paper wealth ≠ true wealth". Serves developers/investors (site due-diligence), government (approval support), NGOs (challenge harmful projects) — neutral resilience scorer for all sides.
- **Build as a rule-based "What-If Simulator", NOT a predictive AI.** Team defines transparent coefficients per development type (documented assumptions), recompute is deterministic math. Frame honestly as "illustrative scenario modeling".
- **Real input is conversational, not structured numbers** — users type free-form sentences ("I have a RM3M ecotourism project on the Kalimantan-Sarawak border, is it reasonable? approval odds? procedures?"). So the interaction IS an LLM app: the LLM understands the sentence, calls the team's tools, reasons, and answers in plain language.
- **Provider: team chose OpenAI GPT (function calling)** — not Codex. Architecture is provider-agnostic: define tools/functions `get_resilience(territory)`, `simulate_impact(type,scale,location)`, `get_regulations(country,type)`; GPT calls them, real numbers come from the deterministic simulator + DB (LLM never invents numbers). Call via **backend only** (don't expose OpenAI key in the React frontend). A mid-tier GPT model is enough for understand-sentence + call-tools + narrate.
- **Still NO LangGraph** — OpenAI function calling + a simple loop (or SDK helper) handles the tool-call orchestration; LangGraph duplicates that. Multi-agent (per-dimension env/social/econ + synthesizer) is a Phase-2 maybe, still rarely needs LangGraph.
- **Grounding honesty:** "is it reasonable / impact" is solid (backed by real resilience data + simulator). "Approval probability / procedures" needs a real permitting-regulations knowledge base (RAG) or GPT will hallucinate — MVP: general guidance + disclaimer ("consult authorities"); Phase 2: add the regs knowledge base. Maps to ABCDE "A" (AI).

## Where to continue (build phase)
1. **DB schema** — the standard table: `territory | indicator | year | value | unit | source | data_level | esg_pillar | sdg_goal | hexagon_pillar | confidence`. One table, tagged for all 3 views (don't split ESG/SDG/Hexagon).
2. **POC ingestion script** (start with keyless sources: data.gov.my + World Bank) → write the standard-schema CSV to prove data flows in. New OpenDOSM IDs available: crops_state, electricity_access, hh_profile_state, hospital_beds, water_access, lfs_qtr_state, hh_poverty_state, enrolment_school_district.
3. **Backend + scheduled pulls** per the **API quick reference** section above (endpoints/keys); PDF-only figures (Brunei literacy/poverty proxy, parks/heritage counts) via admin back-office.
4. **Frontend** (React 19 + Vite 8 scaffold exists): Borneo map + ESG/SDG/Hexagon views + Resilience Index (per `..._methodology.md`) + RAG colors.
