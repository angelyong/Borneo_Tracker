# AI Chat Frontend Contract

Stage 7 prepares the React chatbot UI to consume the current Supabase Edge Function contract without configuring a live endpoint.

## Request

The frontend sends only:

```json
{
  "message": "string",
  "currentPage": "string",
  "region": "string",
  "language": "en"
}
```

`message` is trimmed and empty messages are rejected client-side. The backend still validates every request. `currentPage` comes from the app route, `region` is blank until a page exposes selected territory context to the chatbot, and `language` is restricted to `en` or `ms`.

The frontend does not send secrets, full app state, user identity, IP address, or legacy chat history in the request body.

## Authorization

Stage 8C may additionally send the current Supabase access token as an HTTP header:

```http
Authorization: Bearer <Supabase access token>
```

This header is optional. If no authenticated session exists, no bearer token is sent and the request remains anonymous/unverified. The frontend never sends a service-role key, never sends the Supabase anon key as the bearer token, and never places the access token, user ID, role, or profile data in the JSON body.

## Success

Successful responses are normalized to:

```json
{
  "answer": "string",
  "mode": "gemini-test",
  "sources": [
    {
      "id": "optional",
      "title": "optional",
      "publisher": "optional",
      "year": 2026,
      "url": "optional"
    }
  ],
  "fallback": {
    "used": true,
    "reason": "optional",
    "degraded": true
  },
  "quota": {
    "remaining": 3,
    "limit": 5,
    "resetsAt": "optional"
  }
}
```

Supported modes are `gemini-test` and `template-fallback`. Unknown response fields are ignored.

## Errors

Frontend errors are normalized to:

```json
{
  "code": "string",
  "message": "string",
  "status": 500,
  "retryable": true
}
```

The UI maps invalid requests, missing endpoint/configuration, auth verification failures, service unavailable, unsupported method, message-too-long, rate limit, server error, timeout, network failure, and malformed backend responses to safe English/Malay messages.

Raw response bodies, stack traces, model names, environment variable names, Supabase internals, and validation/debug metadata are not displayed.

## Template Fallback

`template-fallback` is rendered as a successful verified assistant response, not an error. The UI labels it:

- English: `Verified data response`
- Malay: `Jawapan data yang disahkan`

Sources are preserved. Deterministic blocked and clarification answers also render as normal assistant responses.

## Sources

The UI renders only deterministic `sources[]` metadata: `title`, `publisher`, `year`, and `url`. Missing fields are omitted cleanly and duplicates are removed.

The UI never parses sources from answer text, never displays `sourceFile` or `sourcePath`, and does not display internal IDs. Only `http://` and `https://` URLs become links. Unsafe schemes such as `javascript:`, `data:`, and `file:` render as text only. External links use `rel="noopener noreferrer"`.

## Endpoint

`VITE_AI_CHAT_ENDPOINT=` is intentionally blank in `.env.example`.

No Supabase project ref, anon key, service-role key, Gemini key, or production endpoint is committed. Absence of the endpoint produces a safe configuration error.

## Retry

There are no automatic retries.

Manual retry is offered only for retryable failures such as network failure, timeout, or temporary service/server unavailability. It is not offered for invalid requests, empty messages, message-too-long, malformed configuration, rate-limit/quota exhaustion, or malformed responses.

## Language

The chatbot uses the existing i18next setup and supports English and Malay UI strings for loading, service/configuration errors, quota reached, malformed responses, fallback labels, sources, and retry.

## Quota

The frontend understands optional `quota.remaining`, `quota.limit`, and `quota.resetsAt`. Absence is normal. The frontend does not generate quota values, calculate reset times, call quota RPCs, or connect Supabase quota storage.

## Security

Answers are rendered as text nodes, not HTML. The UI does not use `dangerouslySetInnerHTML`, executable markdown HTML, frontend Gemini keys, service-role keys, production logging of full questions/answers, or user-facing environment values.

## Accessibility

The dialog has an accessible name, loading and error live regions, disabled send semantics, keyboard send behavior, Shift+Enter multiline support, accessible source link names, and a visible fallback label that does not rely on color alone.

## Current Limitation

Production Gemini/Supabase end-to-end behavior remains unverified until a real Supabase Edge Function URL is deployed and assigned to `VITE_AI_CHAT_ENDPOINT`.
