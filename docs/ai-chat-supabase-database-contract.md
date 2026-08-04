# AI Chat Supabase Database Contract

Stage 8B adds repository-only database contracts for later AI chatbot identity, quota, telemetry, and deployment work. It serves ABCDE `A` by preparing the AI runtime, `D` by making usage/accounting durable, and `E` by keeping provenance, privacy, and security explicit.

## Migration Strategy

Existing baseline SQL remains in place:

- `supabase/auth_schema.sql` is the existing auth/profile baseline: `profiles`, `current_user_role()`, signup trigger, profile RLS, and profile column privileges.
- `supabase/schema.sql` is the existing news baseline: `news_items` and its RLS.
- New chatbot infrastructure starts forward versioned history under `supabase/migrations/`.

Future deployments must apply the baseline files in their documented order, then all migrations. Do not manually paste only `schema.sql` and skip migrations.

Stage 8B is offline-only. Stage 8D now includes repository-level runtime quota enforcement code, and Stage 8E now includes repository-level telemetry persistence code. No live Supabase project was linked, pushed, queried, migrated, or modified.

## `public.ai_chat_config`

Server-controlled non-secret runtime configuration.

Columns:

- `key text primary key`
- `value_json jsonb not null`
- `description text`
- `updated_at timestamptz not null default now()`
- `updated_by uuid null references auth.users(id)`

Seeded rows are non-secret product defaults:

- `AI_CHAT_ENABLED = true`
- `AI_CHAT_DAILY_LIMITS = {"anonymous":5,"authenticated":25,"admin":50}`
- `AI_CHAT_TELEMETRY_RETENTION_DAYS = 90`

Bootstrap rows belong in the migration because they are required non-secret defaults. Secrets do not belong here.

## Config vs Secrets

Never store these in SQL rows, telemetry, migrations, or frontend code:

- Gemini API key
- Turnstile secret
- Supabase service-role key
- HMAC salt
- endpoint secret
- Authorization header

Those stay as server-side environment or platform secret values.

## Quota Storage

`public.ai_chat_daily_usage` is the durable daily quota ledger.

Columns:

- `usage_date date not null`
- `identity_type text not null`
- `identity_key_hash text not null`
- `daily_limit integer not null`
- `model_calls_reserved integer not null default 0`
- `model_calls_used integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Primary key:

- `(usage_date, identity_type, identity_key_hash)`

Identity types:

- `anonymous`
- `authenticated`
- `admin`
- `ip_guard`

The table stores only opaque identifiers. It does not store raw IP addresses, raw user questions, answer text, message text, prompts, provider payloads, or API keys.

## Quota RPC Contract

`reserve_ai_chat_quota(p_usage_date date, p_identity_type text, p_identity_key_hash text, p_daily_limit integer)`

Returns:

- `allowed boolean`
- `usage_date date`
- `identity_type text`
- `identity_key_hash text`
- `daily_limit integer`
- `model_calls_reserved integer`
- `model_calls_used integer`
- `remaining integer`

Behavior:

- validates date, identity type, opaque identity key, and trusted daily limit
- atomically inserts or increments `model_calls_reserved`
- refuses once `model_calls_reserved + model_calls_used >= daily_limit`
- returns bounded counts and remaining quota

`refund_ai_chat_quota(p_usage_date date, p_identity_type text, p_identity_key_hash text)`

Returns the same shape with `refunded boolean` instead of `allowed`.

Behavior:

- decrements `model_calls_reserved` only when it is above zero
- cannot reduce reserved or used counts below zero
- repeated invalid refunds return `refunded=false` and do not corrupt counts

The RPC receives a resolved daily limit from future trusted Edge Function code. The frontend must never supply the authoritative limit. Stage 8C/8D must resolve session role and config before calling this RPC.

## Quota Limits

The authoritative non-secret target limits live in `AI_CHAT_DAILY_LIMITS`:

- anonymous: 5 model calls/day
- authenticated: 25 model calls/day
- admin: 50 model calls/day

The SQL functions accept `p_daily_limit` so they stay decoupled from Stage 8C auth parsing, but only trusted server code may execute them. Stage 8D should read the config server-side and pass the resolved limit.

## Telemetry Schema

`public.ai_chat_events` is metadata-only telemetry.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `request_id text`
- `identity_type text not null`
- `identity_key_hash text`
- `intent text`
- `mode text`
- `outcome text not null`
- `fallback_used boolean not null default false`
- `fallback_reason text`
- `error_code text`
- `model_called boolean not null default false`
- `quota_consumed boolean not null default false`
- `response_status integer`
- `latency_ms integer`
- `source_count integer`
- `language text`
- `region text`
- `current_page text`

Never add raw full user question, answer, Gemini raw response, system prompt, grounding payload, API keys, Authorization headers, source paths, pending news content, or raw IP address.

## Retention Readiness

No cron or cleanup job is installed in Stage 8B. Retention should be owned by the future Supabase deployment/operations path. A 90-day metadata retention default is recorded in `AI_CHAT_TELEMETRY_RETENTION_DAYS`.

Fields suitable for retention are bounded metadata fields such as intent, outcome, latency, model-called flag, quota-consumed flag, language, region, current page, and source count. Raw content is intentionally excluded so retention does not become a content privacy problem.

## Indexes

Quota:

- primary key on `(usage_date, identity_type, identity_key_hash)`
- `ai_chat_daily_usage_identity_idx`
- `ai_chat_daily_usage_date_idx`

Telemetry:

- `ai_chat_events_created_at_idx`
- `ai_chat_events_request_id_idx`
- `ai_chat_events_identity_idx`
- `ai_chat_events_outcome_idx`
- `ai_chat_events_intent_idx`

## RLS and Security

RLS is enabled on all new tables.

Public browser clients cannot directly mutate chatbot config, quota, or telemetry:

- no anon/authenticated insert/update/delete policies are created
- direct mutation privileges are revoked from `anon` and `authenticated`
- quota RPC execute is revoked from `public` and granted only to `service_role`

Admin read access is allowed through current conventions:

- authenticated users can select rows only when `public.current_user_role() = 'admin'`

Security-definer functions:

- use explicit `set search_path to 'public'`
- fully qualify `public.ai_chat_daily_usage`
- validate all inputs
- do not accept service keys, secrets, raw IPs, or frontend-provided roles

## Identity Boundary

Stage 8B does not implement auth parsing. Future Stage 8C must resolve:

- whether the caller is anonymous, authenticated, admin, or IP guard
- the opaque identity key
- the server-trusted daily limit
- whether deterministic refusals or template fallbacks avoid quota entirely

Authenticated users may later use a UUID-derived opaque key. Anonymous and IP guard identities must use opaque hashed keys.

## IP Privacy Boundary

No raw IP is persisted.

Future Edge Function code should:

- normalize IPv6 to `/64`
- compute a daily salted HMAC server-side
- keep the HMAC secret server-side
- pass only the opaque daily hash to the quota RPC

The database does not parse IP addresses and does not store unsalted stable IP hashes.

## Expected Later Usage

Stage 8C:

- add auth/session parsing
- decide anonymous vs authenticated vs admin identity
- keep `verify_jwt` decisions explicit

Stage 8D implemented in repository code:

- use committed default daily limits server-side, with environment override support
- reserve before Gemini
- refund when the provider call fails or the generated answer is rejected by validation
- ensure refusals and deterministic template fallback consume zero quota
- keep anonymous quota deferred until a trusted anonymous/IP guard identity exists

See `docs/ai-chat-quota.md` for the runtime quota contract.

Stage 8E:

- insert one metadata-only `ai_chat_events` row per handled request through a telemetry abstraction
- keep raw prompts/questions/answers out of telemetry
- record final `model_called` and `quota_consumed` state best-effort
- preserve the existing `outcome` vocabulary: `success`, `fallback`, `refused`, `rate_limited`, `error`
- keep telemetry failure isolated from chatbot responses and quota behavior

See `docs/ai-chat-telemetry.md` for the runtime telemetry contract.

Live news is unchanged. Stage 8B does not modify `news_items` and does not implement a Supabase news repository.

## Offline Limitation

Static repository tests validate the migration contract. Execution-level SQL validation against Postgres/Supabase remains pending until a local or live Supabase database is intentionally used in a later stage.
