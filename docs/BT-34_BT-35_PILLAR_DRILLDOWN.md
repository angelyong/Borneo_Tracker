# BT-34 / BT-35 · Pillar drill-down is empty on two of the three scopes

**Raised:** 2026-08-26 · **Client clause:** §3.4 · **Status:** open, investigation in progress
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

# BT-34 · Aggregate scope: show what the average is made of

**Role:** FE · **Effort:** S · **Priority:** P2

**The data is already there.** Every pillar has a per-territory indicator list in `resilience.json`, and the aggregate pillar score is the mean of the four territory pillar scores. Clicking Shelter on the all-Borneo view could show exactly this:

```
Sabah        Clean water access        80.5%  (2022) → 61.0   [high]
Sarawak      Clean water access        83.7%  (2022) → 67.4   [high]
Brunei       Basic sanitation access  100.0%  (2024) → 100.0  [high]
Brunei       Clean water access       100.0%  (2024) → 100.0  [high]
Kalimantan   Clean water access       82.98% (2025) → 66.0   [high]
                                       aggregate = mean(61.0, 67.4, 100.0, 66.0) = 73.6
```

No new data collection. No new methodology. The drill-down would also make the aggregate arithmetic visible, which serves the client's §1.2 objection to numbers a reader cannot account for.

**Correction to an earlier statement.** The draft client note currently says the aggregate *"genuinely has no one set of source rows"*. That is wrong — it has four, one per territory. That sentence must be fixed when the note is finalised.

---

# BT-35 · District scope: make the pillars clickable, and be honest about the asymmetry

**Role:** FE + DATA · **Effort:** S–M · **Priority:** P2

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

## Investigation required before either ticket is implemented

Three questions are open. The proposal follows the answers, not the other way round.

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
