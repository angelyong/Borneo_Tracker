import { describe, expect, it, vi } from 'vitest';
import { buildNewsQuery, MAX_NEWS_LIMIT, retrieveAIChatNews } from './newsRetriever.ts';

function entities(overrides = {}) {
  return {
    territories: ['Sabah'],
    regions: [],
    concepts: [],
    indicators: [],
    pillars: [],
    districts: [],
    years: [],
    operations: {
      comparison: false,
      ranking: false,
      trend: false,
      weakest: false,
      strongest: false,
      targetGap: false,
      sdgProgress: false,
      districtLevel: false,
      latest: false,
    },
    ambiguities: [],
    matchedTerms: [],
    language: 'en',
    ...overrides,
  };
}

const intent = {
  intent: 'BORNEO_NEWS',
  confidence: 1,
  reasons: [],
  matchedTerms: [],
  language: 'en',
};

function item(overrides = {}) {
  return {
    id: 'published-1',
    title: 'Published item',
    summary: 'Published summary.',
    publishedAt: '2026-07-13T10:00:00Z',
    territory: 'Sabah',
    language: 'en',
    publisher: 'Publisher',
    url: 'https://example.com/story',
    ...overrides,
  };
}

describe('newsRetriever', () => {
  it('builds bounded query from resolved territories and latest operation', () => {
    const warnings = [];
    const query = buildNewsQuery({
      intent,
      entities: entities({
        territories: ['Sabah', 'Brunei Darussalam'],
        operations: { ...entities().operations, latest: true },
      }),
      language: 'ms',
    }, warnings);

    expect(query).toMatchObject({
      territories: ['Sabah', 'Brunei'],
      latest: true,
      limit: 5,
      language: 'ms',
    });
    expect(warnings).toEqual([]);
  });

  it('converts entity years into inclusive date filters', () => {
    expect(buildNewsQuery({
      intent,
      entities: entities({ years: [2026] }),
      language: 'en',
    })).toMatchObject({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
    });

    expect(buildNewsQuery({
      intent,
      entities: entities({ yearRange: { start: 2024, end: 2026 } }),
      language: 'en',
    })).toMatchObject({
      fromDate: '2024-01-01',
      toDate: '2026-12-31',
    });
  });

  it('enforces maximum limit and reports malformed direct dates', async () => {
    const repository = {
      findPublished: vi.fn().mockResolvedValue([item()]),
      countPending: vi.fn().mockResolvedValue(0),
    };

    const result = await retrieveAIChatNews({
      intent,
      entities: entities(),
      language: 'en',
      repository,
      query: { fromDate: 'bad-date', toDate: '2026-07-31', limit: 999 },
    });

    expect(repository.findPublished).toHaveBeenCalledWith(expect.objectContaining({
      toDate: '2026-07-31',
      limit: MAX_NEWS_LIMIT,
    }));
    expect(repository.findPublished.mock.calls[0][0]).not.toHaveProperty('fromDate');
    expect(result.warnings).toContain('INVALID_FROM_DATE');
    expect(result.queryApplied.limit).toBe(MAX_NEWS_LIMIT);
  });

  it('combines published items with pending count without exposing pending content', async () => {
    const repository = {
      findPublished: vi.fn().mockResolvedValue([item(), item({ id: 'published-2', publishedAt: '2026-07-14T00:00:00Z' })]),
      countPending: vi.fn().mockResolvedValue(7),
    };

    const result = await retrieveAIChatNews({ intent, entities: entities(), language: 'en', repository });

    expect(result.published.map((record) => record.id)).toEqual(['published-2', 'published-1']);
    expect(result.pending).toEqual({ count: 7 });
    expect(JSON.stringify(result)).not.toContain('PENDING_SECRET_TITLE');
  });

  it('deduplicates published items by id after injected repository behavior', async () => {
    const repository = {
      findPublished: vi.fn().mockResolvedValue([
        item({ id: 'dup', title: 'First' }),
        item({ id: 'dup', title: 'Second' }),
      ]),
      countPending: vi.fn().mockResolvedValue(0),
    };

    const result = await retrieveAIChatNews({ intent, entities: entities(), language: 'en', repository });

    expect(result.published).toHaveLength(1);
    expect(result.published[0].title).toBe('First');
  });

  it('returns empty-result warning with zero pending count', async () => {
    const repository = {
      findPublished: vi.fn().mockResolvedValue([]),
      countPending: vi.fn().mockResolvedValue(0),
    };

    const result = await retrieveAIChatNews({ intent, entities: entities(), language: 'en', repository });

    expect(result).toMatchObject({
      published: [],
      pending: { count: 0 },
      warnings: ['NO_PUBLISHED_NEWS_MATCH'],
    });
  });

  it('returns empty-result warning while exposing only aggregate pending count', async () => {
    const repository = {
      findPublished: vi.fn().mockResolvedValue([]),
      countPending: vi.fn().mockResolvedValue(2),
    };

    const result = await retrieveAIChatNews({ intent, entities: entities(), language: 'en', repository });

    expect(result.published).toEqual([]);
    expect(result.pending.count).toBe(2);
    expect(JSON.stringify(result)).not.toContain('pending-secret-id');
  });

  it('adds a language fallback warning and does not translate records', async () => {
    const repository = {
      findPublished: vi.fn().mockResolvedValue([item({ id: 'en-only', title: 'English only', language: 'en' })]),
      countPending: vi.fn().mockResolvedValue(0),
    };

    const result = await retrieveAIChatNews({ intent, entities: entities(), language: 'ms', repository });

    expect(result.published[0]).toMatchObject({ title: 'English only', language: 'en' });
    expect(result.warnings).toContain('NO_NEWS_IN_REQUESTED_LANGUAGE');
  });

  it('does not guess unknown territories', () => {
    const warnings = [];
    const query = buildNewsQuery({
      intent,
      entities: entities({ territories: ['North Coast'] }),
      language: 'en',
    }, warnings);

    expect(query.territories).toEqual([]);
    expect(warnings).toEqual(['UNKNOWN_NEWS_TERRITORY']);
  });
});

