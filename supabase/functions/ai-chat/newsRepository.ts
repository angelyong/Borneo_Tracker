import type {
  AIChatNewsQuery,
  AIChatPublishedNewsItem,
} from './contracts.ts';

export interface AIChatNewsRepository {
  findPublished(query: AIChatNewsQuery): Promise<AIChatPublishedNewsItem[]>;
  countPending(query: AIChatNewsQuery): Promise<number>;
}

export type AIChatRawNewsRecord = {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  summary?: unknown;
  publishedAt?: unknown;
  published_at?: unknown;
  publisher?: unknown;
  url?: unknown;
  sourceFile?: unknown;
  status?: unknown;
  beat?: unknown;
  beatLabel?: unknown;
  beat_label?: unknown;
  sdg?: unknown;
  country?: unknown;
  territory?: unknown;
  territories?: unknown;
  language?: unknown;
  originalLang?: unknown;
  sources?: unknown;
};
