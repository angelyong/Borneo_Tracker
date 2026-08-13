import {
  AIChatHttpError,
  type AIChatNewsLanguage,
  type AIChatNewsQuery,
  type AIChatNewsTerritory,
  type AIChatPublishedNewsItem,
} from './contracts.ts';
import { envValue, type EnvLike } from './config.ts';
import type { AIChatNewsRepository } from './newsRepository.ts';
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
const PUBLISHED_SELECT = 'id,title,body,published_at,territories,original_lang,sources,status,beat,beat_label,sdg,country';
const TOPIC_CANDIDATE_MIN_LIMIT = 25;

export type SupabaseNewsRow = {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  published_at?: unknown;
  territories?: unknown;
  original_lang?: unknown;
  sources?: unknown;
  status?: unknown;
  beat?: unknown;
  beat_label?: unknown;
  sdg?: unknown;
  country?: unknown;
};

export type SupabaseNewsQueryBoundary = {
  selectPublished(query: SupabaseNewsBoundaryQuery): Promise<SupabaseNewsRow[]>;
  countPending(query: SupabaseNewsBoundaryQuery): Promise<number>;
};

export type SupabaseNewsBoundaryQuery = {
  territories: AIChatNewsTerritory[];
  topics: string[];
  fromDate?: string;
  toDate?: string;
  limit: number;
};

type SupabaseNewsRepositoryOptions = {
  boundary?: SupabaseNewsQueryBoundary;
  env?: EnvLike;
  fetchImpl?: typeof fetch;
};

type SupabaseNewsRestBoundaryOptions = {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
};

export class SupabaseNewsRepository implements AIChatNewsRepository {
  private readonly boundary: SupabaseNewsQueryBoundary;

  constructor(options: SupabaseNewsRepositoryOptions = {}) {
    this.boundary = options.boundary || new SupabaseNewsRestBoundary({
      env: options.env,
      fetchImpl: options.fetchImpl,
    });
  }

  async findPublished(query: AIChatNewsQuery): Promise<AIChatPublishedNewsItem[]> {
    const boundaryQuery = normalizeBoundaryQuery(query);
    const resultLimit = normalizeLimit(query.limit);
    let rows: SupabaseNewsRow[];
    try {
      rows = await this.boundary.selectPublished(boundaryQuery);
    } catch (error) {
      if (error instanceof AIChatHttpError) throw error;
      throw new AIChatHttpError(503, 'NEWS_QUERY_FAILED', 'The news repository could not complete the query.');
    }

    const records = rows
      .filter((row) => stringValue(row.status) === 'published')
      .filter((row) => matchesNewsTopics(row, boundaryQuery.topics))
      .map((row) => mapPublishedRow(row))
      .filter((record): record is AIChatPublishedNewsItem => Boolean(record))
      .filter((record) => matchesAnyTerritory(record.territories, boundaryQuery.territories))
      .filter((record) => matchesDate(record.publishedAt, boundaryQuery.fromDate, boundaryQuery.toDate));
    const preferred = preferLanguage(records, query.language);

    return dedupeById(preferred)
      .sort(comparePublishedNews)
      .slice(0, resultLimit)
      .map(({ territories: _territories, ...record }) => record);
  }

  async countPending(query: AIChatNewsQuery): Promise<number> {
    const boundaryQuery = normalizeBoundaryQuery(query);
    try {
      return Math.max(0, Math.floor(await this.boundary.countPending(boundaryQuery)));
    } catch (error) {
      if (error instanceof AIChatHttpError) throw error;
      throw new AIChatHttpError(503, 'NEWS_PENDING_COUNT_FAILED', 'The pending news count is unavailable.');
    }
  }
}

export class SupabaseNewsRestBoundary implements SupabaseNewsQueryBoundary {
  private readonly url: string;
  private readonly serviceKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SupabaseNewsRestBoundaryOptions = {}) {
    const url = envValue(options.env, 'SUPABASE_URL');
    const serviceKey = envValue(options.env, 'SUPABASE_SERVICE_ROLE_KEY') || envValue(options.env, 'SUPABASE_SERVICE_KEY');
    if (!url || !serviceKey) {
      throw new AIChatHttpError(503, 'NEWS_REPOSITORY_UNAVAILABLE', 'The news repository is not configured.');
    }
    this.url = url.replace(/\/+$/, '');
    this.serviceKey = serviceKey;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async selectPublished(query: SupabaseNewsBoundaryQuery): Promise<SupabaseNewsRow[]> {
    const url = this.buildPublishedUrl(query);
    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!response.ok) throw new AIChatHttpError(503, 'NEWS_QUERY_FAILED', 'The news repository could not complete the query.');
    const payload = await safeJson(response, 'NEWS_QUERY_FAILED');
    if (!Array.isArray(payload)) throw malformedRow();
    return payload as SupabaseNewsRow[];
  }

  async countPending(query: SupabaseNewsBoundaryQuery): Promise<number> {
    const url = this.buildPendingCountUrl(query);
    const response = await this.fetchImpl(url, {
      method: 'HEAD',
      headers: {
        ...this.headers(),
        prefer: 'count=exact',
      },
    });
    if (!response.ok) throw new AIChatHttpError(503, 'NEWS_PENDING_COUNT_FAILED', 'The pending news count is unavailable.');
    return parseContentRangeCount(response.headers.get('content-range'));
  }

  private buildPublishedUrl(query: SupabaseNewsBoundaryQuery): string {
    const url = new URL(`${this.url}/rest/v1/news_items`);
    url.searchParams.set('select', PUBLISHED_SELECT);
    url.searchParams.set('status', 'eq.published');
    url.searchParams.set('published_at', 'not.is.null');
    applyFilters(url, query);
    url.searchParams.set('order', 'published_at.desc,id.asc');
    url.searchParams.set('limit', String(query.limit));
    return url.toString();
  }

  private buildPendingCountUrl(query: SupabaseNewsBoundaryQuery): string {
    const url = new URL(`${this.url}/rest/v1/news_items`);
    url.searchParams.set('status', 'eq.pending');
    applyTerritoryFilter(url, query.territories);
    return url.toString();
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.serviceKey,
      authorization: `Bearer ${this.serviceKey}`,
    };
  }
}

type InternalPublishedNewsItem = AIChatPublishedNewsItem & {
  territories: AIChatNewsTerritory[];
};

function mapPublishedRow(row: SupabaseNewsRow): InternalPublishedNewsItem | undefined {
  if (stringValue(row.status) !== 'published') return undefined;

  const id = stringValue(row.id);
  const title = stringValue(row.title);
  const summary = stringValue(row.body);
  const publishedAt = stringValue(row.published_at);
  const territories = normalizedTerritories(row.territories);
  if (!id || !title || !summary || !publishedAt || !territories.length || !isValidIsoDate(publishedAt)) return undefined;

  const source = firstValidSource(row.sources);
  return {
    id,
    title,
    summary,
    publishedAt,
    territories,
    territory: territories[0],
    language: normalizeLanguage(stringValue(row.original_lang)),
    ...(source?.publisher ? { publisher: source.publisher } : {}),
    ...(source?.url ? { url: source.url } : {}),
    sourceFile: 'public.news_items',
  };
}

function normalizeBoundaryQuery(query: AIChatNewsQuery): SupabaseNewsBoundaryQuery {
  return {
    territories: (query.territories || [])
      .map((territory) => normalizeTerritory(territory))
      .filter((territory): territory is AIChatNewsTerritory => Boolean(territory)),
    topics: normalizeNewsTopics(query.topics),
    ...(isValidDateFilter(query.fromDate) ? { fromDate: query.fromDate } : {}),
    ...(isValidDateFilter(query.toDate) ? { toDate: query.toDate } : {}),
    limit: topicCandidateLimit(query),
  };
}

function topicCandidateLimit(query: AIChatNewsQuery): number {
  const limit = normalizeLimit(query.limit);
  return normalizeNewsTopics(query.topics).length
    ? Math.max(limit * 5, TOPIC_CANDIDATE_MIN_LIMIT)
    : limit;
}

function applyFilters(url: URL, query: SupabaseNewsBoundaryQuery): void {
  applyTerritoryFilter(url, query.territories);
  if (query.fromDate) url.searchParams.set('published_at', `gte.${startBoundaryIso(query.fromDate)}`);
  if (query.toDate) url.searchParams.append('published_at', `lte.${endBoundaryIso(query.toDate)}`);
}

function applyTerritoryFilter(url: URL, territories: AIChatNewsTerritory[]): void {
  if (territories.length === 1) {
    url.searchParams.set('territories', `cs.{${territories[0]}}`);
  } else if (territories.length > 1) {
    url.searchParams.set('or', `(${territories.map((territory) => `territories.cs.{${territory}}`).join(',')})`);
  }
}

function matchesAnyTerritory(rowTerritories: AIChatNewsTerritory[] | undefined, queryTerritories: AIChatNewsTerritory[]): boolean {
  if (!queryTerritories.length) return true;
  return Boolean(rowTerritories?.some((territory) => queryTerritories.includes(territory)));
}

function normalizedTerritories(value: unknown): AIChatNewsTerritory[] {
  const values = Array.isArray(value) ? value : [];
  return dedupe(values
    .map((territory) => normalizeTerritory(stringValue(territory)))
    .filter((territory): territory is AIChatNewsTerritory => Boolean(territory)));
}

function normalizeTerritory(value: string): AIChatNewsTerritory | undefined {
  if (!value) return undefined;
  if (value === 'Brunei Darussalam') return 'Brunei';
  return SUPPORTED_TERRITORIES.includes(value as AIChatNewsTerritory)
    ? value as AIChatNewsTerritory
    : undefined;
}

function firstValidSource(value: unknown): { publisher?: string; url?: string } | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const record = candidate as Record<string, unknown>;
    const publisher = stringValue(record.name);
    const url = validHttpUrl(stringValue(record.url));
    if (publisher || url) {
      return {
        ...(publisher ? { publisher } : {}),
        ...(url ? { url } : {}),
      };
    }
  }
  return undefined;
}

function normalizeLanguage(value?: string): AIChatNewsLanguage {
  const normalized = (value || '').trim().toLowerCase();
  if (['en', 'eng', 'en-us', 'en-gb', 'english'].includes(normalized)) return 'en';
  if (['ms', 'msa', 'ms-my', 'malay', 'bahasa melayu'].includes(normalized)) return 'ms';
  return 'unknown';
}

function preferLanguage(records: InternalPublishedNewsItem[], language?: string): InternalPublishedNewsItem[] {
  const normalized = normalizeLanguage(language);
  if (normalized === 'unknown') return records;
  const matching = records.filter((record) => record.language === normalized);
  return matching.length ? matching : records;
}

function comparePublishedNews(a: AIChatPublishedNewsItem, b: AIChatPublishedNewsItem): number {
  const byDate = Number(new Date(b.publishedAt)) - Number(new Date(a.publishedAt));
  return byDate || a.id.localeCompare(b.id);
}

function matchesDate(publishedAt: string, fromDate?: string, toDate?: string): boolean {
  const published = parseIsoTime(publishedAt);
  if (published === undefined) return false;
  const from = fromDate ? parseIsoTime(startBoundaryIso(fromDate)) : undefined;
  const to = toDate ? parseIsoTime(endBoundaryIso(toDate)) : undefined;
  if (from !== undefined && published < from) return false;
  if (to !== undefined && published > to) return false;
  return true;
}

function startBoundaryIso(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
}

function endBoundaryIso(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
}

function isValidDateFilter(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && parseIsoTime(value) !== undefined);
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && parseIsoTime(value) !== undefined;
}

function parseIsoTime(value: string): number | undefined {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
}

function normalizeLimit(limit?: number): number {
  return Math.max(0, Math.floor(limit ?? DEFAULT_LIMIT));
}

function validHttpUrl(value: string): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parseContentRangeCount(value: string | null): number {
  const count = value?.match(/\/(\d+)$/)?.[1];
  if (!count) throw new AIChatHttpError(503, 'NEWS_PENDING_COUNT_FAILED', 'The pending news count is unavailable.');
  return Number(count);
}

async function safeJson(response: Response, code: 'NEWS_QUERY_FAILED'): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new AIChatHttpError(503, code, 'The news repository could not complete the query.');
  }
}

function malformedRow(): AIChatHttpError {
  return new AIChatHttpError(503, 'NEWS_MALFORMED_ROW', 'The news repository returned malformed data.');
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function dedupeById<T extends { id: string }>(records: T[]): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
