# Demo runsheet — what changed after the client review

**For:** supervisor demo · **Date:** 2026-08-27 · **All changes are merged to `master`.**

This follows HT's own numbering from his 15 August message, so he can be shown each point against his own words. Each entry gives what he asked for, the tickets it became, what changed, and the exact click path.

**Seven of the ten points can be demonstrated without leaving the Dashboard (`/`).** Start there and stay there.

| | |
|---|---|
| Points he raised | 10 |
| Tickets opened | 37 |
| Frontend tests | 941 → **1,066** |
| Data-pipeline tests | 130 → **134** |

---

## §1.1 — Tell a first-time visitor what this is

> Add a small "What is Borneo Tracker?" or "How It Works" entry in the top header … a compact descriptor beneath or beside the logo.

**Tickets:** BT-01, BT-02, BT-03

**What changed.** A **How It Works** link in the top bar, and the descriptor **"Borneo Sustainability & Resilience Intelligence"** beside the logo — his exact suggested wording. The link lands on a real How It Works section written for the About page.

**Show it**
- Top bar of any page → **How It Works**
- Click it → lands at `/about#how-it-works`

---

## §1.2 — Why are these two scores different?

> Showing both Resilience Index 74.3 and Strict (True Resilience) 71.7 … unexplained secondary metrics can create confusion rather than credibility.

**Tickets:** BT-04

**What changed.** An explainer opens beside the Strict score, under **his own heading** — "Why are these scores different?" It explains that the Index is the mean of the six pillar scores, Strict is a geometric mean that penalises one weak pillar far more heavily, and the gap between them measures how lopsided a territory is.

Worth mentioning: he suggested a tooltip; we made it **click to open**, because a hover-only tooltip is unreachable on a phone and invisible to anyone using a keyboard.

**Show it**
- Dashboard `/` → right panel → the **?** beside "Strict (True Resilience)"
- Pick **Brunei** from the dropdown first — it has the widest gap, so the explanation lands hardest

---

## §2 — Group the sidebar into three

> EXPLORE — Dashboard · Regional Details · ESG · SDG. ANALYSE — Impact Simulator · News & Insights · Community. ACT — Generate Report · Data Sources · About.

**Tickets:** BT-05

**What changed.** Implemented **exactly as he listed it** — same three groups, same pages, same order — plus screen-reader grouping so the headings are announced, not just drawn.

**Show it**
- Left sidebar → the three headings **EXPLORE / ANALYSE / ACT**

---

## §3.1 — One line that says what is happening

> "Borneo's current resilience score is 74.3 — Good, but Food remains the weakest pillar." This converts several charts into one immediately understandable insight.

**Tickets:** BT-07

**What changed.** A headline sentence generated **deterministically from the data** — no AI and no per-view cost, and it cannot drift from the numbers it describes. It regenerates whenever the data does.

**Show it**
- Dashboard `/` → right panel → the **What** line of the answer strip

---

## §3.2 — Let me just ask a question

> "Compare Sabah and Sarawak" · "Show districts with low food resilience" · "Find highest-risk regions"

**Tickets:** BT-14, BT-33

**What changed.** Search no longer dead-ends. A query that isn't a place hands off to **BorneoBot** with the question already filled in, so the answer comes from the assistant grounded in the same data the dashboard shows.

BT-33 turned the suggested prompts into a versioned contract: a prompt is displayed only when its exact wording has an evidence-backed answer path, and every client example is recorded in the code with its status.

**Show it**
- Dashboard `/` → search box → type `compare` → **"Ask BorneoBot instead"** appears
- Click it → the chat opens with the question pre-filled

---

## §3.3 — Make the map mean something

> The user should be able to answer "Where is the problem?" simply by switching layers.

**Tickets:** BT-08, BT-09, BT-10, BT-11a, BT-30

**What changed.** Twelve map layers, grouped into **Scores / Environment / Society**, and the selected layer now states the question it answers together with which direction is the bad one.

Two guards were added so the colouring can't claim more than the data supports:

- **Different units are never ranked.** Forest Cover was comparing Brunei's *72.1 % of land* against Kalimantan's *49.9 million hectares* on one colour ramp — so the most forested territory in Borneo painted red, worst. Any layer whose territories report in different units now refuses to shade, and names the units instead.
- **Absolute totals say so.** Kalimantan leads deforestation and fire alerts because it is by far the largest territory. Per unit of its own baseline forest, its loss rate is actually the *lowest* of the three that publish one. Those layers now carry a note so the ramp reads as "where the most of this occurs", not as a performance ranking.

**Show it**
- Dashboard `/` → right panel → **Map Layer** card
- Pick **Deforestation** → "Where is tree-cover loss highest? (lower is better)" plus the absolute-total note
- Pick **Forest Cover** → not shaded, with the mismatched units named

---

## §3.4 — Clickable pillars, and say why it matters

> Make each pillar clickable so users can drill into the underlying indicators. Add a short explanation: "Resilience is only as strong as its weakest essential pillar."

**Tickets:** BT-12, BT-13, BT-31, BT-34, BT-35

**What changed.** His sentence now appears **verbatim** beneath the radar. He flagged it as the methodology's differentiating idea, and he was right that our own paraphrase described the chart rather than stating the principle.

Pillars are clickable in all three scopes:

- **Overall Borneo** — the drill-down lists all four territories' indicators and states the arithmetic, so the average is accountable rather than just asserted.
- **A single territory** — its own scored indicators with value, year, source and confidence.
- **A district** — the indicators that exist at that level, shown without a score, because two of six pillars is not an index and we will not compute one from it.

**Show it**
- Dashboard `/` → hexagon radar → click **Shelter**
- Default view lists four territories, then *"All-Borneo 73.6 is the mean of the 4 scored territories: Sabah 61.0 · Sarawak 67.4 · Brunei 100.0 · Kalimantan 66.0."*
- Switch the dropdown to **Sabah** → click again → that territory's own indicators
- Switch **Region → District**, pick a **Kalimantan** district (e.g. Sambas, Samarinda) → two indicators, explicitly no score

> **Before the demo:** hard-refresh the browser (Ctrl+Shift+R) so it loads the current build.
> Pick a **Kalimantan** district for the district step — Sabah and Sarawak districts correctly show "no comparable data", because district-level pillar figures are only published on the Indonesian side.

---

## §4.1 — Where does this data actually come from?

> Transform a simple timestamp into a powerful data-trust mechanism. Last updated → Data sources → Update frequency → Data coverage.

**Tickets:** BT-15, BT-16a, BT-16b, BT-20

**What changed.** The date chip opens a popover carrying **exactly his four steps**. Separately, `/data-sources` gained a Sources section listing all 16 publishers with licence, cadence, coverage and official link.

It is kept visually and conceptually apart from the existing hash ledger on the same page, because the two answer different questions: the ledger answers *"has this file been altered since publication?"*, the Sources section answers *"who produced this number, under what licence, and how often do they update it?"*

**Show it**
- Dashboard `/` → click the **"Data as of …"** chip
- Sidebar → **Data Sources** → scroll to the Sources section

---

## §4.2 — Is it getting better or worse?

> 74.3 — GOOD · ↑ +2.1 from previous period. Then show the biggest positive and negative changes.

**Tickets:** BT-17, BT-18, BT-19, BT-32

**What changed.** The interpretation band sits beside the score, followed by a movement reading with a sparkline, then the biggest movers — in the order he wrote them.

Two rules govern this, because it is the number most easily misread:

- **We never compare across a change in method.** Where the published number moved because the calculation changed rather than because Borneo changed, no delta is shown at all.
- **A flat period is stated in words.** Upstream statistics are annual or quarterly while the pipeline republishes daily, so most days genuinely have not moved. The panel says *"No change since 17 Aug 2026"* rather than a meaningless `+0.0`.

**Show it**
- Dashboard `/` → right panel → score card, below the big number
- Pick a single territory to see its own movement reading and sparkline

---

## §5 — From presenting information to enabling decisions

> Make every major section answer one of four questions: What is happening? → Where is it happening? → Why does it matter? → What should we do next?
>
> *Measure Borneo. Understand Borneo. Strengthen Borneo.*

**Tickets:** BT-21, BT-22, BT-23, BT-24

**What changed.** One compact **answer strip** — what, where, why, what next — deliberately one strip rather than four cards. "What next" links straight into the Impact Simulator, pre-set to the relevant territory and pillar.

It runs on the Dashboard, Regional Details, ESG Indicators and SDG Progress. Where a scope cannot answer one of the four from its data, that line is left out rather than filled with a plausible sentence.

His positioning line appears on the About page hero and above the sign-in panel.

**Show it**
- Dashboard `/` → right panel → the four-row strip
- Click **What next** → lands in `/simulator` with the territory and pillar already selected
- The same strip on `/esg` and `/sdg`

---

## Groundwork that made the rest possible

Not requested, but worth one slide — these are why the visible changes can be trusted.

- **BT-29** — both test suites now run in CI on every change. Before this, a change touching only the frontend triggered no checks at all.
- **BT-28** — a release-sequencing contract for published data, so code and regenerated datasets ship in the right order and every published version keeps its cryptographic proof intact.
- **BT-11b** — a release gate: if a pillar that was previously scored disappears during a future data refresh, publication fails rather than quietly shipping a partial score.
- **BT-25** — a bilingual copy check that understands each language's plural rules, so new wording cannot silently go missing in one of them.
- **BT-26** — unit tests for all of the new logic above.

---

## If asked how we know it works

Both suites run in CI on every change.

| Suite | Before | Now |
|---|---|---|
| Frontend tests | 941 | **1,066** |
| Frontend test files | 56 | **65** |
| Data-pipeline tests | 130 | **134** |
