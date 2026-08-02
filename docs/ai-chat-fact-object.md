# AI Chat Fact Object

Stage 4A adds a deterministic fact-building layer for `DASHBOARD_DATA` questions. It converts the routed intent, resolved entities, comparability decision, committed runtime data, and committed methodology metadata into an internal `AIChatFactObject`.

Gemini does not receive this object in Stage 4A and must not calculate, infer, rank, estimate, or invent numbers in later stages. All numerical claims intended for later answer stages must originate from this layer.

## Schema

The contract is defined in `supabase/functions/ai-chat/contracts.ts`.

- `availability`: `AVAILABLE`, `PARTIAL`, `UNAVAILABLE`, or `BLOCKED`.
- `intent`, `territories`, `concepts`, `indicators`, `pillars`, `districts`: the deterministic Stage 3 request context.
- `values`: grouped raw values, indicator scores, pillar scores, overall resilience, target, gap, trend points, and district values.
- `comparison`: whether comparison/ranking was requested, whether Stage 3C allowed it, and the comparison basis.
- `methodologyNotes`, `requiredDisclosures`, `warnings`: answer-safety metadata.
- `sources`: committed source provenance only.
- `approvedNumericTokens` and `approvedYearTokens`: allow-list tokens for later response validation.

## Data Source Hierarchy

Canonical runtime data comes from committed repository files:

1. `public/data/resilience.json`: resilience index, RAG band, strict index, weakest pillar, pillar scores, scored indicator detail, and the resilience calculation method.
2. `public/data/indicators.json`: dashboard indicator values, units, years, concept/pillar/ESG/SDG metadata, canonical flags, derived flags, source strings, and ordered time series.
3. `public/data/districts.json`: district facts and district freshness date.
4. `public/data/manifest.json` and `public/data/provenance.jsonl`: generated file hashes and generation metadata.
5. `compute_resilience.py`: committed target bounds and normalization logic mirrored by Stage 4A for target/gap facts.

There is no live Supabase dependency in Stage 4A.

## Availability States

- `AVAILABLE`: requested facts were found and are safe to use.
- `PARTIAL`: some safe facts exist, but the requested calculation, ranking, target, trend, or SDG progress detail is unavailable or downgraded.
- `UNAVAILABLE`: committed data does not contain the requested fact.
- `BLOCKED`: Stage 3C comparability or ambiguity rules prohibit the requested operation.

Expected missing data and malformed records return fact warnings instead of generic server errors.

## Deterministic Calculations

Calculation helpers live in `factCalculations.ts`.

- Minimum/maximum pillar: computed from committed pillar scores. Ties are sorted alphabetically and the first pillar is used as the primary diagnosis while all ties are disclosed.
- Compatible difference: only calculated when both values are numeric, units match, and indicator definitions match.
- Target gap: `target - current`, only when a committed target bound exists and units match.
- Trend facts: only built from ordered series in `indicators.json.series` with at least three valid points and Stage 3C permission.

Rounding policy: raw numeric values are retained separately; display values are formatted to one decimal place unless the source value is an integer. The code never calculates from formatted strings when a raw number exists.

## Source Provenance

Each source records `sourceFile` and `sourcePath`. Publisher, title, URL, and year are preserved only when they are present or safely parseable from committed metadata.

Rules:

- Do not invent publishers, URLs, publication years, targets, or source titles.
- URLs remain metadata, not answer prose.
- Source URL digits, file hashes, timestamps, internal IDs, and file paths are excluded from approved numeric tokens.

## Numeric Token Approval

The fact object produces two allow lists:

- `approvedNumericTokens`: formatted numeric values that may appear in later answers.
- `approvedYearTokens`: source/data years separated from other numeric values.

For percentages, both numeric and percentage forms are approved where relevant, for example `94.2`, `94.2%`, and `94.2`.

## Comparability Interaction

The builder consumes Stage 3C and does not bypass it.

- `REJECT`: returns `BLOCKED`.
- `NEEDS_CLARIFICATION`: returns `BLOCKED`.
- `DOWNGRADE`: returns `PARTIAL` and builds only descriptive safe facts.
- `ALLOW_WITH_WARNING`: builds facts and preserves warnings/disclosures.
- `ALLOW`: builds normally.

## Current Unsupported Facts

- No Borneo-wide aggregate numerical fact exists unless a committed runtime file explicitly contains it.
- SDG progress-to-target is unsupported because `indicators.json` has mappings but no target fields.
- Impact values, simulator results, lever retrieval, news retrieval, static knowledge retrieval, prompt construction, response validation, and fallback answer templates are later stages.
- Source metadata is often a single source string; structured publisher/title/url fields remain unavailable unless present in committed content.

