# Borneo Tracker — ABCDE ↔ Hexagon Alignment & Reframe Plan

> **Status:** 2026-07-15. **Phase 0 decisions LOCKED** (0.1 water→Shelter · 0.5 RAG 70/40 ·
> 0.6 demote hexagon, weakest-link hero). **Smallest validating loop DONE** (1.1 re-tag + 0.5 RAG
> + 1.5 re-run) — verified: Sabah/Sarawak 1→2 pillars, Kalimantan 3→4, Sabah+Kalimantan flipped
> green→amber. **Brunei still 89.2 green — Food (8.4%) not yet wired (Phase 1.4, pending target
> sign-off).** Next: 0.2/0.3/0.4 + remaining Phase 1.
> **Purpose:** Tighten the product's link to the supervisor's **ABCDE Framework**, and make the
> **True Wealth Hexagon + Resilience Index** (the hero) *credible, capable, and valuable*.
> **Pairs with:** the `borneo-abcde-framework` skill (thinking lens),
> `borneo_tracker_resilience_index_methodology.md`, `compute_resilience.py`,
> `docs/BUSINESS_CASE_ABCDE.md`.

---

## 0. TL;DR

Our strongest asset — a **trustworthy measurement (D + E)** — is already in hand, but it is buried
under three things: **a half-built hero that is also mis-filed, honesty hidden inside the data
instead of on screen, and a lopsided skeleton**. The fix is **not "go find more data."** It is
**"assemble what we already have correctly, surface it honestly, and use it."**

The work is **front-loaded and cheap**: the highest-value first steps need almost no new data
(re-tagging, adding target values, surfacing existing confidence). The big builds (A simulator,
C real-time, B) come later and can be deferred or narrated as roadmap. **This is a sequenced
reframe, not a big-bang rewrite.**

---

## 1. The mental model — three different axes

| | Answers | What it is | Role in the product |
|---|---|---|---|
| **ABCDE** | **How** | the technology stack / method | the *skeleton* of the whole product |
| **True Wealth Hexagon** | **What** | six survival systems | the **hero** |
| **Resilience Index** | **How much** | one 0–100 score | the yardstick built to replace GDP |
| **ESG / SDG** | **How to translate it outward** | two reporting lenses | toggles on the same data — **not** the hero |

**Hexagon (the six pillars):** Food · Energy · Education · Shelter · Healthcare · Entertainment.
**ABCDE:** A = AI · B = Blockchain · C = Connectivity · D = Data · E = Ethics.

---

## 2. Corrections we settled (so we don't regress)

1. **ESG/SDG are lenses, not the substrate.** ABCDE is *not* "built around ESG/SDG." ESG/SDG are a
   thin translation layer on top of **D**; they already render as well as the underlying data allows.
2. **ABCDE is the skeleton, not a patch for a data hole.** The causality is *not* "data is thin, so
   we invoke ABCDE." ABCDE is the design DNA regardless; **Data is just its D letter** — and it is
   already our *strongest* letter (~75%).
3. **Never inflate the index via presentation.** The Resilience Index measures reality. Better
   presentation makes it *honest and useful*, it does **not** raise the number. Completing the
   pillars will likely push some scores **down** (Brunei drops once Food enters) — **that is
   success**, because exposing the fragility GDP hides is the whole value proposition.
4. **Goal = complete + credible + actionable, not "high."** A score you have to *raise* by
   presentation is a vanity metric, i.e. the opposite of the thesis.

---

## 3. Diagnosis — what is actually wrong (one root, five facets)

**Root:** we have not assembled / surfaced / used the trusted measure we already own.

### Facet 1 — The hero is half-built *and* mis-filed
The hexagon lights only 1–3 of 6 pillars. Verified against `compute_resilience.py` + `resilience.json`,
the causes break down as — **and only the last is truly "missing data":**

| Cause | Example | Data problem? | Fix |
|---|---|---|---|
| ① **Mis-tagging** | Clean water / sanitation should be **Shelter** (per methodology) but the data rows are tagged **Healthcare** → Shelter starves, Healthcare double-counts | ❌ No | re-tag, 0 new data |
| ② **Missing BOUNDS targets** | **Entertainment has no target defined at all** → indicators exist but cannot be scored | ❌ No | define targets (methodology decision) |
| ③ **Absolute counts not per-capita'd** | tourist trips / households / crop tonnes are (correctly) excluded as non-comparable | 🟡 Partly | divide by population → comparable |
| ④ **Genuinely missing** | Brunei food self-sufficiency 8.4% (used in the demo, not wired into scoring) | ✅ Yes | wire one number in |

> **Key finding:** the hexagon's thinness is **mostly tagging + targets + per-capita work, not a data
> shortage.** True missing data is the minority.

### Facet 2 — The radar plots *counts*, not scores
`getHexagonCoverage()` in `src/data/useIndicators.js:419` does `counts[pillar] += 1`. The user is
looking at **"how many indicators per pillar," dressed up as wealth strength.** #1 visual reason the
hero looks untrustworthy.

### Facet 3 — The moat (E) is hidden in the data
The confidence layer (`data_level` → High/Med/Low) is designed (methodology §4) and present in the
data, **but not shown in the UI.** We locked our strongest differentiator in a drawer.

### Facet 4 — The skeleton is lopsided
ABCDE is under-realized mainly because **4 of 5 letters have no built surface** — not because of
missing data. See scorecard below.

### Facet 5 — Audience mismatch + unmonetized value chain
The aggregate score is a **narrative tool** for the supervisor / government, yet is expected to serve
**transactional users** (who decide at indicator / plot level). And the "trusted measure → price the
real assets (EUDR / dMRV)" value chain lives only in `docs/BUSINESS_CASE_ABCDE.md`, not in the product.

---

## 4. ABCDE maturity scorecard (current)

| Letter | Maturity | Why it's weak (mostly *not* data) |
|---|---|---|
| **D** Data | 🟢 ~75% | strongest; the real gap is hexagon *scoring* coverage |
| **E** Ethics | 🟡 ~45% | content exists in data, **not surfaced in UI** — a presentation gap |
| **C** Connectivity | 🟠 ~20% | snapshots vs real-time — an **architecture** gap |
| **A** AI | 🟠 ~10% | Impact Simulator **not built** — a **build** gap |
| **B** Blockchain | 🔴 0% | deliberately not started — a **scope** gap |

**Honest posture:** ship **D** and **E** fully and honestly; show **A / C / B** as explicit roadmap.
Faking B in front of an author-supervisor is a credibility trap.

---

## 5. Solutions per surface (the five ABCDE layers)

> These are **layers that co-inhabit screens**, not five separate pages. A single indicator card
> carries D (value) + E (confidence/source) + C (freshness) at once.

**D — Data surface:** indicator explorer (filter by territory/pillar/ESG/SDG) · per-indicator card
(value · unit · **target · gap-to-target** · trend sparkline) · 6 pillar scores + Resilience Index ·
territory↔district (ADM2) drill-down (built) · 27-series trends · three-lens toggle (Hexagon/ESG/SDG) ·
cross-territory table · open-data / download / API (required feature).

**E — Ethics surface:** confidence badge on every score · source + date + methodology link · coverage
("6 scored / 3 unscored") + gaps shown as gaps (never imputed) · **methodology page** (formula is
already written) · data lineage / audit trail · "how we scored this" expander · update changelog ·
(seam for B: hash of published values).

**C — Connectivity surface:** freshness badge per indicator (last-updated · live vs snapshot · cadence) ·
live map layers (fire, AQI, forest change) · **alert stream** (fire / deforestation) → mobile ·
push / subscriptions (mobile requirement) · citizen reports intake (mobile requirement) · system status.

**A — AI surface (differentiator):** **Development Impact Simulator** (conversational What-If →
deterministic sim → labelled "illustrative") · scenario builder (change a driver → see pillar/index
impact) · weakest-pillar "what would move it" recommendations · forecasting on trend series ·
AI data-intake (AR modules, back-office) · anomaly detection · auto-drafted narrative/reports.

**B — Blockchain surface (horizon — design seams, narrate, don't build):** tamper-evident hash of each
published index value (methodology §7) · provenance registry · tokenised RWA / carbon-biodiversity
credits · self-sovereign community data + yield. **Pitch as roadmap, never as shipped.**

---

## 6. The Hexagon question — must it be a radar?

**No — and the symmetric radar may be the *least precise* of the options.**

- **Its one irreplaceable strength:** the "balance / dent at a glance" gestalt. Methodology §2:
  *"the geometry is the argument."* Also — "**Hexagon**" is in the supervisor's book title, so it is
  his **brand identity**. → keep it, don't throw it away.
- **Its weaknesses:** radar is bad at precise comparison; currently plots counts; **treats all six
  pillars visually equal, which betrays the thesis** ("resilience = the weakest link"); shows no
  gap-to-target, no confidence, no trend, no cross-territory view.

**Alternatives, each matched to a job:**

| Form | Does better than the radar | More meaningful for |
|---|---|---|
| **Weakest-link ranked bars** (pillars ascending, weakest on top, gap-to-target) | foregrounds "weakest pillar decides resilience" | **more faithful to the thesis than a symmetric hexagon** |
| **6 pillar meters** (toward target 0→100, RAG + confidence dot + trend) | precise, drillable, shows gap/confidence/trend | the operational view |
| **Bullet bars** (current vs target line) | "how far from self-sufficient" | the sovereignty idea |
| **4 mini-hexagons side by side** | Brunei's dented food-corner vs peers | the cross-territory story |
| **Resilience gauge + weakest-pillar callout** | elevator "one number + who drags it" | Overview headline |
| **GDP vs Resilience juxtaposition** | stages "paper vs true wealth" directly | possibly the single most meaningful panel |
| **Strict-mode toggle** (geometric mean) | "no food = no resilience" mathematically | methodology §3, already designed |

**Recommendation:** demote the hexagon from *analytical workhorse* to *identity / thesis visual*.
Lead decisions with **weakest-link bars + pillar meters + GDP-vs-Resilience juxtaposition**; add
**small-multiples** for cross-territory. The hexagon stays (supervisor's brand), but the *meaning*
moves to the weakest-link view — because the symmetric shape actually dilutes the core argument.

---

## 7. Ordered execution plan

> Legend: 🧭 decision · 🔧 fix · 🆕 add · ✂️ remove/replace ｜ Size: S (hours) / M (~day) / L (multi-day)

### Phase 0 — Lock methodology decisions *(no code; this is the gate)*
| # | Decision | Recommended default | Type |
|---|---|---|---|
| 0.1 | Water/sanitation → **Shelter** or Healthcare? | Shelter (methodology intent); Life expectancy stays Healthcare | 🧭 |
| 0.2 | **Entertainment** indicator + target? (none today) | pick 1 proxy (e.g. per-capita facilities / connectivity) + target | 🧭 |
| 0.3 | Food target + which numbers (incl. **Brunei 8.4%**) | self-sufficiency / agri-land % | 🧭 |
| 0.4 | Per-capita denominator source | existing population data | 🧭 |
| 0.5 | Weighting (equal?) · aggregation (arithmetic headline + geometric strict?) · RAG (**70 vs 67**) | equal + both numbers + unify on 70 | 🧭 |
| 0.6 | Product direction: **demote hexagon, weakest-link becomes hero** | adopt | 🧭 |

### Phase 1 — Fix data truth (D底层, mostly no new data) · highest ROI
| # | Action | File | Type | Size |
|---|---|---|---|---|
| 1.1 | Re-tag water/sanitation → Shelter (Sabah/Sarawak go 1→2 pillars immediately) | indicators.json / compute | 🔧 | S |
| 1.2 | Add missing BOUNDS targets (Entertainment, Food, Shelter housing) | `compute_resilience.py` | 🆕 | S |
| 1.3 | Per-capita the absolute-count indicators | ingest / compute | 🆕 | M |
| 1.4 | Wire Brunei food 8.4% into Food | indicators.json | 🆕 | S |
| 1.5 | Re-run `compute_resilience.py` → approach real 6/6 | — | 🔧 | S |
| ⚠️ | Expected: **Brunei drops from 89 to its real score, the food axis collapses — this is success** | — | — | — |

### Phase 2 — Surface honesty (E, existing data) · cheapest credibility
| # | Action | Type | Size |
|---|---|---|---|
| 2.1 | Confidence badge + source + date on every score | 🆕 | M |
| 2.2 | Coverage label "6 − X scored" + gaps shown as gaps | 🆕 | S |
| 2.3 | Methodology page (formula already written) | 🆕 | M |
| 2.4 | Strict-mode (geometric mean) toggle | 🆕 | S |

### Phase 3 — Fix presentation + make the hero meaningful (depends on Phase 1)
| # | Action | File | Type | Size |
|---|---|---|---|---|
| 3.1 | Radar plots `pillarScores`, not counts | `src/data/useIndicators.js:419` | 🔧 | S |
| 3.2 | Demote hexagon to identity/thesis visual | Overview | ✂️ | S |
| 3.3 | Weakest-link ranked bars (new headline) | Overview | 🆕 | M |
| 3.4 | Pillar meters (target line + confidence + trend) | Regional_Detail | 🆕 | M |
| 3.5 | GDP vs Resilience juxtaposition | Overview | 🆕 | M |
| 3.6 | 4-territory small-multiples | — | 🆕 | M |

### Phase 4 — Build the differentiator (A · Impact Simulator) · can wait
- 4.1 🆕 Conversational What-If → deterministic sim → "illustrative" (L)
- 4.2 🆕 Scenario builder + weakest-pillar "what would move it" (L)
- 4.3 🆕 Forecasting / anomaly detection (M)

### Phase 5 — Make the index live (C · real-time + alerts + mobile) · later
- 5.1 🆕 Freshness badges (M) · 5.2 🆕 Fire/deforestation alert stream + push (L) · 5.3 🆕 Citizen reports (L)

### Phase 6 — Horizon (B) · narrate, don't build
- 6.1 🆕 Published-value hash + provenance registry concept (S, docs) · 6.2 🆕 Tokenisation/community-yield as roadmap only

---

## 8. Three buckets

| Bucket | What | Phases |
|---|---|---|
| ✅ **Do first (now)** | fix truth + surface honesty + fix presentation — small, cheap, ~80% of the credibility gain | **0 → 1 → 2 → 3** |
| ⏸️ **Hold (soon)** | the differentiator build, once the data is stable | **4 (A simulator)** + 3.6 |
| ⬇️ **Later** | architecture / backend / long-term, or narrate-only | **5 (C real-time/mobile) · 6 (B)** |

**Three "remove/replace" not to forget:** ✂️ kill the count-based radar (3.1) · ✂️ demote the hexagon
(3.2) · ✂️ replace "pretend-complete" with a coverage label (2.2).

---

## 9. Immediate next step

**Phase 0.** Lock decisions 0.1–0.6 (recommended defaults above are safe to adopt, then confirm with
the supervisor). The smallest closed loop that validates the whole path is **0.1 + 1.1 (re-tag
water → Shelter) + 1.5 (re-run)** — 0 new data, and Sabah/Sarawak jump from 1 scored pillar to 2.

---

## 10. Provenance

- Framework: `borneo-abcde-framework` skill · Koh How Tze / How Sze, *The ABCDE Framework in The True
  Wealth Hexagon*.
- Scoring facts verified in this session: `compute_resilience.py` (BOUNDS table, target-based method,
  absolute-count exclusion), `public/data/resilience.json` (1–3/6 pillars scored; Brunei 89.2 with Food
  excluded), `src/data/useIndicators.js:419` (`getHexagonCoverage` counts, not scores),
  `borneo_tracker_resilience_index_methodology.md` (target-based normalization, equal weight,
  weakest-pillar, geometric strict mode, confidence layer, decisions to confirm with supervisor).
- Business logic: `docs/BUSINESS_CASE_ABCDE.md` (EUDR, dMRV, ESG-data market).
