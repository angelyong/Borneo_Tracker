# Open issues — found 2026-08-25, not yet actioned

Everything here was **found and verified** during the Wave 3 client-review audit and the ESG/SDG feasibility research. Each entry records the evidence, why it matters, and the decision that has to be made before anyone writes code. Resolved entries are struck through and keep their original write-up, so the reasoning stays readable after the fact.

**Status:** §1 and §3 closed 2026-08-26; §5 closed and §2 partly closed 2026-08-27. §4's aggregate half shipped as BT-34; its district half is BT-35, blocked on BT-36. §2 and §6 remain open; §7 is a recorded research conclusion, not a task.

**Project framing, confirmed 2026-08-26:** Borneo Tracker is a research and academic project with **no commercial direction**. NonCommercial licence terms are therefore not a blocker anywhere in this file. `docs/BUSINESS_CASE_ABCDE.md` is an ABCDE-framework thinking note ("not a signed plan", per its own header), not the project's direction; an earlier version of this document wrongly treated it as one.

Nothing in this file is a KIV item. The three KIV cards (KIV-01 natural-language query engine, KIV-02 ESG/SDG composite layers, KIV-03 AI daily narrative) stay parked by the client's own instruction and are **out of scope** — see §7 for what the research concluded about KIV-02, recorded so the question does not get re-opened from scratch.

---

## 1. ~~Four indicators declare a scoring rule that never runs~~ — RESOLVED 2026-08-26

**Resolved by option (a): the four entries were withdrawn.** No published score changed, because they never scored. Specifically:

- Removed from `compute_resilience.BOUNDS`, with the values and the three reasons they were not simply re-pointed at a pillar preserved as a comment in place.
- The chatbot's hand-copied `TARGET_BOUNDS` mirror in `supabase/functions/ai-chat/factCalculations.ts` is gone. This mattered more than the Python side: the old `targetForIndicator()` matched on indicator name and unit alone with no pillar check, so a user asking BorneoBot for a "target" or "gap" on poverty or unemployment could be handed a figure the dashboard never shows, cited to `compute_resilience.py.BOUNDS`. **Superseded in the merge by BT-33's stronger fix** — see "How the two fixes fit together" below.
- Two regression guards added in `tests/test_resilience_model_export.py`: one asserting **no bound may be declared that cannot resolve to a pillar** (the general defect), one naming these four specifically.
- The synthetic fixture row that was the only place the "cross-pillar wellbeing rate" path ever executed was replaced with a genuinely bounded, genuinely pillar-tagged indicator.

`resilience_model.json` changes (its `bounds` block is exported verbatim), so this regenerates and re-anchors through the normal BT-28 sequence on master. The feature branch carries code and tests only.

**Still open, deliberately:** whether poverty and unemployment *should* be scored at all. Restoring them requires answering which hexagon pillar they belong to (the six are needs; these are economic conditions cutting across all of them), what to do about Brunei having no poverty row, and whether Malaysia's absolute line and Indonesia's P0 line can share a pillar score. That is a methodology card, not a config change.

<details><summary>Original write-up, kept for the record</summary>

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

</details>

### How the two fixes fit together

This was closed from both ends on the same day, by different people, and the two halves are complementary rather than duplicative:

- **Data side (BT-34 branch):** the four entries were withdrawn from `compute_resilience.BOUNDS`, so the pipeline stops *publishing* a rule it never applies. They will leave `public/data/resilience_model.json` at the next master refresh under the BT-28 sequence.
- **AI Chat side (BT-33):** `factCalculations.ts` no longer holds a mirror at all. `targetForIndicator()` takes bounds as a parameter and `FactDataRepository` reads them from the canonical `public/data/resilience_model.json`. On top of that, `buildTargetGapFact()` refuses any bound whose indicator is absent from `indicatorToPillar`, raising `TARGET_INACTIVE` and marking the fact `PARTIAL`.

**The runtime guard is the stronger of the two**, and it stays valuable after the withdrawal lands: it rejects the whole class — *any* bound not mapped to a current pillar — rather than four indicators by name. It is also what covers the window between now and the master refresh, while the committed artifact still contains the withdrawn entries.

**BT-33 implementation boundary (2026-08-26), as recorded by that ticket:** the four inactive bounds are still present in the committed canonical artifact pending D4 owner approval. **The AI Chat implementation must not itself remove them from that artifact, map them to a Hexagon pillar, or describe them as active Resilience Index methodology.** That boundary is about who may change the data contract, and it is unaffected by the data-side withdrawal above — which went through `compute_resilience.py` and the BT-28 release sequence, not through the chat implementation.

---

## 2. ~~Malaysian and Indonesian poverty rates are displayed side by side~~ — PARTLY RESOLVED 2026-08-27

**The map is fixed. The wider class is now visible and partly open.**

Investigating this turned up something worse than the poverty case, on the same mechanism. **Seven `dashboard_concept` groups have territories carrying different indicator definitions**, and two of them drive map layers:

| concept | what the four territories actually carry |
|---|---|
| `forest_cover` | Brunei `% land`; Sabah/Sarawak/Kalimantan `ha` |
| `poverty` | Sabah/Sarawak Malaysia's absolute line; Kalimantan Indonesia's P0 line |
| `economy` | Brunei/Kalimantan GDP growth `%`; Sabah/Sarawak GDP `RM mil` |
| `education` | Brunei adult literacy `%`; others mean years schooling `years` |
| `energy` | Brunei/Sabah/Sarawak electricity access; Kalimantan PLN electrification ratio |
| `entertainment` | tourist arrivals vs domestic tourist trips |
| `shelter` | Brunei basic sanitation `%`; others household counts |

**The live defect this exposed:** the Forest Cover map layer ranked Brunei's `72.1 % land` against Kalimantan's `49,925,040 ha` on one relative colour ramp. Brunei — the most forested territory in Borneo by share — normalised to `0.0000` and painted **red, worst**. That was on screen.

**Fixed with two guards in `layerColorScale` / the new `layerComparability`:**

- **Unit mismatch is detected, not declared.** It is a bug class, so any layer whose territories report different units is refused a ranking ramp: everything paints neutral and the panel says which units are in play. Forest Cover is caught today; a future layer that develops the same problem is caught without anyone noticing it first.
- **Same-unit, different-definition must be declared.** No check can tell Malaysia's absolute poverty line from Indonesia's P0 line — both are `%`. `poverty` now carries `crossBorderDefinitions: true`, which still ranks (comparing two national lines is defensible) but renders a note saying a lower figure on one side of the border does not necessarily mean a better outcome than a higher figure on the other.

**Still open:** the underlying data. Brunei should carry forest extent in `ha`, or the others `% land`; the `economy`, `education`, `entertainment` and `shelter` concepts mix units in ways the map does not currently surface because no layer uses them. Kalimantan's poverty figure also remains an *"unweighted mean of 3/5 provinces, approx"* by its own `source` field, and Brunei still has no poverty row at all. Those are ingestion work and overlap BT-36 and §6.

<details><summary>Original write-up, kept for the record</summary>

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

</details>

---

## 3. ~~The stored WGI governance value may be stale~~ — CLOSED 2026-08-26

**No action needed.** `ingest_poc.pull_governance()` queries the World Bank API live on every refresh (`GOV_WGI_CC.SC?format=json&mrv=5`) and takes the most recent date, so the 2025 methodology revision is picked up automatically. A live API pull during the research returned Brunei 71.86 / Indonesia 36.83 / Malaysia 57.94, which matches what we publish after rounding — the stored values are already the revised series.

<details><summary>Original write-up, kept for the record</summary>

**Severity: medium.**

The World Bank revised the Worldwide Governance Indicators methodology in 2025 and **recalculated the entire history back to 1996**. Our stored Control of Corruption values (Brunei 71.9, Malaysia-inherited 57.9 for both Sabah and Sarawak, Indonesia-inherited 36.8 for Kalimantan) predate that check.

A live API pull during the research returned Brunei 71.86, Indonesia 36.83, Malaysia 57.94 — which reproduces what we store, so the current values look right. But nobody has confirmed our ingestion is reading the revised series rather than a cached one.

**Decision needed:** re-run the WGI ingestion and diff, or confirm the source endpoint is the revised series. Low effort.

WGI is CC-BY 4.0, so there is no licence obstacle here.

</details>

---

## 4. The all-Borneo pillar drill-down opens empty

**Severity: low, but it is on the default screen.**

The Dashboard defaults to `panelTerritory = 'Overall Borneo'`. Clicking a radar pillar in that scope opens `PillarDrilldownModal`, which renders the `pillarDrilldown.aggregateTitle` / `aggregateBody` card — *"Aggregate score, no single indicator list… Choose an individual territory to inspect its scored source indicators"* — because `drilldownIndicators` is hard-coded to `[]` for the aggregate and district scopes.

That is honest: an aggregate genuinely has no single set of source rows. But the client's §3.4 asks to *"drill into the underlying indicators"*, and on the screen a first-time visitor lands on, the drill-down currently teaches them nothing.

Related: pillars are **not** clickable at all in District scope — that radar shows indicator counts, not scores, and is mounted without `onPillarSelect`.

**Decision needed:** leave as-is, or show the four territories' figures for that pillar side by side. The client-facing note already raises this as a known limitation and invites him to choose.

---

## 5. ~~The ESG and SDG pages have no tests~~ — RESOLVED 2026-08-27

**Resolved.** 16 tests added across `src/pages/ESG/esg_indicator.test.jsx` and `src/pages/SDG/sdg_progress.test.jsx`, covering the count-not-score contract, canonical filtering, territory isolation, scope switching, empty states, provenance display, the BT-23 answer strip, and both locales.

**The assertion that matters was wrong on the first attempt, and was caught by mutation-testing it.** The original check was `expect(container.textContent).toContain('2')` — which passes happily against a hero figure of `62.3`. Replacing `summary.count` with a fabricated score left all 8 tests green. The check now locates the hero figure structurally (the element immediately before its own caption) and asserts exact equality against both the expected count and the number of rendered indicator cards. Re-running the same mutation now fails with `expected '62.3' to be '2'`.

That is worth recording because it is the same defect this project criticised in BT-33's suggested-questions test: a green test vouching for a property it does not actually check.

<details><summary>Original write-up, kept for the record</summary>

**Severity: medium.**

`src/pages/ESG/` and `src/pages/SDG/` contain only their `.jsx` files. Zero test files. They are the least-covered surfaces in the app, and they are exactly where any future ESG/SDG work would land. The Wave 3 answer strip is already mounted on both.

**Decision needed:** none — this is just work. Worth doing before either page changes again.

</details>

---

## 6. Environmental indicators measure the wrong quantity — DISCLOSED 2026-08-27, re-ingestion still open

**The misleading half is fixed; the measurement half is deferred to BT-36.**

The live consequence was on the map. `deforestation` and `fireHotspots` rank by absolute total, so Kalimantan led both — it is by far the largest territory — and the red/amber/green ramp turned a size statement into a performance judgement. Normalised against each territory's own year-2000 forest extent the order inverts:

```
absolute (what the map ranked)     per baseline forest extent
  Kalimantan  12,059,800 ha  red     Sarawak     27.3 %
  Sarawak      3,183,066 ha  green   Sabah       27.0 %
  Sabah        1,803,226 ha  green   Kalimantan  24.2 %   <- lowest, not highest
  Brunei          30,486 ha  green   (Brunei publishes % land, so no rate)
```

Both layers now carry `absoluteMagnitude: true` and render, via the §2 mechanism, *"Shaded by absolute total, not by size… Read it as 'where the most of this occurs', not as a ranking of performance."* The numbers and captions were always honest; it was the colouring that overreached.

**Still open — the conversions themselves**, which need data we do not hold and belong with BT-36:

<details><summary>Original write-up, kept for the record</summary>

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

</details>

**Decision needed:** whether to invest in the re-ingestion at all. Free, commercially usable targets exist for the converted metrics (CBD GBF Target 3 = 30% protected by 2030; WHO annual PM2.5 = 5 µg/m³; zero deforestation), so the methodology is not the blocker — the data collection is.

---

## 7. ESG / SDG composite scores — research concluded, recorded so it is not re-litigated

Four research passes on 2026-08-25 settled KIV-02. Summary of the findings, with the reasoning preserved:

**A Governance score is permanently impossible.** Malaysia publishes no state-level governance-quality measure for Sabah or Sarawak (MyOBI measures budget-document publication and is all-rights-reserved; the SDSN Malaysian States index's Goal 16 contains only homicide, violence, detention and prison indicators). Indonesia publishes five recurring provincial governance datasets covering all five Kalimantan provinces including Kalimantan Utara — KPK SPI (2021-2025, open JSON API), Ombudsman compliance scores, Komisi Informasi IKIP, BPS IDI, and BPK audit opinions. **The asymmetry is the blocker**: colouring Kalimantan from real provincial data while Sabah and Sarawak inherit one national figure would look rigorous and be false. Every Indonesian source is "Hak Cipta Dilindungi" with no open licence. The Global Data Lab Subnational Corruption Database resolves Sabah and Sarawak to distinct codes — the only source that does — but has **zero rows for Brunei**, only one year of real survey data (2018, n≈120-180), and a Sabah-Sarawak gap that is not statistically distinguishable from zero.

**Without G, there is no ESG composite.**

**An SDG composite fails on four counts.** (1) SDSN's own inclusion rule requires data for at least 80% of indicators; we hold 29 indicators across 12 of 17 goals. (2) Published scores already exist for three of our four territories but on incompatible scales — Sabah 64.25 and Sarawak 66.81 come from the 72-indicator, 15-goal, 2022-data Malaysian States index, while Brunei's 68.9 comes from the 101-indicator, 17-goal, 2026 global index; the SDR states that comparability requires "the same basket of indicators and similar performance thresholds". Kalimantan has no score under any SDSN-methodology work. (3) The documented rule for a wholly missing goal is to impute the regional average — the EU JRC has publicly warned this makes such scores "reflect more a regional average than the particular situation of the country" — and we have no defined region, so this would violate our own never-impute commitment. (4) The SDG Index is licensed **CC BY-NC-ND 4.0**. *Corrected 2026-08-26:* the project is academic, so the **NonCommercial** clause is not a blocker — and EPI (CC BY-NC-SA) is therefore usable for environmental bounds after all. **NoDerivatives is a separate matter from NonCommercial** and still applies: publishing scores computed from their compiled threshold tables is arguably a derivative regardless of commercial intent. The risk is materially lower in an academic setting, and the right response is still to approach the Jeffrey Sachs Center rather than reuse the tables unilaterally. Note also that BPS Indonesia's terms are not commerce-related at all — mandatory citation with a direct link, an anti-hammering clause, and a requirement to delete content BPS withdraws — and those stand regardless.

**Licensing was roughly the fourth-most important obstacle here. Removing it does not change the verdict:** blockers (1), (2) and (3) above are about data asymmetry, coverage and imputation, and are untouched.

**A structural limit worth remembering:** every published index derives its "worst" bound from a percentile across ~180 countries. With four territories that calculation cannot be performed at all.

**What the research says is viable instead:** goal-level status ratings with insufficient coverage shown as grey rather than scored. This is what SDSN itself publishes for units it declines to rank, and the Malaysian States methodology gives a citable threshold — *"If a country or state has data available less than 50% of the indicators for a goal, colour assigned for Goal rating is grey"*. Environmental bounds can come from treaty and regulatory targets (CBD GBF Target 3, WHO annual PM2.5, zero deforestation), which are freely citable — and, now that NonCommercial is not a constraint, from EPI's published percentile tables as well, with attribution and ShareAlike honoured.

**Lead worth following:** the Jeffrey Sachs Center at Sunway University already scores Sabah and Sarawak, holds Asia-Pacific thresholds it derived for indicators absent from the global table, and states on its own methodology page that it obtained the methodology in collaboration with SDSN Paris rather than reusing it unilaterally. A Malaysian university working the same region — one conversation could resolve both the licensing question and the missing thresholds.

---

## Where things stand — updated 2026-08-27

### These issues

| | Issue | State |
|---|---|---|
| §1 | Four bounds declared but never applied, anchored on Bitcoin | **closed** 2026-08-26 — withdrawn from `compute_resilience.BOUNDS`; BT-33 independently removed the chat mirror and added a runtime pillar guard |
| §2 | Cross-border measures ranked as if commensurable | **map closed** 2026-08-27 — unit mismatch now detected and refused, definition mismatch declared. **Underlying data still open** |
| §3 | WGI value possibly stale | **closed** 2026-08-26 — the pipeline pulls live and takes the latest |
| §4 | Pillar drill-down empty on two scopes | **aggregate closed** as BT-34. District half is BT-35, blocked on BT-36 |
| §5 | ESG and SDG pages untested | **closed** 2026-08-27 — 16 tests; the key assertion was mutation-tested after the first version failed to catch its own defect |
| §6 | Environmental indicators measure the wrong quantity | **map disclosure shipped** 2026-08-27; re-ingestion deferred to BT-36 |
| §7 | ESG/SDG composite research | conclusion on record, not a task |

### BT-36 is where to resume

Nothing in it is blocked on a decision; it is data work with a known shape:

- cumulative hectares → annual loss as **% of forest area**, 3-year averaged
- live AQI → **annual mean PM2.5 (µg/m³)**
- FIRMS detection counts → **burned area as % of land area** (NASA states plainly that detections cannot estimate burned area)
- national-park counts → **% of terrestrial area protected**
- `Forest extent (2000)` is a denominator, not a score; the 24-hour hotspot layer is an operational alert, not an index input

**We still hold no land area for any territory**, which several of those conversions need. Free, citable targets exist for the converted metrics — CBD GBF Target 3 (30% protected by 2030), WHO annual PM2.5 of 5 µg/m³, zero deforestation — and since the project is academic, EPI's percentile-derived bounds are usable too.

§6 overlaps **BT-36** (district ingestion) and inherits the data half of §2: Brunei's forest cover is `% land` where the others are `ha`, Kalimantan's poverty is an *"unweighted mean of 3/5 provinces, approx"*, and Brunei has no poverty row.

### Tickets open beside these issues

- **BT-33** — closed by a teammate on 2026-08-26. The suggested-question contract now records all three client examples with per-example blocked reasons; only *"Compare Sabah and Sarawak"* is enabled. D2/D3/D4 remain methodology decisions, not implementation gaps.
- **BT-35** — district pillar drill-down. Blocked on BT-36.
- **BT-36** — district pillar ingestion, both sides of the border. Not started. Note it reopens a question BT-35 currently settles by default: at 4–5 of 6 pillars, "no district Resilience Index" stops being obvious and becomes a methodology decision, with BT-11b's pillar-loss gate needing district scope first.

### Not code, and still outstanding

1. **`wave-3` has never been merged to `master`, so nothing from Wave 3 is live.** The client cannot see any of it.
2. Two auxiliary artifacts — `public/data/sources.json` and `public/data/resilience_history.json` — do not exist yet. They are generated by `refresh-data.yml` on master per BT-28, so the Sources section and the momentum badge render nothing until that runs and `anchor.yml` stamps the result. `resilience_model.json` also shrinks by four bounds at that refresh.
3. **The client note is still an unapproved internal draft.** `docs/CLIENT_FEEDBACK_RESPONSE_2026-08-24.md` needs: the draft marker removed, internal repo paths stripped (a client cannot open them), and its §3.4 paragraph corrected — it says the aggregate *"genuinely has no one set of source rows"*, which BT-34 has now made plainly false.
4. Whether to approach the **Jeffrey Sachs Center at Sunway**, who already score Sabah and Sarawak and hold Asia-Pacific thresholds for indicators absent from the global table.

### Delivery state

- All 33 original BT tickets complete. BT-33 closed since. BT-34 shipped. BT-35 and BT-36 open.
- Three KIV cards stay parked by the client's own instruction.
- Suites at last run: **vitest 65 files / 1062 tests**, **Python 134 tests**, lint and build clean.
