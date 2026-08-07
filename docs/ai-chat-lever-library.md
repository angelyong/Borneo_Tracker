# AI Chat Lever Library

Stage 5A creates the deterministic foundation for evidence-based interventions.
It does not add invented advice and does not perform external research.

## Schema

Lever records live under `knowledge/levers/` and follow
`knowledge/levers/lever-schema.json`. A lever includes:

- stable `id`;
- `concept`, `pillars`, and `territories`;
- `title`, `summary`, and `mechanism`;
- `whoActs`, `horizon`, and optional `expectedDirection`;
- explicit `appliesWhen` and `doesNotApplyWhen`;
- evidence metadata with `publisher`, `title`, `year`, optional `url`, `sourceFile`,
  optional `sourcePath`, and `whatItActuallySays`;
- `evidenceStatus`;
- `language`;
- `keywords`.

English and Malay files are separate. Malay records are not created unless a verified
Malay lever exists.

## Evidence Status

Only `VERIFIED` records enter runtime artifacts.

`INCOMPLETE`, `PLACEHOLDER`, and `REJECTED` records may remain in curated files for future
review, but the build excludes them. The validator never upgrades a lower-status record.

## Evidence Requirements

Verified levers require at least one traceable evidence item. The evidence description must
state what the source actually supports. Gemini cannot be used as evidence.

URLs remain metadata only. User-facing answer text and grounded prompt prose must not expose
raw URLs, `sourceFile`, or `sourcePath`.

## Territory Applicability

Territory-specific levers apply only to the declared territory.

`Borneo-wide` applies only when the record explicitly declares broad applicability. `generic`
records may be retrieved only when the record itself is not dependent on local legal,
environmental, or administrative conditions.

`doesNotApplyWhen` is an exclusion guard. If the Fact Object or query context matches an
exclusion, the lever is not returned.

## Retrieval Ranking

Retrieval is deterministic and uses structured fields only:

1. exact concept match;
2. exact pillar match, including a diagnosed weakest pillar;
3. territory applicability;
4. `appliesWhen` compatibility;
5. `doesNotApplyWhen` exclusion;
6. language match;
7. verified evidence completeness.

It does not use Gemini, embeddings, vector search, live Supabase, web research, fuzzy
semantic ranking, or score-improvement estimates.

## Language Behavior

Malay requests prefer verified Malay levers. If no verified Malay record exists but an
English record is applicable, the retriever may return the English record with a warning.
It does not translate evidence claims.

## Empty Result

When no verified applicable lever exists, retrieval returns:

```json
{
  "records": [],
  "matchedBy": [],
  "warnings": [],
  "emptyReason": "NO_VERIFIED_APPLICABLE_LEVER"
}
```

The current production library has no verified lever records committed, so runtime retrieval
returns an empty result. The existing Stage 4B unavailable-lever text remains valid.

## Runtime Packaging

`npm run levers:build` loads curated lever files, validates records, excludes non-verified
records, sorts runtime records deterministically, writes
`knowledge/generated/lever-library.json`, mirrors the same artifact to
`supabase/functions/ai-chat/lever-library.json`, and writes
`knowledge/generated/lever-build-report.json`.

`npm run levers:validate` runs the same validation without writing artifacts.

## Structured Answer Integration

For eligible `DASHBOARD_DATA` answers, the handler retrieves verified applicable levers after
the Fact Object is built and before the Structured Answer is built.

When a verified lever is returned, layer five becomes available and carries deterministic
lever wording, `leverIds`, and `requiresGeminiPhrasing: true`.

Blocked and clarification answers skip retrieval and Gemini.

## Prompt Builder Integration

The grounded prompt includes only selected lever fields:

- id;
- title;
- summary;
- actor;
- horizon;
- mechanism;
- appliesWhen;
- evidence publisher/title/year.

It excludes URLs, source paths, unrelated levers, non-verified records, the full library, and
impact estimates.

## Response Validator Integration

When no verified lever exists, recommendation language remains blocked.

When verified `leverIds` exist, the validator permits only recommendation phrasing anchored
in the supplied bounded lever content. It rejects unrelated recommendations, new actors where
detectable, guaranteed-outcome claims, invented evidence, new numeric targets, and URLs.

## Current Evidence Gaps

The repo does not currently contain the 55 verified lever records described in the
authoritative chatbot plan. Stage 5A therefore ships an empty production runtime library and
test fixtures only. Real lever records should be added later through the two-step research
and adversarial verification workflow described in the plan.

## No Impact Estimation

Levers are interventions, not simulator outputs. Stage 5A does not estimate score changes,
calculate expected impact, or implement the Impact Simulator.
