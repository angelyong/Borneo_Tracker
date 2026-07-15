# Borneo Tracker — True Wealth Resilience Index: Methodology (v1)

> How raw indicators become the headline **Resilience Index** (e.g. 64.7) + Green/Yellow/Red status per pillar and territory. Designed to embody the supervisor's framework — *The ABCDE Framework in The True Wealth Hexagon* — not a generic index.

---

## 1. Philosophy — what the index is actually measuring

The book's thesis: real wealth is not money ("paper wealth") but a civilization's **resilience across the survival pillars**. So the index does NOT measure GDP or income. It measures:

> **Can each Borneo territory sustain its people across all six survival pillars — Food, Energy, Education, Shelter, Healthcare, Entertainment?**

Three principles flow from the book and shape the maths:

1. **Sovereignty, not ranking.** We score each territory against an *absolute self-sufficiency / adequacy benchmark* ("can it stand on its own?"), NOT against whichever neighbour happens to be best. → use **target-based** normalization, not min-max-between-territories.
2. **The hexagon is symmetric.** Six equal sides → **equal weight** for the six pillars by default. The geometry is the argument.
3. **Resilience = the weakest link.** A civilization is not resilient if one survival pillar collapses, no matter how strong the others are. → the index must **surface the weakest pillar**, and we offer a "strict" mode that punishes imbalance.

---

## 2. Structure

```
6 Pillars (equal weight)                Each scored per territory:
  Food · Energy · Education ·             Sabah · Sarawak · Brunei · Kalimantan
  Shelter · Healthcare · Entertainment    (+ All-Borneo aggregate)
        │
   each pillar = 2–3 indicators (the ones with real data)
        │
   indicators → pillar score → Resilience Index → Green/Yellow/Red
```

---

## 3. Calculation (4 steps)

### Step 1 — Normalize each indicator to a 0–100 "resilience score"

```
resilience_score = clamp( (value − floor) / (target − floor) × 100 , 0 , 100 )
```
- **target** = the value that represents full resilience / self-sufficiency (= 100).
- **floor** = the value representing no resilience (= 0).
- **"lower is better" indicators** (poverty, deforestation, flood) are inverted: swap floor/target so a low value scores high.
- *Why target-based:* it answers "is this territory self-sufficient?" (the sovereignty idea), not "is it better than Sarawak?". Targets come from international goals (SDG 2030), national targets, or adequacy thresholds (e.g. electricity access target = 100%).

### Step 2 — Indicator scores → Pillar score
```
pillar_score = average( its indicator resilience_scores )
```

### Step 3 — Pillar scores → Resilience Index (two numbers, by design)
```
Resilience Index (headline) = average( 6 pillar_scores )      ← equal weight (hexagon symmetry)
Weakest Pillar              = min( 6 pillar_scores )           ← the limiting factor, shown prominently
```
- **Optional "strict resilience" mode:** use the **geometric mean** instead of the average. It drops sharply if any pillar is near zero — mathematically expressing "no food = no resilience, however good the entertainment". Good as a secondary, more philosophically-pure number.

### Step 4 — Traffic-light status (RAG)
| Score | Status | Meaning |
|---|---|---|
| ≥ 70 | 🟢 Resilient / On Track | self-sufficient, stable |
| 40–69 | 🟡 At Risk / Moderate | gaps, needs attention |
| < 40 | 🔴 Critical | pillar failing |

---

## 4. Data confidence layer — the "Ethics" (E) of ABCDE

Not all data is equally solid (some is state-level, some national proxy). To stay *trustworthy* (a core project requirement), every score carries a confidence flag based on its `data_level`:

| data_level | Confidence |
|---|---|
| state / province (exact) | High |
| national (applied to a territory) | Medium |
| proxy / estimate (e.g. Brunei poverty) | Low |

→ The dashboard shows the score **and** its confidence, so users see how trustworthy each number is. This is the ABCDE "Ethics" pillar made concrete.

---

## 5. Worked example — Sabah (illustrative)

| Pillar | Pillar score | Status |
|---|---|---|
| Food | 57 | 🟡 |
| Energy | 60 | 🟡 |
| Education | 70 | 🟢 |
| Shelter | 62 | 🟡 |
| Healthcare | 68 | 🟡 |
| Entertainment | 80 | 🟢 |

```
Resilience Index = (57+60+70+62+68+80) / 6 = 66.2  → 🟡 At Risk
Weakest Pillar   = Food (57)                        → the priority to fix
Strict mode (geometric mean) ≈ 65.4
```
*(The 0–100 pillar scores above come from Step 1–2 once benchmarks are set; numbers here are illustrative of the mechanism.)*

---

## 6. Design decisions to confirm with the supervisor

These have no single "correct" answer — they are the team's methodological contribution and should be agreed with Mr. Koh / Dr. Sugu:

1. **Benchmarks (the "100" for each indicator):** use SDG 2030 targets, national targets, or adequacy thresholds? *(Recommend: targets/adequacy — fits the sovereignty idea.)*
2. **Weighting:** equal across the 6 pillars, or weight survival pillars (Food/Energy) higher? *(Recommend: start equal — hexagon symmetry, easiest to defend.)*
3. **Aggregation:** arithmetic average (headline) vs geometric mean (strict). *(Recommend: average as headline + always show the weakest pillar.)*
4. **RAG thresholds:** 70 / 40 — or different cut-offs?

---

## 7. ABCDE alignment (so the methodology maps to his framework)

| Letter | Where it lives in this methodology |
|---|---|
| **A — AI** | (Phase 2) auto-detect anomalies, forecast pillar trends |
| **B — Blockchain** | (Phase 2) hash each published index value so it's tamper-evident |
| **C — Connectivity** | the APIs feeding the indicators |
| **D — Data** | the indicator catalogue + normalization (Steps 1–3) |
| **E — Ethics** | the data-confidence layer (§4) + fully published, transparent formula |

---

## 8. One-line summary

> Take real survival-pillar indicators → score each 0–100 against a self-sufficiency target → average the six equal pillars into one Resilience Index, while always flagging the weakest pillar → colour Green/Yellow/Red, with a confidence tag. That single number is the platform's answer to *"how truly wealthy is Borneo?"*
