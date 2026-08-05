import type {
  AIChatEntityResult,
  AIChatIntentResult,
  AIChatNewsQuery,
  AIChatNewsResult,
  AIChatNewsTerritory,
  AIChatPublishedNewsItem,
} from './contracts.ts';
import type { AIChatNewsRepository } from './newsRepository.ts';

export const DEFAULT_NEWS_LIMIT = 5;
export const MAX_NEWS_LIMIT = 10;

type NewsRetrieverInput = {
  intent: AIChatIntentResult;
  entities: AIChatEntityResult;
  language: string;
  repository: AIChatNewsRepository;
  query?: Partial<AIChatNewsQuery>;
};

export async function retrieveAIChatNews(input: NewsRetrieverInput): Promise<AIChatNewsResult> {
  const warnings: string[] = [];
  const query = buildNewsQuery(input, warnings);
  const safeQuery = stripInvalidDates(query, warnings);
  const [published, pendingCount] = await Promise.all([
    input.repository.findPublished(safeQuery),
    input.repository.countPending(safeQuery),
  ]);
  const normalized = dedupeById(published).sort(comparePublishedNews);
  if (!normalized.length) warnings.push('NO_PUBLISHED_NEWS_MATCH');
  if (requestedLanguage(input.language) && normalized.length && !normalized.some((item) => item.language === requestedLanguage(input.language))) {
    warnings.push('NO_NEWS_IN_REQUESTED_LANGUAGE');
  }

  return {
    published: normalized.slice(0, safeQuery.limit || DEFAULT_NEWS_LIMIT),
    pending: { count: pendingCount },
    warnings: dedupe(warnings),
    queryApplied: {
      territories: safeQuery.territories,
      ...(safeQuery.fromDate ? { fromDate: safeQuery.fromDate } : {}),
      ...(safeQuery.toDate ? { toDate: safeQuery.toDate } : {}),
      limit: safeQuery.limit || DEFAULT_NEWS_LIMIT,
    },
  };
}

export function buildNewsQuery(input: Omit<NewsRetrieverInput, 'repository'>, warnings: string[] = []): AIChatNewsQuery {
  const territories = normalizeTerritories(input.query?.territories || input.entities.territories, warnings);
  const dateRange = input.query?.fromDate || input.query?.toDate
    ? { fromDate: input.query.fromDate, toDate: input.query.toDate }
    : datesFromEntities(input.entities);
  const requestedLimit = input.query?.limit;
  const limit = Math.min(MAX_NEWS_LIMIT, Math.max(0, Math.floor(requestedLimit ?? DEFAULT_NEWS_LIMIT)));

  return {
    territories,
    ...(dateRange.fromDate ? { fromDate: dateRange.fromDate } : {}),
    ...(dateRange.toDate ? { toDate: dateRange.toDate } : {}),
    latest: input.query?.latest ?? input.entities.operations.latest,
    limit,
    language: input.query?.language || input.language,
  };
}

function datesFromEntities(entities: AIChatEntityResult): Pick<AIChatNewsQuery, 'fromDate' | 'toDate'> {
  if (entities.yearRange) {
    return {
      fromDate: `${entities.yearRange.start}-01-01`,
      toDate: `${entities.yearRange.end}-12-31`,
    };
  }
  if (entities.years.length === 1) {
    return {
      fromDate: `${entities.years[0]}-01-01`,
      toDate: `${entities.years[0]}-12-31`,
    };
  }
  return {};
}

function stripInvalidDates(query: AIChatNewsQuery, warnings: string[]): AIChatNewsQuery {
  const fromDate = validDateFilter(query.fromDate) ? query.fromDate : undefined;
  const toDate = validDateFilter(query.toDate) ? query.toDate : undefined;
  if (query.fromDate && !fromDate) warnings.push('INVALID_FROM_DATE');
  if (query.toDate && !toDate) warnings.push('INVALID_TO_DATE');
  const { fromDate: _fromDate, toDate: _toDate, ...rest } = query;
  void _fromDate;
  void _toDate;
  return {
    ...rest,
    ...(fromDate ? { fromDate } : {}),
    ...(toDate ? { toDate } : {}),
  };
}

function validDateFilter(value?: string): boolean {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function normalizeTerritories(values: string[], warnings: string[]): AIChatNewsTerritory[] {
  const normalized = values.map(normalizeTerritory);
  const unsupported = values.filter((_, index) => !normalized[index]);
  if (unsupported.length) warnings.push('UNKNOWN_NEWS_TERRITORY');
  return dedupe(normalized.filter((value): value is AIChatNewsTerritory => Boolean(value)));
}

function normalizeTerritory(value: string): AIChatNewsTerritory | undefined {
  if (value === 'Brunei Darussalam') return 'Brunei';
  if (['Sabah', 'Sarawak', 'Brunei', 'Kalimantan', 'Borneo-wide', 'unknown'].includes(value)) {
    return value as AIChatNewsTerritory;
  }
  return undefined;
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

function requestedLanguage(language?: string): 'en' | 'ms' | undefined {
  if (language === 'en' || language === 'ms') return language;
  return undefined;
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}
