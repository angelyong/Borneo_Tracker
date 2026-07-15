# Borneo Tracker — True Wealth Hexagon: Pillar Data Sourcing (Round 2)

> Second sourcing round (verified live 2026-06-21) for the 4 pillars that ESG/SDG did NOT cover: **Food, Energy, Shelter, Entertainment**. (Education & Healthcare were already covered in round 1.) Goal: confirm each pillar has enough real, mostly auto-pullable data to compute a Resilience score.
>
> 🟢 = real data for all/most territories, auto-pullable · 🟡 = partial / national-only / proxy / manual once · 🔴 = no clean data (drop or Phase 2). Each pillar only needs 2–3 usable indicators.

## Result: all 6 pillars are now buildable

| Pillar | Anchor indicator (🟢) | Support indicators | Verdict |
|---|---|---|---|
| Food | Crop production (paddy) | Agricultural land 🟡, Self-sufficiency ratio 🟡 | ✅ Buildable |
| Energy | Electricity access | Renewable share 🟡, Generation/consumption 🟡 | ✅ Buildable |
| Education | (round 1) Enrolment / literacy | — | ✅ Buildable |
| Shelter | Housing count | Road length 🟡, Flood risk 🔴 | ✅ Buildable |
| Healthcare | (round 1) Hospital beds / doctors | Clean water | ✅ Buildable |
| Entertainment | Tourism arrivals | National parks 🟡, UNESCO/heritage 🟡 | ✅ Buildable |

---

## FOOD

| Sub-indicator | Sabah | Sarawak | Brunei | Kalimantan | Verdict |
|---|---|---|---|---|---|
| Crop production (paddy, tonnes) | 107,565 (2022) | 147,272 (2022) | ~1,526 rice (2017) PDF | Kalbar 814,743 (2022) | 🟢 |
| Agricultural land | paddy area 37,323 ha | paddy area 77,943 ha | 2.54% land (WB) | per-crop only | 🟡 |
| Self-sufficiency ratio (SSR) | national only (MY rice 62.6%) | — | 8.4% rice (2022) | national only | 🟡 national |

**Access:** Sabah/Sarawak → OpenDOSM **`crops_state`** [API, keyless] — *must pass `?filter=Sabah@state` or East Malaysia gets truncated*. Brunei → World Bank `AG.LND.AGRI.ZS` [API] + DEPS agriculture PDF. Kalimantan → BPS webapi (free key) / province paddy press releases.

## ENERGY

| Sub-indicator | Sabah | Sarawak | Brunei | Kalimantan | Verdict |
|---|---|---|---|---|---|
| Electricity access | 98.3% rural (2021) | 99.4% (2023) | 100% (2023) | Kalsel 99.2% (2024) | 🟢 |
| Renewable share / capacity | RE 8.9% / 104.6 MW (2019) | Hydro ~75% / 3,558 MW (2024) | solar 1.2 MW (~0.02%) | PLTS IKN 10 MW (2024) | 🟡 |
| Generation / consumption | 5,356 GWh (2021) | peak 4,887 MW (2025) | 10,118 kWh/cap (2014, stale) | 6,215 GWh Kaltimra (2024) | 🟡 |

**Access:** Sabah → OpenDOSM **`electricity_access`** [API] + SE-RAMP 2040 PDF. Sarawak → Sarawak Energy site (big hydro story: Bakun 2,520 MW). Brunei → World Bank `EG.ELC.ACCS.ZS` / `EG.ELC.RNEW.ZS` [API]. Kalimantan → PLN Statistics PDF + BPS. *Note: electricity access ≈100% everywhere → low discriminating power; renewables/generation is the more interesting signal.*

## SHELTER

| Sub-indicator | Sabah | Sarawak | Brunei | Kalimantan | Verdict |
|---|---|---|---|---|---|
| Housing (households) | 806,300 (2024) | 656,300 (2024) | 87,137 (2021 census) | Kalbar 1.29M etc (2022) | 🟢 |
| Road length (km) | 23,716 km (2016) | 35,517 km (2016) | 3,820 km (2023) | per-province (BPS) | 🟡 stale/uneven |
| Flood risk | May-2021 event figures | 270 incidents (2021) | 207 incidents (2022) | BNPB per-event | 🔴 event-based |

**Access:** Malaysia → OpenDOSM **`hh_profile_state`** [API] — *needs trailing slash*; also `hh_access_amenities` (housing adequacy proxy). Brunei → DEPS 2021 Census PDF + World Bank `IS.ROD.TOTL.KM`. Kalimantan → BPS census / road tables. *Flood has no clean cross-territory time series → use as a qualitative "risk flag", not a scored indicator (Phase 2).*

## ENTERTAINMENT

| Sub-indicator | Sabah | Sarawak | Brunei | Kalimantan | Verdict |
|---|---|---|---|---|---|
| Tourism arrivals | 2.61M (2023) | 3.92M (2023) | ~133k (2023) | Kaltim 40,330 wisman (2023) | 🟢 |
| National parks (count) | 9 | ~30 | 1 | 8 | 🟡 manual |
| UNESCO WHS / heritage | 1 WHS + 24 gazetted | 2 WHS + ~41 | 0 WHS (2 tentative) | 0 WHS (1 tentative) | 🟡 manual |

**Access:** Tourism → **state tourism boards** (Sabah Tourism Board, Sarawak Ministry of Tourism / Sarawak Open Data CSV), Brunei Tourism PDF, Kalimantan BPS "wisatawan" (sum 5 provinces). *Federal data.gov.my tourism is national/quarterly only — use state boards for state figures.* Parks/heritage → manual count from official lists + UNESCO WHS list (authoritative).

---

## New auto-pullable datasets discovered (add to the API guide)

| Source | New dataset / code | Pillar |
|---|---|---|
| OpenDOSM `crops_state` | crop production by state | Food |
| OpenDOSM `electricity_access` | electricity access (households) | Energy |
| OpenDOSM `hh_profile_state` | households / living quarters by state | Shelter |
| OpenDOSM `hh_access_amenities` | basic amenities (housing adequacy proxy) | Shelter |
| World Bank `AG.LND.AGRI.ZS` | agricultural land % | Food (Brunei) |
| World Bank `EG.ELC.ACCS.ZS` / `EG.ELC.RNEW.ZS` | electricity access / renewable output | Energy (Brunei) |
| World Bank `IS.ROD.TOTL.KM` | total road km | Shelter (Brunei) |
| Sarawak Open Data (travel-tourism group) | visitor arrivals CSV | Entertainment |

## Honest limitations
- **Sub-national APIs are weakest for Energy generation, Road length, and Kalimantan tourism** — real data exists but often in PDF/utility reports or behind BPS's bot-blocked pages (use BPS webapi key, not page scraping).
- **Flood risk** is the one 🔴 — event-based everywhere, no clean annual series. Treat as a risk flag, not a scored metric.
- **Parks & heritage counts** are manual (count once from official lists, enter via admin) — they barely change year to year, so this is fine.
- **Brunei** continues to lean on World Bank API (national) + PDFs, same pattern as round 1.
