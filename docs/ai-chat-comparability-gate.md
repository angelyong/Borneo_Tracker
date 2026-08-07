# AI Chat Comparability Gate

Stage 3C adds a deterministic answerability and comparability check for dashboard-data questions. It advances the Data and Ethics layers of ABCDE: the bot can ask Gemini for prose only after code has decided whether a comparison, trend, ranking, SDG-progress statement, or district answer is meaningful.

## Runtime Position

The Edge Function flow remains:

1. Validate request.
2. Route intent with `intentRouter.ts`.
3. Resolve entities with `entityResolver.ts`.
4. Evaluate comparability with `comparabilityGate.ts`.
5. Log safe summary metadata.
6. Continue through the existing Stage 1A Gemini test path.

The public response contract is unchanged:

```json
{
  "answer": "string",
  "mode": "gemini-test",
  "sources": []
}
```

Intent, entities, and comparability are internal only until Stage 4.

## Decision Meanings

| decision | meaning |
|---|---|
| `ALLOW` | The requested operation is meaningful on the available basis. |
| `ALLOW_WITH_WARNING` | The operation can proceed only with explicit caveats or freshness/derived-data disclosures. |
| `DOWNGRADE` | The exact numeric/ranking/progress operation is unsafe, but a descriptive answer remains possible. |
| `REJECT` | The requested operation would create a misleading numeric claim and must not be answered as asked. |
| `NEEDS_CLARIFICATION` | The user must choose an exact district, indicator, concept, or comparison basis before a safe answer exists. |

## Result Contract

```ts
type ComparabilityResult = {
  decision: ComparabilityDecision;
  reasons: string[];
  warnings: string[];
  blockedOperations: string[];
  allowedOperations: string[];
  requiredDisclosures: string[];
  normalizedComparisonBasis?: string;
};
```

## Stage 3B Input

`evaluateComparability()` consumes the Stage 3B `AIChatEntityResult`. It reads:

- `concepts`
- `indicators`
- `regions` / `territories`
- `districts`
- `years`
- `yearRange`
- `operations`
- `ambiguities`

The gate must not reimplement request-level entity inference. If a future resolver adds aliases or entity fields, the gate should consume the resolver output rather than adding parallel regex routing.

## Concept Rule Registry

| concept | cross-territory rule |
|---|---|
| `air_quality` | Block territory-wide comparisons; current values are city-level AQI snapshots. |
| `clean_water_access` | Allow only same indicator/unit/denominator percentage basis. |
| `deforestation` | Allow same annual tree-cover-loss basis; warn if headline cumulative values differ from series measure. |
| `economy` | Block mixed growth-rate, absolute GDP, and currency comparisons. |
| `education` | Block incompatible literacy/enrolment/mean-schooling and duplicated/inherited estimates. |
| `energy` | Block unless exact access/electrification definition, unit, and denominator match. |
| `entertainment` | Block mixed visitor-arrival vs resident-trip definitions unless same tourism-flow basis exists. |
| `fire_hotspots` | Allow only area-normalized comparison, e.g. per 1,000 km2. |
| `food` / `food_percapita` | Allow per-capita paddy-production basis with derived-value disclosure. |
| `forest_cover` | Block Brunei percent-land vs other territories' 2000 hectare baseline. |
| `governance` | Block subnational comparison/ranking because WGI values are inherited national values. |
| `healthcare` | Allow same health indicator and unit. |
| `heritage` | Allow UNESCO count as a status indicator, not progress. |
| `internet_use` | Allow with age-denominator disclosure when no ranking claim is made. |
| `poverty` | Block cross-territory denominator mismatch; split trends around the 2019 PLI methodology break. |
| `protected_areas` | Allow only percentage-of-land basis; count comparison is unsafe. |
| `shelter` | Block mixed sanitation/clean-water percentages vs household counts. |
| `unemployment_rate` | Allow with source-year/source-method caveats. |

## Rule Families

Comparison and ranking:
- Different indicator definitions, units, denominators, inherited national values, missing normalization, incomplete source metadata, or materially different years block or downgrade comparisons and rankings.
- Count-based `fire_hotspots`, `protected_areas`, and tourism/entertainment questions require an explicit normalized basis before comparison.
- Kalimantan regional aggregates require a derived-data disclosure when metadata marks them as derived or aggregated from provinces.

Trend:
- Trends require a real ordered series for the same concept and compatible methodology.
- Concepts without series are rejected for trend claims.
- Poverty trends crossing the 2019 PLI methodology break are rejected unless split into separate periods.
- If headline rows and time-series rows use different measures, the result is allowed only with warning and method disclosure.

SDG:
- Repository metadata has SDG mappings but no target fields.
- Questions asking for SDG progress return `DOWNGRADE`.
- Only coverage or mapping explanations are safe before Stage 4.

District:
- District answers require an exact district match and the committed metadata freshness date.
- `districts.json` generated on `2026-07-10` is stale once it exceeds the configured threshold.
- Ambiguous district names return `NEEDS_CLARIFICATION`; unknown districts return `REJECT`.

## Examples

- Rejected: "Compare forest cover in Brunei and Sabah"; "Rank governance for Sabah and Sarawak"; "Compare Sabah shelter with Brunei shelter."
- Allowed with warning: "Compare fire hotspots per 1,000 km2"; "Compare internet use without ranking"; "Show Kalimantan aggregate internet use."
- Needs clarification: "Compare protected areas" when both count and percent bases are possible; "district Kota"; "compare shelter" with no exact indicator.
- Downgraded: "SDG progress for Sabah"; unsupported rankings where a descriptive explanation remains safe.
