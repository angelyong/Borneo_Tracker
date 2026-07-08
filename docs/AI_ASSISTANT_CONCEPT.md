# AI Sustainability Assistant — Concept, Scope & Rationale

**Project:** T002 Borneo Tracker · **Author:** Henry Chin Jian Hong · **Date:** 2026-07-09
**Status:** Concept note for supervisor discussion
**Related:** implemented as module **AR-2** in [`ADDITIONAL_REQUIREMENTS.md`](ADDITIONAL_REQUIREMENTS.md)

> This is a standalone concept note written to explain the AI Chatbot to a supervisor: **what it
> is, what it will and will not do, why it is worth building, and what it depends on.** The formal
> functional requirements and acceptance criteria live in AR-2 of the requirements spec.

---

## 1. What it is (in one paragraph)

A **public, no-login AI assistant** embedded in the Borneo Tracker dashboard. A user can ask it
**any** question about Borneo sustainability, and it answers **using the project's own data** —
always **citing the source** of every answer. On top of general Q&A it offers two flagship
capabilities: a **development suitability assessment** ("is this territory suitable for this kind
of development?") and **land-use application guidance** ("how do I apply to lease/buy/develop land
here?"). It is explicitly an **informational assistant, not an approval authority** — every answer
is framed as reference-only guidance and points users to the real official process.

It is built entirely on an **off-the-shelf LLM API** (Google Gemini) with **prompt-based
grounding**. There is **no model training, fine-tuning, RAG, or vector database** — the whole
dataset is small enough (<100 KB) to hand to the model on every request.

---

## 2. Why build it — purpose & value

The dashboard already holds real ESG/SDG indicators for four Borneo territories. Today a visitor
has to read charts and draw their own conclusions. The assistant turns that passive data into an
**interactive, question-answering decision-support tool**:

| Purpose | What it delivers |
|---|---|
| **Accessibility** | Non-experts get answers in plain language instead of reading raw indicators. |
| **Decision support** | Developers / investors / planners / researchers get a structured, data-backed suitability read before they invest time or money. |
| **Practical guidance** | Users who want to actually proceed are pointed to the correct, real application steps and authorities — not left guessing. |
| **Credibility** | Every answer cites its source, so users can verify — the assistant is a front-end to trustworthy data, not an opinion generator. |
| **Evaluation pillar** | Gives the project a clear **"AI decision support"** story distinct from the news digest (AI content) and smart intake (AI data governance). |

**The differentiator is trust.** A generic chatbot answers from memory and can be confidently
wrong. This assistant answers **only** from our vetted data and a curated knowledge base, and
**shows its sources** — that is the entire point, and the reason it is defensible in front of a
supervisor or a real user.

---

## 3. The three capabilities

### 3.1 All-purpose grounded Q&A
Answers anything derivable from the indicators — e.g. *"Which territory lost the most forest since
2015?"*, *"How does Sabah's poverty rate compare to Sarawak's?"* The full `indicators.json` +
`resilience.json` is injected into each prompt; the answer cites indicator, year, and source.

### 3.2 Development suitability advisor
User names a **territory + development type** (plantation, tourism, housing, industry). The
assistant scores the relevant ESG dimensions (deforestation trend, fire risk, water access,
poverty/social context, governance) as **green / amber / red**, gives an overall verdict from a
**fixed vocabulary — suitable / suitable with caution / high risk** (never "approved/rejected"),
and cites the indicator behind each score.

### 3.3 Application guidance (knowledge-base backed)
User asks **how to apply** to lease/buy/develop land in a jurisdiction. The assistant returns the
**real steps, responsible department, and official links** — quoted **only** from a team-curated
knowledge base (KB). Example jurisdictions and their real processes:

- **Sabah** — State land alienation under the Land Ordinance (Cap. 68), via Jabatan Tanah dan Ukur
  (Lands & Surveys Department); note restrictions on non-Sabahan / foreign ownership.
- **Sarawak** — Sarawak Land Code, via the Land and Survey Department.
- **Brunei** — Land Department; foreign land ownership is heavily restricted.
- **Kalimantan (Indonesia)** — plantation land via **HGU** (Hak Guna Usaha); foreigners cannot hold
  HGU directly (need a PT PMA company), and **AMDAL** environmental approval is required; titles can
  take 2–3 years.

> **This is the highest-value and highest-risk capability.** See §6.

---

## 4. How it fits into the system (architecture)

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND  (existing React + Vite dashboard)                   │
│   Existing: map · ESG · SDG · resilience · open data           │
│   NEW: 💬 chat widget — no login, conversation state on client │
└──────────────────────────────────────────────────────────────┘
        │  question over HTTPS   (frontend never holds the API key)
        ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND PROXY  (new, small FastAPI service — free hosting)    │
│   1. receive question + rate-limit (10/min/IP)                 │
│   2. assemble prompt:                                          │
│        system instructions (cite-or-refuse, disclaimer, fixed  │
│          verdict vocabulary)                                   │
│      + indicators.json      ← live ESG/SDG data                │
│      + resilience.json      ← resilience data                 │
│      + application KB        ← curated 4-jurisdiction steps    │
│      + development-type rubric                                 │
│      + user question                                          │
│   3. call Gemini API  (API key lives ONLY here)               │
│   4. return grounded, cited answer to frontend                │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
   ┌───────────┐
   │ Gemini API │  (free tier covers demo traffic)
   └───────────┘
```

**Grounding model — the AI does not answer from its own memory.** On every request the "truth" is
placed inside the prompt as three knowledge sources:

| Knowledge source | Content | Powers |
|---|---|---|
| A · `indicators.json` | ESG/SDG indicators (already exported by the dashboard) | Q&A + suitability scoring |
| B · `resilience.json` | Resilience data (already used by the dashboard) | Resilience Q&A |
| C · **Application KB** *(new)* | Real application steps, departments, official links per jurisdiction | Application guidance |

A and B **already exist** — wiring them in is near-zero cost. **C is the only thing built from
scratch, and it is where correctness comes from.**

---

## 5. Scope — what it will and will NOT do

**In scope (Phase 1, committed):**
- All-purpose grounded Q&A over project data, with citations.
- Suitability assessment by territory + development type.
- Application guidance from the curated KB (4 jurisdictions).
- Reference-only disclaimer and source links on every answer.

**Stretch (Phase 2):** map point-click → live GFW/WDPA lookup for site-specific analysis.

**Explicitly OUT of scope:**
- ❌ Not an approval/rejection engine — no "approved/rejected" language, ever.
- ❌ Not legal advice — it points to authorities, it does not replace them.
- ❌ No answers invented beyond the data/KB — "we don't have this" instead of a guess.
- ❌ No parcel-level precision in Phase 1 — answers state their resolution ("Sabah state level").
- ❌ No user data collected — no login, conversation stays client-side.

---

## 6. Feasibility & the one real risk

**Overall feasibility: high.** The technology is mature and off-the-shelf; the effort is ~2 weeks
for Phase 1 at ~$0 running cost (Gemini free tier). Nothing here needs research-grade AI.

| Capability | Feasibility | Note |
|---|---|---|
| Grounded Q&A + citations | 🟢 Very high | Standard prompt-grounding; data already exists |
| Disclaimer / fixed vocabulary | 🟢 Very high | Prompt constraints |
| Backend proxy + rate limit | 🟢 High | Standard FastAPI |
| Suitability scoring | 🟡 Medium-high | Needs a development-type rubric, iterated |
| **Application guidance** | 🟡 Medium | Technically easy; **bottleneck is human KB accuracy** |
| Map point analysis (Phase 2) | 🟠 Medium | Live GFW/WDPA geo-queries; stretch |

**The one real risk is the accuracy of application guidance.** An LLM asked "how do I apply for
land in Sabah" from its own memory will produce plausible but possibly **outdated or invented**
procedures — unacceptable when guiding someone through a real legal/government process. The
mitigation is architectural, not hopeful:

1. **KB-only answers.** Application guidance is quoted strictly from the human-curated KB.
2. **Cite-or-refuse.** If the KB doesn't cover it, the assistant says so and names the responsible
   authority — it never fills the gap with a guess.
3. **Reference-only framing.** Every answer states it is guidance, not verified advice, and points
   to the official process (EIA / AMDAL / state land office).

So "correct" is not something the AI provides — **the team provides correctness by curating the KB**,
and the AI's job is to communicate it clearly and cite it. This is the key point to align on with
the supervisor.

---

## 7. What needs to be prepared

**Technical**
1. One **Gemini API key** (free, from Google AI Studio).
2. One **backend proxy service** (FastAPI; free hosting on Render/Railway/Fly.io/Vercel).
3. **GitHub Actions secret** for the key (bundle with the pending GFW/BPS/WAQI secrets task).
4. **Chat UI** component in the React frontend (widget + report-card / source-link rendering).
5. Wire in existing `indicators.json` / `resilience.json` (near-zero effort).

**Content (the real work)**
6. **System prompt** — assistant persona + cite-or-refuse rules + disclaimer + banned vocabulary.
7. **Development-type rubric** — which indicators matter per development type and what counts as
   green/amber/red.
8. ⭐ **Application-guidance KB** — the real steps, departments, and official links for Sabah,
   Sarawak, Brunei, and Kalimantan. **~3–5 days of human research; this is the gating deliverable
   for the guidance capability and the source of its correctness.**

**Team / process**
9. Decide scope: **Phase 1 first** (Q&A + suitability + guidance), Phase 2 later.
10. Assign the KB research (e.g. one person per jurisdiction).
11. Prepare a test set of questions — especially out-of-data and sensitive ones — to confirm the
    assistant refuses gracefully and never "approves".

**Effort (Phase 1):** backend + rate limit 1–2 d · prompt + rubric + report format 3–4 d ·
chat UI 3–4 d · KB research 3–5 d (parallel) → **~2 weeks**, ~$0 running cost.

---

## 8. Talking points for the supervisor

- It converts our existing data into an **interactive decision-support tool**, not just charts.
- Its credibility comes from **grounding + citations** — it answers only from our data/KB and shows
  sources; it cannot "just make things up".
- It is deliberately positioned as **guidance, not approval or legal advice**, with disclaimers and
  a fixed non-committal verdict vocabulary — this manages liability.
- It is **cheap and low-risk technically** (~2 weeks, ~$0, no training).
- The **one thing we must invest in is the knowledge base** — that human research is what makes the
  application guidance genuinely correct and is the assistant's real competitive asset.
- Open questions to align on: (a) confirm the four jurisdictions and depth of the KB; (b) confirm
  Phase 1 scope vs. deferring the map-point feature; (c) who owns KB accuracy and its refresh.
