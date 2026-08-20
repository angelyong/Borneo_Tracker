# Impact Simulator — Build Progress Log

Tracks what's actually been built against `docs/IMPACT_SIMULATOR_SPEC.md`,
stage by stage, on branch `impactSimulator`. Written after Stage IS-3A.
Nothing in this log is committed to git yet — everything described below is
still an uncommitted working-tree change.

## Correction — 2026-08-18 (current release and simulator status)

This dated correction supersedes the **current-status** statements in the
older log below; those entries are retained as historical implementation
evidence and must not be read as the current released-data baseline.

- The 2026-08-17 controlled data release restored Sabah and Sarawak's
  Education input after a duplicate-record canonical collision. Both now
  have six scored pillars. The published baselines are Sabah `67.6 / 62.0`
  (Index / Strict; Food weakest) and Sarawak `73.6 / 71.0` (Education
  weakest), rather than the pre-correction 5/6 values recorded later in
  this document.
- The full Stage IS-3B slider, IS-3C before/after visualisation, and IS-3D
  safety/accessibility work are present in the current implementation. The
  page fetches `resilience_model.json` at runtime, uses the deterministic
  engine, labels scenarios as illustrative rather than forecasts, and keeps
  source/year/confidence beside scored inputs.
- `simulate_resilience()` is available as a deterministic utility seam, but
  **Phase 1.5 is not complete**: it is not yet exposed as a chatbot tool.
- The historical statements below that say Sabah/Sarawak lack Education,
  have 5/6 pillars, show 72.1/79.3, or that IS-3B through IS-3D are not
  started describe the state when they were written. They are not deleted
  because they document the original work and regression context.

**Current status at a glance (2026-08-18):**

| Stage | What it delivers | Current status |
|---|---|---|
| IS-1A | Python emits `resilience_model.json` | ✅ Released |
| IS-1B | Wired into the pipeline + manifest | ✅ Released |
| IS-2A | JS `recompute()` engine | ✅ Implemented and golden-tested |
| IS-2B | Golden drift test (anti-lie gate) | ✅ Implemented |
| IS-3A | `/simulator` page skeleton | ✅ Implemented |
| IS-3B | Six-pillar sliders | ✅ Implemented |
| IS-3C | Before/after visualization | ✅ Implemented |
| IS-3D | Illustrative copy, edge cases, a11y | ✅ Implemented |
| Phase 1.5 | Chatbot `simulate_resilience` tool | ⏳ Not integrated with chatbot |

---

**Historical status at the time this log was first written:**

| Stage | What it delivers | Status |
|---|---|---|
| IS-1A | Python emits `resilience_model.json` | ✅ Done |
| IS-1B | Wired into the pipeline + manifest | ✅ Done |
| IS-2A | JS `recompute()` engine | ✅ Done |
| IS-2B | Golden drift test (anti-lie gate) | ✅ Done, mutation-tested |
| IS-3A | `/simulator` page skeleton | ✅ Done |
| IS-3B | Six-pillar sliders | ⏳ Not started |
| IS-3C | Before/after visualization | ⏳ Not started |
| IS-3D | Illustrative copy, edge cases, a11y | ⏳ Not started |
| Phase 1.5 | Chatbot `simulate_resilience` tool | ⏳ Not started |

---

## IS-1A — Resilience Model Export Contract

**Goal:** make `compute_resilience.py` emit a second file,
`public/data/resilience_model.json`, containing everything a future JS
engine needs to reproduce the Resilience Index client-side — without
changing what the existing `resilience.json` computes or building a second,
parallel scoring implementation.

**What was built** (`compute_resilience.py`):
- `MODEL_SCHEMA_VERSION` — bumped only on a genuine shape change (added/
  renamed/removed field), never for a value refresh.
- `_indicator_to_pillar(scores)` — derives the indicator→pillar mapping
  **from the same run's actual scored output** (`compute()`'s own `detail`
  structure), falling back to `data_model.hexagon_pillar()` only for
  indicators that weren't scored this run, and leaving the handful of
  "cross-pillar wellbeing rate" indicators honestly unmapped rather than
  guessing. This avoids a second, hand-maintained mapping table that could
  drift from what the scorer actually did.
- `build_model(scores)` — reshapes `compute()`'s own return value into the
  versioned contract: `schemaVersion`, `pillars`, `bounds` (copied verbatim
  from the existing `BOUNDS` table), `indicatorToPillar`, `scoring` metadata
  (normalization rule, unit-match requirement, aggregation method), `index`
  metadata (arithmetic/geometric mean rules, RAG thresholds, rounding), and
  `baseline` — every territory's scored inputs, pillar scores, index,
  indexStrict, rag, and weakest pillar, all copied straight from `scores`,
  never recomputed independently.
- `main()` now also writes `public/data/resilience_model.json` right after
  `resilience.json`, from the same `scores` object.

**Why this is safe:** every number in `resilience_model.json` is a **copy**
of something `compute()` already produced. There is no second formula
anywhere — if the JS engine later disagrees with Python, it can only be
because it misread this file, not because two different scoring
implementations exist.

**Verification:** 13 hermetic Python tests
(`tests/test_resilience_model_export.py`) covering all 9 categories the spec
required (top-level fields, pillar order, exact bounds export, mapping
completeness, all 4 territories, baseline-matches-`resilience.json`, unit
preservation, no NaN/Infinity, determinism) — all passing. Confirmed via
`git diff --stat` that only `compute_resilience.py` changed, and that no
existing function body was altered (net effect: two new functions + one
`main()` addition, zero lines of existing scoring logic touched).

**Known limitation:** this environment has no populated database
(`borneo_tracker.db`), so the committed `resilience_model.json` was
generated by feeding `build_model()` the `territories` object straight out
of the already-committed `resilience.json`, not from a live pipeline run.
Verified to reproduce the real dashboard's numbers exactly; will get its
first true end-to-end run on the next scheduled data refresh.

---

## IS-1B — Pipeline Integration

**Goal:** make one pipeline run regenerate both `resilience.json` and
`resilience_model.json` together, and have both hashed/tracked by the
provenance manifest the same way.

**What was actually needed:** less than the stage prompt assumed.
`run_pipeline.py` calls `compute_resilience.main()` at step 5/7 — and
IS-1A had already made that single call write both files. So
**`run_pipeline.py` needed zero changes.** The only real gap was the
manifest:

```diff
 TRACKED_FILES = [
     "public/data/indicators.json",
     "public/data/resilience.json",
+    "public/data/resilience_model.json",
     "public/data/districts.json",
 ]
```
(`emit_manifest.py`, +1 line.) Plus a stale comment fix in
`compute_resilience.py` (the comment used to say "not wired yet — that's
IS-1B"; now it correctly says it's wired and manifest-tracked).

**Verification:**
- Ran `emit_manifest.py` directly (no DB needed — it just hashes files
  already on disk) — confirmed `resilience_model.json` gets a valid 64-char
  sha256 entry, same shape as the other three.
- Ran it twice back-to-back — the `files{}` section was byte-identical both
  times (determinism).
- Added `tests/test_manifest_tracks_resilience_model.py` (4 tests) to lock
  this in permanently, so a future refactor can't silently drop the file
  from tracking.
- Full Python suite: 46 → 50 tests, all passing.

**Known limitation:** same as IS-1A — no local DB means the *full*
`run_pipeline.py` (source pull → DB load → compute → manifest) has never
been run end-to-end in this environment. Everything downstream of "the
files already exist on disk" is verified; the ingestion steps upstream of
that aren't exercised here.

---

## A detour: the front-end got built early, then removed

After IS-1B, I was asked to also build the Impact Simulator front-end
directly — sliders, before/after visualization, the whole page — well
ahead of the staged plan (that would normally be IS-2A through IS-3D). I
built it in one pass: `src/utils/resilienceModel.js`, a golden test, the
`/simulator` route, `ImpactSimulator.jsx` with full slider/HexRadar/
RagGauge/WeakestLinkBars integration, and i18n.

That combined build was then **explicitly reverted** at request — the
`/simulator` route, the page, the sidebar entry, the i18n keys, and the JS
engine were all deleted, restoring the repo to just the IS-1A/IS-1B backend
work. This is why IS-2A and IS-2B below describe the engine and golden test
being **rebuilt from scratch**, not "restored" — the second version is a
cleaner implementation informed by what the first pass got wrong (see the
hard-coded-RAG-threshold bug below), not a copy-paste of the deleted code.

---

## IS-2A — JavaScript Recompute Engine

**Goal:** `src/utils/resilienceModel.js` implementing
`recompute(territory, overrides)`, reproducing the Python scoring model
purely by reading parameters out of `resilience_model.json` — zero
hard-coded bounds, weights, or thresholds.

**What was built:**
- `recompute(territory, overrides = {}, model = <static import of
  resilience_model.json>)` — the 3rd parameter is a deliberate, disclosed
  deviation from the spec's literal 2-argument signature: the module
  statically imports the committed model as its default data source (so
  `recompute(territory, {})` works exactly as the spec expects), but a
  future caller that already fetched a fresher copy at runtime (e.g. a React
  hook, matching how `src/data/useIndicators.js` fetches `resilience.json`
  live rather than bundling it) can pass its own `model` instead of relying
  on the build-time-bundled one.
- Private helpers (`scoreValue`, `geometricMean`, `ragBand`) mirror
  `compute_resilience.py`'s `score_value()`, `geometric_mean()`, and
  `rag_band()` line-for-line in logic, reading `bounds`, `ragThresholds`,
  and rounding precision from the loaded model — never a local literal.

**A real bug found and fixed during verification:** the first draft had
`model.index?.ragThresholds || { green: 70, amber: 40 }` — a hard-coded
fallback that silently duplicates `RAG_GREEN`/`RAG_AMBER` from Python,
exactly the "second source of truth" drift risk the whole spec exists to
prevent. Fixed by removing the fallback: `ragBand()` now returns `null` if
no thresholds are supplied, instead of guessing a plausible-looking number.
A regression test locks this in.

**Verification (manual smoke tests, via Node):**
- `recompute('Sabah', {})` → all 5 scored pillars present (Sabah has no
  scored Education indicator — correctly excluded, not imputed), index
  72.1, indexStrict 66.1, rag green, weakest Food.
- `recompute('Brunei', { 'Paddy production per capita': 40 })` (raising
  Brunei's famously food-fragile indicator from 7.9): Food pillar jumped
  7.9→40, **every other pillar's delta was exactly 0**, index +5.4,
  indexStrict +18.9 (the geometric mean is far more sensitive to the
  weakest link improving — this is the book's "no food = no resilience"
  thesis showing up correctly in the numbers).
- Clamping: an override of `999999` clamps to 100; `-999999` clamps to 0.

---

## IS-2B — Golden Drift Test (the anti-lie gate)

**Goal:** a formal test proving `resilienceModel.js` can never silently
disagree with `compute_resilience.py`'s authoritative output, on every
single test run — not just at review time.

**What was built** (`src/utils/resilienceModel.test.js`, 55 tests total):
- **Golden section (32 tests):** for each of the 4 territories, asserts
  `recompute(territory, {})`'s `index`, `indexStrict`, `rag`, `ragStrict`,
  `weakestPillar`, the exact set of scored pillars, **and each of the 6
  `pillarScores` individually** (not just the aggregate — a pillar-level
  bug that happens to average out would still be caught). Expected values
  are read from the **committed `resilience.json` at test-run time**
  (`import resilience from '../../public/data/resilience.json'`), never
  typed into the test as literals — so it stays green across routine data
  refreshes but goes red on real drift. Tolerance is read from the model's
  own `scoring.roundingPrecision`, not invented.
- **Sanity section (23 tests):** return-shape completeness, no NaN/
  Infinity, determinism, clamping, direction-correctness, and that an
  override on an unknown indicator is ignored rather than injected as a
  fake score.

**The mutation test (proof the gate actually works, not just decorative):**
1. Perturbed one line — added `+ 1` to the pillar-aggregation formula.
2. Re-ran → **32 of 55 tests failed**, each failure naming the exact
   territory and field, e.g. `Kalimantan > pillarScore: Shelter — expected
   67 to be close to 66`.
3. Reverted the one line; diffed against a pre-mutation backup —
   byte-identical.
4. Re-ran → 55/55 passing again.

This is the concrete evidence the anti-lie gate is real: a genuine
1-point drift in the scoring math cannot pass silently.

---

## IS-3A — Simulator Page Skeleton

**Goal:** make `/simulator` reachable — routing, page shell, a territory
selector, and a smoke-check that the trusted engine is wired correctly.
Explicitly **not** sliders, visualizations, or "illustrative" copy — those
are IS-3B/3C/3D.

**What was built:**
- `src/pages/simulator/ImpactSimulator.jsx` — territory dropdown (local
  `useState`), a read-only text line showing
  `recompute(selectedTerritory, {}).index`, and a placeholder box for where
  sliders will go next.
- `src/App.jsx`: one new import + one new `<Route path="/simulator">` line,
  strictly additive (no existing route touched).
- `src/components/sidebar.jsx`: one new nav entry.
- i18n keys for the page title/subtitle/labels in both `en.json`/`ms.json`.

**A correction to the stage's own checklist:** it expected the page to
directly import `Sidebar`/`MiniTopBar` components. That's not how this
codebase actually works — `src/components/layout_new.jsx` already wraps
every page under `<Route element={<Layout />}>` with the real Sidebar/
MiniTopBar/Footer once, centrally. Individual pages (ESG, SDG, and now the
Simulator) only implement the inner `container > rightCol > content` shell.
Importing Sidebar again inside the page would have **double-rendered it**.
Verified by diffing structural keywords against `esg_indicator.jsx` —
zero differences, confirming the new page matches the real, dominant
pattern rather than the checklist's mistaken assumption.

**Verification:** lint clean, `npm run build` succeeds, dev server serves
`/simulator` (HTTP 200). Per-territory correctness relies on the already-
green golden test (same `recompute(territory, {})` call the page makes) —
Sabah 72.1, Sarawak 79.3, Brunei 78.0, Kalimantan 67.7, matching the
committed baseline exactly. No real browser click-through was possible in
this environment (no browser tool available) — worth doing manually before
treating this as fully signed off.

---

## Current repo state (uncommitted)

```
 M compute_resilience.py        (IS-1A: +build_model() etc., comment fix)
 M emit_manifest.py             (IS-1B: +1 line, TRACKED_FILES)
 M public/data/manifest.json    (regenerated by verification runs)
 M public/data/provenance.jsonl (append-only ledger, grew during verification)
 M src/App.jsx                  (IS-3A: +2 lines, additive route)
 M src/components/sidebar.jsx   (IS-3A: +1 line, nav entry)
 M src/i18n/locales/en.json     (IS-3A: +8 lines)
 M src/i18n/locales/ms.json     (IS-3A: +8 lines)
?? public/data/resilience_model.json      (IS-1A deliverable)
?? src/pages/simulator/                   (IS-3A: ImpactSimulator.jsx)
?? src/utils/resilienceModel.js           (IS-2A/2B: the JS engine)
?? src/utils/resilienceModel.test.js      (IS-2A/2B: sanity + golden tests)
?? tests/test_manifest_tracks_resilience_model.py  (IS-1B)
?? tests/test_resilience_model_export.py           (IS-1A)
```

Nothing above is committed to git — this is all still working-tree state
on the `impactSimulator` branch.

**Test totals as of now:** Python 50/50 passing (`python -m unittest
discover -s tests`). JS 614 passed, 18 failed (`npm test`) — the 18
failures are pre-existing chatbot tests (`structuredAnswerBuilder.test.js`,
`AIChatDialog.test.jsx`), unrelated to and unchanged by any of this work;
confirmed identical before and after every stage above.

**Not yet built:** the six-pillar sliders (IS-3B), the before/after
HexRadar/RagGauge/WeakestLinkBars visualization (IS-3C), the "illustrative,
not a forecast" labelling and edge-case/accessibility hardening (IS-3D),
and the chatbot's `simulate_resilience` tool (Phase 1.5).
