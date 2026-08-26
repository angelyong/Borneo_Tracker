# BT-34 / BT-35 · Pillar drill-down is empty on two of the three scopes

**Raised:** 2026-08-26 · **Client clause:** §3.4 · **Status:** BT-34 done · BT-35 blocked on BT-36
**Related:** BT-12 (shipped — territory-scope drill-down), BT-31 (shipped — honest unscored pillars)

---

## Client ask (§3.4, verbatim)

> The radar chart communicates the imbalance effectively.
> **Make each pillar clickable so users can drill into the underlying indicators.**
> Add a short explanation: *"Resilience is only as strong as its weakest essential pillar."*
>
> Note: "Weakest Link First" is potentially a powerful intellectual property / methodology concept. It transforms the dashboard from simply measuring performance into identifying where intervention can create the greatest improvement.

BT-12 delivered this for one of the three scopes. The explanation sentence was added separately during the 2026-08-25 client-review follow-up.

## Where it works and where it does not

| Scope | Radar shows | Pillar clickable | Drill-down shows |
|---|---|---|---|
| Single territory (Sabah, Sarawak, Brunei, Kalimantan) | 0–100 pillar scores | yes, mouse + keyboard | the real indicators — value, year, source, confidence |
| **Overall Borneo** *(the default view)* | 0–100 aggregate pillar scores | yes | **nothing** — a card saying an aggregate has no indicator list |
| **District** | indicator *counts*, not scores | **no** — `onPillarSelect` is not passed | n/a |

`OverviewDashboard.jsx`:

```js
const drilldownIndicators = !isDistrict && !isOverall
  ? resilience?.territories?.[panelTerritory]?.detail?.[drilldownPillar] || []
  : [];                                    // aggregate and district both get []
```

The Dashboard opens on `panelTerritory = 'Overall Borneo'`, so **the scope a first-time visitor lands on is the one where the client's feature does nothing.**

---

# BT-34 · Aggregate scope: show what the average is made of — DONE 2026-08-26

**Role:** FE · **Effort:** S · **Priority:** P2

**Shipped.** Clicking a pillar on the all-Borneo view now lists every contributing territory's indicators and states the arithmetic. Live output for Shelter:

```
Sabah      · Clean water access       80.5%  (2022) → 61.0
Sarawak    · Clean water access       83.7%  (2022) → 67.4
Brunei     · Basic sanitation access 100.0%  (2024) → 100.0
Brunei     · Clean water access      100.0%  (2024) → 100.0
Kalimantan · Clean water access       82.98% (2025) → 66.0

All-Borneo 73.6 is the mean of the 4 scored territories:
Sabah 61.0 · Sarawak 67.4 · Brunei 100.0 · Kalimantan 66.0.
```

Three things the implementation had to get right:

- **The React key had to gain the territory.** Flattening four lists produces genuine duplicates — Sabah and Sarawak both report `Clean water access` for 2022 — and the old key was `indicator-year`.
- **A territory with no score for the pillar contributes no rows.** It is absent from the mean, so it must not appear in the list as a zero.
- **The method line does not use `{{count}}`.** i18next reserves that token for plural resolution and would look for `_one`/`_other` variants that Malay must not have; the token is `{{territories}}`.

The `isScored` gate was left untouched, so BT-31's guarantee is unaffected.

**Still to do:** the draft client note says the aggregate *"genuinely has no one set of source rows"*. That was wrong before this shipped and is plainly wrong now — it has four, one per territory. Fix it when the note is finalised (currently parked).

---

# BT-35 · District scope: make the pillars clickable, and be honest about the asymmetry

**Role:** FE + DATA · **Effort:** S–M · **Priority:** P2 · **Status:** blocked on the BT-36 decision

**Investigation changed this ticket's premise — see "What the research found" below.** The Malaysian gap is not a publication limit. Separately, a defect the district radar had regardless of this ticket was fixed on 2026-08-26: coverage counts were reaching `HexRadar` as zeros, so every axis read as scored, a filled polygon was drawn, and with the scale auto-fitting the largest count a single indicator rendered at the same full radius as a score of 100. Zero-count pillars are now passed as `null` and label as "No comparable data".

`districts.json` holds **987 rows across 131 districts**. Contrary to an earlier assumption in this project, district-level pillar data *does* exist — but for only two pillars, and only on one side of the border:

```
hexagon_pillar across all 987 district rows:
  (empty)      875
  Education     56   Mean years schooling (RLS) — BPS Indonesia, canonical, high confidence
  Healthcare    56   Life expectancy            — BPS Indonesia, canonical, high confidence
```

Those 56 rows are exactly the 56 Kalimantan districts. **Sabah's 28 districts and Sarawak's 47 districts carry zero pillar-tagged rows.**

What the radar renders today:

```
Sambas (Kalimantan Barat)   Food 0 · Energy 0 · Education 1 · Shelter 0 · Healthcare 1 · Entertainment 0
Kota Kinabalu (Sabah)       all zero
Kuching (Sarawak)           all zero
```

So a Kalimantan district has real, citable indicators behind two pillars that nobody can reach, because the district radar is mounted without `onPillarSelect`.

**Two things this ticket must NOT do:**

1. **It must not produce a district-level Resilience Index.** Two of six pillars, and only for 56 of 131 districts. Averaging that into an index is precisely the defect BT-11a corrected and BT-11b now gates against.
2. **It must not present Sabah and Sarawak districts as merely "no data yet"** if the underlying reason is that the data is not published at that granularity. The reason belongs on screen.

---

## What the research found (2026-08-26)

Four surveys ran — two over the repo, two over external sources. Summary of what changed:

**Q1 — the drill-down component.** `PillarDrilldownModal` extends cleanly for BT-34 and was extended. For BT-35 it does not: the indicator list lives **inside** the `isScored` branch, district rows carry no `score` field, and this ticket forbids manufacturing one. The modal would need a third, named, tested state — "indicators present, score deliberately absent" — because `isScored` is not a display condition, it is the structural form of BT-31's "a score of zero is not assumed" guarantee. No reusable container exists elsewhere in the codebase; the closest data shape is `reportContent.js`'s per-indicator `readings`, but that is print code with no i18n or theme tokens.

**Q2 — the district data.** Verified exactly: 987 rows, 131 districts, `hexagon_pillar` is `Education` on 56 rows and `Healthcare` on 56 — all of them Kalimantan, none of them Sabah or Sarawak. Also found: **239 district rows are bounded but pillar-blank** (unemployment 124, poverty 115), which was the district-scale version of OPEN_ISSUES §1, now resolved by withdrawing those bounds. And **districts have never entered SQLite at all** — `SELECT COUNT(*) FROM indicators WHERE data_level='district'` returns 0 — so no district row has ever passed through `score_value`. Scoring a district is new code, not a config change.

**Q3 — the decisive one. The Malaysian gap is a sourcing gap, not a publication limit.** Two independent lines of evidence:

- *From our own code:* `ingest_poc.py:275-292` already downloads `hospital_beds`, `enrolment_school_district` and `hh_access_amenities` — all three carry a `district` column — and filters each to the `"All Districts"` roll-up, discarding the breakdown. Separately, `ingest_districts.build_dosm()` never passes `hexagon=` to `make_row`, so **every Malaysian district row is pillar-blank by default argument**; unlike the BPS and GFW modules, it never calls `hexagon_pillar()`.
- *From the publishers:* DOSM publishes water, sanitation and electricity per district (`hies/hh_access_amenities.csv` — the same bucket `ingest_districts.py` already fetches `hies/hh_poverty_district` and `hies/hies_district` from), internet use per district to 2025, and — new since September 2025 — **life expectancy by district**, the exact indicator we already ingest for Kalimantan. All CC BY 4.0. Real variance exists: Sarawak Bukit Mabong 2024 has piped water 25.0% and electricity 54.2% against a state figure near 99%.

**The one genuine publication limit:** mean years of schooling does not exist below state level, and Malaysia does not publish it as raw years at any level — zero matches across all 290 data.gov.my and all 183 OpenDOSM datasets. It exists only as an input to the Education Index inside the Malaysia Human Development Index, published for 16 states.

**Indonesia is under-ingested too.** The same BPS endpoint we already call returns kabupaten breakdowns for rice production, internet use, clean water and sanitation that `ingest_districts_bps.py` never requests. Its mirror-image weakness: **no kabupaten-level electrification ratio exists from BPS**, so Energy is thin on the Indonesian side exactly where it is available on the Malaysian one.

**Consequence for this ticket.** BT-35 as written was "make it clickable and explain a limitation". The limitation is largely not real. Making district pillars clickable today would show Kalimantan two indicators and Sabah/Sarawak nothing — and the empty state could not honestly say "not published at this granularity". The ingestion work is therefore tracked separately as **BT-36**, and BT-35 waits on whether that lands first.

**Q1 — What does the existing drill-down component actually support?**
`PillarDrilldownModal` was built for one shape: a list of indicators for one territory. An aggregate view needs a territory column; a district view needs to handle "this pillar has nothing" for four or six pillars at once. Does the component extend cleanly, or is a second shape needed? Is there an existing component that already renders a per-territory comparison worth reusing rather than duplicating?

**Q2 — Is the district data genuinely as described, and is anything else taggable?**
Independent re-verification of the 56/56/0/0 finding. Also: districts carry `poverty`, `household_income`, `inequality`, `economy`, `unemployment_rate`, `forest_cover`, `deforestation`, `fire_hotspots` with no pillar tag. Should any of those legitimately belong to a hexagon pillar — and note that poverty and unemployment are already the subject of an unresolved question in `OPEN_ISSUES_2026-08-25.md` §1, so this must not be settled casually.

**Q3 — Is the Sabah/Sarawak district gap a permanent limitation or an unfilled sourcing gap?**
This decides what BT-35 says on screen and what we tell the client. If Malaysian agencies publish district-level education, health, water, energy or food statistics for Sabah and Sarawak, then "no data" is our sourcing gap and the honest label is different from a genuine publication limit. If they do not publish at that granularity, that is a real limitation and should be stated as one, with a source.

## Done when

- Both scopes answer the client's sentence, or state in the interface exactly why they cannot.
- No district-level Resilience Index is created.
- The reason for any empty state is on screen, not only in a document.
- The draft client note's §3.4 paragraph is corrected.
