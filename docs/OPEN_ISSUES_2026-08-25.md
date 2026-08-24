# Open issues — found 2026-08-25, not yet actioned

Everything here was **found and verified** during the Wave 3 client-review audit and the ESG/SDG feasibility research. None of it is fixed. Each entry records the evidence, why it matters, and the decision that has to be made before anyone writes code.

Nothing in this file is a KIV item. The three KIV cards (KIV-01 natural-language query engine, KIV-02 ESG/SDG composite layers, KIV-03 AI daily narrative) stay parked by the client's own instruction and are **out of scope** — see §7 for what the research concluded about KIV-02, recorded so the question does not get re-opened from scratch.

---

## 1. Four indicators declare a scoring rule that never runs — and it is anchored on Bitcoin

**Severity: high.** This is the one to settle first.

`compute_resilience.py:82-85` defines bounds for four indicators:

```python
# Cross-pillar wellbeing rates (attach to the pillar tagged on the row)
"Unemployment rate":                   {"unit": "%", "best": 3,  "worst": 15},
"Poverty rate (absolute)":             {"unit": "%", "best": 0,  "worst": 25},
"Poverty rate (P0)":                   {"unit": "%", "best": 0,  "worst": 25},
"Poverty headcount <$2.15/day (SDG1)": {"unit": "%", "best": 0,  "worst": 25},
```

The comment says they attach to the pillar tagged on the row. But `data_model.py` `hexagon_pillar()` has **no mapping for the `poverty` or `unemployment_rate` concepts**, so those rows get `hexagon_pillar = ""`. `compute()`'s pillar filter only accepts rows matching one of the six pillars, so the rows are dropped.

Verified against the working tree:

| Indicator | In `BOUNDS` | Actually scored in `resilience.json` | Written into `resilience_model.json` |
|---|---|---|---|
| Unemployment rate | yes | **no** | yes |
| Poverty rate (absolute) | yes | **no** | yes |
| Poverty rate (P0) | yes | **no** | yes |
| Poverty headcount <$2.15/day (SDG1) | yes | **no** | yes |

`_indicator_to_pillar()` notices and prints a NOTE rather than failing, which is why this has survived.

**Why it matters:** `resilience_model.json` is one of the six files in `manifest_contract.DATASET_PATHS`. It is hashed, Sigstore-attested and OpenTimestamps-anchored. **We have anchored a normalisation rule the pipeline has never applied.** On a platform whose entire pitch is verified numbers, that is the wrong kind of defect to leave sitting.

**Decision needed — two options with different blast radius:**

- **(a) Delete the four entries.** Nothing already published changes. The platform stops declaring a rule it does not apply. Cheapest and safest.
- **(b) Give `poverty` and `unemployment_rate` a real `hexagon_pillar()` mapping** so the declared bounds take effect. This **changes published scores** — the affected territories gain a scored indicator inside whichever pillar the mapping picks — so it must go through the BT-28 release sequence, and it needs a decision about which pillar poverty and unemployment actually belong to. That is a methodology question, not a code question.

Recommendation: (a) now, and open (b) as a separate methodology card if we want those indicators scored.

---

## 2. Malaysian and Indonesian poverty rates are displayed side by side but are not the same measure

**Severity: medium (comparability).**

```
Sabah       Poverty rate (absolute)  17.7%  (2024)  data.gov.my / OpenDOSM
Sarawak     Poverty rate (absolute)   8.4%  (2024)  data.gov.my / OpenDOSM
Kalimantan  Poverty rate (P0)         4.73% (2025)  BPS Indonesia
Brunei      —                                        not sourced
```

Two separate problems in one row set:

1. **Different instruments.** Malaysia's absolute poverty line and Indonesia's P0 line are set by different governments at different real income levels. The SDSN SDG Index refuses national-statistics-office estimates for exactly this reason: *"To ensure the results are comparable across countries, we do not incorporate estimates received directly from national statistical offices."*
2. **The Kalimantan figure is a construction.** Its own `source` field reads *"BPS Indonesia (unweighted mean of 3/5 provinces, approx)"* — three of five provinces, unweighted, self-described as approximate.

**Decision needed:** disclose the incomparability in the UI (a footnote or a provenance chip variant), or source a genuinely comparable series. The research identified World Data Lab's $3.00/day and $4.20/day headcount as the metric the SDG Index uses, and it covers Brunei — which would also close the Brunei gap. Licence and access unverified.

---

## 3. The stored WGI governance value may be stale

**Severity: medium.**

The World Bank revised the Worldwide Governance Indicators methodology in 2025 and **recalculated the entire history back to 1996**. Our stored Control of Corruption values (Brunei 71.9, Malaysia-inherited 57.9 for both Sabah and Sarawak, Indonesia-inherited 36.8 for Kalimantan) predate that check.

A live API pull during the research returned Brunei 71.86, Indonesia 36.83, Malaysia 57.94 — which reproduces what we store, so the current values look right. But nobody has confirmed our ingestion is reading the revised series rather than a cached one.

**Decision needed:** re-run the WGI ingestion and diff, or confirm the source endpoint is the revised series. Low effort.

WGI is CC-BY 4.0 and commercial use is permitted, so there is no licence obstacle here.

---

## 4. The all-Borneo pillar drill-down opens empty

**Severity: low, but it is on the default screen.**

The Dashboard defaults to `panelTerritory = 'Overall Borneo'`. Clicking a radar pillar in that scope opens `PillarDrilldownModal`, which renders the `pillarDrilldown.aggregateTitle` / `aggregateBody` card — *"Aggregate score, no single indicator list… Choose an individual territory to inspect its scored source indicators"* — because `drilldownIndicators` is hard-coded to `[]` for the aggregate and district scopes.

That is honest: an aggregate genuinely has no single set of source rows. But the client's §3.4 asks to *"drill into the underlying indicators"*, and on the screen a first-time visitor lands on, the drill-down currently teaches them nothing.

Related: pillars are **not** clickable at all in District scope — that radar shows indicator counts, not scores, and is mounted without `onPillarSelect`.

**Decision needed:** leave as-is, or show the four territories' figures for that pillar side by side. The client-facing note already raises this as a known limitation and invites him to choose.

---

## 5. The ESG and SDG pages have no tests

**Severity: medium.**

`src/pages/ESG/` and `src/pages/SDG/` contain only their `.jsx` files. Zero test files. They are the least-covered surfaces in the app, and they are exactly where any future ESG/SDG work would land. The Wave 3 answer strip is already mounted on both.

**Decision needed:** none — this is just work. Worth doing before either page changes again.

---

## 6. Environmental indicators measure the wrong quantity for scoring

**Severity: only blocks work if we decide to score the environment pillar.**

None of the seven environmental indicators has a scoring bound today, and four of them cannot be given one without changing what we measure:

| Held today | Would have to become |
|---|---|
| Tree cover loss (cumulative ha) | annual loss as **% of forest area**, 3-year averaged |
| Air quality (live AQI) | **annual mean PM2.5 (µg/m³)**, population-weighted |
| Fire alerts (VIIRS detection count) | **burned area as % of land area** (GWIS MCD64A1) |
| National parks (count) | **% of terrestrial area protected** |
| Forest extent 2000 (ha) | not a score at all — it is a denominator |
| Active fire hotspots (24h) | operational alert layer, not an index input |
| Forest cover (% land) | usable roughly as-is |

**We do not currently hold land area for any territory**, which several of these conversions need as a denominator.

NASA states plainly that FIRMS detections are neither a fire count nor a basis for estimating burned area, so the current fire indicator cannot be scored under any methodology.

**Decision needed:** whether to invest in the re-ingestion at all. Free, commercially usable targets exist for the converted metrics (CBD GBF Target 3 = 30% protected by 2030; WHO annual PM2.5 = 5 µg/m³; zero deforestation), so the methodology is not the blocker — the data collection is.

---

## 7. ESG / SDG composite scores — research concluded, recorded so it is not re-litigated

Four research passes on 2026-08-25 settled KIV-02. Summary of the findings, with the reasoning preserved:

**A Governance score is permanently impossible.** Malaysia publishes no state-level governance-quality measure for Sabah or Sarawak (MyOBI measures budget-document publication and is all-rights-reserved; the SDSN Malaysian States index's Goal 16 contains only homicide, violence, detention and prison indicators). Indonesia publishes five recurring provincial governance datasets covering all five Kalimantan provinces including Kalimantan Utara — KPK SPI (2021-2025, open JSON API), Ombudsman compliance scores, Komisi Informasi IKIP, BPS IDI, and BPK audit opinions. **The asymmetry is the blocker**: colouring Kalimantan from real provincial data while Sabah and Sarawak inherit one national figure would look rigorous and be false. Every Indonesian source is "Hak Cipta Dilindungi" with no open licence. The Global Data Lab Subnational Corruption Database resolves Sabah and Sarawak to distinct codes — the only source that does — but has **zero rows for Brunei**, only one year of real survey data (2018, n≈120-180), and a Sabah-Sarawak gap that is not statistically distinguishable from zero.

**Without G, there is no ESG composite.**

**An SDG composite fails on four counts.** (1) SDSN's own inclusion rule requires data for at least 80% of indicators; we hold 29 indicators across 12 of 17 goals. (2) Published scores already exist for three of our four territories but on incompatible scales — Sabah 64.25 and Sarawak 66.81 come from the 72-indicator, 15-goal, 2022-data Malaysian States index, while Brunei's 68.9 comes from the 101-indicator, 17-goal, 2026 global index; the SDR states that comparability requires "the same basket of indicators and similar performance thresholds". Kalimantan has no score under any SDSN-methodology work. (3) The documented rule for a wholly missing goal is to impute the regional average — the EU JRC has publicly warned this makes such scores "reflect more a regional average than the particular situation of the country" — and we have no defined region, so this would violate our own never-impute commitment. (4) The SDG Index is licensed **CC BY-NC-ND 4.0**: NonCommercial conflicts with the project's stated commercial direction, and NoDerivatives makes publishing scores computed from their threshold tables legally uncertain. EPI, the equivalent for environment, is CC BY-NC-SA.

**A structural limit worth remembering:** every published index derives its "worst" bound from a percentile across ~180 countries. With four territories that calculation cannot be performed at all.

**What the research says is viable instead:** goal-level status ratings with insufficient coverage shown as grey rather than scored. This is what SDSN itself publishes for units it declines to rank, and the Malaysian States methodology gives a citable threshold — *"If a country or state has data available less than 50% of the indicators for a goal, colour assigned for Goal rating is grey"*. Environmental bounds would come from treaty and regulatory targets, which are free and commercially usable, rather than from EPI's NonCommercial percentile tables.

**Lead worth following:** the Jeffrey Sachs Center at Sunway University already scores Sabah and Sarawak, holds Asia-Pacific thresholds it derived for indicators absent from the global table, and states on its own methodology page that it obtained the methodology in collaboration with SDSN Paris rather than reusing it unilaterally. A Malaysian university working the same region — one conversation could resolve both the licensing question and the missing thresholds.

---

## Delivery state as of this file

- **33 of 33 BT tickets complete.** The three KIV cards remain parked by the client's instruction.
- Wave 3 stages 1 and 2 are committed and pushed on `wave-3`.
- Stage 3, stage 4 and the client-review follow-up are committed alongside this file.
- **`wave-3` has not been merged to `master`.** Nothing from Wave 3 is live.
- `public/data/sources.json` and `public/data/resilience_history.json` do not exist yet. They are auxiliary artifacts generated by `refresh-data.yml` on master per BT-28, so the Sources section and the momentum badge render nothing until that runs and `anchor.yml` stamps the result.
