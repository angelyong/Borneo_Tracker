import type {
  AIChatNewsLanguage,
  AIChatNewsQuery,
  AIChatNewsTerritory,
  AIChatPublishedNewsItem,
} from './contracts.ts';
import type { AIChatNewsRepository, AIChatRawNewsRecord } from './newsRepository.ts';
import { matchesNewsTopics, normalizeNewsTopics } from './newsTopics.ts';

const SUPPORTED_TERRITORIES: AIChatNewsTerritory[] = [
  'Sabah',
  'Sarawak',
  'Brunei',
  'Kalimantan',
  'Borneo-wide',
  'unknown',
];

const DEFAULT_LIMIT = 5;

export type LocalNewsRepositoryOptions = {
  records?: AIChatRawNewsRecord[];
};

export class LocalNewsRepository implements AIChatNewsRepository {
  private readonly records: AIChatRawNewsRecord[];

  constructor(options: LocalNewsRepositoryOptions = {}) {
    this.records = [...(options.records || [])];
  }

  async findPublished(query: AIChatNewsQuery): Promise<AIChatPublishedNewsItem[]> {
    const limit = normalizeLimit(query.limit);
    const normalizedQuery = normalizeQuery(query);
    const normalized = this.records
      .filter((record) => record.status === 'published')
      .filter((record) => matchesNewsTopics(record, normalizedQuery.topics))
      .map((record) => normalizePublishedRecord(record))
      .filter((record): record is AIChatPublishedNewsItem => Boolean(record))
      .filter((record) => matchesTerritory(record.territory, normalizedQuery.territories))
      .filter((record) => matchesDate(record.publishedAt, normalizedQuery.fromDate, normalizedQuery.toDate));
    const preferred = preferLanguage(normalized, normalizedQuery.language);

    return dedupeById(preferred)
      .sort(comparePublishedNews)
      .slice(0, limit);
  }

  async countPending(query: AIChatNewsQuery): Promise<number> {
    const normalizedQuery = normalizeQuery(query);
    return this.records
      .filter((record) => record.status === 'pending')
      .map((record) => pendingRecordTerritory(record))
      .filter((territory): territory is AIChatNewsTerritory => Boolean(territory))
      .filter((territory) => matchesTerritory(territory, normalizedQuery.territories))
      .length;
  }
}

function normalizePublishedRecord(record: AIChatRawNewsRecord): AIChatPublishedNewsItem | undefined {
  const id = stringValue(record.id);
  const title = stringValue(record.title);
  const summary = stringValue(record.summary) || stringValue(record.body);
  const publishedAt = stringValue(record.publishedAt) || stringValue(record.published_at);
  const territory = firstTerritory(record);
  if (!id || !title || !summary || !publishedAt || !territory || !isValidIsoDate(publishedAt)) return undefined;

  const source = firstSource(record.sources);
  const publisher = stringValue(record.publisher) || stringValue(source?.name);
  const url = stringValue(record.url) || stringValue(source?.url);

  return {
    id,
    title,
    summary,
    publishedAt,
    ...(publisher ? { publisher } : {}),
    ...(url ? { url } : {}),
    territory,
    language: normalizeLanguage(stringValue(record.language) || stringValue(record.originalLang)),
    ...(stringValue(record.sourceFile) ? { sourceFile: stringValue(record.sourceFile) } : {}),
  };
}

function pendingRecordTerritory(record: AIChatRawNewsRecord): AIChatNewsTerritory | undefined {
  return firstTerritory(record);
}

function firstTerritory(record: AIChatRawNewsRecord): AIChatNewsTerritory | undefined {
  const values = Array.isArray(record.territories)
    ? record.territories
    : [record.territory];
  for (const value of values) {
    const normalized = normalizeTerritory(stringValue(value));
    if (normalized) return normalized;
  }
  return undefined;
}

function normalizeQuery(query: AIChatNewsQuery): Required<Pick<AIChatNewsQuery, 'territories'>> & Omit<AIChatNewsQuery, 'territories'> {
  return {
    ...query,
    territories: (query.territories || [])
      .map((territory) => normalizeTerritory(territory))
      .filter((territory): territory is AIChatNewsTerritory => Boolean(territory)),
    topics: normalizeNewsTopics(query.topics),
  };
}

function normalizeTerritory(value: string): AIChatNewsTerritory | undefined {
  if (!value) return undefined;
  if (value === 'Brunei Darussalam') return 'Brunei';
  return SUPPORTED_TERRITORIES.includes(value as AIChatNewsTerritory)
    ? value as AIChatNewsTerritory
    : undefined;
}

function matchesTerritory(territory: AIChatNewsTerritory, territories: string[]): boolean {
  if (!territories.length) return true;
  return territories.includes(territory);
}

function matchesDate(publishedAt: string, fromDate?: string, toDate?: string): boolean {
  const published = parseIsoTime(publishedAt);
  if (published === undefined) return false;
  const from = startBoundary(fromDate);
  const to = endBoundary(toDate);
  if (from !== undefined && published < from) return false;
  if (to !== undefined && published > to) return false;
  return true;
}

function preferLanguage(records: AIChatPublishedNewsItem[], language?: string): AIChatPublishedNewsItem[] {
  const normalized = normalizeLanguage(language);
  if (normalized === 'unknown') return records;
  const matching = records.filter((record) => record.language === normalized);
  return matching.length ? matching : records;
}

function comparePublishedNews(a: AIChatPublishedNewsItem, b: AIChatPublishedNewsItem): number {
  const byDate = Number(new Date(b.publishedAt)) - Number(new Date(a.publishedAt));
  return byDate || a.id.localeCompare(b.id);
}

function dedupeById(records: AIChatPublishedNewsItem[]): AIChatPublishedNewsItem[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

function firstSource(value: unknown): { name?: unknown; url?: unknown } | undefined {
  return Array.isArray(value) && value[0] && typeof value[0] === 'object'
    ? value[0] as { name?: unknown; url?: unknown }
    : undefined;
}

function normalizeLanguage(value?: string): AIChatNewsLanguage {
  if (value === 'en' || value === 'ms') return value;
  return 'unknown';
}

function normalizeLimit(limit?: number): number {
  return Math.max(0, Math.floor(limit ?? DEFAULT_LIMIT));
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && parseIsoTime(value) !== undefined;
}

function parseIsoTime(value: string): number | undefined {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
}

function startBoundary(value?: string): number | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00.000Z`) : parseIsoTime(value);
}

function endBoundary(value?: string): number | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T23:59:59.999Z`) : parseIsoTime(value);
}
