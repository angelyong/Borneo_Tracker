import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createAIChatNewsRepository, newsRepositoryMode } from './newsRepositoryFactory.ts';
import { SupabaseNewsRepository, SupabaseNewsRestBoundary } from './supabaseNewsRepository.ts';

const PENDING_SENTINEL = {
  id: 'pending-secret-id',
  title: 'PENDING_SUPABASE_SECRET_TITLE',
    body: 'PENDING_SUPABASE_SECRET_BODY',
    status: 'pending',
  published_at: '2026-07-20T00:00:00Z',
  territories: ['Sabah'],
  original_lang: 'en',
  sources: [{ name: 'PENDING_SECRET_PUBLISHER', url: 'https://pending-secret.example/private' }],
};

function row(overrides = {}) {
  return {
    id: 'published-1',
    title: 'Published Sabah update',
    body: 'Published summary.',
    status: 'published',
    published_at: '2026-07-20T10:00:00Z',
    territories: ['Sabah'],
    original_lang: 'en',
    sources: [{ name: 'Trusted Publisher', url: 'https://example.com/story' }],
    ...overrides,
  };
}

function repositoryWith(rows, pendingCount = 0, hooks = {}) {
  const boundary = {
    selectPublished: vi.fn(async (query) => {
      hooks.onSelect?.(query);
      return rows;
    }),
    countPending: vi.fn(async (query) => {
      hooks.onCount?.(query);
      return pendingCount;
    }),
  };
  return {
    boundary,
    repository: new SupabaseNewsRepository({ boundary }),
  };
}

describe('SupabaseNewsRepository', () => {
  it('maps bounded published fields and extracts the first structurally valid source', async () => {
    const { repository } = repositoryWith([
      row({
        id: 'newest',
        sources: [
          { name: '', url: 'ftp://invalid.example/story' },
          { name: 'Valid Publisher', url: 'https://example.com/valid' },
        ],
      }),
    ]);

    await expect(repository.findPublished({ territories: ['Sabah'] })).resolves.toEqual([
      {
        id: 'newest',
        title: 'Published Sabah update',
        summary: 'Published summary.',
        publishedAt: '2026-07-20T10:00:00Z',
        publisher: 'Valid Publisher',
        url: 'https://example.com/valid',
        territory: 'Sabah',
        language: 'en',
        sourceFile: 'public.news_items',
      },
    ]);
  });

  it('keeps missing publisher missing and drops invalid URLs without domain inference', async () => {
    const { repository } = repositoryWith([
      row({ sources: [{ url: 'javascript:alert(1)' }] }),
    ]);

    const result = await repository.findPublished({ territories: ['Sabah'] });

    expect(result[0]).not.toHaveProperty('publisher');
    expect(result[0]).not.toHaveProperty('url');
  });

  it('rejects malformed rows, pending-looking fixture content, and rows without valid dates', async () => {
    const { repository } = repositoryWith([
      row({ id: 'valid' }),
      PENDING_SENTINEL,
      row({ id: 'rejected-territory', territories: ['North Coast'] }),
      row({ id: 'bad-date', published_at: 'not-a-date' }),
      row({ id: '', title: 'Missing id' }),
    ]);

    const result = await repository.findPublished({ territories: ['Sabah'] });
    const serialized = JSON.stringify(result);

    expect(result.map((item) => item.id)).toEqual(['valid']);
    expect(serialized).not.toContain('PENDING_SUPABASE_SECRET_TITLE');
    expect(serialized).not.toContain('PENDING_SUPABASE_SECRET_BODY');
    expect(serialized).not.toContain('PENDING_SECRET_PUBLISHER');
    expect(serialized).not.toContain('pending-secret.example');
  });

  it.each([
    ['Sabah', 'sabah-1'],
    ['Sarawak', 'sarawak-1'],
    ['Brunei', 'brunei-1'],
    ['Kalimantan', 'kalimantan-1'],
    ['Borneo-wide', 'borneo-1'],
    ['unknown', 'unknown-1'],
  ])('filters %s exactly without unintended widening', async (territory, id) => {
    const { repository } = repositoryWith([
      row({ id: 'sabah-1', territories: ['Sabah'] }),
      row({ id: 'sarawak-1', territories: ['Sarawak'] }),
      row({ id: 'brunei-1', territories: ['Brunei'] }),
      row({ id: 'kalimantan-1', territories: ['Kalimantan'] }),
      row({ id: 'borneo-1', territories: ['Borneo-wide'] }),
      row({ id: 'unknown-1', territories: ['unknown'] }),
    ]);

    await expect(repository.findPublished({ territories: [territory] })).resolves.toEqual([
      expect.objectContaining({ id, territory }),
    ]);
  });

  it('matches multi-territory rows while exposing a deterministic primary territory', async () => {
    const { repository } = repositoryWith([
      row({ id: 'multi-1', territories: ['Sarawak', 'Sabah'] }),
    ]);

    const result = await repository.findPublished({ territories: ['Sabah'] });

    expect(result).toEqual([expect.objectContaining({ id: 'multi-1', territory: 'Sarawak' })]);
    expect(result[0]).not.toHaveProperty('territories');
  });

  it('normalizes known language values and falls back when the preferred language has no result', async () => {
    const { repository } = repositoryWith([
      row({ id: 'en-label', original_lang: 'English', published_at: '2026-07-21T00:00:00Z' }),
      row({ id: 'ms-label', original_lang: 'ms-MY', published_at: '2026-07-22T00:00:00Z' }),
      row({ id: 'unknown-label', original_lang: 'id', published_at: '2026-07-23T00:00:00Z' }),
    ]);

    await expect(repository.findPublished({ territories: ['Sabah'], language: 'ms' })).resolves.toEqual([
      expect.objectContaining({ id: 'ms-label', language: 'ms' }),
    ]);
    await expect(repository.findPublished({ territories: ['Sabah'], language: 'fr' })).resolves.toHaveLength(3);
  });

  it('applies inclusive date filters, newest-first sort, id tie-break, dedupe, and limit', async () => {
    const { repository } = repositoryWith([
      row({ id: 'dup', title: 'First kept', published_at: '2026-07-20T00:00:00Z' }),
      row({ id: 'dup', title: 'Duplicate dropped', published_at: '2026-07-20T00:00:00Z' }),
      row({ id: 'b', published_at: '2026-07-31T23:59:59Z' }),
      row({ id: 'a', published_at: '2026-07-31T23:59:59Z' }),
      row({ id: 'before', published_at: '2026-06-30T23:59:59Z' }),
      row({ id: 'after', published_at: '2026-08-01T00:00:00Z' }),
    ]);

    const result = await repository.findPublished({
      territories: ['Sabah'],
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
      limit: 3,
    });

    expect(result.map((item) => item.id)).toEqual(['a', 'b', 'dup']);
    expect(result.find((item) => item.id === 'dup')?.title).toBe('First kept');
  });

  it('post-filters published Supabase rows by controlled topics without inspecting pending rows', async () => {
    const { repository, boundary } = repositoryWith([
      row({ id: 'fire-1', title: 'Forest fire response in Kalimantan', territories: ['Kalimantan'] }),
      row({ id: 'peat-1', title: 'Sarawak peat monitoring update', territories: ['Sarawak'] }),
      PENDING_SENTINEL,
    ], 1);

    const result = await repository.findPublished({
      territories: ['Kalimantan'],
      topics: ['wildfire'],
      limit: 3,
    });

    expect(boundary.selectPublished).toHaveBeenCalledWith(expect.objectContaining({
      territories: ['Kalimantan'],
      topics: ['fire'],
      limit: 25,
    }));
    expect(result.map((item) => item.id)).toEqual(['fire-1']);
    expect(JSON.stringify(result)).not.toContain('PENDING_SUPABASE_SECRET');
  });

  it('returns count only for pending and does not pass language/date filters to the pending boundary', async () => {
    const { repository, boundary } = repositoryWith([], 2);

    await expect(repository.countPending({
      territories: ['Sabah'],
      language: 'ms',
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    })).resolves.toBe(2);

    expect(boundary.countPending).toHaveBeenCalledWith({
      territories: ['Sabah'],
      topics: [],
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
      limit: 5,
    });
  });

  it('maps query and pending-count failures to bounded safe errors', async () => {
    const queryFailure = new SupabaseNewsRepository({
      boundary: {
        selectPublished: vi.fn(async () => {
          throw new Error('PostgREST raw body with PENDING_SUPABASE_SECRET_BODY');
        }),
        countPending: vi.fn(async () => 0),
      },
    });
    const countFailure = new SupabaseNewsRepository({
      boundary: {
        selectPublished: vi.fn(async () => []),
        countPending: vi.fn(async () => {
          throw new Error('PostgREST raw body with PENDING_SUPABASE_SECRET_BODY');
        }),
      },
    });

    await expect(queryFailure.findPublished({ territories: [] })).rejects.toMatchObject({
      code: 'NEWS_QUERY_FAILED',
      message: 'The news repository could not complete the query.',
    });
    await expect(countFailure.countPending({ territories: [] })).rejects.toMatchObject({
      code: 'NEWS_PENDING_COUNT_FAILED',
      message: 'The pending news count is unavailable.',
    });
  });

  it('uses bounded REST select fields for published rows and HEAD exact count for pending', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn(async () => [row()]),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-range': '0-0/7' }),
      });
    const boundary = new SupabaseNewsRestBoundary({
      env: {
        SUPABASE_URL: 'https://example.supabase.co/',
        SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
      },
      fetchImpl,
    });

    await boundary.selectPublished({
      territories: ['Sabah'],
      topics: [],
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
      limit: 5,
    });
    await expect(boundary.countPending({ territories: ['Sabah'], topics: [], limit: 5 })).resolves.toBe(7);

    const [publishedUrl, publishedInit] = fetchImpl.mock.calls[0];
    const [pendingUrl, pendingInit] = fetchImpl.mock.calls[1];
    expect(publishedUrl).toContain('select=id%2Ctitle%2Cbody%2Cpublished_at%2Cterritories%2Coriginal_lang%2Csources%2Cstatus%2Cbeat%2Cbeat_label%2Csdg%2Ccountry');
    expect(publishedUrl).toContain('status=eq.published');
    expect(publishedUrl).toContain('territories=cs.%7BSabah%7D');
    expect(publishedInit.headers).toMatchObject({
      apikey: 'service-secret',
      authorization: 'Bearer service-secret',
    });
    expect(pendingInit).toMatchObject({
      method: 'HEAD',
      headers: expect.objectContaining({ prefer: 'count=exact' }),
    });
    expect(pendingUrl).toContain('status=eq.pending');
    expect(pendingUrl).not.toContain('select=');
    expect(pendingUrl).not.toContain('title');
    expect(pendingUrl).not.toContain('body');
    expect(pendingUrl).not.toContain('sources');
  });

  it('selects repositories explicitly and fails safely when live mode lacks config', () => {
    expect(newsRepositoryMode({})).toBe('local');
    expect(newsRepositoryMode({ AI_CHAT_NEWS_REPOSITORY: 'supabase' })).toBe('supabase');
    expect(() => createAIChatNewsRepository({ env: { AI_CHAT_NEWS_REPOSITORY: 'supabase' } })).toThrowError(
      expect.objectContaining({ code: 'NEWS_REPOSITORY_UNAVAILABLE' })
    );
    expect(createAIChatNewsRepository({
      env: {
        AI_CHAT_NEWS_REPOSITORY: 'supabase',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
      },
    })).toBeInstanceOf(SupabaseNewsRepository);
  });

  it('does not import the frontend browser Supabase client', () => {
    const source = readFileSync('supabase/functions/ai-chat/supabaseNewsRepository.ts', 'utf8');

    expect(source).not.toContain('supabaseClient');
    expect(source).not.toContain('@supabase/supabase-js');
  });
});
