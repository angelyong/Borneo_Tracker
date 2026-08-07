# AI Chat Golden Tests

Stage 6 adds a deterministic Golden Test Set and offline evaluation harness for the Borneo Tracker AI chatbot pipeline.

This harness measures what the repository currently supports. It does not claim completion for static knowledge retrieval, live Supabase news access, verified lever recommendations, production authentication, production quota enforcement, or live Gemini/Supabase end-to-end behavior.

## Golden Files

- `tests/ai-chat/golden/golden-schema.json`
- `tests/ai-chat/golden/golden-evaluation-config.json`
- `tests/ai-chat/golden/golden-questions.en.json`
- `tests/ai-chat/golden/golden-questions.ms.json`

Each Golden record contains:

- stable `id`
- `language`
- `question`
- optional `context`
- explicit `implementationStatus`
- expected intent, entities, operations, comparability decision, fact availability, blocked and clarification state
- optional news, validator, and fallback expectations
- category `tags`
- optional rationale/source note

## Implementation Status Labels

- `IMPLEMENTED`: deterministic repository-side behavior is expected and evaluated.
- `PARTIALLY_IMPLEMENTED`: deterministic behavior exists, but the feature has documented limitations.
- `NOT_IMPLEMENTED`: the feature is intentionally not evaluated as working functionality.
- `BLOCKED_BY_SUPABASE`: live Supabase access is unavailable and not simulated as production.
- `NO_VERIFIED_DATA`: infrastructure exists, but verified runtime records are absent.

## Current Golden Set

The committed set contains 72 questions:

- 36 English
- 36 Malay

Records may have multiple tags. Coverage includes site-knowledge routing, dashboard data, comparisons, trends, SDG requests, districts, local news privacy, out-of-scope prompts, language variants, prompt-injection/numeric safety, fallback behavior, and empty verified-lever behavior.

## Metrics

The evaluator reports:

- routing accuracy
- entity-resolution accuracy
- operation-detection accuracy
- comparability accuracy
- fact-availability accuracy
- blocked/clarification accuracy
- news privacy pass rate
- numeric/security validation pass rate
- fallback correctness

Static retrieval recall@10 is deliberately not reported because no static retriever exists.

## Thresholds

Committed implemented Golden checks use conservative thresholds:

- routing: 100%
- entity checks: 100%
- operation checks: 100%
- comparability checks: 100%
- fact availability: 100%
- blocked/clarification: 100%
- news pending privacy: 100%
- numeric/security validation: 100%
- fallback behavior: 100%

Unsupported records are listed as skipped and are not counted as implemented success.

## Safety-Critical Failures

Any of these must fail evaluation with a non-zero exit:

- pending news content exposed
- blocked comparison allowed
- clarification guessed
- unapproved number or year accepted
- URL accepted in dashboard prose
- source path exposed
- secret or system metadata accepted
- recommendation accepted when no verified lever exists
- invalid Gemini output returned instead of deterministic fallback
- request validation bypass
- Gemini-generated source accepted

Reports omit raw rejected Gemini text, raw pending news content, secrets, stack traces, and machine-specific absolute paths.

## Fixture Policy

Production committed repository data is used for:

- territories
- indicators
- resilience values
- pillars
- districts
- methodology
- knowledge index

Synthetic fixtures are kept under `tests/fixtures/ai-chat/` and are used only for:

- Gemini success/failure/invalid-output examples
- pending news privacy
- malformed or edge-case local news behavior
- lever edge cases

No fake production dashboard, news, or verified lever records are added.

## Unsupported Feature Handling

The current report must state:

- `knowledgeIndexAvailable: true`
- `staticRetrieverImplemented: false`
- `staticRetrievalStatus: NOT_IMPLEMENTED`
- `leverInfrastructureImplemented: true`
- `verifiedRuntimeLeverCount: 0`
- `verifiedRecommendationCoverage: 0`
- `localNewsRepositoryEvaluated: true`
- `liveSupabaseRepositoryEvaluated: false`
- `liveStatus: BLOCKED_BY_SUPABASE`

## Commands

Validate Golden files:

```bash
npm run ai-chat:golden:validate
```

Run evaluation and generate reports:

```bash
npm run ai-chat:golden
```

Reports are written to:

- `reports/ai-chat/golden-evaluation.json`
- `reports/ai-chat/golden-evaluation.md`

## Adding A Golden Question

1. Add the record to the English or Malay Golden file.
2. Use a stable id with the next sequence number.
3. Add explicit implementation status.
4. Keep expected fields limited to behavior the repository can actually evaluate.
5. Use synthetic fixtures for Gemini, news privacy, and lever edge cases.
6. Run validation and evaluation.
7. Do not lower thresholds or change expected values merely to hide a real failure.

## Current Limitations

Static knowledge final answers are not evaluated because static retrieval is not implemented. Live Supabase news is not evaluated. Verified lever recommendation coverage is zero because the runtime verified lever library has zero records. Production Gemini/Supabase end-to-end behavior, authentication, and quota enforcement are outside Stage 6.
