import { describe, expect, it } from 'vitest';
import { LocalNewsRepository } from './localNewsRepository.ts';

const PENDING_SENTINEL = {
  id: 'pending-secret-id',
  title: 'PENDING_SECRET_TITLE',
  body: 'PENDING_SECRET_SUMMARY',
  publisher: 'PENDING_SECRET_PUBLISHER',
  url: 'https://pending-secret.example/private',
  status: 'pending',
  territories: ['Sabah'],
  createdAt: '2026-07-13T00:00:00Z',
};

function published(overrides = {}) {
  return {
    id: 'published-1',
    title: 'Published Sabah update',
    body: 'Published summary only.',
    status: 'published',
    territories: ['Sabah'],
    publishedAt: '2026-07-13T10:00:00Z',
    originalLang: 'en',
    sources: [{ name: 'Trusted Publisher', url: 'https://example.com/news' }],
    ...overrides,
  };
}

describe('LocalNewsRepository', () => {
  it('returns published records with deterministic source metadata', async () => {
    const repository = new LocalNewsRepository({ records: [published()] });

    await expect(repository.findPublished({ territories: ['Sabah'] })).resolves.toEqual([
      expect.objectContaining({
        id: 'published-1',
        title: 'Published Sabah update',
        summary: 'Published summary only.',
        publisher: 'Trusted Publisher',
        url: 'https://example.com/news',
        territory: 'Sabah',
        language: 'en',
      }),
    ]);
  });

  it('never returns pending, draft, rejected, malformed, or missing-status records', async () => {
    const repository = new LocalNewsRepository({
      records: [
        published(),
        PENDING_SENTINEL,
        published({ id: 'draft-1', status: 'draft' }),
        published({ id: 'rejected-1', status: 'rejected' }),
        published({ id: 'malformed-1', status: 'not-a-status' }),
        { ...published({ id: 'missing-status-1' }), status: undefined },
      ],
    });

    const result = await repository.findPublished({ territories: [] });

    expect(result.map((item) => item.id)).toEqual(['published-1']);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('PENDING_SECRET_TITLE');
    expect(serialized).not.toContain('PENDING_SECRET_SUMMARY');
    expect(serialized).not.toContain('pending-secret-id');
    expect(serialized).not.toContain('PENDING_SECRET_PUBLISHER');
    expect(serialized).not.toContain('pending-secret.example');
  });

  it('returns only a numeric pending count', async () => {
    const repository = new LocalNewsRepository({ records: [published(), PENDING_SENTINEL] });
    const count = await repository.countPending({ territories: ['Sabah'] });

    expect(count).toBe(1);
    expect(typeof count).toBe('number');
  });

  it.each([
    ['Sabah', 'sabah-1'],
    ['Sarawak', 'sarawak-1'],
    ['Brunei', 'brunei-1'],
    ['Kalimantan', 'kalimantan-1'],
    ['Borneo-wide', 'borneo-1'],
  ])('filters published records for %s without territory guessing', async (territory, id) => {
    const records = [
      published({ id: 'sabah-1', territories: ['Sabah'] }),
      published({ id: 'sarawak-1', territories: ['Sarawak'] }),
      published({ id: 'brunei-1', territories: ['Brunei'] }),
      published({ id: 'kalimantan-1', territories: ['Kalimantan'] }),
      published({ id: 'borneo-1', territories: ['Borneo-wide'] }),
    ];
    const repository = new LocalNewsRepository({ records });

    await expect(repository.findPublished({ territories: [territory] })).resolves.toEqual([
      expect.objectContaining({ id }),
    ]);
  });

  it('returns the union for multiple territories and no results for unknown territories', async () => {
    const repository = new LocalNewsRepository({
      records: [
        published({ id: 'sabah-1', territories: ['Sabah'] }),
        published({ id: 'sarawak-1', territories: ['Sarawak'] }),
      ],
    });

    await expect(repository.findPublished({ territories: ['Sabah', 'Sarawak'] })).resolves.toHaveLength(2);
    await expect(repository.findPublished({ territories: ['unknown'] })).resolves.toEqual([]);
  });

  it('applies inclusive date filters and excludes invalid or missing publication dates', async () => {
    const repository = new LocalNewsRepository({
      records: [
        published({ id: 'start', publishedAt: '2026-07-01T00:00:00Z' }),
        published({ id: 'inside', publishedAt: '2026-07-10T12:00:00Z' }),
        published({ id: 'end', publishedAt: '2026-07-31T23:59:59Z' }),
        published({ id: 'before', publishedAt: '2026-06-30T23:59:59Z' }),
        published({ id: 'bad-date', publishedAt: 'not-a-date' }),
        published({ id: 'missing-date', publishedAt: undefined }),
      ],
    });

    const result = await repository.findPublished({
      territories: ['Sabah'],
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    });

    expect(result.map((item) => item.id)).toEqual(['end', 'inside', 'start']);
  });

  it('orders latest records newest first with id tie-break and enforces limit', async () => {
    const repository = new LocalNewsRepository({
      records: [
        published({ id: 'b', publishedAt: '2026-07-13T10:00:00Z' }),
        published({ id: 'a', publishedAt: '2026-07-13T10:00:00Z' }),
        published({ id: 'older', publishedAt: '2026-07-12T10:00:00Z' }),
      ],
    });

    const result = await repository.findPublished({ territories: ['Sabah'], latest: true, limit: 2 });

    expect(result.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('uses language as a preference and does not translate', async () => {
    const repository = new LocalNewsRepository({
      records: [
        published({ id: 'en-1', originalLang: 'en', title: 'English title' }),
        published({ id: 'ms-1', originalLang: 'ms', title: 'Tajuk Melayu' }),
      ],
    });

    await expect(repository.findPublished({ territories: ['Sabah'], language: 'ms' })).resolves.toEqual([
      expect.objectContaining({ id: 'ms-1', title: 'Tajuk Melayu' }),
    ]);
  });

  it('falls back to available published records when no preferred language exists', async () => {
    const repository = new LocalNewsRepository({ records: [published({ id: 'en-1', originalLang: 'en' })] });

    await expect(repository.findPublished({ territories: ['Sabah'], language: 'ms' })).resolves.toEqual([
      expect.objectContaining({ id: 'en-1', language: 'en' }),
    ]);
  });

  it('keeps missing publisher missing and deduplicates by stable id', async () => {
    const repository = new LocalNewsRepository({
      records: [
        published({ id: 'dup', sources: [] }),
        published({ id: 'dup', title: 'Duplicate should be ignored', sources: [{ name: 'Later' }] }),
      ],
    });

    const result = await repository.findPublished({ territories: ['Sabah'] });

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('publisher');
  });

  it('handles an empty repository', async () => {
    const repository = new LocalNewsRepository();

    await expect(repository.findPublished({ territories: [] })).resolves.toEqual([]);
    await expect(repository.countPending({ territories: [] })).resolves.toBe(0);
  });
});

