# Knowledge Builder

The Stage 2 Knowledge Builder converts approved repository content into static chatbot
knowledge records under `knowledge/generated/`. It is a deterministic build step for the
future Supabase Edge Function chatbot. It does not implement retrieval, embeddings, Gemini
prompting, live dashboard data, or news access.

## Architecture

- `ContentSourceScanner` loads `knowledge/knowledge-sources.json` and excludes unsafe paths.
- `JsonContentExtractor` extracts records from structured JSON and selected public interface copy.
- `MarkdownContentExtractor` extracts heading-based sections from Markdown sources.
- `PageContentExtractor` extracts safe static content from selected source files such as report
  explanations and policy page section arrays.
- `KnowledgeRecordNormalizer` creates stable IDs, keywords, searchable text, language fields,
  source metadata and provenance metadata.
- `KnowledgeValidator` rejects invalid, empty, unsafe or untraceable records.
- `KnowledgeDeduplicator` skips repeated content while retaining records that differ by language,
  region, concept, SDG context or category.
- `KnowledgeWriter` writes category files, the combined index, the build report and the packaged
  Edge Function copy.
- `KnowledgeBuildReport` records sources, counts, warnings and errors.

## Source Configuration

Edit `knowledge/knowledge-sources.json`.

Only enable files that exist in the repository and are safe public knowledge sources. Do not enable `.env` files, dependency folders, build output, cache folders, private uploads or source files containing secrets.

Current source types:

- `json` with `kind: "i18n"`: page-level English/Malay public interface copy from
  `src/i18n/locales/en.json` and `src/i18n/locales/ms.json`.
- `json` without a special kind: curated `knowledge/*.json` records.
- `page` with `kind: "report-content"`: deterministic report indicator and concept explanations
  from `src/pages/reports/reportContent.js`.
- `page` with `kind: "policy"`: section arrays from `src/pages/policies/PolicyPage.jsx`.
  These are marked incomplete because the source itself says the policy content is mock/prototype
  text.
- `markdown`: heading-based documentation sections, currently the Resilience Index methodology.

Example:

```json
{
  "id": "site-copy-en",
  "type": "json",
  "path": "src/i18n/locales/en.json",
  "category": "site-overview",
  "enabled": true
}
```

## Commands

Build generated knowledge:

```bash
npm run knowledge:build
```

Validate without writing output:

```bash
npm run knowledge:validate
```

The build exits non-zero for critical validation failures.

## Generated Output

The builder writes:

- `knowledge/generated/site-overview.json`
- `knowledge/generated/dashboard.json`
- `knowledge/generated/regional.json`
- `knowledge/generated/regions.json`
- `knowledge/generated/esg-indicators.json`
- `knowledge/generated/sdgs.json`
- `knowledge/generated/data-sources.json`
- `knowledge/generated/generate-report.json`
- `knowledge/generated/faq.json`
- `knowledge/generated/reports.json`
- `knowledge/generated/methodology.json`
- `knowledge/generated/news.json`
- `knowledge/generated/community.json`
- `knowledge/generated/knowledge-index.json`
- `knowledge/generated/build-report.json`
- `supabase/functions/ai-chat/knowledge-index.json`

Manual source files in `knowledge/*.json` are not overwritten.

Only files for categories with runtime-safe verified records are present after a build. Stale
generated JSON files are removed before writing new output.

## Runtime Packaging

`knowledge/generated/knowledge-index.json` is the canonical generated artifact. The same build step
also writes `supabase/functions/ai-chat/knowledge-index.json` so the future Deno Edge Function can
load a local static file at deploy time. This is a generated copy, not a manually maintained fork.
Stage 2 does not add retrieval code or Gemini prompt changes.

## Generated Schema

See `knowledge/schema.md`. Every runtime record includes:

- `id`, `title`, `content`, `category`, `language`
- `pageUrl`, `region`, `regions`, `concept`, `sdgTags`, `relatedSdgs`
- `keywords`, `searchableText`
- `sourceFile`, `sourceType`, `sourceId`, `sourcePath`, `sourceName`, `sourceUrl`
- `status`, `placeholder`, `runtimeIncluded`
- `provenance` metadata for source cards and later URL integrity checks

## Validation Rules

Records need stable IDs, title, category, content, language, source file, source type, page URL,
status and provenance metadata. Placeholder content is never marked verified. Empty content,
secret-like content and missing source traceability are rejected. Numerical claims are warned for
review rather than invented or inferred.

## Placeholder Rules

- `verified` records are written to the generated category files and combined runtime index.
- `placeholder` and `incomplete` records are excluded from runtime retrieval.
- Excluded records are still listed in `build-report.json` under `placeholderRecords`.
- The builder does not upgrade placeholder or mock policy content into verified knowledge.
- Translated records are kept separate by `language`; `sourcePath`/`translationKey` links EN/MS
  records only where both come from the same i18n key path.

## Chatbot Consumption

`knowledge/generated/knowledge-index.json` is the static knowledge artifact for
the future chatbot runtime. `supabase/functions/ai-chat/knowledge-index.json` is the packaged copy
for the Edge Function. The previous `src/server/ai/StaticKnowledgeProvider`
prototype was removed during Stage 0 cleanup, so no current code should import it
or treat it as the production search interface.

Stage 1 should load the generated index from the Supabase Edge Function or its
chosen server-side adapter, then apply the retrieval and answer-contract rules in
`docs/AI_CHATBOT_CONCEPT_AND_PLAN.md`.

## Current Limitations

- Phase 1 uses local keyword search, not vector retrieval.
- Live dashboard indicator values are intentionally excluded from static knowledge.
- Some manual records remain placeholders until approved copy is supplied.
- Operational docs containing env-var examples are disabled as knowledge sources.

## Future Upgrade Path

Vector retrieval is not part of Stage 0A. Per the authoritative chatbot plan,
add vector search only after the documented corpus-size or golden-set recall
thresholds are met.
