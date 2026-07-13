# News & Insights ("Borneo Pulse" / AR-3) — Implementation Plan

**Project:** T002 Borneo Tracker · **Module:** AR-3 · **Date:** 2026-07-14
**Status:** Build plan (supervisor-approved concept) · **Related:** `docs/NEWS_DIGEST_CONCEPT.md`, `docs/ADDITIONAL_REQUIREMENTS.md` (AR-3, FR-3.1–3.12)

> This is the concrete build plan for the News & Insights page. The *why* lives in
> `NEWS_DIGEST_CONCEPT.md`; the formal requirements/acceptance criteria in AR-3. This file answers:
> **what the process is, and what has to be built/changed in the frontend, backend, database, plus
> the exact tools, AI, and materials required.**

**Non-negotiable design rule (re-confirmed):** we do **NOT** do "AI truth detection". An LLM cannot
verify whether a news claim is true. Credibility comes only from **(a) a whitelist of trusted
outlets, (b) multi-source corroboration — how many independent outlets reported the same story, and
(c) a human admin who approves every post before it goes public.**

---

## 0. Where we are today (reality check)

| Layer | Current state |
|---|---|
| **Frontend** | ✅ The public `/news` page is **fully built** on `master`: `NewsPage`, `FeaturedNews`, `NewsCard`, `NewsDetailPage`, filters, skeleton/empty/error states, `/news/:articleId` route, sidebar entry. |
| **Data** | ❌ **All fake.** `newsService.js` returns 10 hard-coded articles from `src/data/mockNews.js`. No real news is fetched. |
| **Admin side** | ❌ **Not built.** No admin review queue exists on `master` (the old `ReportVerification.jsx` lives only on the `feature/figma-redesign` branch). |
| **Backend** | ❌ **There is none.** The whole app is a static Vite+React SPA. Auth is mock (`authToken` is never actually set). |
| **Data pipeline** | ✅ A real Python pipeline exists for the dashboard: `run_pipeline.py` → SQLite (`borneo_tracker.db`) → `public/data/*.json`, run daily by `.github/workflows/refresh-data.yml` (05:00 MYT). **We mirror this pattern for news.** |

**So the news UI shell is done; everything behind it — collection, AI digest, storage, and the whole
admin review/publish side — is what this plan builds.**

---

## 1. Chosen architecture

Because the app has no backend and the admin side must let a human **read drafts → approve/edit/reject
→ publish**, and because the collection should run **every few hours** (not just daily), the
recommended architecture is a real, free, hosted **shared backend: Supabase**.

**Why Supabase (recommended):**
- The admin queue is just CRUD on one table → Supabase's auto-generated API means almost no backend code.
- "Every few hours" collection = simple `INSERT`s; the admin queue updates live with **no rebuild/redeploy** (a static-JSON approach would need a git commit + site build on every fetch).
- Gives us **real admin auth** (currently missing) for the review gate.
- It is the **same shared backend AR-1 (smart intake) and AR-2 (AI assistant) are designed to reuse** — built once, used by all three modules.
- Free tier (500 MB Postgres, 50k monthly active users) is far more than this needs; nothing to self-host.

**Alternative (backend-free fallback), kept for reference — see [Appendix A](#appendix-a):** Git-native +
one free serverless function. Pipeline commits drafts as JSON; the admin page calls a Vercel/Netlify
function that writes approved posts into `public/data/news.json` via the GitHub API. $0 and consistent
with the existing pipeline, but clumsy for frequent fetches and in-app edits. Choose this only if we
refuse to introduce any backend.

The rest of this plan is written for the **Supabase** path; §9 marks what changes for the fallback.

---

## 2. End-to-end process

Matches the business flow: **auto-fetch → AI digest → admin decides → user sees it.**

```
STAGE 1 — COLLECT (automated, every 3–6h)          [GitHub Action: news.yml]
  fetch_news.py:
    • Google News RSS + publisher RSS, per territory × language (EN/BM/ID)
    • rolling 24–48h window · whitelist outlets only · dedupe by URL hash
    • cluster the same story across outlets → count independent sources
  → raw candidate stories

STAGE 2 — DIGEST (automated, one batched AI call)   [same Action]
  digest_news.py → Gemini Flash (batched JSON):
    • filter to the 5 in-scope beats (drop sports/entertainment/unrelated)
    • rewrite each story in our OWN ENGLISH words (source may be BM/ID)
    • tag territories[] + related_indicators[] · attach source links + source_count
  → INSERT rows into Supabase  news_items  with status = 'pending'
    (dedupe on url_hash so re-runs never double-insert)

STAGE 3 — REVIEW (human gate)                        [in-app /admin/news, admin login]
  Admin sees each pending draft: rewritten English text (editable),
  "Reported by N sources" + all source links, indicator chips it will show.
    ✅ Approve → status = 'published'
    ✏️ Edit → save edits, then publish  (edited text is what goes live)
    ❌ Reject → status = 'rejected' (kept for audit, never shown)

STAGE 4 — PUBLISH (what the user sees)               [public /news]
  Public page reads only status = 'published' rows.
  Cards show: title · our English summary · "AI-generated summary" label ·
  source links · live indicator chip(s) → deep-link into the dashboard.
```

If a run finds no relevant news → **zero drafts** (no filler). If collection/AI fails, the dashboard
data refresh is unaffected (separate workflow = failure isolation).

---

## 3. Database changes

One new Supabase (Postgres) project, two tables. (Auth uses Supabase's built-in `auth.users`.)

### 3.1 `news_items` — the drafts + published store

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK (default `gen_random_uuid()`) | |
| `slug` | `text` unique | URL id for `/news/:slug` |
| `title` | `text` | AI-rewritten English title |
| `body` | `text` | AI-rewritten English summary (our words, never article text) |
| `beat` | `text` | one of the 5 beats (`fire_haze`, `deforestation`, `floods_weather`, `conservation`, `policy_dev`) |
| `territories` | `text[]` | subset of `{Sabah, Sarawak, Brunei, Kalimantan}` |
| `related_indicators` | `text[]` | from the fixed `dashboard_concept` vocabulary (§8.3) |
| `sources` | `jsonb` | `[{name, url, published_at}]` — all corroborating outlets |
| `source_count` | `int` | number of **independent** outlets (corroboration) |
| `image_url` | `text` null | source og:image if present, else null → beat placeholder |
| `original_lang` | `text` | `en` / `ms` / `id` (provenance) |
| `url_hash` | `text` unique | dedupe key (hash of canonical URL / title) |
| `ai_generated` | `bool` default `true` | drives the "AI-generated summary" label |
| `status` | `text` default `'pending'` | `pending` / `published` / `rejected` |
| `created_at` | `timestamptz` default `now()` | when the pipeline generated it |
| `reviewed_by` | `uuid` null | admin user id (audit) |
| `reviewed_at` | `timestamptz` null | approve/reject time (audit) |
| `published_at` | `timestamptz` null | set on approve |

Provenance (FR-3.10) = `created_at`, `reviewed_by`, `reviewed_at`, `original_lang`, `ai_generated`,
plus full `sources`. A permanent audit trail without any extra table.

### 3.2 `admins` (or a boolean flag / Supabase role)

Marks which authenticated users may see `/admin/*` and change `status`. Simplest: a `role` claim /
an `admins(user_id)` allow-list table.

### 3.3 Row-Level Security (RLS) — the actual publish gate

- **Public (anon) role:** `SELECT` on `news_items` **only** `WHERE status = 'published'`. This is
  what enforces "nothing is public until approved" at the database level (AC-3.2).
- **Admin role:** `SELECT` all statuses; `UPDATE` `status`, `title`, `body`, `reviewed_*`.
- **Pipeline (service key, server-side only):** `INSERT` drafts. The service key lives **only** in
  GitHub Actions secrets, never in the frontend bundle.

> Fallback path (no Supabase): "database" = two static files — `public/data/news.json` (published) and
> a non-public `data/news_pending.json` (drafts). Provenance lives in git history. See Appendix A.

---

## 4. Backend changes

There is **no server to run** — Supabase is the backend. The "backend" work is:

1. **Supabase project setup** — create project, run the SQL for §3 tables + RLS, create the admin user(s).
2. **Two keys:**
   - `anon` public key → shipped in the frontend (read published rows only; safe by RLS).
   - `service_role` key → **GitHub Actions secret only**, used by `digest_news.py` to insert drafts.
3. **Pipeline write path** — `digest_news.py` inserts via the Supabase REST endpoint or
   `supabase-py`. Idempotent on `url_hash`.
4. **Admin auth** — Supabase Auth (email+password or magic link) for the admin login; gate `/admin/*`
   routes on `role`/`admins` membership. (This also replaces today's fake `authToken` for the admin
   area; the public site stays open, no login required to read news.)

No REST API of our own, no server process, no container. Everything is Supabase's managed API +
client SDK.

---

## 5. Frontend changes

Two parts: **(A) upgrade the existing public page from mock → real data + the AR-3 fields**, and
**(B) build the new admin review page.**

### 5.A Public `/news` page — from mock to real

**Data source swap**
- `src/services/newsService.js` — replace the `mockNews` import with Supabase reads:
  `getNewsArticles()` → `select * where status='published' order by published_at desc`;
  `getNewsArticleById(slug)`; `getRelatedNewsArticles()` by shared territory/beat. Keep the same
  async function signatures so `NewsPage`/`NewsDetailPage` need almost no change to their control flow.
- `src/data/mockNews.js` — **delete** once real data flows (or keep as a seed/fallback for offline dev).

**Schema reconciliation (the current UI diverged from AR-3 — these fields must change):**

| Current mock field | New field | Component change |
|---|---|---|
| `aiSummary` | `body` | rename in Card/Featured/Detail |
| `territory` (single) | `territories[]` | render one chip per territory |
| `category` (single) | `beat` (from fixed 5) | chip label from beat |
| `sourceName` + `sourceUrl` (single) | `sources[]` + **`source_count`** | Detail lists **all** source links; Card/Featured show a **"Reported by N sources"** badge |
| `sdgTags[]` (static strings) | derived from `related_indicators` | optional; can keep SDG chips |
| `indicatorTags[]` (static strings) | `related_indicators[]` → **live chips** | **new `IndicatorChip` component** (below) |
| `isFeatured` | (server flag or newest-in-beat) | keep featured logic |

**New component — `IndicatorChip.jsx` (the "data speaks" tie, FR-3.7):**
Given a `dashboard_concept` + territory, it reads `public/data/indicators.json`, shows the **current
value + unit** (e.g. `Fire alerts: 128`), and **deep-links to the matching dashboard layer**
(`/regions`, `/esg`, `/sdg`). This is what makes "news explains the numbers, numbers verify the news"
real instead of a static tag. Used in `NewsCard`, `FeaturedNews`, `NewsDetailPage`.

**Files touched:** `NewsCard.jsx`, `FeaturedNews.jsx`, `NewsDetailPage.jsx` (fields + chips + multi-source
list), `newsUtils.js` (search over new fields; add indicator-lookup helper), `news.css` (source-count
badge, indicator chip, multi-territory row). Filters (`NewsFilters.jsx`) switch the "category" dropdown
to the 5 **beats** and keep territory/sort/search.

**Images:** RSS rarely gives clean images. Use the source `og:image` when the digest can grab one,
otherwise fall back to a **per-beat placeholder** (5 static images in `public/`). `NewsImage.jsx`
already handles empty `src`.

### 5.B New admin review page — `/admin/news` (the missing piece)

- **Route + gate:** add `/admin/news` behind an admin auth check (redirect non-admins).
- **Queue UI (reuses the community/report-verification pattern):** a list of `status='pending'`
  drafts, each showing the **editable** English title/body, the **"Reported by N sources"** count +
  every source link, and the indicator chips it will carry. Actions: **Approve** / **Edit → Publish**
  / **Reject**. On action, call Supabase `update` → the public page reflects it immediately.
- **New files:** `src/pages/admin/NewsReview.jsx` (+ small `DraftCard`), `src/services/adminNewsService.js`
  (admin reads/updates), plus a sidebar/admin-nav entry shown only to admins.

---

## 6. Data pipeline (Python) changes

Mirror the existing dashboard pipeline exactly (it already does ingest → SQLite → JSON, run in CI).

**New scripts (repo root, next to `ingest_poc.py` etc.):**

- **`fetch_news.py`** — collect candidates:
  - Build the query matrix: keyword × territory × language (§8.4) → Google News RSS URLs (keyless).
  - Add publisher-native RSS for priority outlets; (optional) GDELT for extra Kalimantan depth.
  - Rolling 24–48h window; keep only whitelisted outlets; dedupe by URL hash.
  - Cluster near-duplicate titles across outlets → `source_count` + `sources[]`.
  - Output: list of candidate clusters (JSON).
- **`digest_news.py`** — one batched Gemini Flash call:
  - Prompt: filter to the 5 beats, rewrite each cluster in **our own English words**, tag
    `territories` + `related_indicators` (from the fixed vocabulary), return **structured JSON**.
  - **Insert** each item into Supabase `news_items` as `status='pending'`, idempotent on `url_hash`.
  - No truth-checking anywhere in the prompt — only in-scope filtering + rewrite + tagging.

**Reused as-is:** the CI runner, Python 3.12 setup, secrets mechanism, commit step pattern.

---

## 7. Automation (GitHub Actions)

**New workflow `.github/workflows/news.yml`** (separate from `refresh-data.yml` → failure isolation
+ its own cadence):

```yaml
on:
  schedule:
    - cron: "0 */6 * * *"   # every 6h (tune 3–6h); or "0 21 * * *" for daily-only
  workflow_dispatch: {}
jobs:
  news:
    runs-on: ubuntu-latest
    steps:
      - checkout / setup-python 3.12
      - pip install feedparser requests google-generativeai supabase python-dateutil
      - run: python fetch_news.py && python digest_news.py
        env:
          GEMINI_API_KEY:      ${{ secrets.GEMINI_API_KEY }}
          SUPABASE_URL:        ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

If the LLM secret is missing, the job **skips digest** but never breaks the dashboard refresh
(AC-3.8). This workflow writes to Supabase, so — unlike `refresh-data.yml` — it needs **no commit
step** for drafts (that's the DB payoff).

---

## 8. Tools, AI, and materials (explicit lists)

### 8.1 Tools / services

| Tool | Role | Cost | Key needed? |
|---|---|---|---|
| **Google News RSS** | primary collection (keyless, aggregates all outlets by query) | free | no |
| **Publisher-native RSS** (ANTARA, Tribun, The Borneo Post…) | richer summaries for priority sources | free | no |
| **GDELT** (optional) | fallback for extra Kalimantan depth | free | no |
| **Supabase** (Postgres + Auth + auto REST API) | the shared backend / DB / admin auth | free tier | anon + service keys |
| **GitHub Actions** | scheduler for collect+digest (every 3–6h) | free (public repo) | — |
| **Open-Meteo** (optional, §8.6) | weather strip for 4 territories' cities | free, keyless | no |
| **Python libs** | `feedparser` (RSS), `requests`, `supabase-py`, `python-dateutil`, optional `langdetect` | free | — |
| **`@supabase/supabase-js`** | frontend read + admin write | free | anon key |

Explicitly **NOT used:** paid news APIs (NewsAPI / GNews / Bing News), any full-article scraper.

### 8.2 AI

- **Google Gemini Flash** (free tier via Google AI Studio) — **one batched call per run**: filter →
  rewrite-to-English → tag. ~1–20 calls/day against the 1,500/day free quota (~1%). Key =
  `GEMINI_API_KEY` GitHub secret on the pipeline repo.
- **AI does NOT judge truth.** Its only jobs: relevance filtering, English rewrite, and tagging.
  Output is structured JSON, validated before insert.

### 8.3 Materials — indicator vocabulary (fixed set, from `indicators.json`)

`related_indicators` may only be drawn from the existing `dashboard_concept` values, so every chip
resolves to a real dashboard value:

`fire_hotspots`, `air_quality`, `deforestation`, `forest_cover`, `protected_areas`,
`clean_water_access`, `energy`, `economy`, `governance`, `shelter`, `healthcare`, `education`,
`food`, `poverty`, `unemployment_rate`, `heritage`, `entertainment`.

### 8.4 Materials — beats + source whitelist + query matrix

- **5 beats:** ① `fire_haze` · ② `deforestation` (& palm oil) · ③ `floods_weather` · ④
  `conservation` (wildlife) · ⑤ `policy_dev` (IKN/Nusantara, carbon trading, energy).
- **Beat → indicator mapping** (drives the chips): fire_haze→`fire_hotspots`,`air_quality`;
  deforestation→`deforestation`,`forest_cover`,`protected_areas`; floods_weather→`clean_water_access`
  (+SDG13); conservation→`protected_areas`,`forest_cover`; policy_dev→`energy`,`economy`,`governance`,`shelter`.
- **Source whitelist (~30+ outlets)** from the concept doc §3.1: Sabah (The Borneo Post, Daily
  Express, New Sabah Times) · Sarawak (Borneo Post, New Sarawak Tribune, Utusan Borneo, See Hua) ·
  Brunei (Borneo Bulletin, BruDirect, Media Permata, RTB) · Kalimantan (ANTARA kaltim/kalbar/kalteng/
  kalsel/kaltara, Tribun, Kaltim Post, Kompas, Tempo, Mongabay Indonesia).
- **Query matrix:** keyword × territory × language, e.g. `Sarawak deforestation` (EN),
  `Kalimantan kebakaran hutan` (ID), `Sabah banjir` (MS). To be finalized as a `sources.yml` /
  `queries.yml` config the pipeline reads.

### 8.5 Materials — misc assets

- 5 per-beat **placeholder images** (`public/news/…`) for stories without an og:image.
- Beat labels + colors for chips (frontend copy).
- Gemini **prompt template** (filter + rewrite + tag; JSON schema).

### 8.6 Optional companion — weather strip

Open-Meteo (keyless) forecast for one key city per territory (Kota Kinabalu, Kuching, Bandar Seri
Begawan, Pontianak/Samarinda). No AI, no review, independent of the news pipeline. **Build last;
droppable with zero impact.**

---

## 9. What changes if we pick the Git-native fallback (no Supabase)

- **Database →** static files: `public/data/news.json` (published) + non-public `data/news_pending.json` (drafts).
- **Backend →** one free serverless function (Vercel/Netlify) the admin page calls to commit approved posts to `news.json` via GitHub API; or plain "admin merges a PR in GitHub."
- **Pipeline →** `digest_news.py` writes JSON + commits, instead of INSERTing to Supabase; `news.yml` regains a commit step.
- **Auth →** no real auth available → admin gate is a shared password / GitHub-side review.
- **Frontend →** `newsService.js` fetches `/data/news.json` instead of Supabase; everything else in §5 is identical.

Everything in §2, §5.A schema work, §6 collection, §8 tools/AI/materials is the **same** either way.

---

## 10. Build sequence (addresses the "admin side is behind" gap)

Phased so there's a working vertical slice early:

1. **Phase 1 — real data end-to-end (highest value):** Supabase project + `news_items` table +
   RLS; `fetch_news.py` + `digest_news.py` producing real pending drafts; swap `newsService.js` to
   read published rows; do the §5.A schema/field upgrade + `IndicatorChip`. *(~4–6 days)*
2. **Phase 2 — the admin side (the current gap):** admin auth + `/admin/news` review queue
   (Approve/Edit/Reject). *(~3 days)*
3. **Phase 3 — automation:** `news.yml` on a 3–6h cron + failure isolation + dedupe hardening. *(~1 day)*
4. **Phase 4 — polish/optional:** weather strip, per-beat placeholder art, SDG chips. *(~1–2 days)*

> Tip for speed: while the admin page (Phase 2) is being built, you can approve the first drafts
> straight in the Supabase table editor (flip `status` to `published`) so the public page can be
> demoed **before** the admin UI is finished.

---

## 11. Open items to confirm

- [ ] Confirm the backend track: **Supabase (recommended)** vs git-native fallback (§9).
- [ ] Confirm collection cadence (every 3h / 6h / daily).
- [ ] Confirm who owns the daily admin review.
- [ ] Confirm the source whitelist + query matrix (finalize `sources.yml`).
- [ ] Weather strip — include now or defer.

---

## Appendix A — Git-native fallback detail

Pipeline commits `data/news_pending.json`; an in-app read-only preview shows pending items; approval
is either (i) an admin clicking Approve → a Vercel/Netlify function commits the item into
`public/data/news.json` via the GitHub API (in-app buttons, ~50 lines, $0), or (ii) the admin edits/
merges the day's drafts PR in GitHub (zero extra code). Provenance = git history. Public `/news`
reads `public/data/news.json`. Use this only to avoid standing up any backend.
