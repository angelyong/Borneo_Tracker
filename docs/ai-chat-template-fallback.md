# AI Chat Template Fallback

Stage 4C adds a deterministic fallback for dashboard-data answers when Gemini cannot provide a valid response.

## When Fallback Is Used

Fallback is allowed only after the request has passed validation, intent routing, entity resolution, comparability evaluation, Fact Object building, and Structured Answer building.

The fallback uses `AIChatStructuredAnswer.summaryText` as the body. It does not rebuild facts, retrieve new data, call Supabase, call Gemini, or parse arbitrary model text.

Supported Gemini failure reasons:

| Existing error | Fallback reason |
|---|---|
| `GEMINI_TIMEOUT` | `GEMINI_TIMEOUT` |
| `GEMINI_RATE_LIMITED` | `GEMINI_RATE_LIMIT` |
| `GEMINI_HTTP_500`, `GEMINI_HTTP_502`, `GEMINI_HTTP_503`, `GEMINI_HTTP_504` | `GEMINI_UNAVAILABLE` |
| Other `GEMINI_HTTP_*` | `GEMINI_HTTP_ERROR` |
| `MALFORMED_GEMINI_RESPONSE` | `GEMINI_MALFORMED_RESPONSE` |
| `EMPTY_GEMINI_RESPONSE` | `GEMINI_EMPTY_RESPONSE` |
| `MISSING_GEMINI_API_KEY` | `GEMINI_NOT_CONFIGURED` |
| `GEMINI_REQUEST_FAILED` | `GEMINI_UNAVAILABLE` |

`INVALID_AI_CHAT_CONFIG` is not treated as fallback-safe because it indicates invalid runtime configuration rather than temporary provider unavailability.

## Supported Intents

Only `DASHBOARD_DATA` is supported in Stage 4C.

This includes deterministic structured answers whose availability is:

- `AVAILABLE`
- `PARTIAL`
- `UNAVAILABLE`
- `BLOCKED`

Clarification states are also returned through fallback when the Structured Answer marks `clarificationRequired: true`.

## Unsupported Intents

Fallback is not used for:

- `SITE_KNOWLEDGE`
- `BORNEO_NEWS`
- `OUT_OF_SCOPE`

Those paths do not yet have safe retrieval-backed Structured Answers. Gemini failures for those intents remain safe error responses.

## HTTP Behavior

A successful fallback response uses HTTP success status and this shape:

```json
{
  "answer": "Live AI phrasing is temporarily unavailable...",
  "mode": "template-fallback",
  "sources": [],
  "fallback": {
    "used": true,
    "reason": "GEMINI_TIMEOUT",
    "degraded": true
  }
}
```

Request errors remain errors:

- malformed JSON
- missing or invalid message
- blank message
- too-long message
- unsupported method

Unexpected programming errors remain safe server errors and are not masked by fallback.

## Source Handling

Fallback sources come only from `structuredAnswer.sources`.

Rules:

- no invented sources
- no Gemini source
- duplicate source records removed
- source metadata preserved
- source URLs stay in `sources`, never in `answer`

## Numeric Integrity

The fallback notice contains no numeric tokens. The final fallback answer is checked with the Stage 4B numeric guard:

- every numeric token must be present in `approvedNumericTokens` or `approvedYearTokens`
- URLs are rejected from answer prose
- fallback wording does not include retry durations, HTTP status codes, dates, or numbered headings

## English And Malay Notices

English:

`Live AI phrasing is temporarily unavailable. The verified Borneo Tracker data is shown below.`

Malay:

`Penyusunan jawapan AI secara langsung tidak tersedia buat sementara waktu. Data Borneo Tracker yang telah disahkan ditunjukkan di bawah.`

The Structured Answer language decides which notice is used, with request language as a secondary hint.

## Frontend Compatibility

The response still has `answer` as a string and `sources` as an array. Existing frontend code treats successful responses generically and stores `mode` passively, so `template-fallback` is accepted without a Stage 7 rendering change.

## Relationship To Later Stages

Stage 4C does not implement the Prompt Builder, Response Validator, static knowledge retrieval, lever retrieval, news retrieval, quota logic, Supabase live access, or frontend structured rendering.

Later Stage 4D may decide how deterministic facts are sent to Gemini for phrasing. Stage 4E may validate final Gemini responses. Stage 4C only ensures a safe deterministic dashboard answer is available when Gemini fails.
