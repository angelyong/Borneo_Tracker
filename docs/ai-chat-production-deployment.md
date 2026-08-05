# AI Chat Production Deployment Preparation

Stage 8G prepares the repository and the future live-change plan only. Commands in this document are **NOT YET EXECUTED**. Do not run them until Stage 8H is explicitly started.

This work serves ABCDE `A`, `D`, and `E`: the AI assistant can move toward production, but the data, quota, telemetry, news, and identity claims remain bounded by what has actually been verified.

## Current Audit

- Supabase CLI config: `supabase/config.toml` contains `project_id = "borneo-tracker"` and `[functions.ai-chat] verify_jwt = false`.
- Migration history: one forward migration exists, `supabase/migrations/20260804000100_ai_chat_infrastructure_contracts.sql`.
- Baseline schema history: there is no historical migration chain before Stage 8B. The baseline is represented by `supabase/auth_schema.sql` and `supabase/schema.sql`.
- Baseline evidence: `auth_schema.sql` says `profiles`, `current_user_role()`, and `handle_new_user()` were exported from the live `borneo-news` project on 2026-07-28. `schema.sql` defines `news_items` and depends on `current_user_role()`.
- Stage 8B dependencies: Supabase Auth schema, `auth.users`, `public.current_user_role()`, `gen_random_uuid()`, `service_role`, and the existing public schema.
- Expected pre-existing production objects: `public.profiles`, `public.current_user_role()`, `public.handle_new_user()`, trigger `auth.users.on_auth_user_created`, and `public.news_items`.
- Function JWT setting: `verify_jwt = false` remains intentional because no-token anonymous requests must reach the function. The function verifies bearer tokens explicitly.
- Expected function URL shape: `https://<project-ref>.functions.supabase.co/ai-chat`.

## Database Baseline Strategy

Treat the database as two tracks:

- Existing production baseline objects: `auth_schema.sql` and `schema.sql`. Verify they already exist before applying Stage 8B. If missing, apply the baseline files in order only after explicit review.
- New Stage 8B chatbot objects: apply the timestamped migration after baseline verification.

Do not assume Supabase migration tooling can recreate the full production database from scratch. Do not create destructive alignment migrations. If production history is out of sync, prefer documenting the live state and applying a forward fix.

Baseline order, when explicitly approved:

```bash
# NOT YET EXECUTED
supabase db execute --file supabase/auth_schema.sql
supabase db execute --file supabase/schema.sql
```

## Stage 8B Migration Review

Static readiness of `20260804000100_ai_chat_infrastructure_contracts.sql`:

- Creates `public.set_updated_at()` with pinned `search_path`.
- Creates `public.ai_chat_config`, `public.ai_chat_daily_usage`, and `public.ai_chat_events`.
- References `auth.users(id)` from `ai_chat_config.updated_by`.
- Uses `public.current_user_role() = 'admin'` for read policies, so baseline auth must exist first.
- Enables RLS on all new tables.
- Revokes direct anon/authenticated mutation.
- Grants quota RPC execution only to `service_role`.
- Uses `SECURITY DEFINER` plus `set search_path to 'public'` for quota RPCs.
- Provides indexes for quota date/identity and telemetry created/request/identity/outcome/intent lookups.
- Is mostly idempotent for tables, indexes, triggers, policies, and function definitions; seeded config rows use `on conflict do nothing`.
- Rollback is non-trivial because telemetry/quota data may become operational records after launch.

Expected objects after migration:

- Tables: `public.ai_chat_config`, `public.ai_chat_daily_usage`, `public.ai_chat_events`.
- Functions: `public.set_updated_at()`, `public.reserve_ai_chat_quota(date,text,text,integer)`, `public.refund_ai_chat_quota(date,text,text)`.
- Triggers: `set_ai_chat_config_updated_at`, `set_ai_chat_daily_usage_updated_at`.
- Indexes: `ai_chat_daily_usage_identity_idx`, `ai_chat_daily_usage_date_idx`, `ai_chat_events_created_at_idx`, `ai_chat_events_request_id_idx`, `ai_chat_events_identity_idx`, `ai_chat_events_outcome_idx`, `ai_chat_events_intent_idx`.
- Policies: admin read policies for config, quota, and events.
- Seed rows: `AI_CHAT_ENABLED`, `AI_CHAT_DAILY_LIMITS`, `AI_CHAT_TELEMETRY_RETENTION_DAYS`.

## Required Environment

Edge Function required or production-critical:

- `AICHATBOTGEMINI_API_KEY`: preferred Gemini key for chatbot model calls.
- `GEMINI_API_KEY`: accepted fallback by current code; avoid sharing with the news digest in production.
- `GEMINI_MODEL`: optional override, default `gemini-3.6-flash`.
- `AI_CHAT_TIMEOUT_MS`: optional timeout, default `30000`, maximum `120000`.
- `AI_CHAT_CORS_ORIGINS`: comma-separated allowed browser origins.
- `AI_CHAT_NEWS_REPOSITORY=live`: production value; `supabase` is also accepted by code.
- `AI_CHAT_DAILY_LIMITS_JSON`: optional runtime override for defaults.
- `SUPABASE_URL`: server-side project URL.
- `SUPABASE_ANON_KEY`: server-side anon key for `/auth/v1/user` verification and profile RLS reads. Current code also accepts `VITE_SUPABASE_ANON_KEY`, but server config should use `SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY`: preferred service credential for quota RPC, telemetry insert, and live news pending count.
- `SUPABASE_SERVICE_KEY`: existing accepted alias; current code accepts either this or `SUPABASE_SERVICE_ROLE_KEY`.

Optional or future:

- Turnstile secret: not implemented.
- IP HMAC salt: not implemented.
- Supabase anonymous auth configuration: not enabled.
- Anonymous IP guard quota: not production-ready.

Frontend deployment values:

- `VITE_AI_CHAT_ENDPOINT`: set only after the Edge Function is deployed, expected `https://<project-ref>.functions.supabase.co/ai-chat`.
- `VITE_AI_CHAT_TIMEOUT_MS`: optional frontend timeout, default `30000`.
- `VITE_SUPABASE_URL`: browser Supabase URL for auth/news.
- `VITE_SUPABASE_ANON_KEY`: browser anon key, RLS-gated.

Never put Gemini keys, service-role keys, Turnstile secrets, HMAC salts, or bearer tokens in `VITE_*`.

## Gemini Configuration

Current Edge Function source confirms:

- Default model: `gemini-3.6-flash`.
- Override env: `GEMINI_MODEL`.
- API key precedence: `AICHATBOTGEMINI_API_KEY`, then `GEMINI_API_KEY`.
- Timeout: `AI_CHAT_TIMEOUT_MS`, default `30000`, maximum `120000`.
- Provider endpoint: `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`.
- Missing key behavior: model-call path fails with `MISSING_GEMINI_API_KEY` and deterministic fallback where available.

No real Gemini request has been made in Stage 8G.

## News Runtime

Set production Edge Function config to:

```txt
AI_CHAT_NEWS_REPOSITORY=live
```

`live` and `supabase` select `SupabaseNewsRepository`. Missing, `local`, `offline`, or `test` uses `LocalNewsRepository`. If live mode is requested without Supabase server credentials, code fails closed with `NEWS_REPOSITORY_UNAVAILABLE`; it does not silently use local news.

The live adapter currently uses the service credential for both published reads and pending counts. Published reads are still guarded in code with `status=eq.published` and a returned-row status check. Pending count requires privilege because pending title/body/source content must remain private and only an aggregate number may be exposed.

## Quota Readiness

Runtime quota depends on:

- Stage 8B migration applied.
- Valid authenticated/admin identity from Supabase Auth.
- Server-side service credential for `reserve_ai_chat_quota` and `refund_ai_chat_quota`.
- `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`.

Supported at launch after verification:

- Authenticated users: default 25 model calls/day.
- Admin users: default 50 model calls/day.
- Deterministic paths: zero quota.

Anonymous durable quota remains deferred because there is no Supabase anonymous auth, Turnstile, or IP HMAC identity. Safe anonymous behavior after deployment: deterministic zero-model paths can respond; anonymous model-call paths fail closed into deterministic fallback where one exists and must not be claimed as 5/day production quota.

## Telemetry Readiness

`SupabaseTelemetryAdapter` requires:

- Stage 8B `public.ai_chat_events`.
- `SUPABASE_URL`.
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`.

It inserts metadata only: request id, identity type, intent, mode, outcome, fallback code, error code, model/quota flags, status, latency, source count, language, region, and current page. It does not store raw question, answer, prompt, URLs, pending news, JWT, email, IP, stack trace, or keys.

Telemetry failure is isolated. A write failure must not change the chatbot response, trigger another Gemini call, alter quota, or expose database details.

## Auth And JWT Flow

Expected production request:

```txt
browser -> Supabase session -> AIChatService -> Authorization: Bearer <access token>
-> Edge Function -> explicit token verification -> trusted profiles role lookup
-> identity -> quota -> response
```

`verify_jwt = false` remains intentional. Supabase should not reject no-token requests before code can classify them as anonymous. The function behavior is:

- No token: anonymous/unverified.
- Valid token: verify through Supabase Auth `/auth/v1/user`, then read caller profile using anon key and bearer token.
- Missing profile: authenticated user, not admin.
- Admin profile: admin identity.
- Invalid or expired token: 401 safe auth error, not downgraded.
- Suspended profile: 403 safe auth error.

## CORS

`AI_CHAT_CORS_ORIGINS` must eventually contain exact frontend origins, comma-separated.

- Development origin: use the local Vite origin when testing locally, commonly `http://localhost:5173`.
- Production origin: expected DirectAdmin site origin, currently `https://borneotracker.rentsmartprop.com.my`, unless production hosting changes.
- OPTIONS behavior: returns CORS preflight without requiring Gemini config.
- Allowed headers: `authorization`, `x-client-info`, `apikey`, `content-type`.

Do not use `*` in production if an explicit origin is available. The current code defaults to `*` only when `AI_CHAT_CORS_ORIGINS` is blank, so production must set it.

## Future Deployment Command Plan

All commands below are **NOT YET EXECUTED**.

```bash
# 1. Authenticate CLI
supabase login

# 2. Link the correct project
supabase link --project-ref <project-ref>

# 3. Inspect migration state
supabase migration list

# 4. Verify baseline DB objects
supabase db execute --file ops/sql/verify-ai-chat-baseline.sql

# 5. Review Stage 8B migration
supabase migration repair --status applied <baseline-versions-if-ever-needed>

# 6. Apply Stage 8B migration only after review
supabase db push

# 7. Verify new tables/RPC/RLS
supabase db execute --file ops/sql/verify-ai-chat-stage-8b.sql

# 8. Configure Edge Function secrets/config
supabase secrets set AICHATBOTGEMINI_API_KEY=<redacted>
supabase secrets set GEMINI_MODEL=gemini-3.6-flash
supabase secrets set AI_CHAT_TIMEOUT_MS=30000
supabase secrets set AI_CHAT_CORS_ORIGINS=https://borneotracker.rentsmartprop.com.my
supabase secrets set AI_CHAT_NEWS_REPOSITORY=live
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase secrets set SUPABASE_ANON_KEY=<redacted>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<redacted>

# 9. Deploy Edge Function
supabase functions deploy ai-chat

# 10-16. Smoke and live verification with controlled requests
# Use Stage 8H matrix below. Begin without Gemini-consuming prompts where possible,
# then verify auth, quota, telemetry, news, and finally one real Gemini request.

# 17. Configure frontend deployment
# Set VITE_AI_CHAT_ENDPOINT=https://<project-ref>.functions.supabase.co/ai-chat

# 18. Build frontend
npm run build

# 19. Browser end-to-end smoke test
# Verify DirectAdmin production forwards Bearer tokens and renders safe responses.
```

The placeholder `ops/sql/*.sql` files are intentionally not committed in Stage 8G because they would need live-project object names and explicit review before execution.

## Stage 8H Verification Matrix

Request:

- Valid POST returns a normalized response.
- Invalid JSON returns safe 400.
- Empty message returns safe 400.
- Oversized message returns safe 413 or message-too-long error.
- OPTIONS returns preflight headers.
- Unsupported method returns 405.

Auth:

- No token remains anonymous.
- Valid user resolves authenticated.
- Valid admin resolves admin.
- Invalid token returns 401.
- Expired token returns 401 expired.
- Suspended user returns 403 and no model call.

Dashboard:

- Gemini success.
- Deterministic blocked comparison.
- Clarification fallback.
- Timeout fallback with quota refund.
- Validation rejection fallback with quota refund.

Knowledge:

- Valid retrieval.
- No-match fallback.
- Ambiguity fallback.
- Gemini failure fallback.

Quota:

- Authenticated reservation.
- Admin reservation.
- Exhaustion returns 429.
- Refund after provider/validation failure.
- No quota on deterministic paths.

Telemetry:

- Success event.
- Fallback event.
- Zero-model event.
- Telemetry write failure isolation.

News:

- Published result.
- Zero published plus pending count.
- Pending content never exposed.
- Territory filter.
- Language preference/fallback behavior.

Security:

- No secret exposure.
- No raw provider/database error.
- No source paths in public response.
- No pending news content.
- No fake client answer.

Frontend:

- Real endpoint configured.
- Bearer forwarding.
- Fallback UI.
- Safe sources.
- Network error UI.
- 429 behavior.

## Rollback

Stage 8B migration:

- Prefer forward fixes for schema or policy mistakes after launch.
- Reversible configuration, such as seeded `AI_CHAT_ENABLED`, can be updated after review.
- Dropping tables/functions is destructive once telemetry/quota rows exist and requires explicit data-retention review.

Edge Function deployment:

- Redeploy the last known-good `ai-chat` function source.
- If needed, temporarily unset `VITE_AI_CHAT_ENDPOINT` in frontend deployment to disable the browser entry point.

Secrets/config:

- Rotate bad secrets in Supabase.
- Reset `AI_CHAT_NEWS_REPOSITORY` to `local` only as an emergency server-side degradation, and document that live news is disabled.
- Tighten or correct `AI_CHAT_CORS_ORIGINS` without redeploying frontend.

Frontend endpoint:

- Remove or blank `VITE_AI_CHAT_ENDPOINT` and rebuild/redeploy frontend to show the safe configuration error.
- Roll back DirectAdmin frontend by redeploying the last known-good commit through the existing deployment workflow.

## Known Limitations

- No live Supabase migration, RPC, telemetry, news, or Edge Function behavior has been verified.
- No real Gemini request has been made.
- Anonymous durable quota is not production-ready.
- Turnstile and IP HMAC identity are not implemented.
- Stage 8B config table is seeded, but runtime code still uses env/defaults for daily limits.
- Live Golden news cases remain blocked until Stage 8H.

## Repository Preflight

Run:

```bash
# NOT YET EXECUTED
npm run ai-chat:deploy:check
```

The command verifies local repository consistency only. It does not link Supabase, read secret values, call PostgREST, deploy a function, or call Gemini.
