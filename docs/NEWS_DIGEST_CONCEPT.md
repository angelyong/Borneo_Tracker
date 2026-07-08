# "Borneo Pulse" AI News Digest — Concept, Implementation & Workflow

**Project:** T002 Borneo Tracker · **Author:** Henry Chin Jian Hong · **Date:** 2026-07-09
**Status:** Concept note for supervisor discussion
**Related:** implemented as module **AR-3** in [`ADDITIONAL_REQUIREMENTS.md`](ADDITIONAL_REQUIREMENTS.md)

> This is a standalone note written to explain the news module to a supervisor: **what it is for,
> how it will be built, and what the end-to-end workflow looks like.** The formal functional
> requirements and acceptance criteria live in AR-3 of the requirements spec.

---

## 1. What it is for — purpose & intent

The dashboard already shows *what* the numbers are (deforestation, fire hotspots, air quality,
poverty, …). What it does **not** do today is tell a visitor *what is happening on the ground right
now* that those numbers describe. **"Borneo Pulse" is a `/news` page that fills that gap**: a daily,
plain-English digest of real sustainability events across the whole of Borneo — Sabah, Sarawak,
Brunei, and all of Kalimantan.

The purpose is not to be "yet another news feed". It is built around one idea:

> **News explains the numbers; the numbers verify the news.**

Every digest post is linked to the project's own indicators. A post about Kalimantan fires carries a
live `fire_hotspots` chip that deep-links to that map layer; a haze story carries the current
`air_quality` value. This two-way tie is the whole point — it makes the news **evidence for our
data**, and our data **evidence for the news**. That is the "data speaks" story, made interactive.

| Purpose | What it delivers |
|---|---|
| **Context** | Turns static indicators into a live story — *why* did the fire number jump this week? |
| **Coverage** | One place for sustainability news across all four territories, in English, that no single local outlet provides. |
| **Credibility** | Each post links its sources, shows how many outlets reported it, and is human-approved before publishing. |
| **Evaluation pillar** | Gives the project a distinct **"AI content, cross-verified with data"** story, separate from the AI assistant (AR-2) and smart data intake (AR-1). |

**Scope is deliberately narrow.** A story is included only if it maps to one of our ESG/SDG
indicators or the Borneo resilience story. Five core beats: ① fire & haze · ② deforestation & palm
oil · ③ floods & extreme weather · ④ conservation & wildlife (kept as a positive-news
counterweight) · ⑤ sustainable policy / major development (IKN/Nusantara, carbon trading, energy).
Sports, entertainment, and unrelated crime are **out** — they have no indicator to attach to and
would dilute the platform.

---

## 2. The honest problem this design solves

Two hard truths shaped the design; both are worth stating plainly to the supervisor.

**(a) An AI cannot tell whether a news story is true.** Asking an LLM to "filter for truthfulness"
would be a promise we can't keep — it would confidently pass fabricated stories. So we do **not**
claim AI fact-checking. Instead credibility is built from three things we *can* do:

1. **Trusted sources only** — we collect from a whitelist of established Borneo outlets, not the open web.
2. **Majority rules (corroboration)** — we count how many *independent* outlets reported the same
   story. Many outlets → high confidence; a lone source → flagged as weak.
3. **A human is the final gate** — every AI-generated draft is reviewed by an admin before it goes
   public. The admin, not the AI, decides what users see.

**(b) Copying news is a copyright problem.** So we never reproduce article text. We read only the
free RSS **headline + short summary + link**, have the AI **rewrite the story in our own English
words**, and always **attribute and link back** to the original outlets. Users who want the full
article click through to the source.

Together these turn "we can't verify truth" and "we can't copy text" from blockers into the
product's design: **trusted-source + corroboration + human review + rewrite-and-attribute.**

---

## 3. How it will be implemented

The module is small and built almost entirely from **free, off-the-shelf pieces**. No model
training, no paid APIs, no new infrastructure beyond the shared backend that AR-1/AR-2 already need.

### 3.1 Where the news comes from — sources

~30+ real outlets across the four territories (supply is abundant; Kalimantan is the deepest, with
one ANTARA and one Tribun site *per province*):

| Territory | Example outlets | Language |
|---|---|---|
| Sabah | The Borneo Post, Daily Express, New Sabah Times | English / Malay |
| Sarawak | The Borneo Post, New Sarawak Tribune, Utusan Borneo, See Hua Daily | English / Malay / Chinese |
| Brunei | Borneo Bulletin, BruDirect, Media Permata, RTB | English / Malay |
| Kalimantan (5 provinces) | ANTARA (kaltim/kalbar/kalteng/kalsel/kaltara), Tribun Network, Kaltim Post, Kompas.com, Tempo, Mongabay Indonesia | Indonesian |

### 3.2 How we fetch it — three free layers

1. **Google News RSS (primary).** A keyless public RSS endpoint. One query by keyword × territory ×
   language returns matching stories **from all the outlets above, aggregated** — so we don't have
   to integrate 30 websites individually. Example: a query for `Sarawak deforestation` (English) or
   `Kalimantan kebakaran hutan` (Indonesian).
2. **Publisher-native RSS (supplement).** The big outlets (ANTARA, Tribun, The Borneo Post) publish
   their own RSS feeds with richer summaries — we subscribe to these for our priority sources.
3. **GDELT (optional fallback).** A free global news-event database, used only if we need extra
   Kalimantan depth.

**We read only the RSS title + summary + link — we never scrape full article pages.** The RSS
snippet is content publishers put *outside* their paywall on purpose (to attract readers), so this
is both technically simple (no anti-scraping, no login walls) and safe on copyright and cost.
Paywalls never cost us money; at worst a rare single-outlet paywalled exclusive gives only a thin
summary, which corroboration covers or we skip.

To avoid missing stories published at odd hours across the region's two time zones (UTC+7 / +8), the
fetch uses a **rolling 24–48h look-back window**, not a single fixed snapshot — so we don't need to
know each outlet's publishing schedule.

### 3.3 How the AI processes it

One batched call to **Google Gemini (Flash, free tier)** per day does four things:
**filter** to the five in-scope beats → **cluster** the same story reported by different outlets into
one item (and count the independent sources) → **rewrite** each item in our own words **in English**
(even when the source is Malay or Indonesian) → **tag** the relevant territories and indicators and
attach the source links. Output is structured JSON, ready to store.

### 3.4 What it costs — $0, and why we won't hit limits

| Piece | Service | Free allowance | Our usage |
|---|---|---|---|
| News collection | Google News RSS + publisher RSS + GDELT | free, keyless | tens of queries/day |
| AI rewrite | Gemini Flash | 1,500 requests/day | **~1–20/day (~1% of quota)** |
| Weather (optional) | Open-Meteo | 10,000 calls/day | <100/day |
| Scheduler | GitHub Actions | free (public repo) | 1 run/day |
| Review / publish | shared backend (free hosting) | — | low, admin-only traffic |

Because we run **once a day and batch everything into a few AI calls**, we sit far below every
limit. (The failure mode to avoid is calling the AI per-article or generating on each user
request — we do neither.) The only paid thing in this space, commercial news APIs (NewsAPI, GNews,
Bing News), we **do not use**.

### 3.5 What needs to be prepared

- **Gemini API key** (free, Google AI Studio) → stored as a GitHub Actions secret on
  `angelyong/Borneo_Tracker`.
- **The shared backend** (same one AR-1/AR-2 use) for the draft → review → publish state and admin auth.
- **Source whitelist + query list** — the outlets and keyword×territory×language queries (§3.1–3.2).
- **Indicator tag vocabulary** — the fixed set of indicators a post can be linked to (`fire_hotspots`,
  `air_quality`, `tree_cover_loss`, …).
- **`/news` frontend page** + an **admin review queue** (reuses the existing `ReportVerification.jsx`
  queue pattern).

### 3.6 Companion: weather (optional, low-effort)

A small weather strip for the four territories' main cities via **Open-Meteo** (keyless, free). No
copyright, no AI, no review — it pairs naturally with fire/haze/flood news. Built only after the
news core is stable, and droppable with zero impact if time is short.

---

## 4. The end-to-end workflow

### 4.1 Daily automated stage (no human)

```
┌────────────────────────────────────────────────────────────────────┐
│ 1. TRIGGER — GitHub Action, 05:00 MYT (extends refresh-data.yml)     │
└────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────┐
│ 2. COLLECT — fetch_news.py                                           │
│    • Google News RSS + publisher RSS, per territory × language       │
│    • rolling 24–48h window, whitelisted outlets only                 │
│    • dedupe by URL / title                                           │
│    → list of {title, summary, link, source, published_at}            │
└────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────┐
│ 3. DIGEST — digest_news.py  (one batched Gemini call)               │
│    • filter to the 5 in-scope beats                                  │
│    • cluster the same story across outlets → count independent sources│
│    • rewrite each story in our own ENGLISH words                     │
│    • tag territories + related indicators, attach source links       │
│    → JSON items {title, body, territories, related_indicators,       │
│                  sources[], source_count, ai_generated:true}         │
└────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────┐
│ 4. STAGE AS DRAFT — saved to backend DB with status = "pending"     │
│    (nothing is public yet)                                          │
└────────────────────────────────────────────────────────────────────┘
```

If there is no relevant news that day, the pipeline produces **zero drafts** — no filler. If the
news step fails, the normal data refresh still completes (failure isolation).

### 4.2 Human review stage (the gate)

```
┌────────────────────────────────────────────────────────────────────┐
│ 5. ADMIN REVIEW QUEUE (admin back-office, login required)           │
│    For each pending draft the admin sees:                           │
│      • the rewritten English digest (editable)                      │
│      • "Reported by N sources" + all source links                   │
│      • the indicator tags / chips it will show                      │
│    Admin action:                                                    │
│      ✅ Approve  → status = "published"                              │
│      ✏️  Edit → publish  → the edited text is what goes live         │
│      ❌ Reject  → discarded & logged                                 │
└────────────────────────────────────────────────────────────────────┘
```

The admin — not the AI — is the final decision-maker on what reaches the public. The source count
lets them spot weak, single-source stories at a glance.

### 4.3 Publish stage (what the user sees)

```
┌────────────────────────────────────────────────────────────────────┐
│ 6. PUBLIC /news PAGE                                                 │
│    Approved posts render as cards:                                   │
│      • title · our English summary                                   │
│      • "AI-generated summary" label + source links                  │
│      • live indicator chip(s) → deep-link into the dashboard         │
│    (optional) a weather strip for the four territories               │
└────────────────────────────────────────────────────────────────────┘
```

Published items are recorded with full provenance (what was generated, approved by whom, when) as a
permanent audit trail.

---

## 5. Scope — what it will and will NOT do

**In scope:**
- Daily English digests across all four territories, from a whitelist of trusted outlets.
- The five sustainability beats, each post tagged and linked to a live indicator.
- Multi-source corroboration with a visible source count.
- Admin review-before-publish; rewrite-and-attribute (never reproduce article text).
- (Optional) a weather strip.

**Explicitly OUT of scope:**
- ❌ No AI "truth detection" — credibility comes from trusted sources + corroboration + human review.
- ❌ No sports / entertainment / unrelated news — only indicator-mappable sustainability stories.
- ❌ No full-article scraping or reproduction — RSS summary + rewrite + link only.
- ❌ No auto-publishing — nothing goes live without an admin approving it.
- ❌ No paid news APIs — all sources are free.

---

## 6. Feasibility summary

**Overall feasibility: high (~85%).** Every piece is mature and free; the only judgement call we
reframed is "authenticity", which becomes trusted-source + corroboration + human gate.

| Part | Feasibility | Note |
|---|---|---|
| RSS collection (four territories, 3 languages) | 🟢 High | Google News RSS + publisher feeds, keyless |
| Relevance filter + clustering + English rewrite | 🟢 High | Standard LLM strengths; batched daily |
| Source-count / corroboration | 🟢 High | Cluster by story, count distinct outlets |
| Admin review queue | 🟢 High | Reuses existing report-verification pattern |
| News↔indicator chips | 🟢 High | Data already exported by the dashboard |
| "AI verifies truth" | 🔴 Not attempted | Deliberately replaced by human gate |
| Weather strip | 🟢 Very high | Open-Meteo, keyless, no review |

**Running cost ~$0; effort ~2–2.5 weeks** (collection 2–3d · digest 2–3d · review queue 2–3d ·
frontend 2–3d · wiring 0.5d · weather +1d optional).

---

## 7. Talking points for the supervisor

- It turns our static indicators into a **living story** — news that explains the numbers, numbers
  that verify the news.
- **We do not claim the AI checks truth.** Credibility = trusted sources + how many outlets reported
  it + a **human admin approving every post** before it's public.
- **No copyright risk:** we read only free RSS summaries, rewrite in our own words, and always link
  back — we never copy article text.
- **Free and low-risk:** all sources and the AI free tier cost ~$0; running once a day keeps us at
  ~1% of the AI quota, so rate limits are not a concern.
- **Focused, not a general news site:** only sustainability stories that map to our indicators;
  sports/entertainment are excluded on purpose.
- Open questions to align on: (a) confirm the five beats and the source whitelist; (b) confirm
  who owns the daily admin review; (c) include the weather strip now or defer it.
