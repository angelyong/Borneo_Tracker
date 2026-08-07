# AI Chat Response Validator

Stage 4E treats every Gemini-generated `DASHBOARD_DATA` answer as untrusted output.
The grounded prompt from Stage 4D limits what Gemini is asked to do, but the prompt is
not a security boundary. The handler now validates Gemini prose before returning it.

## Pipeline

For `DASHBOARD_DATA` requests the edge function:

1. validates the request;
2. routes intent;
3. resolves entities;
4. evaluates comparability;
5. builds the deterministic Fact Object;
6. builds the deterministic Structured Answer;
7. returns deterministic template output directly for blocked or clarification states;
8. otherwise builds the grounded prompt;
9. calls Gemini once;
10. validates Gemini output;
11. returns validated Gemini phrasing, or Stage 4C template fallback on rejection.

Unsupported intents keep the existing connection-test behavior and are not passed through
the dashboard response validator.

## Numeric And Year Rules

The validator extracts numeric tokens from Gemini prose and accepts only tokens present in
the deterministic allow lists from the Fact Object, Structured Answer, or grounded prompt.
Four-digit years are validated separately against approved year tokens.

The validator rejects invented numbers, re-rounded values, calculated differences,
new percentages, numbered-list markers, HTTP status numbers, internal IDs, invented source
years, current-year insertions, and unapproved year ranges.

## URL And Source Rules

Gemini must not place URLs, markdown links, bare domains, encoded URLs, source files, or
internal source paths in the answer body. Public sources come only from deterministic
`structuredAnswer.sources`.

Source claims are checked conservatively against the bounded source labels supplied in the
grounded prompt. Gemini may omit source mentions. It may not cite Gemini, external studies,
invented publishers, invented report titles, or unsupported citation markers.

## Comparability Enforcement

Rejected and clarification states bypass Gemini completely. The response uses
`template-fallback` with `DETERMINISTIC_BLOCKED` or `DETERMINISTIC_CLARIFICATION`.

For downgraded states, Gemini may only phrase allowed descriptive facts. Ranking, trend,
comparison, target-gap, and progress-to-target claims are rejected when the comparability
gate did not allow them.

For warning states, important disclosures must remain present. If phrase-based validation
cannot confirm preservation, the system falls back deterministically.

## Recommendations And Levers

Stage 5 lever retrieval is not implemented. When the structured answer has no verified
lever IDs, the validator rejects recommendation language in English or Malay. The
deterministic unavailable-lever statement remains allowed.

## Secret And Internal Metadata Detection

The validator rejects answers that appear to disclose API keys, environment variables,
authorization headers, Supabase service-role keys, system or developer instructions,
chain-of-thought content, raw grounding payloads, Fact Object JSON, approved token allow
lists, source paths, environment configuration, or stack traces.

## Fallback On Rejection

If Gemini returns invalid text, the handler logs only safe validation metadata: issue codes,
issue count, numeric/year/url counts, intent, fallback state, blocked flag, and clarification
flag. It does not log the rejected answer, prompt, user question, API key, source URLs, or raw
Gemini response.

The public response remains compatible:

```json
{
  "answer": "string",
  "mode": "template-fallback",
  "sources": [],
  "fallback": {
    "used": true,
    "reason": "GEMINI_RESPONSE_REJECTED",
    "degraded": true
  }
}
```

No second Gemini call is made. Invalid Gemini output is not repaired.

## Limitations

The validator is deterministic and phrase-based. It does not attempt full semantic
understanding and does not use another model as a judge. This is intentional: uncertain
cases should fall back to the deterministic template rather than accept risky prose.

Later retrieval stages can widen the allowed facts and lever IDs, but they should feed new
deterministic allow lists into this validator instead of trusting generated text directly.
