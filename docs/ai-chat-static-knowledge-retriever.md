# AI Chat Static Knowledge Retriever

Stage 6A adds deterministic retrieval for `SITE_KNOWLEDGE` questions using the packaged
Edge Function knowledge index at `supabase/functions/ai-chat/knowledge-index.json`.

This is a D + E feature in the ABCDE framing: it uses committed data and provenance to answer
site-knowledge questions without embeddings, live Supabase, live web access, or invented facts.

## Repository Contract

`KnowledgeRepository` loads the packaged artifact once through a static JSON import. The artifact
shape is:

```json
{
  "schemaVersion": 2,
  "generatedAt": "1970-01-01T00:00:00.000Z",
  "recordCount": 83,
  "records": []
}
```

The repository exposes:

- `getAllRuntimeRecords()`
- `getByLanguage(language)`
- `getByCategory(category)`
- `getByIds(ids)`

It returns only records where `runtimeIncluded === true`, `status === "verified"`, and
`placeholder === false`. Malformed, incomplete, and placeholder-like records are rejected.

## Runtime Schema

Runtime records include public answer fields such as `id`, `title`, `content`, `category`,
`language`, `pageUrl`, `region`, `regions`, `concept`, `sdgTags`, `relatedSdgs`, and `keywords`.
They also preserve provenance fields including `sourceFile`, `sourceType`, `sourceId`,
`sourcePath`, `sourceName`, `sourceUrl`, and `provenance`.

Internal fields such as source paths, searchable text, raw record IDs, and retrieval scores are
not written into answer prose. Source metadata is returned separately in `sources[]`.

## Current Counts

- Runtime records: 83
- Languages: English 73, Malay 10
- Source types: JSON 20, page 55, markdown 8
- Regions: no runtime records currently carry a region field
- Main categories: reports 55, methodology 8, site-overview 4, dashboard 4, and 2 each for ESG,
  SDG, regional, generate-report, community, and news

## Ranking

The retriever is phrase/token-aware and deterministic. It scores:

- exact normalized title phrase
- exact keyword phrase
- multi-token keyword overlap
- exact concept match
- category match
- exact page/currentPage match and page-category hints
- territory/region match
- language match or mismatch
- token overlap in title and content/searchable text

Ordering is by score descending, language match, then stable `id`.

Current thresholds:

- minimum same-language score: `8`
- Malay-to-English language fallback minimum score: `12`
- ambiguity margin: `2`

`AMBIGUOUS` is returned when close top matches represent different topics and no strong title,
concept, product-identity, page, or multi-word keyword signal resolves the tie.

## Normalization

Normalization lowercases text, removes diacritics, normalizes apostrophes and hyphen variants,
removes punctuation, collapses repeated spaces, and uses small English/Malay stopword sets.
Domain terms such as ESG, SDG, resilience, daya tahan, indicator, penunjuk, report, and laporan
are retained.

## Language Behavior

English questions prefer English records. Malay questions prefer Malay records. If no suitable
Malay record exists, a verified English record may be selected only when the topic match is strong;
the result status is `LANGUAGE_FALLBACK` and the warning is preserved. Deterministic code does not
invent Malay translations.

## Answer Building

The answer builder uses selected record title/content only. It combines multiple records only when
they share the same topic category or concept, deduplicates repeated sentences, strips URLs from
answer prose, and keeps source metadata in `sources[]`.

No-match answers are deterministic:

- English: `The current Borneo Tracker knowledge base does not contain a verified answer for this question.`
- Malay: `Pangkalan pengetahuan Borneo Tracker semasa tidak mengandungi jawapan yang telah disahkan untuk soalan ini.`

Ambiguous answers ask the user to specify the page or topic.

## Prompt Grounding

`buildSiteKnowledgeGroundedPrompt()` creates a dedicated site-knowledge prompt. It sends only the
selected records and the deterministic answer, never the full 83-record index. The prompt forbids
new facts, URLs, recommendations, dashboard data, news, source paths, and unselected records.

## Response Validation

`validateSiteKnowledgeGeminiResponse()` checks that Gemini output is non-empty plain text and
contains no URL, internal path, secret, system prompt disclosure, unsupported number/year,
invented source, dashboard score injection, or recommendation language. If validation fails, the
handler returns the deterministic knowledge answer with `KNOWLEDGE_RESPONSE_REJECTED`.

## Fallback Behavior

`SITE_KNOWLEDGE` bypasses Gemini for `NO_MATCH` and `AMBIGUOUS`. For valid retrieved answers,
Gemini is called once. Missing API key, timeout, rate-limit/server errors, malformed/empty Gemini
responses, and validation rejection all return the deterministic knowledge answer with
`mode: "template-fallback"`.

## Golden Metrics

After Stage 6A, the Golden set evaluates 68 implemented records and skips 4 unsupported records
that remain outside this stage: live Supabase news and verified lever coverage.

Latest Stage 6A Golden run:

- Passed: 68
- Failed: 0
- Skipped: 4
- SITE_KNOWLEDGE retrieval status accuracy: 1.0
- SITE_KNOWLEDGE top-1 retrieval accuracy: 1.0
- SITE_KNOWLEDGE recall@3: 1.0
- SITE_KNOWLEDGE recall@10: 1.0

## Limitations

- The runtime corpus is 83 verified records, with only 10 Malay records.
- Region fields are currently empty, so territory matching is ready but has little runtime effect.
- The retriever is deterministic lexical retrieval only; there are no embeddings or vector search.
- Static knowledge intentionally does not answer live news, live dashboard calculations, or verified
  intervention advice.
