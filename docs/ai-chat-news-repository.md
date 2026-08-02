# AI Chat News Repository

Stage 5B adds a deterministic news-access boundary for the AI chatbot. It serves the ABCDE Data and Ethics layers: published news can be read with provenance, while unpublished review content remains private.

## Repository Interface

The chatbot depends on `AIChatNewsRepository`:

```ts
interface AIChatNewsRepository {
  findPublished(query: AIChatNewsQuery): Promise<AIChatPublishedNewsItem[]>;
  countPending(query: AIChatNewsQuery): Promise<number>;
}
```

No intent, prompt, or answer module depends on Supabase directly. Tests can inject any implementation with these two methods.

## Published-Only Access

`findPublished()` must enforce `status === 'published'` inside the repository implementation. The caller is not trusted to apply the status filter. Pending, draft, rejected, malformed, and missing-status records are excluded.

Published records may expose only bounded public fields:

- `id`
- `title`
- `summary`
- `publishedAt`
- `publisher`
- `url`
- `territory`
- `language`
- `sourceFile`

## Pending Count Boundary

`countPending()` returns a number only. It must never return pending records or pending metadata such as title, summary, URL, publisher, ID, source, date, category, or raw row data.

When a territory query is supplied, the pending count may be scoped to that aggregate query. The result shape remains:

```ts
{ count: number }
```

## Territory Filtering

Supported territories are:

- `Sabah`
- `Sarawak`
- `Brunei`
- `Kalimantan`
- `Borneo-wide`
- `unknown`

Filtering is exact and deterministic. A Sabah query does not include Sarawak or Borneo-wide records unless those territories are explicitly requested. Unknown territories are not guessed.

## Date Filtering

The retriever supports `fromDate`, `toDate`, `latest`, and `limit`.

Rules:

- ISO dates are parsed safely.
- Boundaries are inclusive.
- Published items sort newest first by `publishedAt`.
- Ties are broken by stable `id`.
- Records with missing or invalid `publishedAt` are excluded.
- Malformed query dates are stripped and reported with deterministic warnings.
- The current date is never inserted as a fallback.

## Language Behavior

Language is a preference. English and Malay requests prefer matching published items. If no matching-language published item exists, available published records may be returned with `NO_NEWS_IN_REQUESTED_LANGUAGE`.

The repository does not translate titles or summaries. Stage 5B does not ask Gemini to translate news.

## Empty Results

When no published items match, the retriever returns:

```ts
{
  published: [],
  pending: { count: number },
  warnings: ["NO_PUBLISHED_NEWS_MATCH"],
  queryApplied: { territories: [], limit: 5 }
}
```

It does not substitute unrelated territories, use old news outside the requested range, search the web, or invent an update.

## Source Metadata

Published sources may include publisher, title, publication date, and URL. URLs remain metadata and are not inserted into Gemini answer prose in Stage 5B. Missing publisher remains missing; the repository does not infer a publisher from a URL domain.

Duplicate published records are removed by stable `id`.

Pending records never produce source metadata.

## Safe Logging

Handler logs may include aggregate fields only:

- `newsQueryExecuted`
- `territoryCount`
- `publishedCount`
- `pendingCount`
- `dateFilterUsed`
- `limit`
- `languagePreferenceUsed`
- `warningCodes`

Logs must not contain titles, summaries, URLs, publisher names, pending IDs, raw records, database payloads, or full user questions.

## Handler Integration

Stage 5B integrates news retrieval internally for `BORNEO_NEWS` only. Dashboard, site-knowledge, and out-of-scope intents do not invoke the news repository.

For this stage, news results are not sent to Gemini and are not added to grounded prompts. Public response compatibility is preserved.

## Future Supabase Adapter

A later stage can add `supabaseNewsRepository.ts` behind the same interface.

Expected future behavior:

- `findPublished(query)` queries only `status = 'published'`.
- It selects bounded public fields only.
- `countPending(query)` uses a count-only query.
- It must not select pending row content.
- Database errors must be logged without query payloads or row content.

Stage 5B does not add Supabase client code, migrations, secrets, live database access, or deployment.

