import { describe, expect, it } from 'vitest';
import { LocalNewsRepository } from './localNewsRepository.ts';

describe('AIChatNewsRepository contract', () => {
  it('supports dependency-injected implementations through findPublished and countPending', async () => {
    const repository = new LocalNewsRepository({
      records: [
        {
          id: 'published-contract',
          title: 'Contract published item',
          body: 'Safe published summary.',
          status: 'published',
          territories: ['Sabah'],
          publishedAt: '2026-07-13T00:00:00Z',
        },
        {
          id: 'pending-contract-secret',
          title: 'PENDING_CONTRACT_SECRET_TITLE',
          body: 'PENDING_CONTRACT_SECRET_SUMMARY',
          status: 'pending',
          territories: ['Sabah'],
        },
      ],
    });

    const published = await repository.findPublished({ territories: ['Sabah'] });
    const pendingCount = await repository.countPending({ territories: ['Sabah'] });

    expect(published).toEqual([expect.objectContaining({ id: 'published-contract' })]);
    expect(pendingCount).toBe(1);
    expect(JSON.stringify({ published, pendingCount })).not.toContain('PENDING_CONTRACT_SECRET');
  });
});

