# AI Chat Identity Contract

Stage 8C adds identity context for the Borneo Tracker chatbot without enabling quota enforcement, telemetry persistence, Turnstile, live news, deployment, or live Supabase verification. This advances ABCDE `A` by preparing the AI assistant for real users and `E` by making auth provenance explicit before billing or logging decisions.

## Frontend Token Forwarding

The chatbot request body remains unchanged:

```json
{
  "message": "string",
  "currentPage": "string",
  "region": "string",
  "language": "en"
}
```

`AIChatService` accepts an optional injected `accessTokenProvider`. When it returns a non-empty Supabase access token, the service sends:

```http
Authorization: Bearer <Supabase access token>
```

If no token is available, no bearer header is sent and the request remains possible as anonymous/unverified. The service does not store a duplicate long-lived token and does not place tokens, user IDs, roles, or profile data in the JSON body.

## Internal Identity Contract

The Edge Function resolves identity internally as:

```ts
type AIChatIdentity = {
  type: 'anonymous' | 'authenticated' | 'admin';
  userId?: string;
  role?: 'user' | 'admin';
  status?: 'active' | 'suspended';
  verified: boolean;
};
```

This is never returned to the browser. Public responses must not expose user IDs, JWT claims, profile rows, role internals, access tokens, identity hashes, or auth provider metadata.

## JWT Verification Boundary

`supabase/config.toml` remains:

```toml
[functions.ai-chat]
verify_jwt = false
```

This is intentional because anonymous chatbot access must remain possible. The Edge Function handles bearer tokens explicitly:

- no `Authorization` header means anonymous/unverified;
- malformed `Authorization` fails safely;
- valid-looking bearer tokens are verified through a verifier interface;
- invalid or expired tokens are rejected and never downgraded to authenticated;
- request-body `userId` and `role` are ignored.

The default verifier uses Supabase Auth's `/auth/v1/user` endpoint with the project anon key from server-side environment. This avoids a custom JWT parser. Offline tests use injected verifiers and repositories, so no live Supabase project is required.

## Trusted Role Source

Admin authority remains `public.profiles.role`, matching the existing app and database design. The Edge profile repository reads the caller's own `profiles` row using the verified bearer token and Supabase RLS. It does not trust frontend role fields, user metadata, arbitrary JWT custom claims, or request body values.

Missing profile rows are treated as regular authenticated users, never admins.

## Anonymous and Future Anonymous Auth

Stage 8C anonymous means: no valid Supabase session was presented, so the request is unverified and has no persistent identity.

This is distinct from future Supabase anonymous-auth JWT support. Anonymous Supabase sign-in is still not implemented, and Stage 8C does not create anonymous users, store anonymous identity, hash IPs, verify Turnstile, or reserve quota.

## Suspended Users

`public.profiles.status` already supports `active` and `suspended`. If the trusted profile source returns `suspended`, the Edge Function rejects the request with a safe auth error and does not treat the caller as active user or admin.

The existing repository notes that admin suspension writes are not fully implemented yet. Stage 8C only respects the status when it is present from the trusted source.

## Auth Error Handling

Safe backend codes:

- `AI_CHAT_AUTH_MALFORMED`
- `AI_CHAT_AUTH_INVALID`
- `AI_CHAT_AUTH_EXPIRED`
- `AI_CHAT_IDENTITY_UNAVAILABLE`
- `AI_CHAT_USER_SUSPENDED`

Errors must not include raw JWT payloads, signature details, Supabase project refs, stack traces, token fragments, profile rows, email addresses, or database internals. The frontend maps these to safe English and Malay messages.

## CORS

The Edge Function keeps the existing CORS strategy. Allowed request headers include:

- `authorization`
- `apikey`
- `content-type`

Origins remain controlled by `AI_CHAT_CORS_ORIGINS`. Stage 8C does not hard-code production origins.

## Logging Privacy

Logs may include coarse metadata:

- `identityType`
- `authenticated`
- `admin`
- verification result code

Logs must not include:

- user ID
- email
- access token
- JWT
- Authorization header
- full profile object
- IP address
- raw auth error payload

## Explicitly Not Enabled

Stage 8C does not:

- call `reserve_ai_chat_quota`
- call `refund_ai_chat_quota`
- read `AI_CHAT_DAILY_LIMITS`
- return real quota values
- write `ai_chat_daily_usage`
- insert `ai_chat_events`
- enforce Turnstile
- compute IP HMACs
- enable Supabase anonymous sign-in
- implement live Supabase news
- deploy or verify against a live Supabase project

Stage 8D later added repository-level runtime quota enforcement for authenticated/admin model-call paths. Anonymous remains unverified and does not receive a durable quota key yet.

## Stage 8D Dependencies

Quota enforcement now builds on this by:

- using `AIChatIdentity.type` to choose the server-trusted limit;
- using a server-created stable identity key for authenticated/admin users;
- deferring anonymous/IP guard identity until Turnstile and daily HMAC design are implemented;
- reserving quota only before a model call;
- refunding failed provider calls and rejected generated answers;
- keeping deterministic refusals and template fallbacks at zero quota.
