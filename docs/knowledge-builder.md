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

## Chatbot Search

`StaticKnowledgeProvider` now reads `knowledge/generated/knowledge-index.json` when available. It falls back to manual `knowledge/*.json` files when the generated index is missing or invalid.

Search uses normalized title, keywords, category, content, regions, SDGs, source metadata and exact phrase boosts. The provider interface stays unchanged for the chatbot service.

## Current Limitations

- Phase 1 uses local keyword search, not vector retrieval.
- Live dashboard indicator values are intentionally excluded from static knowledge.
- Some manual records remain placeholders until approved copy is supplied.
- Operational docs containing env-var examples are disabled as knowledge sources.

## Future Upgrade Path

A vector-store provider can be added behind the same `StaticKnowledgeProvider.search()` interface by indexing `knowledge/generated/knowledge-index.json`. The chatbot controller and UI should not need changes.
