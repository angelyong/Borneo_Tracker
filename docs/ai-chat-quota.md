# AI Chat Quota Contract

Stage 8D adds runtime model-call quota enforcement for the AI chatbot Edge Function. It serves ABCDE `A` by protecting the AI runtime, `D` by using the Stage 8B quota ledger contract, and `E` by keeping identity, limits, and logs privacy-bounded.

Stage 8D is repository-verified only. No live Supabase project was linked, pushed, migrated, or queried.

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

Execution-level SQL validation against Postgres/Supabase remains pending.
