# Client Feedback → Action Plan (Trello-ready) — v2

**Source:** client review by ~HT, 2026-08-15 (dashboard walkthrough comment).
**Verified against:** `master` @ `e44e3fb` (2026-08-16). v1 of this plan was scoped against the older `feature/blockchain-anchoring` tree — that branch is now **fully merged into master**, and master is ~28 commits further on, so several v1 facts were stale. Every claim below has been re-checked against master by an 11-agent verification pass plus independent re-derivation of the numbers.

**Totals: 33 build cards + 3 KIV cards = 36 cards** (v1 said 27 + 3 = 30).

Each **bold title** is the Trello card name; the block under it is the card description.

---

## 0. What changed since v1 — read before assigning

### 0.1 v1 claims that were WRONG (do not act on them)

| v1 said | Truth on master | Consequence |
|---|---|---|
| "Data is 7 days old (`generatedAt: 2026-08-09`)" | `resilience.json` reads **2026-08-15** | Concern withdrawn — but see 0.2, the timestamp is a *build* clock, not a data clock |
| "en.json ~469 keys, ms.json ~462 — already drifting; close the 7-key gap" | **498 / 491** leaves. All 7 EN-only keys are i18next `_one` plural variants. `Intl.PluralRules('ms')` returns `["other"]` only — Malay **must not** have them | There is no translation debt. A naive key-parity test would **fail on correct data**. BT-25 rewritten |
| "954 districts" | **987 rows / 136 (parent,key) pairs / 131 selectable districts**, against only **111 polygons** | 28 selectable districts have no polygon at all |
| BT-11 fix lives in `ingest_poc.py` / `load_db.py` / `compute_resilience.py` | None of those set `canonical`. `data_model.py:426-432 assign_canonical()` does | The fix is ~2 lines in `data_model.py`, not a data-sourcing exercise |
| BT-12 gets its data from `getRowsForPillar()` | That filters `row.esg_pillar` (E/S/G), not `hexagon_pillar` | Re-pointed at `resilience.json` → `territories[X].detail` |
| BT-06: "sidebar collapses to a 72px icon rail" | `layout_new.jsx:18` sets width **0**; the 72 in `sidebar.jsx:83` is dead code | No collapsed-mode design work exists. BT-06 merged into BT-05 |
| BT-20 targets per-source rows on `/data-sources` | That page is a **cryptographic ledger** over the 6 hashed files; it has no per-source entity | Re-pointed at a new Sources section fed by BT-16b |
| BT-14 "no new API budget" | True only narrowly — it consumes the shared daily quota in `supabase/functions/ai-chat` (`AI_CHAT_QUOTA_EXHAUSTED`, 429) | State honestly given the client's KIV rule |

### 0.2 ⚠️ The single most important finding: the 74.3 the client praised is inflated by a bug

Sabah and Sarawak lost their Education pillar on **2026-08-02** (commit `506aeef`). Dropping a territory's *worst* pillar **raises** its arithmetic mean, so the loss made the dashboard look better and flipped Sabah amber → green.

I re-derived the post-fix numbers directly from `resilience_model.json` bounds (RLS: worst 6, best 12 → 8.7 yrs = **45.0**):

| | today (client saw this) | after the BT-11a fix |
|---|---|---|
| **All-Borneo index** | **74.3** (green) | **71.7** |
| **All-Borneo strict** | **71.7** (green) | **69.3 → amber** (threshold 70) |
| Sabah | 72.1 / strict 66.1 / **green** | 67.6 / 62.0 / **amber** |
| Sarawak | 79.3, weakest **Food** | 73.6, weakest flips to **Education** |
| All-Borneo Education avg | 70.8 (from only 2 of 4 territories) | 57.9 (all 4) |

**Three consequences for planning:**
1. Fixing the bug **lowers the headline score** and downgrades Sabah's band. That is a *correction*, not a decline — but it must be explained the day it ships. That is BT-32, and it belongs in Wave 1 next to the fix.
2. Post-fix index (71.7) equals today's strict value (71.7). Any copy or screenshot written now will be ambiguous later — date every number.
3. BT-07 (headline) and BT-17 (band word) put these exact numbers on screen. Do not ship them before BT-11a, or we hard-code a wrong story.

### 0.3 ⚠️ Anchoring machinery taxes every `public/data` change (v1 missed this entirely)

Master gates production on Bitcoin/Sigstore proof verification. `manifest_contract.py:13-17` is a **hard-coded 6-path tuple**, never globbed, and `deployment-pr-validation.yml` runs `validate_data.py`, `verify_manifest.py`, `verify_proof_contract.py` and `verify_anchor.py` on any PR touching `public/data/**`. There is **no green single-PR ordering** for a data change:

- regenerate data, leave manifest → `sha256 mismatch`
- regenerate manifest too → `verify_proof_contract.py` dies on the missing `versions/<newsha>/`, and `verify_anchor.py` exits 3 (`--allow-pending` does not rescue it)
- declare a new path in `manifest_contract.py` without the file → "manifest files must contain exactly the six Phase-1 datasets"

The anchor can only be minted by `anchor.yml` **running on master after merge**. So the correct sequence is: merge *pipeline code only* → let `refresh-data.yml` (cron `0 21 * * *`) regenerate and push data to master → let `anchor.yml` stamp it. **This affects BT-11a, BT-16a and BT-18.** It is now its own P0 card, BT-28.

### 0.4 What already exists (do NOT rebuild)

Weakest-link bars · strict score + fragility gap · provenance chips · freshness chip + Integrity chip · a full About page · place search · 5 map layers · Impact Simulator. Two free wins nobody is using:
- `src/components/SmallMultiples.jsx` — a finished 4-territory comparison view, imported **nowhere** (needs one i18n key). It is *not* a trend component.
- `resilience.json` already carries a per-pillar `detail[]` array (indicator, value, score, confidence, source, year) — BT-12's drill-down is UI-only, no data work.

---

## Epic 0 — Foundations & blockers (5 cards, all P0, must land first)

### **BT-28 · Release-sequencing contract for `public/data` changes**
**Why:** BT-11a, BT-16a and BT-18 all regenerate `public/data`, and none of them can produce a green PR (see 0.3). Without this card those three stall at review.
**Do:** write and agree the sequence: (1) PR contains pipeline/code changes only, no regenerated artifacts; (2) merge to master; (3) `refresh-data.yml` regenerates and commits data; (4) `anchor.yml` mints the proof and dispatches deploy. Document it in `docs/public-data-release-sequence.md`, add it as a checklist item on every data card, and **confirm with the repo owner whether `AUTO_PRODUCTION_DEPLOY` is `true`** — `deploy.yml:159,166-169` aborts automatic dispatch unless it is exactly `true`, and `docs/DEPLOYMENT_SETUP.md:147` documents it as defaulting to `false`. If it is false, nothing in this plan reaches the client without a manual production run with an exact proof-commit SHA.
**Files:** `docs/public-data-release-sequence.md`, plus the checklist on BT-11a/16a/18.
**Done when:** the sequence is written down, one data card has been run through it end to end, and the `AUTO_PRODUCTION_DEPLOY` answer is recorded.
**Role:** DATA/DEVOPS · **Effort:** M · **Priority:** P0 · **Blocks:** BT-11a, BT-16a, BT-18

### **BT-29 · Run the JS and Python test suites in CI**
**Why:** 39 vitest files and 14 of 17 Python test modules run in **no workflow at all**. `npm test` appears nowhere in `.github/workflows/`. The only test execution anywhere is three workflow-contract modules in `deployment-pr-validation.yml:47-50`, and that workflow only triggers on a narrow `paths:` list — **a PR touching only `src/` runs zero checks**. This is what makes BT-26 more than a promise, and it must land before any manifest-scope change (a broken Verify chip would otherwise ship with every check green).
**Do:** add a CI job running `npm ci && npm run lint && npm test` plus the Python suites. Note `python -m unittest discover -s tests -t .` fails — `tests/` has no `__init__.py`; either add one or name modules explicitly.
**Files:** `.github/workflows/` (new `ci.yml` or extend `deployment-pr-validation.yml`), possibly `tests/__init__.py`.
**Done when:** a PR touching only `src/` runs lint + vitest and can go red.
**Role:** DEVOPS · **Effort:** S · **Priority:** P0

### **BT-11a · Fix the Education canonical-flag collision (Sabah & Sarawak)**
**Why:** both territories score 5/6 pillars, inflating the headline (see 0.2) and half-emptying the client's requested Education layer.
**Root cause (traced end to end):** `data_model.py:42-49 SOURCED_ROWS` hard-codes the Sabah/Sarawak RLS rows that `borneo_tracker_poc.csv:239-240` **now also supplies** from Global Data Lab (the GDL token was added to CI on 2026-07-28). `build_sourced_rows()` (`data_model.py:462-481`) appends them with **no duplicate guard**, unlike `build_internet_rows` (`:440-446`) which has one. `assign_canonical()` (`:426-432`) gives `canonical=1` to the CSV twin via `min()`; then `load_db.py:87` `PRIMARY KEY (territory, indicator)` + `INSERT OR REPLACE` lets the `canonical=0` twin overwrite it; `compute_resilience.py:123-129` selects `WHERE canonical = 1` and finds nothing.
**Do:** delete the two now-redundant `SOURCED_ROWS` entries (or add a `build_internet_rows`-style duplicate guard). Add a durable guard: de-duplicate on `(territory, indicator)` **before** `assign_canonical`, or assert exactly one canonical row per `(territory, dashboard_concept)` after load.
**Trap:** `borneo_tracker.db` and `borneo_tracker.snapshot.db` are **untracked and stale from 2026-07-15**; in them the RLS rows are already `canonical=1`, so running `compute_resilience.py` alone reproduces the *old* 6/6 behaviour and makes the bug look already-fixed. `compute_resilience.py:130` also silently falls back to the snapshot DB. **Verify with a full `run_pipeline.py`, never `compute_resilience.py` alone.**
**Files:** `data_model.py` (~2 lines + guard), regenerated `public/data` **via BT-28's sequence**.
**Release checklist:** follow `docs/public-data-release-sequence.md`; the feature PR must not commit regenerated `public/data` artifacts, and BT-07/BT-17 stay blocked until the post-refresh `resilience.json` is active.
**Done when:** 4/4 territories score 6 pillars, numbers match the 0.2 table, verified through a full pipeline run.
**Role:** DATA · **Effort:** M · **Priority:** P0 · **Depends on:** BT-28 · **Pairs with:** BT-32

### **BT-11b · Pillar-loss gate + symmetric shift detection**
**Why:** the regression passed every existing check. `validate_data.py` never mentions `scoredPillars`; its only related check is a global 90% count floor (`MIN_COUNT_RATIO = 0.90`) — the regression day went 25 → 23 scored entries, floor `int(25*0.90)=22`, **so it passed**. And `detect_resilience_shifts.py:109` iterates *current* pillars only, so it structurally **cannot** see a pillar disappear: replaying the real event produced 4 warnings, **none** naming the loss, and Sabah produced zero.
**Do:** add a hard per-territory check in `validate_data.py` that fails when `scoredPillars` is a proper subset of the previously committed set (naming territory + pillar), and make `detect_resilience_shifts.py` diff the pillar **key sets** symmetrically.
**Ready-made fixture:** replay blobs `b66a900b` → `506aeefe` (both in git). Required outcome: **red**, naming Sabah + Sarawak + Education.
**Files:** `validate_data.py`, `detect_resilience_shifts.py`, `tests/`.
**Done when:** the fixture goes red before the fix and green after.
**Role:** DATA · **Effort:** M · **Priority:** P0 · **Must not delay:** BT-11a

### **BT-32 · All-Borneo coverage disclosure + post-fix number comms**
**Why:** two related honesty gaps. (a) `OverviewDashboard.jsx:590` shows the "N/6 pillars scored" note **only** in the per-territory branch; the all-Borneo branch (`:626`) says just "Average of 4 territories" — so the 70.8 Education average feeding the client-visible 71.7 is computed from **2 of 4 territories** and never disclosed. (b) BT-11a will move the headline from 74.3 to 71.7 and downgrade Sabah green → amber.
**Do:** surface the coverage denominator in the all-Borneo scope, and prepare a short client-facing note explaining that the score *decrease* is a correction of a data-loss bug, not a real-world decline. Ship it the same day as BT-11a.
**Files:** `OverviewDashboard.jsx`, both locale files, client note.
**Role:** FE + CONTENT · **Effort:** S · **Priority:** P0 · **Depends on:** BT-11a

---

## Epic 1 — Clarity (client §1.1, §1.2) — 4 cards

### **BT-01 · Add "How It Works" entry to the top header**
**Client ask (§1.1):** a header entry so a first-time visitor understands the platform.
**Why it is urgent:** `/about` has **exactly one link in the entire app** (`sidebar.jsx:158-169`) — the footer links only the three policy pages. And because the sidebar collapses to **0px** (not an icon rail), a visitor with the sidebar closed has *literally no path* to About.
**Do:** add a "How It Works" link in `MiniTopBar.jsx` routing to `/about#how-it-works`.
**Watch out:** `MiniTopBar` is mounted at **three** sites — `layout_new.jsx:56`, `AuthLayout.jsx:10` (signed-out shell) and `MyProfile.jsx:72` (which stacks a *second* `position:fixed` bar inside a layout that already renders one). No existing `topbar.*` key fits; add a new key to **both** locales.
**Done when:** visible on every page including signed-out, `/profile` doesn't double-render, both languages, clean at 1280/1024/768/390px.
**Role:** FE · **Effort:** S · **Priority:** P0

### **BT-02 · Add the platform descriptor beside the logo**
**Client ask (§1.1):** *"Borneo Sustainability & Resilience Intelligence"* beside/beneath the logo.
**Do:** render it next to the centred logo. The bar is 52px — one line, 11–12px, muted, hidden below ~1024px. Keep the wording as an i18n key. Same three render sites as BT-01.
**Done when:** renders in light + dark without pushing the logo off-centre; hidden (not truncated) when narrow.
**Role:** FE · **Effort:** S · **Priority:** P0

### **BT-03 · Write the "How It Works" section on the About page**
**Do:** a 3-step section — **We collect** (link into `/data-sources`), **We score** (hexagon → Resilience Index, weakest-link first), **We act** (simulator, reports, news).
**Two corrections to v1:** (a) the "We score" step is already half-written as the existing **"The Resilience Score"** section (`AboutPage.jsx:164-187`) — fold it in or cross-link, don't duplicate; (b) **the anchor will dead-link in Malay**: `AboutPage.jsx:231` derives every section id from the *translated* heading (`what-we-monitor` in EN vs `apa-yang-kami-pantau` in MS), so the `Section` helper must take an explicit `id` prop before `/about#how-it-works` works at all.
**Files:** `AboutPage.jsx`, `src/pages/about/about.css` (v1 named this wrong), both locale files.
**Role:** CONTENT + FE · **Effort:** M · **Priority:** P0 · **Blocks:** BT-01's anchor

### **BT-04 · "Why are these scores different?" explainer (Index vs Strict)**
**Client ask (§1.2):** explain the two scores, *"unexplained secondary metrics can create confusion rather than credibility"*.
**Why it is worse than v1 thought:** grepping the locales for `strict|fragility|geometric` returns **only** `dashboard.strictTrueResilience` and `dashboard.fragilityGap`. There is no explanation anywhere in the app — not even on About (unlike weakest-link, which About does explain). Brunei's **17.1-point gap** (78.0 vs 60.9) is presented with zero context.
**Do:** a `ScoreExplainer` popover (click + keyboard, not hover-only). Copy must match `compute_resilience.py`: the Index is the mean of pillar scores; Strict is the **geometric** mean, which punishes one weak pillar; the gap measures imbalance. Reuse on Regional Details.
**Gotcha:** the all-Borneo strict figure (71.7) is **not** stored anywhere — it is computed only in the frontend (`OverviewDashboard.jsx:594-616`) as the geometric mean of cross-territory pillar averages. It is *not* the mean of the four `indexStrict` values (that is 67.6). Any backend or AI-chat copy must recompute it the same way or it will disagree with the screen.
**Files:** new `src/components/ScoreExplainer.jsx`, `OverviewDashboard.jsx`, `Regional_Detail.jsx`, both locales.
**Role:** FE · **Effort:** M · **Priority:** P0

---

## Epic 2 — Navigation (client §2) — 1 card

### **BT-05 · Regroup the sidebar into EXPLORE / ANALYSE / ACT**
**Client ask (§2):** `EXPLORE`: Dashboard · Regional Details · ESG · SDG — `ANALYSE`: Impact Simulator · News & Insights · Community — `ACT`: Generate Report · Data Sources · About.
**Do:** restructure `menuItems` (`sidebar.jsx:58-68`) into three labelled groups. **About is not part of `menuItems`** — it is hand-written JSX at `:158-169`, so the refactor must handle it separately when moving it into ACT. Keep badges and the Admin Tools group working.
**Absorbed from the deleted BT-06:** add `role="group"` + `aria-label` per group, and check BM labels don't wrap at 240px. **No collapsed-rail work is needed** — the collapsed sidebar renders 0px of visible UI (the 72 at `sidebar.jsx:83` is dead code). Optionally flag that dead code, or implement the intended icon rail (`layout_new.jsx:18` → `isSidebarOpen ? 240 : 72`), which would also fix About's reachability.
**Row budget:** an admin already sees up to 13 rows; group headers add 3–4 more.
**Files:** `sidebar.jsx` (the only Sidebar consumer is `layout_new.jsx`), both locales.
**Role:** FE · **Effort:** M · **Priority:** P0

---

## Epic 3 — Insight-first UX (client §3) — 8 cards

### **BT-07 · Dashboard headline sentence (deterministic, no AI)**
**Client ask (§3.1):** *"Borneo's current resilience score is 74.3 — Good, but Food remains the weakest pillar."*
**Do:** a pure `buildHeadline(resilience, scope)` in `src/utils/headline.js`, composed from `resilience.json`. Template-based, **zero LLM cost**.
**Sequencing:** must ship **after BT-11a** or it states an inflated number. Must respect BT-32's coverage disclosure for the all-Borneo scope.
**Done when:** correct for all 5 scopes, honest fallback for unscored pillars, unit-tested, EN + BM.
**Role:** FE · **Effort:** M · **Priority:** P0 · **Depends on:** BT-11a

### **BT-08 · Map layers: add Resilience + the 6 hexagon pillars**
**Client ask (§3.3):** Resilience | Food | Energy | Healthcare | Education | … so users can answer *"Where is the problem?"*.
**Do:** add 7 score-based layers from `resilience.json`. **Resized L → M:** region mode already paints province polygons by `parent → territory` (`OverviewDashboard.jsx:836-851`), so a pillar layer is a 4-value lookup. The real work is that `LAYER_CONFIG` entries are `{label, concept, better}` and `getLayerRows` only knows `indicators.json` — you need a `source` discriminator **plus** a `scale: 'absolute' | 'relative'` field (pillar scores are already 0–100 and comparable; today's 3-bucket relative min/max scale would misrepresent them).
*(ESG/SDG layers excluded on purpose — KIV-02.)*
**Files:** `src/data/useIndicators.js`, `OverviewDashboard.jsx`.
**Done when:** every pillar layer recolours from real scores, unscored territory renders grey/hatched (never green), legend states the scale.
**Role:** FE · **Effort:** M · **Priority:** P0

### **BT-09 · Layer picker redesign + fix two copy defects**
**Why:** BT-08 takes the list from 5 to 12; the flat radio list stops working.
**Do:** grouped control (Scores / Environment / Society) + a caption stating the question each layer answers + unit and direction in the legend.
**Absorbed defects:** (a) the radio labels are the **only untranslated control in the panel** — `OverviewDashboard.jsx:1145` derives them from the camelCase key, bypassing both `LAYER_CONFIG.label` and `t()`; (b) `en.json`/`ms.json` still promise *"Poverty is available now; forest, fire & air layers arrive with the satellite feed"* — **forest (111 rows), deforestation (111) and fire (110) all arrived**; that string is false and is rendered at `OverviewDashboard.jsx:1177`.
**Done when:** 12 layers reachable in ≤2 clicks, all labels translated, false string gone, works at 300px panel width.
**Role:** FE · **Effort:** M · **Priority:** P1 · **Depends on:** BT-08

### **BT-10 · District mode: honest handling of the score layers**
**Do:** pillar/resilience scores exist **only** at territory level, so a score layer in District mode must show an explicit "not available at district level" state — never a fake choropleth.
**Verified district coverage** (`districts.json`, 987 rows): `forest_cover` 111 · `deforestation` 111 · `fire_hotspots` 110 · `poverty` 115 · `education` 56 · `healthcare` 56 · plus economy/unemployment/income/inequality/population. **`air_quality` = 0 rows** — the existing airQuality layer already greys every polygon in all 7 provinces today, before any new work.
**Note for scope:** district-level `education` and `healthcare` rows *do* exist, so the client's Education/Healthcare layers can degrade to raw indicators at district level rather than going blank — decide deliberately and label it.
**Also fix:** the district-unavailable notice interpolates `districtParent` (the province), so it reads "Switch to Region view for Sabah's score" even when Beaufort is selected, under a placeholder named `{{district}}`.
**Done when:** every layer × level combination shows real data or an explicit unavailable state.
**Role:** FE · **Effort:** M · **Priority:** P0 · **Depends on:** BT-08

### **BT-31 · Render unscored pillars honestly on the radar** *(new)*
**Why:** `OverviewDashboard.jsx:661-670` does `out[p] = Number.isFinite(ps[p]) ? ps[p] : 0`, so `HexRadar` draws Education collapsed to the centre and prints the literal label **"0"** (`HexRadar.jsx:62`) — indistinguishable from a real score of zero. Meanwhile `weakestPillar` is Food (28.6), so **the axis flagged red is not the visually collapsed one**, and `WeakestLinkBars` shows only 5 bars. Three views on one card disagree with each other.
**Do:** render unscored pillars as an explicit gap (dashed axis / "no data" label), never as 0. Keep the three views consistent.
**Note:** BT-11a removes today's instance of this, but the bug is structural and will recur on the next coverage gap. Both BT-12 and BT-13 build on this card.
**Files:** `HexRadar.jsx`, `OverviewDashboard.jsx`, `WeakestLinkBars.jsx`.
**Role:** FE · **Effort:** M · **Priority:** P1 · **Blocks:** BT-12, BT-13

### **BT-12 · Make radar pillars clickable → indicator drill-down**
**Client ask (§3.4):** *"Make each pillar clickable so users can drill into the underlying indicators."*
**Do:** make labels/vertices interactive (click + keyboard), opening a panel listing the indicators behind that pillar with value, year, source, confidence (reuse `ProvenanceChip`).
**Corrected data source:** **not** `getRowsForPillar()` (that filters `esg_pillar`, i.e. E/S/G). Use `resilience.json` → `territories[X].detail` (already loaded client-side, carries indicator/value/score/confidence/source/year), and `row.hexagon_pillar` on `indicators.json` rows.
**Dropped criterion:** "unscored pillars explain *why*" — that data does not exist; an unscored pillar is simply **absent** from `detail`, and the reason lives only in the pipeline. Either drop it or add an `unscoredReason` field as a separate pipeline task.
**Role:** FE · **Effort:** L · **Priority:** P1 · **Depends on:** BT-31

### **BT-13 · Surface the weakest-link explanation under the radar**
**Client ask (§3.4):** *"Resilience is only as strong as its weakest essential pillar"* — the client calls this our potential IP.
**Resized S → XS:** the sentence **already exists and is already translated** as `about.resilienceByPillarBody` in both locales. This is "surface existing copy on the dashboard card", not "write + translate".
**Role:** FE · **Effort:** XS · **Priority:** P0 · **Depends on:** BT-31

### **BT-14 · Search: route non-place queries to BorneoBot**
**Client ask (§3.2):** *"Compare Sabah and Sarawak"*, *"Show districts with low food resilience"*.
**Do:** today the search matches place names only (it does also match parent/province names) and dead-ends on "no places match". Replace that empty state with **"Ask BorneoBot: \<query\>"**, opening the existing chat panel pre-filled. Seed `SuggestedQuestions` with the client's three examples.
**Honest cost note:** this adds **no new service**, but it does increase call volume against the shared daily quota in `supabase/functions/ai-chat` (`AI_CHAT_QUOTA_EXHAUSTED`, 429). Flag that when reporting against the client's KIV rule.
**Role:** FE · **Effort:** M · **Priority:** P1 · **Related KIV:** KIV-01

---

## Epic 4 — Data trust & momentum (client §4) — 7 cards

### **BT-15 · Turn the freshness chip into a trust-chain popover**
**Client ask (§4.1):** *last updated → data sources → update frequency → data coverage*.
**Do:** make the "Data as of" chip clickable (IntegrityChip is the working precedent — same flex row, already links `/data-sources`).
**Decide the semantics first — this is a correctness question, not copy:** `generatedAt` is a **build clock, not a data clock**. `json_artifacts.py` skips the write when only the top-level `generatedAt` moved, so each file's stamp means "date of last *substantive* change". Consequences: `resilience_model.json` reads **2026-08-10** while `resilience.json` reads **2026-08-15** — five days apart **by design**, on the file the simulator actually reads. And the last refresh changed *only* 20 `last_updated` strings plus `generatedAt`: **no scored value has moved since 2026-08-04.** A naive "updated today" badge overstates freshness.
**Honest cadence wording (verified):** `refresh-data.yml` cron `0 21 * * *` (daily, 05:00 MYT) but it **only commits when data actually changed**; anchoring and deploy are event-driven (`repository_dispatch`), not scheduled. So "checked daily, updates when sources change" is true; "updated daily" and "verified daily" are false.
**Role:** FE · **Effort:** M · **Priority:** P0 · **Depends on:** BT-16a

### **BT-16a · Emit a deterministic `meta` block**
**Do:** add a top-level `meta` to `indicators.json` / `districts.json` / `resilience.json` — `schemaVersion`, `updateCadence`, `sourceCount`, `coverage`, and (cheap, high value) `unscoredPillars` surfaced at top level, which is exactly the signal that went missing in the Education regression.
**⚠️ Correctness landmine v1 created:** v1 proposed `nextExpectedUpdate`. `json_artifacts.py:14-18` strips **only the top-level `generatedAt`** before deciding whether to rewrite bytes. A clock-derived value nested in `meta` survives that filter, so **every daily run** would produce new bytes → new `dataVersion` → 6 new provenance lines/day → a new `versions/<sha>/` → a new Bitcoin stamp → a new production deploy, on days when no datum moved. That defeats the documented intent of an append-only log of *distinct data versions*. **Every `meta` field must be deterministic given the data** — drop `nextExpectedUpdate`, or express it as a relative cadence, or extend `_without_volatile_generated_at` (with a test).
**Also note:** `source_count` already exists per row but **every value is 1**, so a UI built on it shows 1 everywhere.
**Files:** `export_json.py`, `compute_resilience.py` (`resilience_model.json` is written by `build_model()`, not `export_json.py`, and a shape change there bumps `MODEL_SCHEMA_VERSION`, which `src/utils/resilienceModel.js` and its golden test key off).
**Release checklist:** follow `docs/public-data-release-sequence.md`; the feature PR must be code/test/docs only until the post-merge refresh and proof workflows regenerate `public/data`.
**Role:** DATA · **Effort:** M · **Priority:** P0 · **Depends on:** BT-28

### **BT-16b · Build the per-source cadence & coverage registry** *(split from v1's BT-16)*
**Why:** v1 said "derive from the ingest configuration". **There is no such configuration** — grepping `data_model.py`, `ingest_poc.py`, `export_json.py` for `frequency|cadence|update_freq|schedule` returns **zero hits**. Per-source facts exist only as 40 distinct free-text `source` strings across the rows.
**Do:** create the registry (source id, display name, cadence, licence, last successful fetch, coverage) that BT-16a and BT-20 both consume.
**Role:** DATA · **Effort:** M · **Priority:** P1 · **Blocks:** BT-20

### **BT-17 · Show the interpretation band next to the score**
**Client ask (§4.2):** *"74.3 — GOOD"*.
**Do:** render the RAG band word beside the number using `ragThresholds`.
**Correction:** the existing strings bake the thresholds in (`"Good (≥{{value}})"`), so a bare "GOOD" needs **new keys in both locales** — not reuse.
**Sequencing:** ships in the same wave as BT-11a, which flips Sabah green → amber. Pair with BT-32.
**Role:** FE · **Effort:** S · **Priority:** P0 · **Depends on:** BT-11a

### **BT-18 · Build the resilience history series** *(re-scoped)*
**Client ask (§4.2):** *"↑ +2.1 from previous period"*.
**Feasibility (verified):** **45 committed versions / 39 distinct dates**, 2026-07-05 → 2026-08-15, are replayable from git. But only 32 blobs (from 2026-07-15) contain `indexStrict` at all, there are gaps at 08-01/08-11/08-14, and the series is a **step function** — constant for 07-16→07-31, constant again for 08-04→08-15. Most steps are methodology changes, **and the largest single jump (Sabah 63.7 → 72.1) is the bug**. Publishing that as history would ship the regression as a success story.
**Do:** emit `public/data/resilience_history.json`, **gated behind BT-11a**, with each point tagged by methodology/version so bug-driven steps are distinguishable from real change.
**⚠️ Owner decision this card must make (v1 never did):** `manifest_contract.py` is a hard-coded 6-path tuple.
- **Option A — unhashed.** Drop the file in `public/data/` without touching `DATASET_PATHS`. Verified: all gates pass unchanged, Vite copies it, the deploy mirror uploads it, `.htaccess` serves it `no-store`. Cost ≈ 0. **Loss:** the one artifact on an anchoring-branded site that is not anchored.
- **Option B — hashed.** Needs `manifest_contract.py` +1 path, a **flat filename** (`verify_manifest.py:23` and `deploy.yml:878` both break on a subdirectory), a regenerated manifest + provenance batch, a fresh `versions/<sha>/` + `.ots`, **and** `src/data/useIntegrity.js:6-12` plus its length check at `:66` — otherwise **every visitor's Verify chip reads INVALID**. Two test constants move (`useIntegrity.test.js:99` and `:148`). Plus an unmitigated trap: `index.html` has no cache directive and is uploaded **last**, so a returning visitor runs a cached 6-file bundle against a 7-file `no-store` manifest and sees INVALID until a hard refresh.
**Files (v1's list omitted all of these):** `build_resilience_history.py`, `run_pipeline.py`, `refresh-data.yml`, `validate_data.py`, **plus** `manifest_contract.py`, `useIntegrity.js`, `useIntegrity.test.js` if Option B.
**Release checklist:** follow `docs/public-data-release-sequence.md`; decide hashed vs unhashed scope before merge, then let the post-merge refresh/anchor sequence create any regenerated artifacts and proofs.
**Role:** DATA · **Effort:** L · **Priority:** P1 · **Depends on:** BT-11a, BT-28

### **BT-19 · Momentum UI: delta + biggest movers**
**Do:** `↑ +2.1 vs <actual date>` (never a vague "previous period") + biggest improvement/decline at pillar level. Honest empty state when only one point exists.
**Expectation management:** because scored values have not moved since 2026-08-04, **the delta will read 0.0 on most days**. Consider showing "no change since \<date\>" as the normal state rather than a zero.
**No component to reuse:** `SmallMultiples.jsx` is *not* a trend component (it renders four snapshot hexagons). The only time-series code is **inline ECharts** in `Regional_Detail.jsx:74-133`. Either extract that first (adds a refactor sub-task) or hand-roll an SVG sparkline.
**Role:** FE · **Effort:** M · **Priority:** P1 · **Depends on:** BT-18

### **BT-20 · Add a real Sources section** *(re-pointed)*
**Correction:** v1 aimed this at `/data-sources`, but that page is a **cryptographic ledger** (columns: file / hash / size / status, iterating `manifest.files` — the 6 hashed artifacts). Its own header comment says "a ledger, not a marketing page". There is no `source-id` to anchor to.
**Do:** build a distinct Sources view fed by BT-16b showing per-source cadence, last fetch and coverage, flagging any source older than its own cadence. Decide whether it is a new route or a new section on the existing page — do not bolt it onto the hash table.
**Role:** FE · **Effort:** M · **Priority:** P1 · **Depends on:** BT-16b

---

## Epic 5 — From information to decisions (client §5) — 4 cards

### **BT-21 · "What next" CTA → Impact Simulator deep-link**
**Do:** next to the weakest pillar, **"See what would fix this →"** linking to `/simulator?territory=X&pillar=Food`. The simulator ignores query params today — add reading (and write-back on change).
**Corrected lever coverage:** v1 implied several pillars lack levers. In fact `PILLAR_INDICATOR_CANDIDATES` covers **all six**; a slider only renders if a candidate exists in that territory's baseline. Resolved live: Sabah 5/6, Sarawak 5/6, Brunei 6/6, Kalimantan 6/6 — **Education is the only dead lever, and only for Sabah/Sarawak (2 of 24 combinations)**, and it stays dead after BT-11a until the model's baseline inputs pick the row up. So the CTA must suppress or annotate itself for exactly those two, not degrade broadly.
**Role:** FE · **Effort:** M · **Priority:** P0

### **BT-22 · Build the four-question answer strip (component + dashboard)**
**Client ask (§5):** *What is happening? → Where? → Why does it matter? → What next?*
**Do:** a shared `AnswerStrip` — *what* = BT-07's headline, *where* = weakest territory/district, *why* = the pillar's real-world consequence, *what next* = BT-21's link. One compact strip, not four cards.
**Role:** FE · **Effort:** L · **Priority:** P1 · **Depends on:** BT-07, BT-21

### **BT-23 · Apply the answer strip to ESG, SDG and Regional Details**
**Role:** FE · **Effort:** M · **Priority:** P2 · **Depends on:** BT-22

### **BT-24 · Positioning copy: "Measure Borneo. Understand Borneo. Strengthen Borneo."**
**Do:** tagline on the About hero and the login screen; align the About lede and footer blurb with the intelligence-platform framing.
**Constraints:** `footer.jsx` is a **fixed 20px bar** with `justify-content: space-between` at 13px — a tagline cannot simply be appended without a layout change. `AuthLayout` has real vertical space (`main` has `paddingTop: 92`) and is the lower-risk placement. Both locales required.
**Role:** CONTENT · **Effort:** S · **Priority:** P2

---

## Epic 6 — Map data quality (1 card)

### **BT-30 · Fix district join keys and geometry coverage** *(new)*
**Why the map epic forces this:** **Kota Kinabalu — Sabah's capital, the most likely polygon a demo viewer clicks — can never be coloured, selected or flown to.** `districts.json` keys three Sabah districts `kotabelud` / `kotakinabalu` / `kotamarudu` while `borneo_districts.geojson` keys the same polygons `belud` / `kinabalu` / `marudu`. The failure is silent: `colorForKey` returns null → greyed on every layer; clicking falls back to the polygon name, `selectedKey` never matches, so neither the blue selection fill nor the fly-to ever fires.
**Also in scope (verified):** 27 of 115 poverty rows don't join — Kalimantan Utara + Mahakam Ulu poverty rows are keyed by BPS numeric code (`221`, `222`, `223`, `224`, `225`, `6411`) while their polygons are keyed by name, **and `forest_cover` for the same districts uses name keys**, so two ingests disagree with each other. Kalimantan Barat has **zero** poverty rows. And **28 of 136 district keys have no polygon at all** (131 selectable names vs 111 polygons) — the map silently does nothing when those are picked.
**Do:** normalise join keys at ingest, add a join-coverage assertion to `validate_data.py` (fail or warn on unmatched keys), and either hide or explicitly label districts with no geometry.
**Role:** DATA · **Effort:** L · **Priority:** P1 · **Wave:** with the map epic

---

## Epic 7 — Cross-cutting (3 cards)

### **BT-25 · Plural-aware i18n parity check** *(rewritten — the v1 defect does not exist)*
**Correction:** there is **no translation debt**. en 498 / ms 491 leaves; all 7 EN-only keys are `_one` plural variants and Malay correctly has only `other`. A naive key-set-equality test **would fail on correct data**.
**Do:** add a parity test that strips `_one`/`_other`/`_zero` and honours each locale's `Intl.PluralRules` categories. This matters because nothing currently catches an omission and `fallbackLng: 'en'` hides it — and every card in this plan adds new copy.
**Role:** FE · **Effort:** S · **Priority:** P1

### **BT-26 · Tests for the new logic**
**Do:** unit tests for `buildHeadline` (BT-07), the momentum maths (BT-19), the absolute-vs-relative layer scale (BT-08), the pillar→indicator resolver (BT-12); Python tests for the history builder (BT-18), the pillar-loss gate (BT-11b) and the `meta`-block determinism (BT-16a).
**Note:** this card is only meaningful once **BT-29** actually runs the suites in CI.
**Role:** FE + DATA · **Effort:** M · **Priority:** P1 · **Depends on:** BT-29

### **BT-27 · Documentation, traceability & commit this plan**
**Do:** commit this document (it is currently **untracked** — nothing in it is traceable yet), tick client items as cards close, and update `PROGRESS_REPORT.md` / `README.md` with the new layers, the history artifact and the `meta` contract. Produce the client-facing "what we changed in response to your feedback" note, mapped to their numbering — and fold in BT-32's explanation of the score correction.
**Role:** ANY · **Effort:** S · **Priority:** P2

---

## KIV — needs budget or a methodology decision (3 cards)

### **KIV-01 · Full natural-language query engine**
Per-query LLM intent routing (compare / filter / rank / locate → dashboard state). Needs a token budget and a quota policy. BT-14 delivers the free 80% through the existing chatbot. **Effort:** L

### **KIV-02 · ESG and SDG composite map layers**
Not a cost issue — a **methodology** issue. No ESG or SDG composite score exists (the ESG panel reports indicator *counts*). Painting a map by an undefined number is exactly the unexplained metric the client warns about in §1.2. Needs an agreed weighting/normalisation method, ideally supervisor-approved, before any code. **Effort:** L (M once agreed)

### **KIV-03 · AI-written daily narrative summary**
Daily generation per territory + a human review gate = recurring tokens and moderation effort. BT-07 gives an accurate auto-updating headline for free. **Effort:** M

---

## Trello setup

**Lists:** `Backlog` → `Wave 1 (Now)` → `In Progress` → `Review / QA` → `Done` → `KIV (Parked)`
**Labels:** `FE` · `DATA` · `DEVOPS` · `CONTENT` · `QA` · `P0` · `P1` · `P2` · `KIV` · `Client §1`…`§5` · `Blocked-by-data-release`

**Card template:**
```
Client ask: <quoted line from HT's 2026-08-15 review>
Why it matters:
What to do:
Files:
Done when:
Depends on:
```

### Waves

**Wave 1 — unblock, correct, explain (P0):**
BT-28 · BT-29 · BT-11a · BT-11b · BT-32 · BT-01 · BT-02 · BT-03 · BT-04 · BT-05 · BT-13 · BT-17
*Nothing data-side can merge cleanly until BT-28/29 exist. BT-11a corrects the inflated score; BT-32 explains it the same day. The clarity and nav cards are independent of all that and can run in parallel.*

**Wave 2 — the "where is the problem?" map + insight layer:**
BT-07 · BT-08 · BT-09 · BT-10 · BT-31 · BT-16a · BT-15 · BT-21 · BT-30
*BT-31 lands before BT-12/BT-13 build on the radar. BT-30 rides with the map epic — Kota Kinabalu should work before a client clicks it.*

**Wave 3 — momentum, drill-down, decision framing:** ✅ **delivered 2026-08-24**
BT-16b · BT-18 · BT-19 · BT-20 · BT-12 · BT-14 · BT-22 · BT-23 · BT-24 · BT-25 · BT-26 · BT-27
*All twelve closed. Execution plan and per-stage status: `docs/WAVE_3_EXECUTION_AND_FIXING_PLAN.md`. Client-facing note: `docs/CLIENT_FEEDBACK_RESPONSE_2026-08-24.md`. The two new data artifacts (`sources.json`, `resilience_history.json`) are auxiliary by contract and are published by `refresh-data.yml` on master per BT-28, not committed with the feature code.*

---

## Traceability — every client point is covered

| Client item | Cards |
|---|---|
| §1.1 Header entry + logo descriptor | BT-01, BT-02, BT-03 |
| §1.2 Explain Index vs Strict | BT-04 |
| §2 EXPLORE / ANALYSE / ACT nav | BT-05 |
| §3.1 Daily headline insight | BT-07 *(+ KIV-03)* |
| §3.2 Natural-language search | BT-14 *(+ KIV-01)* |
| §3.3 Meaningful map layers | BT-08, BT-09, BT-10, BT-11a, BT-30 *(+ KIV-02)* |
| §3.4 Clickable pillars + weakest-link explanation | BT-12, BT-13, BT-31 |
| §4.1 Trust chain | BT-15, BT-16a, BT-16b, BT-20 |
| §4.2 Interpretation + momentum | BT-17, BT-18, BT-19, BT-32 |
| §5 Decision layer + positioning | BT-21, BT-22, BT-23, BT-24 |
| Delivery integrity (not asked, but required) | BT-28, BT-29, BT-11b, BT-25, BT-26, BT-27 |
