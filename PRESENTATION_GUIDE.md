# Borneo Tracker (T002) — Presentation Guide

> What to show and say. Focus = the **data layer** (Phase 3) you built, framed inside the
> project's vision. Suggested length: 12–15 slides, ~12–15 min + demo + Q&A.

---

## Slide-by-slide

### 1. Title
- **Borneo Tracker** — a public ESG / SDG / Resilience dashboard for Borneo Island.
- Team T002 · your role: **Data layer (sourcing + pipeline + database)**.
- One line: *"Turning real, scattered government data into one trustworthy picture of Borneo's wellbeing."*

### 2. The problem — why this is hard
- Borneo = **4 territories across 3 countries**: Sabah + Sarawak (Malaysia), Brunei, Kalimantan (Indonesia, 5 provinces).
- Each has a **different statistics agency, language, data format, and API** (or no API).
- Challenge: get **real, comparable, up-to-date** data for the same indicators across all four — without faking anything.

### 3. The vision (the supervisor's framework)
- Not measuring money ("paper wealth") but **True Wealth = resilience across 6 survival pillars**: Food · Energy · Education · Shelter · Healthcare · Entertainment.
- "**Resilience = the weakest link**" → the index surfaces the weakest pillar.
- Three lenses on the same data: **ESG · UN SDG · True Wealth Hexagon**.

### 4. System architecture
- Show the diagram: **7 APIs + 1 manual layer → standard table → SQLite → frontend reads**.
- Key rule: **API keys are backend-only**; the frontend never calls a source (security + CORS).
- Re-runnable, scheduled, **keep-last-good** (a source going down never wipes data).

### 5. Where the data comes from (8 sources)
- data.gov.my (Malaysia) · World Bank (Brunei) · UN SDG · BPS Indonesia · Global Forest Watch · NASA FIRMS · WAQI · + a **cited manual layer** for report-only figures.
- Mix of: keyless APIs, key+token APIs, satellite platforms, and official reports.

### 6. What we collected (the headline result)
- **145 data rows · 32 indicators · 4 territories · 3 frameworks.**
- Coverage: **Hexagon 6/6 pillars · ESG all 3 categories · SDG 11 goals**.
- Show the **canonical indicator table** (14 concepts × 4 territories) from the progress report.

### 7. Hard problems we solved (this is the impressive part)
- **BPS Indonesia**: bot-blocked, per-province variable IDs, silent data truncation → built a **verified variable-ID map** + retry logic.
- **Global Forest Watch**: behind a firewall (WAF) → custom request shape; pinned canopy threshold so numbers don't inflate.
- **Fire data**: NASA FIRMS kept going down → switched to **GFW VIIRS fire alerts** (works even when FIRMS is offline).
- **Kalimantan = 5 provinces** → rolled up into one figure (sum for counts, mean for rates) while keeping province detail.

### 8. Data integrity — the project's backbone
- **Rule: no fake data, ever** (this is a real-world public tool).
- Every value carries a **confidence flag**: `high` (exact API) · `medium` (national-inherited / province average) · `manual` (from a cited report).
- The **manual layer** records each report figure with its source, URL, page and date → fully auditable.
- Where data genuinely doesn't exist, we **leave it blank and document why** — we don't estimate.

### 9. Making it comparable (consistency)
- Problem: each agency publishes the same concept with a **different metric** (e.g. healthcare = hospital beds vs life expectancy).
- We standardised one **unified metric per concept** (e.g. life expectancy, mean years of schooling, GDP growth %) so territories are actually comparable.
- A `canonical` flag marks the unified metric; legacy values stay for reference.

### 10. Honest gaps (shows maturity)
- **Genuine gaps:** Brunei poverty (high-income, not published) · Sabah electrification % (never published).
- **Deferred (Phase 2):** river water quality (dropped — covered by clean-water access), flood risk, road length, food self-sufficiency — data is event-based / national-only / stale, not yet comparable.
- Message: *we know exactly what's missing and why — nothing is hidden.*

### 11. The dashboard (frontend)
- Show the UI: **Borneo map + layer controls**, **ESG scorecards**, **resilience trend line + Hexagon radar chart**.
- Be honest: **UI is built; connecting it to the live database is in progress** (currently sample values).

### 12. Live demo (see below) — the strongest moment

### 13. Status & next steps
- Done: data sourcing, pipeline, database, consistency, documentation.
- Next: **Resilience Index computation** (0–100 per pillar) · **wire real data into the dashboard** · **historical trends**.

### 14. Closing
- One line: *"A trustworthy data foundation for Borneo — real, cited, comparable, and honest about its limits."*

---

## Live demo — what to actually run (≈3 min)

1. **Run the pipeline:** `python run_pipeline.py` (or `python ingest_poc.py`) — show it pulling live from the 7 sources in real time.
2. **Show the database:** open `borneo_tracker.db`, or run `python poc_progress.py` to print the live coverage table (Green/Amber/Red).
3. **Open the dashboard:** `npm run dev` → show the map, ESG page, and the resilience trend + radar charts.
4. **Show the progress report** (`PROGRESS_REPORT.docx`) as the written deliverable.

*Tip:* if live internet is risky, take screenshots beforehand as backup.

---

## Numbers to memorise (so you can answer confidently)

- **4** territories · **8** data sources · **3** frameworks · **6** Hexagon pillars.
- **145** rows · **32** indicators · confidence **high 109 / medium 18 / manual 18**.
- SDG **11/17** goals (original scope was 6 — exceeded).
- **2** genuine data gaps (Brunei poverty, Sabah electrification %).

---

## Likely questions & answers

- **"Is the data real / can we trust it?"** → Yes — every value is from an official source, tagged with a confidence level; report figures are cited; gaps are left blank, never estimated.
- **"Why is Kalimantan one number when it's 5 provinces?"** → We aggregate (sum for counts, mean for rates) but keep each province too, and label the method.
- **"What about missing data (Brunei poverty etc.)?"** → Documented genuine gaps — the source country doesn't publish it. We show it as a gap, not a guess.
- **"Why these indicators?"** → They map to the 6 Hexagon survival pillars + ESG + SDG, chosen for having real comparable data across all 4 territories.
- **"How fresh is the data?"** → The pipeline re-pulls on a schedule; each row carries a `last_updated` date; keep-last-good protects against source outages.
- **"How is the resilience score calculated?"** → Each indicator is normalised 0–100 against a self-sufficiency target, averaged into 6 equal pillars, with the weakest pillar always surfaced (methodology documented).

---

## What to emphasise (your strongest selling points)

1. **Integrity** — the "no fake data + confidence layer" story is unique and mature.
2. **Real engineering** — you beat real obstacles (bot-blocks, firewalls, outages, truncation).
3. **Comparability** — unifying 4 different statistics systems onto one metric set is the hard, valuable work.
4. **Honesty about limits** — documented gaps signal rigour, not weakness.

---

## ⚡ UPDATE 2026-07-06 — the demo got much stronger

Slides 11/13 above are now OUTDATED in your favour. As of commit `9c30add`:

- **The dashboard runs on 100% real data** — zero mock values (slide 11's "sample values" caveat is gone; say the opposite: *"every number on screen is live from the pipeline"*).
- **Real historical trends** — Regional Detail has a working **Trend** tab: e.g. Sarawak annual tree-cover loss **2001–2024** (24 real satellite-derived points), fire alerts since 2012. Indicators without real history show a greyed-out button — the integrity story in action.
- **Resilience Index is computed and on screen** — Brunei 81.2 🟢 · Kalimantan 69.2 🟢 · Sarawak 58.6 🟡 · Sabah 56.9 🟡, each with its weakest pillar (Education) and a visible "scored X/6 pillars" honesty label.
- **SDG page is live** (`/sdg`, the 6 client-required goals).
- **The data refreshes itself** — GitHub Actions runs the pipeline daily at 05:00 MYT and commits changes. Answer to the client's *"like real-time plane tracking?"* question: **yes — fire and air quality are near-real-time; annual indicators update the moment their source publishes, automatically.**

### Updated 3-minute demo route
1. `/` — map, switch layers, point at "Data as of <today> · refreshed daily" in the corner.
2. `/regions` → Sarawak → **Resilience Index chip** (58.6, weakest: Education) → pick *Tree cover loss* → click **Trend** → the 24-year deforestation curve. This is the money shot.
3. `/regions` → pick *Air quality* → Trend is greyed out ("no free historical source") — 10 seconds on why honesty is a feature.
4. `/sdg` — flip through two goals with confidence tags.
5. (Optional) show the GitHub Actions run log — "no human touched this data today."

### New numbers to memorise
- **256** historical observations · **16** trend series · tree-cover loss **2001–2024** · fire alerts since **2012**.
- Resilience: **Brunei 81.2 / Kalimantan 69.2 / Sarawak 58.6 / Sabah 56.9** — weakest pillar everywhere: **Education**.
- Pipeline: **5 steps**, daily at **05:00 MYT**, data.gov.my throttled to its official **4 req/min**.
</content>
