# AI Chat News Repository

Stage 5B defined the deterministic chatbot news repository boundary:

```ts
interface AIChatNewsRepository {
  findPublished(query: AIChatNewsQuery): Promise<AIChatPublishedNewsItem[]>;
  countPending(query: AIChatNewsQuery): Promise<number>;
}
```

Stage 8F keeps that interface unchanged and adds the production-capable Supabase adapter documented in [`ai-chat-supabase-news-repository.md`](./ai-chat-supabase-news-repository.md).

The core privacy contract remains: published content may be returned, pending content never leaves the repository boundary except as an aggregate count, and news answers are deterministic zero-model responses.
