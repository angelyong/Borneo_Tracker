# Hybrid AI Chatbot

## Architecture

Borneo Tracker AI is implemented as a hybrid assistant with a frontend dialog and a backend-style `/api/ai/chat` endpoint. The current repository is a Vite React app, so the endpoint is mounted through Vite middleware for local development and preview.

Server responsibilities are split across:

- `AIChatController`: HTTP handling, safe errors and rate limiting.
- `AIChatService`: orchestration and response composition.
- `IntentRouter`: static, dynamic, mixed and unknown classification.
- `StaticKnowledgeProvider`: local JSON keyword search.
- `DynamicDataProvider`: read-only dynamic data adapter surface.
- `PromptBuilder`: Borneo Tracker system instructions and live AI prompt input.
- `SourceFormatter`: source display records.
- `OpenAIClient`: server-only OpenAI Responses API integration.
- `ChatRequestValidator`: request validation and sanitisation.

## Request Flows

Static flow:

1. Frontend sends `POST /api/ai/chat`.
2. `IntentRouter` classifies the message as `STATIC_KNOWLEDGE`.
3. `StaticKnowledgeProvider` searches files in `knowledge/`.
4. `AIChatService` returns a concise answer and static sources.

Dynamic flow:

1. `IntentRouter` classifies the message as `DYNAMIC_DATA`.
2. `DynamicDataProvider` tries the relevant read-only adapter.
3. If dynamic reads are disabled or a connection is missing, the response states that data is unavailable.
4. No statistics are fabricated.

Mixed flow:

1. Static knowledge and dynamic adapters are both queried.
2. The answer separates definitions from dashboard or database-derived values.
3. Sources can include both static page links and dynamic data labels.

## Files Created Or Modified

Created:

- `knowledge/*.json`
- `knowledge/schema.md`
- `src/shared/aiChatContracts.js`
- `src/server/ai/*`
- `src/services/AIChatService.js`
- `src/components/ai-chat/*`
- `docs/hybrid-ai-chatbot.md`

Modified:

- `src/components/AIbotButton.jsx`
- `vite.config.js`
- `eslint.config.js`
- `.env.example`

## Environment Variables

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
AI_CHAT_ENABLED=false
AI_CHAT_MOCK_MODE=true
AI_CHAT_DYNAMIC_READS=false
AI_CHAT_TIMEOUT_MS=15000
OPENAI_VECTOR_STORE_ID=
VITE_AI_CHAT_CLIENT_MOCK_FALLBACK=true
```

`OPENAI_API_KEY` must stay server-side. Do not use a `VITE_` prefix for it.

## Mock Mode

Mock mode is the default:

```env
AI_CHAT_ENABLED=false
AI_CHAT_MOCK_MODE=true
```

The UI remains runnable without an OpenAI key. Static answers use placeholder knowledge. Dynamic questions return "Dynamic data connection is not configured yet" unless dynamic reads are explicitly enabled.

## Live AI Mode

1. Install the official OpenAI SDK.
2. Set `OPENAI_API_KEY`.
3. Set `AI_CHAT_ENABLED=true`.
4. Set `AI_CHAT_MOCK_MODE=false`.
5. Choose `OPENAI_MODEL`.

Live calls are made only in `src/server/ai/OpenAIClient.js` through the Responses API.

## Adding Static Knowledge

Add or edit records in `knowledge/` using the schema in `knowledge/schema.md`. Keep records marked `placeholder` until content has been approved. Do not add statistics without source, year, region and unit.

## Knowledge Builder

The Phase 1 Knowledge Builder creates generated static knowledge from approved repository content without overwriting manual knowledge files.

Architecture:

- `scripts/knowledge/ContentSourceScanner.js`
- `scripts/knowledge/JsonContentExtractor.js`
- `scripts/knowledge/MarkdownContentExtractor.js`
- `scripts/knowledge/PageContentExtractor.js`
- `scripts/knowledge/KnowledgeRecordNormalizer.js`
- `scripts/knowledge/KnowledgeValidator.js`
- `scripts/knowledge/KnowledgeDeduplicator.js`
- `scripts/knowledge/KnowledgeWriter.js`
- `scripts/knowledge/KnowledgeBuilder.js`

Source configuration lives in `knowledge/knowledge-sources.json`. Only existing, enabled and safe repository files are processed. Environment files, dependency folders, build output, caches and version-control metadata are excluded.

Run:

```bash
npm run knowledge:build
npm run knowledge:validate
```

Generated files are written to `knowledge/generated/`, including category files, `knowledge-index.json` and `build-report.json`.

`StaticKnowledgeProvider` reads the generated index first and safely falls back to manual `knowledge/*.json` records if generated output is unavailable. Search uses normalized keywords, titles, content, categories, region/SDG metadata, source traceability and phrase boosts. Phase 1 remains local keyword search; vector search can be added later behind the same provider interface.

To add a source, add it to `knowledge/knowledge-sources.json`, keep `enabled` false until the file exists and is safe, then run validation. To correct invalid records, inspect `knowledge/generated/build-report.json`, fix the original source or extractor mapping, and rebuild.

Current limitations: approved static content is still incomplete, placeholder manual records remain visible as placeholders, operational docs with env examples are disabled, and dynamic dashboard values are intentionally not converted into static knowledge.

## Connecting Dynamic Data

Connect production reads inside `DynamicDataProvider` or replace it with an adapter that uses existing backend services. The adapter surface is:

- `getIndicatorValue(indicatorId, regionId, year)`
- `getIndicatorTrend(indicatorId, regionId, startYear, endYear)`
- `compareRegions(indicatorId, regionIds, year)`
- `getRegionalSummary(regionId)`
- `getSdgProgress(sdgId, regionId, year)`
- `getLatestNews(limit)`

Dynamic reads are read-only. Do not add write, delete, update or arbitrary SQL behavior.

## Testing

Run:

```bash
npm run lint
npm run test
npm run build
```

The tests cover dialog open/close, Escape close, disabled empty send, message display, loading state, source rendering, intent routing, validation, mock mode and unavailable dynamic data.

## Current Limitations

- Static knowledge is placeholder content.
- Production backend hosting for `/api/ai/chat` must be wired outside Vite middleware if deploying as a static-only site.
- Dynamic provider connections are disabled by default.
- Conversation history is held in frontend state only.
- Vector-store file search is not connected yet.

## Phase 2 Work

- Replace placeholder knowledge with approved content.
- Mount the chat controller in the production backend or serverless platform.
- Connect dynamic adapters to production data services.
- Add server-side conversation storage if needed.
- Add vector store retrieval with `OPENAI_VECTOR_STORE_ID`.
- Add deeper abuse monitoring and product analytics that do not store sensitive content.
