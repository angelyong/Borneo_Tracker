# AI Chat Grounded Prompt

Stage 4D adds a deterministic Prompt Builder for `DASHBOARD_DATA` requests. Gemini may phrase a verified dashboard answer, but it is not trusted to calculate, retrieve, rank, compare, invent facts, invent sources, or decide whether an answer is allowed.

## Gemini Role

Gemini receives a strict system instruction and a bounded user-content payload. Its role is limited to rewriting verified content into concise plain text.

It must:

- use only the supplied grounding payload
- preserve all supplied facts and limitations
- write in the resolved language
- avoid new numbers, years, URLs, sources, advice, causal claims, rankings, or comparisons
- respect blocked, clarification, downgraded, partial, and unavailable states

Stage 4D does not make Gemini output trusted. Stage 4E remains responsible for response validation.

## Prompt Builder Inputs

`buildGroundedPrompt()` accepts:

- validated user question
- resolved language
- routed intent
- resolved entities
- `ComparabilityResult`
- `AIChatFactObject`
- `AIChatStructuredAnswer`

It does not read Supabase, environment variables, live APIs, repository JSON files, logs, user identity, or hidden configuration.

## Trusted And Untrusted Content

The user question is untrusted. It is placed in a dedicated `untrustedUserQuestion` field inside structured user content.

Trusted grounding comes from the repository-side deterministic pipeline:

- intent routing
- entity resolution
- comparability decision
- Fact Object
- Structured Answer
- source metadata already carried by the Structured Answer

Prompt-injection text inside the user question must not become instructions.

## Grounding Payload

The grounding payload contains only phrasing material:

- answer status
- blocked state
- clarification state
- conclusion text
- diagnosis text
- gap text
- impact text
- recommended-action layer text
- honesty or limitations text
- required disclosures
- warnings
- approved numeric tokens
- approved year tokens
- bounded source labels

The payload is built from `AIChatStructuredAnswer`, not rebuilt from raw dashboard data.

## Numeric And Year Restrictions

The prompt includes exact allow lists:

- `approvedNumericTokens`
- `approvedYearTokens`

Gemini is instructed not to use any other number or year, not to round differently, not to transform an approved value into a new value, and not to use numbered lists.

The Prompt Builder does not generate extra numeric variants.

## Source Restrictions

Prompt source labels may include:

- publisher
- title
- year

The prompt excludes:

- source URLs
- `sourceFile`
- `sourcePath`
- JSON paths
- internal record identifiers

Public `sources` continue to be produced by deterministic code, never parsed from Gemini prose.

## Language Behavior

Supported prompt languages:

- English: `Write the final response in English.`
- Malay: `Tulis jawapan akhir dalam Bahasa Melayu.`

Unsupported language values fall back to English through the Structured Answer behavior and retain the existing language fallback warning.

## Blocked And Clarification Behavior

Stage 4D passes blocked and clarification states to Gemini in the grounding payload and system instruction.

For blocked answers, Gemini must explain the limitation and must not attempt the blocked comparison, ranking, trend, or other unsafe operation.

For clarification answers, Gemini must ask only for the missing detail and must not guess.

If Gemini fails, Stage 4C deterministic template fallback returns the safe structured message.

## Lever And Advice Restrictions

Stage 5 lever retrieval is not implemented. The prompt therefore preserves the unavailable lever layer and explicitly forbids free-form policy advice.

Gemini must not fill the missing recommendation layer from general knowledge.

## Fallback Interaction

Handler flow for dashboard data:

- validate request
- route intent
- resolve entities
- evaluate comparability
- build Fact Object
- build Structured Answer
- build Grounded Prompt
- call Gemini with the grounded prompt
- return Gemini phrasing if it succeeds
- return Stage 4C template fallback if Gemini fails safely

Other intents retain the Stage 1A connection-test prompt until static knowledge or news retrieval exists.

## Remaining For Stage 4E

Stage 4D constrains Gemini input, but does not validate Gemini output.

Stage 4E must still check:

- final answer numeric tokens
- final answer year tokens
- absence of URLs in prose
- no leaked prompt/system/internal terms
- no invented sources
- blocked and clarification compliance
