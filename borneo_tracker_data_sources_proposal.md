# Borneo Tracker — ESG & SDG Data Sources
### Reference Document for Project Proposal (T002)

**Prepared:** 21 June 2026 · **Project:** Borneo Tracker — a public ESG & SDG monitoring dashboard for Borneo Island.

_Last updated: 2026-07-20_

---

## 1. Data Strategy

Borneo Island is split across three jurisdictions, so no single platform provides all indicators for the whole island. Data is therefore collected **separately from each territory's official source** and combined into one standardised Borneo Tracker dataset.

| Borneo Tracker Territory | Jurisdiction | Primary Data Authority |
|---|---|---|
| Sabah | Malaysian Borneo (state) | DOSM / OpenDOSM |
| Sarawak | Malaysian Borneo (state) | DOSM / OpenDOSM |
| Brunei | Sovereign country | DEPS + World Bank |
| Kalimantan | Indonesian Borneo (5 provinces) | BPS Indonesia |

> **Kalimantan note:** consists of 5 provinces — Kalimantan Barat, Tengah, Selatan, Timur, Utara — aggregated (sum or population-weighted average) into one "Kalimantan" figure.

**Each data point is tagged with a `data_level` label** (state / province / national / proxy / satellite) so users can see exactly how precise and comparable each figure is. This transparency is what makes the dashboard trustworthy.

All sources below are **free**; the majority are auto-pullable via public APIs, verified live with real sample values on 21 June 2026.

---

## 2. Environmental Indicators (E)

Satellite-based — uniform, high-quality coverage for all four territories.

| Indicator | Data Source | Coverage | Access | Verified |
|---|---|---|---|---|
| Forest cover | Global Forest Watch (UMD/Hansen) | All 4 territories (GADM admin) | Free API + key | ✅ |
| Deforestation / tree cover loss | Global Forest Watch | All 4 territories | Free API + key | ✅ |
| Active fire hotspots | NASA FIRMS (VIIRS satellite) | All 4 (Borneo bounding box) | Free API + key | ✅ |
| Air quality (PM2.5) | WAQI / aqicn.org (+ MY APIMS, ID ISPU) | Major cities only* | Free API + token | ✅ |
| Water quality (river WQI) | DOE Malaysia / KLHK Indonesia | Limited — see §6 Gap | PDF reports | ⚠️ |

\* *Air quality has live monitoring stations in major cities (Kota Kinabalu, Kuching, Bandar Seri Begawan, Pontianak) but not in smaller towns.*

---

## 3. Social Indicators (S)

National statistics, collected per territory. Brunei figures drawn primarily from the World Bank open API.

| Indicator | Sabah | Sarawak | Brunei | Kalimantan | Access |
|---|---|---|---|---|---|
| Poverty rate | 19.7% (2022) | 10.8% (2022) | proxy 3.2%** | 5.5% (2024) | API (BN = proxy) |
| Employment / unemployment | 5.7% (2025) | 3.1% (2025) | 5.2% (2024) | 5.1% (2024) | API |
| Education (literacy / schooling) | ✅ enrolment | ✅ enrolment | 97.6% literacy | 10.2 yrs schooling | API / report |
| Healthcare (hospital beds) | 5,053 (2022) | 4,119 (2022) | 4.19/1k (2022) | by province | API |
| Clean water access | 80.5% (2022) | 83.7% (2022) | 100% (2022) | 76.3% (2023) | API |

\*\* *Brunei has no official poverty line; the closest figure is a 2015 Household Expenditure Survey proxy (≈3.2% below B$283/month). Labelled as an estimate.*

---

## 4. Governance Indicator (G)

No sub-national governance score exists anywhere in the world — these are **country-level only**. Sabah & Sarawak inherit Malaysia's value; Kalimantan inherits Indonesia's; Brunei uses its own.

| Indicator | Malaysia | Indonesia | Brunei | Source | Access |
|---|---|---|---|---|---|
| Corruption Perceptions Index (CPI 2024) | 50 | 37 | not scored 2024*** | Transparency International | CSV download |
| Worldwide Governance Indicators (WGI) | ✅ | ✅ | ✅ | World Bank | Free API |

\*\*\* *Brunei moves in/out of the CPI; use the most recent available score (2020 = 60, or 2025 = 63), clearly dated.*

---

## 5. SDG Progress Tracking

Each country publishes an official SDG platform; Malaysia and Indonesia report at sub-national level. The same ESG data above also feeds the SDGs (mapping below).

| Territory | Official SDG Source | Sub-national? |
|---|---|---|
| Sabah / Sarawak | DOSM "SDG Indicators by State 2024" (84 indicators) | ✅ By state |
| Kalimantan | Bappenas SDGs Dashboard | ✅ By province |
| Brunei | SDG Brunei + VNR 2023 / UNESCAP Tracker | National |
| All four (baseline) | UN SDG Global API | Country level |

**ESG → SDG mapping:**

| SDG Goal | Fed by Indicator |
|---|---|
| SDG 1 — No Poverty | Poverty rate |
| SDG 4 — Quality Education | Education |
| SDG 6 — Clean Water | Clean water access |
| SDG 8 — Decent Work & Economic Growth | Employment + GDP |
| SDG 13 — Climate Action | Fire hotspots + air quality |
| SDG 15 — Life on Land | Forest cover + deforestation |

---

## 6. Known Data Gap — resolved (water quality superseded)

> **Update (2026-07-20): river water quality was dropped from the tracked indicator set (2026-06-29) and superseded by Clean Water Access — it is no longer a gap.**
>
> The original concern was that river WQI / IKA had no clean, auto-pullable data island-wide (Malaysia DOE PDF-only, Brunei classification-only, Kalimantan KLHK PDFs — though Kalimantan IKA is in fact reachable via the BPS national-domain API). Rather than wait on data that doesn't exist uniformly, **Clean Water Access** (Section 3, fully available via API for all four territories) is used as the SDG 6 metric, which it already covers 4/4. River water quality is retained only as an optional, clearly-labelled "limited data" reference where PDFs exist. Reinstate as a scored indicator only if a numeric Brunei WQI and a uniform cross-territory method appear.

---

## 7. Master Source List

| Source | Link | Use | Access |
|---|---|---|---|
| Global Forest Watch | https://data-api.globalforestwatch.org/ | Forest cover, deforestation | Free API + key |
| NASA FIRMS | https://firms.modaps.eosdis.nasa.gov/api/area/ | Fire hotspots | Free API + key |
| WAQI / aqicn | https://aqicn.org/api/ | Air quality (PM2.5) | Free token |
| OpenDOSM / data.gov.my | https://open.dosm.gov.my/data-catalogue | Sabah & Sarawak statistics | Free API (no key) |
| DOSM SDG by State 2024 | https://www.dosm.gov.my/portal-main/release-content/sustainable-development-goals-sdg-indicators--malaysia--state2024 | Malaysia SDG (by state) | Download |
| Malaysia APIMS (DOE) | https://eqms.doe.gov.my/APIMS/main | MY live air quality | Web/JSON |
| BPS Indonesia WebAPI | https://webapi.bps.go.id/developer/ | Kalimantan statistics | Free API + key |
| BPS province portals | https://kaltim.bps.go.id (+ kalbar/kalteng/kalsel/kaltara) | Per-province data | Web / API |
| Bappenas SDGs Dashboard | https://sdgs.bappenas.go.id/dashboard | Indonesia SDG (by province) | Web |
| Brunei DEPS | https://deps.mofe.gov.bn/ | Brunei statistics | PDF / Excel |
| Brunei Statistical Yearbook / BDKI | https://deps.mofe.gov.bn/statistical-publications/ | Brunei all-in-one indicators | PDF |
| SDG Brunei + VNR 2023 | https://www.sdgbrunei.gov.bn/ | Brunei SDG progress | Web / PDF |
| World Bank Open Data API | https://api.worldbank.org/v2/ | Brunei + country baselines | Free API (no key) |
| UN SDG Global API | https://unstats.un.org/SDGAPI/v1/sdg/ | Official SDG data | Free API (no key) |
| Transparency International CPI | https://www.transparency.org/en/cpi/2024 | Governance (corruption) | CSV download |
| UNESCAP National SDG Tracker | https://data.unescap.org/national-sdg-tracker | Brunei SDG numbers | Web |

---

## 8. Summary for Proposal

- **18 official data sources** identified and verified across the three jurisdictions plus global satellite platforms.
- **~80% of indicators are auto-pullable via free public APIs** (no manual entry), the rest via official downloads or an admin back-office for the small number of PDF-only national figures.
- **One known data gap** — river water quality — handled by using Clean Water Access as the primary SDG 6 measure.
- **All four territories** (Sabah, Sarawak, Brunei, Kalimantan) have confirmed real data for the core ESG and SDG indicators, making a credible, data-driven dashboard feasible.
