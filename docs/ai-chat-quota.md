# AI Chat Quota Contract

Stage 8D adds runtime model-call quota enforcement for the AI chatbot Edge Function. It serves ABCDE `A` by protecting the AI runtime, `D` by using the Stage 8B quota ledger contract, and `E` by keeping identity, limits, and logs privacy-bounded.

Stage 8D was repository-verified before live deployment. Stage 8H-2A later applied the Stage 8B database contracts to the live `borneo-news` Supabase project and found production blockers in the quota database layer. Stage 8H-2A-F fixes those blockers with forward migrations `20260804000200_ai_chat_quota_production_fixes.sql` and `20260804000300_ai_chat_quota_rpc_conflict_target_fix.sql`; the original applied Stage 8B migration remains immutable history.

## Scope

Implemented:

- server-side quota service boundary in `supabase/functions/ai-chat/quota.ts`
- default daily model-call limits:
  - anonymous: 5
  - authenticated: 25
  - admin: 50
- Supabase REST RPC adapter for:
  - `reserve_ai_chat_quota`
  - `refund_ai_chat_quota`
- reservation immediately before Gemini calls
- refund after provider failure or response validation rejection
- deterministic zero-quota responses for blocked, clarification, news, and out-of-scope paths
- optional public quota metadata on successful Gemini responses: `{ remaining, limit }`

Not implemented:

- live Supabase deployment or migration execution
- telemetry persistence
- Turnstile
- IP HMAC or anonymous/IP guard quota identity
- Supabase anonymous sign-in
- live Supabase news repository
- billing, payment, or per-plan quota tiers

## Model-Call Boundary

Quota is checked only after deterministic routing, retrieval, and structured answer construction prove a Gemini call is needed.

Quota-consuming paths:

- `SITE_KNOWLEDGE` with `FOUND` or `LANGUAGE_FALLBACK`, after verified knowledge retrieval and prompt construction
- `DASHBOARD_DATA` with a grounded prompt, after fact object, comparability, structured answer, and lever retrieval

Zero-quota paths:

- invalid request or auth rejection
- CORS preflight and non-POST rejection
- `SITE_KNOWLEDGE` `NO_MATCH` or `AMBIGUOUS`
- deterministic dashboard blocked or clarification fallback
- deterministic `BORNEO_NEWS` response from published local news metadata
- deterministic `OUT_OF_SCOPE` refusal
- template fallback built before any provider call

## Reservation and Refund

The handler calls `reserveForModelCall(identity)` immediately before `geminiClient(...)`.

If reservation succeeds:

- Gemini is called once
- successful validated Gemini output consumes the reservation
- public response may include `quota: { remaining, limit }`

The handler calls `refundReservation(reservation)` when a reservation exists and:

- Gemini times out
- Gemini returns 429, 5xx, malformed JSON, empty text, or another provider/network failure
- local Gemini configuration fails after reservation
- response validation rejects the Gemini answer

Refund failures are logged as safe metadata and do not trigger a retry or expose quota internals.

## Anonymous Strategy

Stage 8C anonymous identity is unverified and has no stable trusted key. Stage 8D therefore does not write anonymous quota rows.

Current behavior:

- anonymous deterministic zero-quota paths still work
- anonymous model-call paths fail closed into deterministic fallback where a verified fallback exists
- direct anonymous Gemini usage remains deferred until Supabase anonymous auth, Turnstile, and/or daily IP HMAC design is implemented

The default anonymous target limit remains documented as 5 calls/day so the database and later runtime configuration stay aligned.

## Identity Keys

For authenticated/admin users, Stage 8D derives a server-side stable key from the verified identity:

```txt
authenticated:<verified-user-id>
admin:<verified-user-id>
```

The key is passed only from server code to the service-role quota RPC. It is not returned to the browser and is not logged. A later production hardening stage may replace this with a hashed/HMAC form before RPC execution without changing the public response contract.

The live database validates opaque identity keys with explicit length checks plus a separate character-set check:

```sql
char_length(identity_key_hash) between 16 and 256
identity_key_hash ~ '^[A-Za-z0-9:_-]+$'
```

This replaced the original PostgreSQL regex interval pattern `^[A-Za-z0-9:_-]{16,256}$`, which failed at runtime in Stage 8H-2A with `invalid repetition count(s)`. The validation intent is unchanged: too-short, too-long, null, and malformed identity keys are rejected, while valid opaque keys are accepted.

## Limits

The committed fallback defaults are:

```json
{
  "anonymous": 5,
  "authenticated": 25,
  "admin": 50
}
```

The service can read `AI_CHAT_DAILY_LIMITS_JSON` from server environment for offline/runtime overrides. Stage 8B also seeded `AI_CHAT_DAILY_LIMITS` in `public.ai_chat_config`; reading that table as the authoritative live config remains pending until a live Supabase integration stage.

The browser never supplies authoritative limits.

## RPC Privileges

Quota reservation and refund are trusted-server operations only. The browser calls the Edge Function; the Edge Function uses the Supabase service-role credential to call:

- `reserve_ai_chat_quota(date, text, text, integer)`
- `refund_ai_chat_quota(date, text, text)`

Because PostgreSQL grants function EXECUTE to `PUBLIC` by default, the live production fix explicitly revokes effective EXECUTE from `PUBLIC`, `anon`, and `authenticated`, then grants EXECUTE back only to `service_role`. This is separate from table privileges and RLS: table RLS protects rows, while function EXECUTE controls whether browser roles can invoke the `SECURITY DEFINER` quota functions at all.

Live validation also confirmed the reserve RPC should target the primary-key constraint by name:

```sql
on conflict on constraint ai_chat_daily_usage_pkey do update
```

This avoids PL/pgSQL ambiguity between returned column names and the quota table's primary-key columns while preserving the same atomic upsert semantics.

## Public Response

Successful validated Gemini responses may include:

```json
{
  "quota": {
    "remaining": 24,
    "limit": 25
  }
}
```

Responses never expose:

- identity key
- user ID
- role details
- table counters
- reserved/used counts
- service-role errors
- reset timestamp

Quota fallback responses may omit quota metadata when it cannot be safely known.

## Safe Logs

Logs may include:

- quota status
- identity type
- remaining and limit
- unavailable reason code
- refund status

Logs must not include:

- identity key
- user ID
- JWT or access token
- service-role key
- raw Supabase error body
- user message
- Gemini prompt or answer

## Verification

Repository tests cover:

- default daily limits
- successful reservation
- exhaustion
- refund after failure/rejection
- anonymous deferral
- missing Supabase service credentials
- Supabase REST RPC shape
- handler behavior for quota reservation, model calls, refunds, and zero-quota news/out-of-scope paths
- production-fix SQL preserving function signatures, `SECURITY DEFINER`, `search_path`, service-role-only EXECUTE, explicit identity length bounds, malformed identity rejection, and non-negative refund behavior

Execution-level SQL validation against Postgres/Supabase is performed during Stage 8H live rollout steps before the Edge Function is deployed.
