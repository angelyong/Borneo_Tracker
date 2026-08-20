import { describe, expect, it } from 'vitest';
import { buildHeadline } from './headline';

describe('deterministic dashboard headline', () => {
  it('uses only the supplied resilience summary and never invents a value', () => {
    expect(buildHeadline(null).key).toBe('dashboard.headline.unavailable');
    expect(buildHeadline({ index: 67.6, rag: 'amber', weakestPillar: 'Food' })).toEqual({
      key: 'dashboard.headline.complete',
      values: { index: 67.6, rag: 'amber', weakestPillar: 'Food' },
    });
  });

  it('discloses incomplete pillar coverage instead of treating it as zero', () => {
    expect(buildHeadline({ index: 70, rag: 'green', weakestPillar: 'Education', unscoredPillars: ['Healthcare'] }).key)
      .toBe('dashboard.headline.incomplete');
  });
});
