---
name: borneo-abcde-framework
description: >
  THE primary thinking lens for ALL Borneo Tracker work. The product exists to
  operationalise the supervisor's own ABCDE Framework (AI, Blockchain, Connectivity,
  Data, Ethics) and True Wealth Hexagon (Food, Energy, Education, Shelter, Healthcare,
  Entertainment), measured by a Resilience Index, staged in Borneo. Read this BEFORE
  any non-trivial work — feature, data, copy, IA, roadmap, pitch, business case — and
  think ABCDE-first: name the letter(s) and the pillar a change serves, and who pays.
  Holds the current build maturity scorecard and the business logic (EUDR, dMRV / carbon
  & biodiversity credits, the ESG-data market). Pairs with the `borneo-tracker-data`
  skill (the operational data reference). Source: Koh How Tze / How Sze (the supervisor),
  "The ABCDE Framework in The True Wealth Hexagon" + bsyssolution.com.
---

# Borneo Tracker — the ABCDE Framework (primary thinking lens)

> **Who set this:** the project supervisor **Mr. Koh How Sze** is — to near-certainty —
> the ABCDE author **Koh How Tze** (same name, romanisation variant; the brief says "his
> ABCDE Framework"). So the framework is not optional flavour; it is the client's own
> thesis and the grading rubric. The instruction is *"free to build, but grounded in his
> requirements AND his ABCDE Framework."* Treat ABCDE as the spine of every decision.

## 0. How to think here (do this every time)

For any change, ask in order:
1. **Which ABCDE letter(s)** does it advance? (A/B/C/D/E — see §2)
2. **Which Hexagon pillar(s)** of True Wealth does it strengthen or measure?
3. **Who pays / who is it for?** (regulator-driven buyer, credit market, investor, gov,
   NGO, community — see §5). If a change serves no letter, no pillar, and no payer, question it.
4. **Does it keep the E-moat?** (provenance, confidence, never-imputed). Honesty is the product.

If a task is framed only as "an ESG/SDG dashboard feature," re-frame it: ESG and SDG are
*reporting lenses* on the True-Wealth measurement — never the hero.

## 1. The thesis

Borneo Tracker shifts value from the **mirage of "paper wealth"** (fiat, stock balances —
abstract, volatile) to the **physical reality of "True Wealth"** — the thermodynamic
essentials that keep people alive. **GDP is rejected as the yardstick; the strength of the
True Wealth Hexagon is the yardstick.** (The resilience demo already shows the punchline:
Brunei is money-rich but ~8.4% food-self-sufficient — *fragile* true wealth.)

## 2. The two lattices × one index × one place

**ABCDE = the technology stack (the *how*).** Note: this is *also* the standard architecture
of the nature-tech / digital-MRV industry — so applying ABCDE and building a real business are
the same act (see §5).

| | Pillar | Role | Nature-tech / dMRV equivalent |
|---|---|---|---|
| **A** | Artificial Intelligence | manual → autonomous; predict, draft, optimise | AI extraction, forecasting, plot aggregation |
| **B** | Blockchain | trust without institutions; **tokenise Real-World Assets**; self-sovereign data | immutable registry, tokenised credits, DDS |
| **C** | Connectivity | the "nervous system"; live IoT/satellite; kill system-blindness | sensor + satellite feeds (frequency = value) |
| **D** | Data | descriptive→prescriptive; **data stays with & yields to the community** | the measured dataset itself |
| **E** | Ethics | governance/provenance **written into the code**; never bolted on | verification, provenance, audit trail |

**True Wealth Hexagon = six survival pillars (the *what*):**
`Food · Energy · Education · Shelter · Healthcare · Entertainment` — each a *system to keep
strong*, not a commodity to extract.

**Resilience Index = the single 0–100 measure** that replaces GDP. Methodology (per the
supervisor's book): target-based normalisation, equal-weight hexagon, weakest-pillar
surfaced, RAG bands, **data-confidence as an explicit input (that's the E)**.

**Borneo = the testbed.** Thermodynamic reality (water, biomass, intact ecology, solar) +
tri-sovereign structure (Sabah, Sarawak = MY · Brunei · Kalimantan = 5 IDN provinces) = a
greenfield for new governance/finance models ("civilisational leapfrogging").

**The value chain (= the business logic):** `measure (D/A) → make it trustworthy without
institutions (E→B) → price/tokenise the real assets behind it (B) → yield back to the
community (B/D)`. **Whoever owns the trusted measure owns the basis for valuing the wealth.**
Borneo Tracker sits at the measure (D+E). That is the seat at the table; A/C/B are the road.

## 3. Current build maturity (as of 2026-07-10 — keep this honest & updated)

Scorecard by ABCDE letter. Update the %s as the build moves.

| Letter | Maturity | What exists / what's missing |
|---|---|---|
| **D** Data | 🟢 **~75%** | Real pipeline ~80% auto (data.gov.my, World Bank, BPS, GFW, FIRMS, WAQI); 4 territories + ADM2 district drill-down; `resilience.json` (3/6 pillars *scored*, all 6 *buildable* per data skill); trends (27 series); manual intake being de-manualised (UNESCO, GDL done; FAOSTAT pending). |
| **E** Ethics | 🟡 **~45%** | Provenance is designed in: `data_level` + `confidence` tags, "never imputed", methodology aligned to the book. But under-surfaced in UI; no explicit audit/governance view. **This is the moat — invest here.** |
| **C** Connectivity | 🟠 **~20%** | Some live (AQI live, GFW/FIRMS satellite) but mostly scheduled snapshots; no IoT; no real-time. |
| **A** AI | 🟠 **~10% (designed)** | **Development Impact Simulator** (the signature differentiator — conversational What-If, GPT function-calling, deterministic simulator, honest "illustrative") designed, not built. AI data-intake (AR modules) designed. |
| **B** Blockchain | 🔴 **0%** | Nothing yet. The whole self-sovereign / tokenisation / community-yield story is unstarted — narrate as *horizon*, never claim as built. |

**Required features (supervisor's brief):** Borneo map ✅ · ESG indicators ✅ · SDG progress
✅ · RAG dashboard ✅ · open data 🟡 · admin back-office 🟠 (figma branch) · mobile app
(alerts + citizen reports) 🔴 · **Development Impact Simulator 🟠 (the differentiator)**.

**Honest posture:** ship D and E *fully and honestly*; show A/C/B as an explicit roadmap.
Faking B (blockchain/self-sovereign) in a read-only dashboard is a credibility trap in front
of an academic/author supervisor.

## 4. How the model is wired in the repo

- **Resilience Index** — `public/data/resilience.json` + `useResilience()`; RAG gauge on Overview.
- **True Wealth Hexagon** — every indicator row tagged `hexagon_pillar`; `getHexagonCoverage()` +
  `HexRadar` "Pillar Coverage" card. (Known gap: radar plots *coverage counts*, not the real
  `pillarScores` — fix it to plot scores.)
- **Cross-taxonomy asset** — each indicator carries `esg_pillar` + `sdg_goal` + `hexagon_pillar`
  at once — the *same data, three lenses* (True Wealth hero, ESG/SDG as toggles).
- **Design prototypes** — `docs/design/borneo-tracker-dashboard.html` (functional, 3-lens),
  `docs/design/borneo-vision.html` (narrative landing).

## 5. Business logic — who pays, and why ABCDE wins (full case: `docs/BUSINESS_CASE_ABCDE.md`)

The Borneo natural-capital dataset sits at the crossing of three converging, high-value,
time-sensitive markets — and ABCDE is the winning architecture for all three:

1. **EUDR compliance (regulatory, hard deadline 30 Dec 2026).** Palm oil, timber, rubber,
   cocoa sold into/exported from the EU must be proven **deforestation-free with plot-level
   geolocation + legality**, filed as Due Diligence Statements. Borneo (esp. Kalimantan) is a
   hotspot; smallholder aggregation is the unsolved problem. → Borneo Tracker's deforestation/
   forest-cover data is a direct input. **Mandatory demand, dated.**
2. **Carbon & biodiversity credits / dMRV.** SEA (Indonesia-led) is the world's largest supply;
   dMRV = satellite+AI+IoT+blockchain = **literally ABCDE**; cuts MRV cost 50–70%, enables
   frequent, tamper-proof issuance and tokenised (RWA) credits.
3. **ESG / natural-capital intelligence (~$5B market).** Buyers: investors, banks, insurers,
   governments. Research is unanimous: **data quality / provenance / reproducible methodology /
   transparent scoring is the #1 moat.** That is exactly Borneo Tracker's E.

**Who pays:** commodity traders + their EU buyers (EUDR); carbon/biodiversity developers &
credit buyers; ESG investors/insurers; the four governments (planning & approvals via the Impact
Simulator; SDG reporting); NGOs/researchers; and — the self-sovereign endgame — communities
earning yield on their own data. **Models:** API/subscription tiers, analytics modules,
white-label, usage-based; endgame = registry/transaction fees on tokenised credits.

**Patterns the dataset is uniquely able to surface** (investigation angles): deforestation
hotspots vs concession boundaries (EUDR risk); cross-border leakage between the 4 jurisdictions
(only a unified Borneo layer sees this); resilience decline vs development pressure (the Impact
Simulator); pillar fragility (Brunei paper-rich / food-fragile).

## 6. Decision heuristics (per feature)

1. Name the **ABCDE letter** + **Hexagon pillar** + **payer**. 2. Lead with True Wealth; ESG/SDG
are toggles on the same data. 3. **Score, don't just count.** 4. **Never impute; show provenance**
(the E-moat). 5. Design for the *living* index (C), not a snapshot. 6. Leave seams for B
(self-sovereign / RWA) without hard-wiring central ownership. 7. Borneo-first, tri-sovereign.
8. Every pillar is a *system*, not a commodity.

## 7. Sources & provenance caveat

- Supervisor **Koh How Sze** — author **Koh How Tze**, BSYS Solution — *"The ABCDE Framework in
  The True Wealth Hexagon"* (Amazon `B0H4M9QCGB`); bsyssolution.com ("The Borneo Thesis", the
  ABCDE article, "About Us").
- Market facts (§5) from: EU EUDR (green-forum.ec.europa.eu, WRI); nature-tech dMRV
  (naturetechcollective.org, Chainlink, RMI); ESG-data monetisation (Datarade, IBM).
- ⚠️ Book full text not machine-readable when written (Amazon 500s); framework reconstructed
  from the author's own articles. Reconcile against the ebook if it becomes available.
