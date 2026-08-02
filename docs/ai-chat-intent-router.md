# AI Chat Intent Router

Stage 3A adds deterministic bilingual routing for the Supabase Edge Function chatbot.

## Supported Intents

- `SITE_KNOWLEDGE`: questions about Borneo Tracker, pages, report generation, site meaning, and help.
- `DASHBOARD_DATA`: questions about resilience, scores, indicators, pillars, territory data, and comparisons.
- `BORNEO_NEWS`: questions about Borneo news, recent reports, updates, and conservation news.
- `OUT_OF_SCOPE`: unrelated requests such as coding help, celebrities, homework, travel booking, or unsupported topics.

## Routing Rules

Routing is deterministic and phrase/token aware. It normalizes case, punctuation, apostrophe variants,
and repeated whitespace. Multi-word phrases score higher than generic terms. It avoids naive substring
matching, so a fragment like `art` does not match a word like `quarterly`.

English and Malay terms are both supported. Malay examples include `berita terkini`, `laporan terkini`,
`kemas kini`, `penunjuk`, `daya tahan`, `skor`, `wilayah`, `bagaimana menggunakan`, `apakah maksud`,
`laman`, and `papan pemuka`.

## Tie-Breaking

When multiple supported intents match, priority is:

1. `DASHBOARD_DATA`
2. `BORNEO_NEWS`
3. `SITE_KNOWLEDGE`
4. `OUT_OF_SCOPE`

`currentPage` and selected `region` are weak contextual signals only. They cannot override explicit user
wording.

## Mixed Intent

Mixed production routing is deferred. If dashboard and news signals both appear, the router returns the
strongest supported intent and includes an ambiguity reason: `mixed intent deferred`.

## No LLM Routing

The router does not call Gemini, Supabase, embeddings, vector search, or live data sources.
