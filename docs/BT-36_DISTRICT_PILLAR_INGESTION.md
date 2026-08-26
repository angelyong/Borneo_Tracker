# BT-36 · District-level pillar ingestion — both sides of the border

**Raised:** 2026-08-26 · **Client clause:** §3.4 (indirectly — it is what BT-35 needs to be worth doing)
**Role:** DATA · **Effort:** L · **Priority:** P2 · **Status:** open, not started
**Blocks:** BT-35 · **Related:** BT-30 (district join keys), OPEN_ISSUES §2 (poverty comparability)

---

## Why this exists

District pillar coverage today is **2 of 6 pillars, on one side of the border only**: Education and Healthcare for the 56 Kalimantan districts, nothing for Sabah's 28 or Sarawak's 47. BT-35 was written on the assumption that the Malaysian side was a publication limit. It is not.

## What is actually available

**Malaysia (DOSM, CC BY 4.0, machine-readable):**

| Pillar | Dataset | Coverage | Latest |
|---|---|---|---|
| Shelter | `hies/hh_access_amenities.csv` — piped water, sanitation | Sabah 27 · Sarawak 40 | 2024 |
| Energy | same file — electricity | same | 2024 |
| Healthcare | Abridged Life Tables by district — life expectancy | 27 / 40 | 2024 |
| Entertainment | ICT Survey by administrative district — internet use | Sabah 28/28 · Sarawak 45/47 | 2025 |
| Education | enrolment / schools / teachers by district | 24 / 30 PPD | 2025 |
| Food | crops by district | 26 / 40 | **2017 only** |

`ingest_districts.py` already fetches `hies/hh_poverty_district` and `hies/hies_district` from that same bucket, so water, sanitation and electricity are **one filename away**. Life expectancy by district is new — DOSM's own words: *"For the first time this publication presents abridged life tables by 156 administrative districts."* It is the same indicator we already ingest for Kalimantan.

**Indonesia (BPS WebAPI, needs a free key):** the endpoint we already call returns kabupaten breakdowns for rice production, internet use, clean water and sanitation that `ingest_districts_bps.py` never requests — its `UNITS` map hard-limits it to five indicators.

## The genuine limits, to be stated on screen rather than worked around

- **Mean years of schooling does not exist below state level in Malaysia**, and is not published as raw years at any level (0 matches across 290 data.gov.my and 183 OpenDOSM datasets; it is an internal input to the MHDI Education Index, published for 16 states). So the Education pillar cannot be made like-for-like with Kalimantan's RLS. Enrolment and teacher counts are provision, not attainment, and are absolute counts with no bound.
- **No kabupaten-level electrification ratio exists from BPS**, so Energy is thin on the Indonesian side — the mirror image of Malaysia's education gap.
- **Malaysian district GDP is stuck at 2020** because `latest_by_district()` collapses each series to its newest point and that dataset stops there.

## Join hazards — these will bite

1. **DOSM uses ~160 administrative districts; our GADM 4.1 geometry has Sabah 28 / Sarawak 47.** Clean joins: 27/28 Sabah (missing Membakut), 40/47 Sarawak (missing Gedong, Lingga, Meradong, Pantu, Sebuyau, Siburan, Tanjong Manis — post-2015 splits).
2. **Education data uses PPD education districts, not administrative districts** — composite labels like `Telupid/Tongod`, `Tatau/Sebauh`. Needs an explicit alias table.
3. **Spellings differ inside DOSM's own datasets.** This already affects us: `districts.json` currently splits Sarawak's `Maradong` (6 DOSM rows, no geometry) from `Meradong` (3 GFW rows, with geometry), and `Tanjong Manis` from `Tanjung Manis` — so two Sarawak districts have their indicator set cut in half and the "131 districts" count is really ~129. Never join on a raw name.
4. `schools_district` and `enrolment_school_district` use **different district sets** (Sabah 26 vs 28) and are not join-compatible without a crosswalk.
5. `All Districts` rollup rows have blank water/sanitation for 2024 — aggregate from the district rows.

## Terms to honour

DOSM is CC BY 4.0 — attribution and "indicate changes", which the provenance chips already carry. BPS is a bespoke permissive grant, **not** Creative Commons: mandatory citation including a direct link to the source table, an explicit anti-hammering clause (rate-limit, cache; the JSON API is capped at 4 requests/minute), and a requirement to **delete content BPS withdraws**. That last one is a durability constraint on the ingestion design, not a formality. Some Indonesian provincial datasets are CC-NC; the project is academic so that is not a blocker, but licence should still be recorded per source.

## The decision this forces

BT-35 forbids a district-level Resilience Index, on the grounds that 2 of 6 pillars for 56 of 131 districts is the defect BT-11a corrected. **If this ticket lands, that reasoning no longer holds** — coverage would be 4–5 of 6 on both sides. Whether to compute a district index then becomes a real methodology question rather than an obvious no, and it must be answered deliberately, with the pillar-loss gate (BT-11b) extended to district scope first.

## Suggested sequencing

1. Water, sanitation, electricity from `hies/hh_access_amenities.csv` — same bucket, same survey, three pillars, smallest possible change.
2. Life expectancy by district — closes the Healthcare asymmetry with the identical indicator.
3. Build the district-name crosswalk **before** step 4; it also fixes the existing Maradong/Meradong split.
4. Internet use (Malaysia ICT survey; Indonesia BPS var).
5. Only then revisit Education and Food, which have real limits rather than gaps.
