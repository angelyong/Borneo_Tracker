# Borneo Tracker — Data Coverage Matrix (Completeness Check)

_Last updated: 2026-07-20_

> **Purpose:** Prove that real, auto-pullable data exists for every ESG + SDG indicator across all four territories (Sabah, Sarawak, Brunei, Kalimantan) **before** we start building. Every "real value" below was pulled live from the actual source on **2026-06-21** — it is proof the data exists, not just that a portal exists.
>
> **Note (2026-07-20):** this matrix reflects the **original pre-build survey (June 2026)** plus **mid-July updates** made during the build — river water quality was dropped/superseded (see §C), and several scored hexagon indicators were added (Internet use, Paddy production per capita, Basic sanitation access — see §B.1).

## Legend

| Mark | Meaning |
|---|---|
| 🟢 GREEN | Real data confirmed + **auto-pullable** (live API / API+free key / structured CSV). Build on these now. |
| 🟡 YELLOW | Real data exists but with a caveat (national/proxy level, city-level only, or one-time manual download). Usable, must be labelled. |
| 🔴 RED | No clean auto-pullable data exists. Genuine gap — reframe, down-scope, or drop. |

Access types: **[API]** keyless API · **[API+KEY]** free key needed · **[CSV]** structured download · **[PDF]** locked in PDF (manual once) · **[NONE]** does not exist.

---

## A. Environment (satellite — uniform across all 4 territories)

These come from global satellite platforms, so all four territories are covered the same way and at the same quality. **Strongest part of the project.**

| Indicator | Source | Real proof | Access | Status |
|---|---|---|---|---|
| Forest cover | Global Forest Watch (`umd_tree_cover`) | Sabah ~59% land = forest, 4.4 Mha (2020) | [API+KEY] GADM admin codes MYS/IDN/BRN | 🟢 |
| Deforestation / tree cover loss | Global Forest Watch (`umd_tree_cover_loss`) | Sarawak+Sabah = bulk of MY's 2.9 Mha primary loss 2002–2023 | [API+KEY] same | 🟢 |
| Active fire hotspots (→ Climate action) | NASA FIRMS (VIIRS) | Borneo bbox `108,-4,119,7`; spikes Aug–Oct haze season | [API+KEY] free, 5000 req/10min | 🟢 |

> GFW endpoint: `data-api.globalforestwatch.org/dataset/<id>/<ver>/query/json` + header `x-api-key`.
> FIRMS endpoint: `firms.modaps.eosdis.nasa.gov/api/area/csv/<KEY>/VIIRS_NOAA20_NRT/108,-4,119,7/1`.

---

## B. Social & Economic (per-country national statistics)

Each territory queried separately. **Kalimantan = sum/avg of 5 provinces.** Brunei mostly via the keyless World Bank API.

| Indicator | Sabah | Sarawak | Brunei | Kalimantan | Status |
|---|---|---|---|---|---|
| **Poverty rate** | 19.7% (2022) [API] | 10.8% (2022) [API] | ⚠️ **No official rate**; proxy 3.2% <B$283/mo (2015) [PDF] | Kaltim 5.51% (2024), all 5 prov [API] | 🟡 |
| **Employment / unemployment** | 5.7% (Q3 2025) [API] | 3.1% (Q3 2025) [API] | 5.18% (2024) [API WB] | Kaltim 5.14% (2024) [API] | 🟢 |
| **Education** | enrolment 506k (2022) [API] | enrolment 432k (2022) [API] | literacy 97.6% (2021) [PDF] + schooling 14.1y [API WB] | RLS 10.22y, literacy 99% (Kaltim) [API] | 🟢 |
| **Healthcare** | 5,053 beds (2022) [API] | 4,119 beds (2022) [API] | 4.19 beds/1k (2022) [API WB] | hospitals by prov (2023) [API] | 🟢 |
| **Clean water access** | 80.5% (2022) [API] | 83.7% (2022) [API] | 100% basic (2022) [API WB] | Kalsel 76.3% (2023) [API] | 🟢 |
| **GDP / economic growth** | RM 83.2 bn (2023) [API] | RM 142.4 bn (2023) [API] | +4.05% growth (2024) [API WB] | Kaltim Rp 858 tn (2024) [API/CSV] | 🟢 |

> Malaysia API (keyless): `api.data.gov.my/data-catalogue?id=<DATASET_ID>` — IDs: `hh_poverty_state`, `lfs_qtr_state`, `enrolment_school_district`, `hospital_beds`, `water_access`, `gdp_state_real_supply`.
> Indonesia API (free key): `webapi.bps.go.id/v1/api/list?model=data&domain=<PROV>&var=<ID>&key=<KEY>`.
> Brunei API (keyless): `api.worldbank.org/v2/country/brn/indicator/<CODE>?format=json` — codes: `SL.UEM.TOTL.ZS`, `SH.MED.BEDS.ZS`, `SH.H2O.BASW.ZS`, `NY.GDP.MKTP.KD.ZG`, `AG.LND.FRST.ZS`.

### B.1 Added scored hexagon indicators (mid-July 2026 build)

Added during the build to give the True Wealth Hexagon comparable, *scoreable* indicators (%/years/per-capita, not absolute counts). All now live in `public/data/indicators.json` and `data_model.py`.

| Indicator | Pillar | Sabah | Sarawak | Brunei | Kalimantan | Status |
|---|---|---|---|---|---|---|
| **Internet use (%)** | Entertainment | 98.0% (2024) | 98.0% (2024) | 99.0% (2023) | 76.1% (2024) | 🟡 national proxy — medium confidence |
| **Paddy production per capita (kg/capita)** | Food | derived | derived | 8.1 (2023) | derived | 🟢 derived from paddy tonnes ÷ population |
| **Basic sanitation access (%)** | Shelter | [API] | [API] | 100% (2024) [API WB] | [API] | 🟢 |

> Internet use: DOSM ICT Use & Access Survey (MY, national applied to state), ITU / World Bank (Brunei), BPS (Kalimantan). Paddy per capita: `build_percapita_food_rows()` divides the paddy-tonnes row by `POPULATION`. Sanitation: World Bank `SH.STA.BASS.ZS` (Brunei) / national statistics.

---

## C. Weak indicators (real but not cleanly auto-pullable)

| Indicator | Sabah | Sarawak | Brunei | Kalimantan | Status |
|---|---|---|---|---|---|
| **Air quality (PM2.5)** | KK 8.1 µg/m³ live | Kuching 20 µg/m³ live | BSB AQI 5–6 live | Pontianak AQI ~62 live | 🟡 city-level only, uneven coverage |
| ~~**Water quality (river WQI/IKA)**~~ **DROPPED 2026-06-29** | DOE PDF only | DOE PDF only | classification only, no number | BPS IKA API (var 2532); KLHK PDF (Kalsel 55.6, 2023) | ⬛ superseded by Clean water access (SDG6 already 4/4) |
| **Governance / transparency** | = Malaysia | = Malaysia | Brunei country value | = Indonesia | 🟡 country-level only — no sub-national score exists anywhere |

> Water quality (2026-07-20): **dropped/superseded, no longer the headline gap.** No comparable cross-territory number exists (Malaysia DOE PDF-only, Brunei classification-only), and SDG6 is already fully covered by **Clean water access** (§B, 4/4). Kalimantan IKA *is* in fact reachable via the BPS national-domain API (var 2532) — so even the original "PDF-only" framing was too pessimistic. Removed from the tracked indicator set on 2026-06-29; reinstate only if a numeric Brunei WQI and a uniform method appear.
> Air quality: WAQI/aqicn free token API `api.waqi.info/feed/<city>/?token=<TOKEN>` — only works for cities that have a station (major capitals do; smaller towns don't).
> Governance: CPI 2024 — Malaysia 50, Indonesia 37, Brunei not scored in 2024 (use 2020=60 or 2025=63, labelled). WGI Control-of-Corruption percentile via `api.worldbank.org/v2/country/MYS;IDN;BRN/indicator/CC.PER.RNK`. Sabah/Sarawak inherit Malaysia; Kalimantan inherits Indonesia.

---

## D. SDG progress (proven to break down by region)

| Territory | SDG source | Proof | Access |
|---|---|---|---|
| Sabah / Sarawak | DOSM SDG-by-State 2024 | 84 state-level indicators; 16 per-state reports | [CSV/Web] |
| Kalimantan | Bappenas SDGs Dashboard | Province geomap + bar chart; Kaltim/Kalsel/Kalteng profile pages | [Web] |
| Brunei | SDG Brunei + VNR 2023 / UNESCAP | National progress (qualitative) + UNESCAP numeric tracker | [Web/PDF] |
| All 4 (baseline) | UN SDG Global API | Live: MY (M49 458) poverty series returned real JSON | [API] keyless |

> ESG data doubles as SDG data: Poverty→SDG1 · Clean water→SDG6 · Education→SDG4 · Fire/air→SDG13 · Forest→SDG15 · Employment/GDP→SDG8.
> UN SDG API: `unstats.un.org/SDGAPI/v1/sdg/Series/Data?seriesCode=<CODE>&areaCode=<M49>` (MY 458, IDN 360, BRN 96).

---

## Final completeness verdict

**Of the 9 required ESG indicators + 6 SDG goals across 4 territories:**

- 🟢 **8 indicator-areas are fully auto-pullable real data today** — forest cover, deforestation, fire, employment, education, healthcare, clean water, GDP. (≈ 80% of the dashboard.)
- 🟡 **3 are usable with a label** — poverty (Brunei is a proxy, no official figure), air quality (city-level only), governance (country-level only, no sub-national score exists).
- ⬛ **Water quality is no longer counted as a gap (dropped 2026-06-29)** — superseded by Clean water access (SDG6 already 4/4). No comparable cross-territory number exists and none is needed; see §C.

**Conclusion: the data foundation is sufficient to proceed.** Nothing critical is missing; every territory has real, mostly auto-pullable data for the core indicators. The known limits (Brunei poverty/forest are proxies, governance is country-level) are inherent to the region — no amount of further searching changes them, so they should be *designed around* (via the `data_level` label), not waited on. Water quality, once flagged the headline gap, was resolved by superseding it with Clean water access rather than waiting on data that doesn't exist.
