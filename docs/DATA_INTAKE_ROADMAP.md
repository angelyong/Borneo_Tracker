# Data Intake Roadmap — De-manualising `manual_overrides.csv`

**Status:** 🔵 **Bucket B started 2026-07-09 — UNESCO puller DONE (code, tested); rest deferred to the admin-site build.**
_Status updated: 2026-07-20 — an admin site now **partially exists** (user management + news review, both on Supabase), but the data-intake automation in this roadmap (Bucket C review queue, the staleness monitor, and the FAOSTAT paddy puller) is **still not built**. The "wait until you build the admin site" trigger is now partly satisfied: the front+back admin surface and the Supabase backend that Bucket C's review queue needs both exist — so Bucket C can now be built on top of them rather than blocked on standing up an admin site._
**Decided:** 2026-07-09 · **Owner:** Henry · **Related:** [`ADDITIONAL_REQUIREMENTS.md`](./ADDITIONAL_REQUIREMENTS.md) (AR-1)

**Progress log**
- 2026-07-09 — **UNESCO puller landed** (`pull_unesco` in `ingest_poc.py`): pulls the official
  World Heritage XML register (keyless, WAF-safe via `get_bytes_raw`), assigns each site to a
  Borneo territory by coordinate box. Verified output Sabah 1 / Sarawak 2 / Brunei 0 / Kalimantan 0
  (matches the retired manual rows). The 4 UNESCO rows were removed from `manual_overrides.csv`
  (Safety Rule 2). Confidence upgraded manual → high.
- 2026-07-09 — **GDL puller landed** (`pull_gdl` in `ingest_poc.py`): mean years of schooling for
  Sabah/Sarawak (subnational) + Brunei (national) from Global Data Lab (keyed — `GDL_API_TOKEN` in
  `.env`). Verified 8.70 / 8.70 / 9.28 (matches retired manual rows). Tagged `data_level='modeled'`
  → new `confidence='medium'` rule in `data_model.py` (academic/harmonised, never "high"). One
  request returns all countries+years+levels; response is cached to committed `gdl_msch_cache.csv`
  with a `# fetched=<date>` header and only re-fetched when >28 days old, so the API is hit ~monthly
  (≈12/yr) vs the free 1000-call token limit → ~83yr runway. Status endpoint
  `/shdi/api/status/?token=` reports remaining calls. 3 schooling rows removed from manual_overrides.
  ⚠️ **CI TODO:** add `GDL_API_TOKEN` to GitHub Actions secrets on `angelyong/Borneo_Tracker`, and
  ensure the refresh workflow commits `gdl_msch_cache.csv` so the monthly gate persists.
  ⚠️ **Local note:** this machine's TLS-inspecting proxy blocks Python's https to globaldatalab.org
  (self-signed cert in chain); the fetch works in CI / via curl. Puller verified locally against a
  seeded cache. `manual_overrides.csv` now 11 rows (was 18). **FAOSTAT still pending (521 outage).**
  **UNESCO + GDL go live on the next full `run_pipeline.py` / daily Action run** (DB + JSON not
  regenerated yet — poc CSV newer than DB, avoided a risky partial re-ingest).

> ⚠️ **READ THIS WHEN YOU START BUILDING THE ADMIN SITE.** This work was intentionally
> parked until then. Do not forget it — it is the plan for turning our 18 hand-typed
> data rows into a governed, mostly-automated intake system.

---

## Why this doc exists

Today, ~18 indicator values in `manual_overrides.csv` are **hand-typed** because their
sources have no API (government PDFs, press releases, web tables). That CSV has **no
validation, no deep provenance, no staleness alarm**. It is the only ungoverned seam in
an otherwise ~80%-automated data pipeline. This roadmap replaces it. We chose to build it
**at the same time as the admin site** (because the human-review UI needs that front-end +
back-end anyway) rather than piecemeal now.

## The concept — a two-lane intake system

Every manual indicator is routed by one question: **does a clean API/feed exist?**

- **Lane 1 — fully automatic (no human):** pull → validate → tag `data_level` → write to pipeline.
- **Lane 2 — assisted (human is the gatekeeper):** auto-collect candidate source → AI extracts
  a draft (value + verbatim quote + source link) → validation gate → **admin approves/edits/rejects**
  → write to pipeline.

Both lanes share ONE exit: a git-committed source-of-truth → `load_db.py` → `indicators.json`
→ dashboard (badge "Manual — verified"). The existing pipeline is **not rewritten**; this is
purely additive.

## The 18 rows split into 3 buckets

| Bucket | What | How | Needs admin site? |
|---|---|---|---|
| **A** | life expectancy, tourist arrivals, electrification | Extend existing pullers; where sub-national is missing, fall back to the **WB national** value we already pull, tagged `data_level=national` | No |
| **B** | mean-years-schooling ×3, UNESCO WHS ×4, Brunei paddy ×1 (~8 rows) | Wire **one new API each** — pure automation, no AI, no backend | No |
| **C** | national parks ×4, sub-national tourist arrivals, Sarawak electrification (~6 rows) | Shrunk/hybrid AR-1: auto-collect + AI draft + **human review queue** | **Yes (front + back)** |

Buckets A & B need neither front-end nor back-end and could be done anytime. Bucket C's
**review queue** is what binds this to the admin-site build.

## Source verdicts (live-checked 2026-07-09 from Henry's machine)

| Source | Verdict | Notes |
|---|---|---|
| **UNESCO WHS** — `https://whc.unesco.org/en/list/xml/` | ✅ **VERIFIED live** (HTTP 200, 2.44 MB XML, 1248 sites, keyless) | Use `http.client` + browser UA, **NOT urllib** (WAF 403s urllib — same trick as GFW in `ingest_poc.py`). Cross-check passed: no Brunei site = matches manual row "Brunei = 0". First-party official. **Lowest-risk, build first.** |
| **Global Data Lab** (mean years schooling) | ✅ Real REST API | Needs a **FREE token** (register on GDL site). Radboud University, peer-reviewed (Nature Sci Data). **Academic/harmonised, NOT official statistics → tag `data_level=modeled/academic`, never "official".** |
| **FAOSTAT** (Brunei paddy) — `fenixservices.fao.org/faostat/api/v1/en/data/QCL` | ⚠️ **BLOCKED — could NOT verify** | Returned **HTTP 521 (Cloudflare origin-down) on 6 attempts** on 2026-07-09. FAO data itself is genuine/official (UN). **Re-test the endpoint before relying on it; FAOSTAT bulk-CSV download is the fallback. If still down, defer Brunei paddy to Bucket C.** |

## When you build it — checklist

**Data / pipeline (Lane 1, buckets A & B):**
- [ ] Write UNESCO puller (XML → count sites per territory) — verified, keyless, do first.
- [ ] Write GDL puller (needs token in secrets; tag `data_level=modeled/academic`).
- [ ] **Re-test FAOSTAT endpoint.** If up, write paddy puller; if down, route to Bucket C.
- [ ] Bucket A: add WB-national fallback with `data_level=national` where sub-national is missing.

**Assisted intake (Lane 2, bucket C) — with the admin front + back:**
- [ ] Scheduled collector (GitHub Action): per stale cell, run targeted search → candidate sources.
- [ ] AI extraction → draft `{value, verbatim quote, source_url, year}`; **reject drafts with no quote.**
- [ ] Validation gate: unit match · flag if >50% deviation from last year · no future year.
- [ ] **Admin review queue** in the admin site: show AI draft + quote + old-vs-new + validation flags,
      with Approve / Edit / Reject. (Mirror the existing `ReportVerification.jsx` queue pattern.)
- [ ] Approve → write to source-of-truth (git commit via the back-end) → pipeline publishes it.
- [ ] Staleness monitor: flag manual observations older than 12 months back into the queue.

## Three safety rules (do not violate)

1. **Failure isolation** — a new puller failing must NOT break the whole refresh (copy the
   `try/except` pattern already used for `ingest_history` in `run_pipeline.py`).
2. **Retire replaced rows** — when an indicator becomes API-pulled, DELETE its row from
   `manual_overrides.csv` so the same cell doesn't have two competing sources.
3. **Correct `data_level` tags** — never label a modeled/academic source (GDL) or a national
   proxy as official sub-national data. Honesty of provenance is the whole "data speaks" story.

## Review-surface decision

**Preferred: in-app admin review queue** (better visualisation of the evidence; matches the
"data governance" evaluation pillar; consistent with the existing report-verification queue).
It requires a small back-end/serverless endpoint to write approvals back to git — **which is
exactly the back-end this admin-site build provides**, so the dependency is satisfied by
definition. GitHub-PR review is the zero-cost fallback if the back-end slips. The **engine
(collect + AI draft) is identical either way** — only the review UI swaps.
