# What we changed in response to your 15 August review

**Delivery:** Wave 3 (momentum, drill-down, decision framing) · **Date:** 2026-08-25
**Status: internal draft — the product/client owner must approve the wording and the audience before this is sent.**

This note maps our work back to your own numbering. We also re-read your review line by line against the running product and found four places where we had answered the spirit of a point but not the point itself; those are fixed and marked below. Wave 1 (corrections and navigation) and Wave 2 (the map and insight layer) were reported separately; the full card list and its reasoning live in `docs/CLIENT_FEEDBACK_2026-08-15_ACTION_PLAN.md`.

---

## §1.2 — "Why are these scores different?"

Both the Resilience Index and the Strict (True Resilience) score appear together on the Dashboard. Until now the explanation of why they differ was only reachable from the Regional Details page — so on the screen where you actually saw `74.3` and `71.7`, the second number sat there unexplained. That is exactly the confusion risk you named, and it is now fixed: the explanation opens from beside the Strict score itself, under your own heading, *"Why are these scores different?"*

It says, in short: the **Index** is the average of the six pillar scores; the **Strict** score is a geometric mean, which penalises a single weak pillar far more heavily; and the **gap** between them measures how lopsided a territory is. A wide gap — Brunei's is the widest — means one essential is dragging the whole picture down.

One deliberate departure from your wording: you suggested a tooltip. We made it open on click rather than on hover, because a hover-only tooltip is unreachable on a phone and invisible to anyone navigating by keyboard. The same pattern is already used by the data-freshness chip elsewhere on the page.

## §3.2 — "I should be able to just ask a question"

Search on the Dashboard no longer dead-ends in the Wave 3 repository: a query that is not a place is handed to **BorneoBot** with the question pre-filled. This is not yet a production-complete claim: the frontend-to-Edge-Function deployment wiring and browser smoke evidence are tracked separately.

Of the three examples in §3.2, only **“Compare Sabah and Sarawak”** is currently enabled because it has a committed, deterministic answer path. **“Show districts with low food resilience”** remains parked until comparable district Food data and an approved scoring rule exist. **“Find highest-risk regions”** remains parked until the supervisor approves what “risk” means. The other two visible prompts are Borneo Tracker release-safe wording, not client examples.

**Limitation we want to be explicit about:** BorneoBot runs on a shared daily quota. When that quota is exhausted the interface says so and falls back to a static six-pillar guide — it does not silently fail or invent an answer. A full natural-language query engine (per-query intent routing into dashboard state) needs a token budget we have not committed, and remains parked.

## §3.4 — "The hexagon should be clickable, and it should tell me why"

Each pillar on the True Wealth Hexagon radar is now clickable — by mouse and by keyboard — and opens the exact indicators behind that pillar: value, year, source and confidence tag.

Where a territory has no comparable data for a pillar, the drill-down says so. It does **not** show a zero. A missing measurement and a bad measurement are different facts and the interface now keeps them different.

Your sentence — **"Resilience is only as strong as its weakest essential pillar."** — now appears verbatim beneath the radar, above the weakest-first pillar list. We had previously written our own description of what the chart shows, which is not the same thing: yours states the *principle*, and you were right that the principle is the differentiating idea. It is the claim the whole scoring method rests on, so it belongs on screen in those words.

**Known limitation:** on the all-Borneo view a pillar drill-down opens to say that an aggregate has no single indicator list, and points you to pick a territory. That is honest — the aggregate genuinely has no one set of source rows — but it means the drill-down only becomes useful once a territory is selected. Tell us if you would rather it showed the four territories side by side.

## §3.3 — "Where is the problem?" by switching layers

The map carries twelve layers: overall Resilience, each of the six True Wealth pillars, and Deforestation, Forest Cover, Air Quality, Fire Hotspots and Poverty. Six of the eight you listed are there.

They were presented as one undivided list of twelve, with nothing to say what any of them measured. They are now grouped — **Scores**, **Environment**, **Society** — and the selected layer states the question it answers together with which direction is the bad one. Selecting Deforestation now reads *"Where is tree-cover loss highest? (lower is better)"*.

**The two we did not add: ESG and SDG.** Not for cost reasons. No ESG or SDG composite score exists in a defensible form — the ESG panel reports the *number* of indicators available, not a weighted index. Colouring a map by a number nobody can explain is precisely the unexplained metric your review warns against in §1.2. This needs an agreed, ideally supervisor-approved, weighting method before any code.

## §4.1 — "Where does this data actually come from?"

`/data-sources` gains a **Sources** section listing every authoritative publisher we use: the organisation, the licence, the official URL, how often they publish, which territories and which pillars they feed.

We kept it separate from the existing hash ledger on the same page, because the two answer different questions. The ledger answers *"has the published file been altered?"*. The Sources section answers *"who produced this number, under what licence, and how often do they update it?"* Neither substitutes for the other.

## §4.2 — "Is it getting better or worse?"

The Dashboard now shows **momentum**: how the Resilience Index has moved since the previous publication, with a small sparkline of the comparable period. For the all-Borneo view it names the territories that actually moved.

Three deliberate decisions here, because this is the number most easily misread:

1. **We do not compare across a change in method.** On 17 August we corrected a data-processing defect (see below). The published number moved, but Borneo did not. Points recorded under a different method are kept for traceability and are explicitly excluded from any comparison; the first reading after such a change says "first reading on the current method" and shows no delta at all.
2. **A flat period is stated in words.** Most of the underlying statistics are published annually or quarterly while our pipeline republishes daily, so on most days nothing has genuinely changed. You will see *"No change since 17 Aug 2026"* rather than a meaningless `+0.0`.
3. **History starts where our record starts.** The series is rebuilt from our own published snapshots. We did not back-cast estimates for dates before we were publishing.

Two corrections we made after re-reading your wording:

- You asked for the biggest positive **and** negative changes. Our first version ranked territories purely by the size of their move and showed the top three — which, when three territories rise and one falls, silently dropped the only decline and left a page of green. It now always reserves a place for the largest rise and the largest fall.
- The delta and the movers list had been built as alternatives: the all-Borneo view got one, a single territory the other, so your three-line sequence never appeared together. They now appear in the order you wrote them, on the same screen.

On the all-Borneo view you will see a direction summary — how many territories rose, fell or held steady — rather than a single Borneo-wide `+2.1`. That is a deliberate limit, not an omission: the all-Borneo score is the average of cross-territory pillar averages, not the average of the four territory scores, so a Borneo-wide period-over-period figure cannot be recovered from the per-territory history without inventing it.

## §5 — "So what do I do about it?"

Every main analysis page now carries one compact **answer strip** that reads as four questions rather than four disconnected cards:

- **What** — the current score and its interpretation band.
- **Where** — the weakest scored territory (all-Borneo view) or the weakest scored pillar (single territory).
- **Why** — the real-world consequence of that specific pillar being the weak one.
- **What next** — a direct link into the Impact Simulator, pre-set to that territory and that pillar.

It is on the Dashboard, Regional Details, ESG Indicators and SDG Progress. If a scope does not have the data to answer one of the four, that line is left out rather than filled with a plausible sentence.

## Positioning

The platform now states its purpose in one line — **"Measure Borneo. Understand Borneo. Strengthen Borneo."** — on the About page and above the sign-in panel.

---

## The score correction of 17 August

You will see this in the momentum panel, so it should be stated plainly.

On 17 August 2026 we corrected a data-processing issue that had excluded an existing Education observation for Sabah and Sarawak, which had inflated the average by dropping a weak pillar. After the fix both territories are back on a full six-pillar calculation. Current published scores: **Sabah 67.6 (amber) · Sarawak 73.6 (green) · Brunei 78.0 (green) · Kalimantan 67.7 (amber)**.

**This was a correction to calculation completeness, not a deterioration on the ground.** The restored values are real source observations (Global Data Lab, mean years of schooling, 2023), not estimates. We have since added a release gate: if a pillar that was previously scored disappears during a future refresh, publication fails rather than quietly shipping a partial score.

---

## What we deliberately did not do

- **We did not add an AI-written daily narrative.** The headline sentence on the Dashboard is generated deterministically from the data. It cannot drift from the numbers it describes, and it costs nothing per view.
- **We did not paint the map with an ESG or SDG composite score.** No such score exists in a defensible form — the ESG panel reports indicator *counts*, not a weighted index. Inventing a weighting would be exactly the kind of unexplained metric your review warned against. This needs an agreed methodology first.
- **We did not add the new data files to the integrity manifest.** The manifest hashes six datasets and every already-published copy of the site verifies against exactly those six. The source registry and the history series are therefore published as auxiliary files. Adding a seventh would make every existing client report a tamper warning for a change that is not tampering.

---

## Verification

For this delivery: 63 frontend test files (1,012 tests) and 130 Python tests pass, the production build is clean, and both suites run in CI on every pull request. The source registry and history series appear on the live site after the next scheduled data refresh publishes and stamps them.
