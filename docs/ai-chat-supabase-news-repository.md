# AI Chat Supabase News Repository

Stage 8F prepares a production-capable Supabase-backed news repository for the AI chatbot. It advances ABCDE Data and Ethics: public reviewed news can be retrieved from durable storage, while pending review content remains private.

No live Supabase project was linked, migrated, queried, deployed, or verified in this stage.

## Repository Interface

The chatbot still depends only on:

```ts
interface AIChatNewsRepository {
  findPublished(query: AIChatNewsQuery): Promise<AIChatPublishedNewsItem[]>;
  countPending(query: AIChatNewsQuery): Promise<number>;
}
```

`SupabaseNewsRepository` implements this interface behind an injected query boundary. Tests use fake boundaries and fake `fetch`; the runtime code does not import the frontend browser Supabase client.

## Runtime Selection

`createAIChatNewsRepository()` selects the repository explicitly:

- missing, `local`, `offline`, or `test` `AI_CHAT_NEWS_REPOSITORY` uses `LocalNewsRepository`;
- `supabase` or `live` uses `SupabaseNewsRepository`;
- live mode without `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY` fails closed with `NEWS_REPOSITORY_UNAVAILABLE`;
- there is no silent local-news fallback when live mode is requested.

Injected test repositories still override this factory.

## DB Mapping

`public.news_items` maps to `AIChatPublishedNewsItem` as:

- `id -> id`
- `title -> title`
- `body -> summary`
- `published_at -> publishedAt`
- `territories[] -> territory`
- `original_lang -> language`
- `sources -> publisher/url`

`status` is selected as an internal guard field so the repository can enforce `status === 'published'` itself. It is never returned.

The published query selects only bounded fields: `id,title,body,published_at,territories,original_lang,sources,status`.

## Published Rule

`findPublished()` applies `status=eq.published` in the PostgREST query and rejects any returned row whose internal `status` is not exactly `published`. Pending, rejected, malformed, missing-status, and missing/invalid-date rows are not returned.

Published failures are mapped to bounded errors:

- `NEWS_REPOSITORY_UNAVAILABLE`
- `NEWS_QUERY_FAILED`
- `NEWS_MALFORMED_ROW`

Raw Supabase errors, rows, SQL, project refs, and credentials are not exposed.

## Source JSON

`digest_news.py` writes `sources` as an array, preserving frontend source objects such as `{ name, url, publishedAt }`.

The adapter scans sources in order and uses the first source with valid bounded metadata:

- `name` becomes `publisher` only when it is a non-empty string;
- `url` becomes `url` only when it parses as `http` or `https`;
- missing publisher stays missing;
- invalid URL stays missing;
- publisher is never inferred from a domain;
- arbitrary nested source payloads are not returned.

When multiple sources exist, the first structurally valid source is exposed because the Stage 5B runtime item supports one publisher/url pair.

## Territories

Supported runtime territories remain:

- `Sabah`
- `Sarawak`
- `Brunei`
- `Kalimantan`
- `Borneo-wide`
- `unknown`

`Brunei Darussalam` normalizes to `Brunei`. No fuzzy guessing or territory widening is performed. A Sabah query does not include `Borneo-wide` unless requested.

Rows with multiple valid territories match any exact requested territory, but the returned legacy `territory` field uses the first valid DB territory deterministically. The adapter keeps multi-territory applicability internally for filtering and does not expose an invented territory list.

## Language

`original_lang` is normalized conservatively:

- `en`, English variants -> `en`
- `ms`, Malay variants -> `ms`
- anything else -> `unknown`

Language is a preference. If no requested-language published result exists, the existing retriever behavior returns available published records and emits `NO_NEWS_IN_REQUESTED_LANGUAGE`.

## Date Filtering

Published date filtering remains deterministic:

- `fromDate` and `toDate` are inclusive;
- date-only boundaries expand to full UTC day boundaries;
- newest records sort first;
- stable id tie-break is ascending;
- invalid query dates are stripped by the retriever with warnings;
- missing or invalid `published_at` rows are excluded;
- no current-date fallback is inserted;
- Gemini is not involved.

## Pending Count

`countPending()` returns only a number, which the retriever wraps as `{ count }`.

The Supabase REST boundary uses a `HEAD` request with `Prefer: count=exact`, `status=eq.pending`, and exact territory scoping. It does not select or return pending titles, body, URL, publisher, IDs, source JSON, dates, category, or moderation metadata.

Language and date filters are not applied to pending counts in Stage 8F. This preserves Stage 5B local behavior and avoids filtering against `published_at`, which pending rows normally do not have.

Pending-count failures map to `NEWS_PENDING_COUNT_FAILED`; the handler must not guess a count.

## RLS And Credentials

The database policy allows anon/authenticated reads only where `status = 'published'`. Admin review policies are separate.

The Stage 8F adapter is server-only and currently uses a server credential because pending aggregate counts require access that public RLS must not grant. The code still enforces published-only reads itself, so service-role access does not widen the returned runtime object.

Future hardening may split published reads to an anon/auth server key and pending counts to a privileged RPC or view. User JWTs and frontend roles must never be trusted for pending access.

## Privacy

Pending content must never enter:

- repository return objects;
- handler logs;
- telemetry rows;
- Gemini prompts;
- fallback answers;
- source arrays;
- thrown error messages.

Stage 8F tests include sentinel pending title/body/source values and assert they do not appear outside the fake fixture. The adapter never imports `src/services/supabaseClient.js` and never places service-role credentials in frontend code.

## Handler, Quota, And Telemetry

`BORNEO_NEWS` remains deterministic. News is not sent to Gemini.

Quota behavior:

- `modelCalled = false`
- `quotaConsumed = false`
- no quota reservation for news reads

Telemetry remains minimal:

- `intent = BORNEO_NEWS`
- `outcome`
- `sourceCount`
- `modelCalled = false`
- `quotaConsumed = false`

The handler logs aggregate news metadata. Telemetry does not include title, body, URL, pending count, pending row metadata, prompts, or answer text.

## Current Limitation

The adapter is offline-tested only. Actual Supabase behavior remains unverified until a later live stage confirms:

- baseline schema and migrations are applied;
- Edge Function has the required server-side environment;
- service credential works server-side;
- RLS allows public published reads and blocks pending/rejected rows;
- pending count behaves as intended against real PostgREST;
- live Golden news cases can be safely unblocked.

Until then, live Supabase news status remains `BLOCKED_BY_SUPABASE`.
