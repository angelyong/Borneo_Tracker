# AI Chat Telemetry Contract

Stage 8E adds best-effort runtime telemetry persistence for the Borneo Tracker AI chatbot. It supports ABCDE `A` by making the AI runtime observable, `D` by recording bounded event metadata, and `E` by excluding raw conversation content and sensitive identity data.

Stage 8E is repository-verified only. No live Supabase project was linked, migrated, queried, or deployed.

## Service Boundary

Runtime code uses `AIChatTelemetryService.record(event)` from `supabase/functions/ai-chat/telemetry.ts`.

The handler depends on the service abstraction. It does not insert telemetry rows directly.

Adapters:

- `SupabaseTelemetryAdapter`: server-only REST insert into `public.ai_chat_events`
- `MemoryTelemetryAdapter`: focused tests
- `FailingTelemetryAdapter`: failure-isolation tests

If the production adapter is absent or fails, telemetry is skipped or logged safely. Chat behavior is preserved.

## Event Schema

Stage 8E writes only fields already supported by the Stage 8B schema:

- `request_id`
- `identity_type`
- `identity_key_hash`
- `intent`
- `mode`
- `outcome`
- `fallback_used`
- `fallback_reason`
- `error_code`
- `model_called`
- `quota_consumed`
- `response_status`
- `latency_ms`
- `source_count`
- `language`
- `region`
- `current_page`

`id` and `created_at` remain database-generated.

Stage 8E does not populate `identity_key_hash`; authenticated/admin telemetry remains privacy-minimal at `identity_type` only.

## Outcome Vocabulary

The database outcome vocabulary is unchanged:

- `success`
- `fallback`
- `refused`
- `rate_limited`
- `error`

Detailed states are represented by bounded `fallback_reason` and `error_code` values, not new outcome values.

Examples:

- blocked comparison: `outcome=fallback`, `fallback_reason=DETERMINISTIC_BLOCKED`
- clarification: `outcome=fallback`, `fallback_reason=DETERMINISTIC_CLARIFICATION`
- knowledge no-match: `outcome=fallback`, `fallback_reason=KNOWLEDGE_NO_MATCH`
- out-of-scope: `outcome=refused`, `fallback_reason=DETERMINISTIC_BLOCKED`
- quota exhausted: `outcome=rate_limited`, `fallback_reason=QUOTA_EXHAUSTED`
- auth rejection: `outcome=refused`, `error_code=AI_CHAT_AUTH_MALFORMED`

## Request ID

Each non-OPTIONS handled request gets a server-generated bounded request ID.

Behavior:

- generated with `crypto.randomUUID()` when available
- not derived from user content, identity, token, or session data
- used for safe log/telemetry correlation
- not returned in public chatbot responses

OPTIONS/preflight does not record chatbot business telemetry.

## Event Lifecycle

The handler records at most one final telemetry event per completed chatbot request.

Lifecycle:

1. Generate request ID and start timer.
2. Resolve identity where possible.
3. Validate request and route intent.
4. Process deterministic, quota, Gemini, validation, fallback, or error path.
5. Finalize response state.
6. Record telemetry best-effort.
7. Return the already-selected response.

Helper and catch paths do not write duplicate events. All response paths use one finalizer.

## Success Events

Validated Gemini success records:

- `outcome=success`
- `mode=gemini-test`
- `model_called=true`
- `quota_consumed=true`
- final source count
- bounded language, region, current page
- response status and latency

Answer text is not stored.

## Fallback Events

Fallback events record safe reason codes only.

Examples:

- Gemini timeout: `model_called=true`, `quota_consumed=false`, `fallback_reason=GEMINI_TIMEOUT`
- Gemini 429: `model_called=true`, `quota_consumed=false`, `outcome=rate_limited`, `fallback_reason=GEMINI_RATE_LIMIT`
- Gemini 5xx: `model_called=true`, `quota_consumed=false`, `fallback_reason=GEMINI_UNAVAILABLE`
- validation rejection: `model_called=true`, `quota_consumed=false`, `fallback_reason=GEMINI_RESPONSE_REJECTED`
- quota exhausted before Gemini: `model_called=false`, `quota_consumed=false`, `outcome=rate_limited`, `fallback_reason=QUOTA_EXHAUSTED`

Refund policy follows Stage 8D. Telemetry reflects the final quota state after refund attempts.

## Zero-Model Events

Deterministic paths record:

- `model_called=false`
- `quota_consumed=false`

Covered paths:

- deterministic blocked comparison
- deterministic clarification
- site-knowledge no-match
- site-knowledge ambiguous
- deterministic published-news path
- out-of-scope refusal
- invalid request and auth rejection

Telemetry does not turn deterministic paths into quota usage.

## Error Events

Safe runtime errors record bounded metadata:

- `outcome=error` or `outcome=refused` for auth/method rejection
- `error_code`
- `response_status`
- `identity_type=unknown` before identity resolution, because the Stage 8B schema explicitly allows `unknown`

Raw error objects, stack traces, exception messages, and provider/Supabase error bodies are not persisted.

## Privacy Exclusions

Telemetry never stores:

- raw question
- answer text
- Gemini output
- raw Gemini response
- prompt
- grounding payload
- source URLs
- source files or paths
- pending news title/body
- email
- JWT
- Authorization header
- raw IP
- profile payload
- Gemini key
- Supabase service key
- stack trace

## Identity Privacy

Persisted identity is coarse:

- `anonymous`
- `authenticated`
- `admin`
- `unknown`

Stage 8E does not persist raw Supabase user IDs, emails, profile rows, JWT claims, or the Stage 8D quota identity key. `identity_key_hash` remains unused until a later privacy-reviewed identifier design exists.

## Context Normalization

`region` is persisted only when it matches a supported application region:

- `Sabah`
- `Sarawak`
- `Brunei`
- `Kalimantan`
- `Borneo-wide`

`current_page` is normalized to an internal route:

- query strings are stripped
- hash fragments are stripped
- external URLs are omitted
- unsafe or overly long paths are omitted

## Failure Isolation

Telemetry is observability only.

Telemetry failure must not:

- change the selected chatbot response
- trigger a second Gemini call
- alter quota reservation or refund
- expose database details
- convert success or fallback into HTTP 500

The safe log code is `TELEMETRY_WRITE_FAILED`.

## Retention

Stage 8B defines `AI_CHAT_TELEMETRY_RETENTION_DAYS = 90`.

Stage 8E does not implement:

- cron
- scheduled cleanup
- database scheduler
- external retention job

Retention remains production operations work after live Supabase deployment.

## Production Limitation

The Supabase adapter is production-capable but not live-verified in Stage 8E. It requires:

- Stage 8B migration applied
- Supabase URL configured server-side
- service-role key configured server-side
- Edge Function deployment
- live insert/RLS verification

No browser Supabase client is used for telemetry writes.
