# Knowledge Builder

The Phase 1 Knowledge Builder converts approved repository content into static chatbot knowledge records under `knowledge/generated/`.

## Architecture

- `ContentSourceScanner` loads `knowledge/knowledge-sources.json` and excludes unsafe paths.
- `JsonContentExtractor` extracts records from structured JSON and selected public interface copy.
- `MarkdownContentExtractor` extracts heading-based sections from Markdown sources.
- `PageContentExtractor` is reserved for future safe static page extraction.
- `KnowledgeRecordNormalizer` creates stable IDs, keywords, searchable text and source metadata.
- `KnowledgeValidator` rejects invalid, empty, unsafe or untraceable records.
- `KnowledgeDeduplicator` skips duplicate title/content/source records.
- `KnowledgeWriter` writes category files, the combined index and build report.
- `KnowledgeBuildReport` records sources, counts, warnings and errors.

## Source Configuration

Edit `knowledge/knowledge-sources.json`.

Only enable files that exist in the repository and are safe public knowledge sources. Do not enable `.env` files, dependency folders, build output, cache folders, private uploads or source files containing secrets.

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
- `knowledge/generated/regions.json`
- `knowledge/generated/esg-indicators.json`
- `knowledge/generated/sdgs.json`
- `knowledge/generated/data-sources.json`
- `knowledge/generated/generate-report.json`
- `knowledge/generated/faq.json`
- `knowledge/generated/knowledge-index.json`
- `knowledge/generated/build-report.json`

Manual source files in `knowledge/*.json` are not overwritten.

## Validation Rules

Records need stable IDs, title, category, content, source file, source type, page URL and status. Placeholder content is never marked verified. Empty content, secret-like content and missing source traceability are rejected. Numerical claims are warned for review rather than invented or inferred.

## Chatbot Consumption

`knowledge/generated/knowledge-index.json` is the static knowledge artifact for
the future chatbot runtime. The previous `src/server/ai/StaticKnowledgeProvider`
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
