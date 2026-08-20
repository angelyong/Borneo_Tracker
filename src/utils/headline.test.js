import { describe, expect, it } from 'vitest';
import { buildHeadline } from './headline';

describe('buildHeadline', () => {
  it('returns an unavailable state rather than fabricating a score or weakest pillar', () => {
    expect(buildHeadline(null)).toEqual({
      key: 'dashboard.headline.unavailable',
      values: {},
      coverage: { isIncomplete: true, unscoredPillars: [], partialPillars: [] },
    });
    expect(buildHeadline({ index: Number.NaN, weakestPillar: 'Education' }).key).toBe(
      'dashboard.headline.unavailable'
    );
  });

  it('uses a complete, precomputed territory summary without calculating any score or band', () => {
    const summary = {
      index: 67.6,
      rag: 'amber',
      weakestPillar: 'Food',
      scoredPillars: ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'],
      unscoredPillars: [],
    };

    expect(buildHeadline(summary)).toEqual({
      key: 'dashboard.headline.complete',
      values: {
        index: 67.6,
        rag: 'amber',
        weakestPillar: 'Food',
        scoredPillarCount: 6,
        scoredTerritoryCount: null,
      },
      coverage: { isIncomplete: false, unscoredPillars: [], partialPillars: [] },
    });
  });

  it('does not name a weakest pillar when the summary has a score but no valid weakest pillar', () => {
    const result = buildHeadline({ index: 71.7, rag: 'green', scoredPillars: ['Food'] });

    expect(result.key).toBe('dashboard.headline.scoreOnly');
    expect(result.values.weakestPillar).toBeNull();
    expect(result.coverage.isIncomplete).toBe(false);
  });

  it('does not fabricate an interpretation band when the precomputed summary lacks one', () => {
    const result = buildHeadline({
      index: 71.7,
      weakestPillar: 'Education',
      scoredPillars: ['Food', 'Energy', 'Education'],
    });

    expect(result.key).toBe('dashboard.headline.scoreOnly');
    expect(result.values.rag).toBeNull();
    expect(result.values.weakestPillar).toBe('Education');
  });

  it('selects the incomplete state when a territory explicitly has unscored pillars', () => {
    const result = buildHeadline({
      index: 72.1,
      rag: 'green',
      weakestPillar: 'Food',
      scoredPillars: ['Food', 'Energy', 'Shelter', 'Healthcare', 'Entertainment'],
      unscoredPillars: ['Education'],
    });

    expect(result.key).toBe('dashboard.headline.incomplete');
    expect(result.coverage).toEqual({
      isIncomplete: true,
      unscoredPillars: ['Education'],
      partialPillars: [],
    });
  });

  it('selects the incomplete state when an aggregate pillar has fewer contributors than the aggregate denominator', () => {
    const result = buildHeadline({
      index: 71.7,
      rag: 'green',
      weakestPillar: 'Education',
      scoredPillars: ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'],
      unscoredPillars: [],
      scoredTerritoryCount: 4,
      pillarContributors: { Food: 4, Energy: 4, Education: 2, Shelter: 4, Healthcare: 4, Entertainment: 4 },
    });

    expect(result.key).toBe('dashboard.headline.incomplete');
    expect(result.coverage).toEqual({
      isIncomplete: true,
      unscoredPillars: [],
      partialPillars: ['Education'],
    });
  });

  it('does not mistake a complete aggregate for incomplete coverage', () => {
    const result = buildHeadline({
      index: 71.7,
      rag: 'green',
      weakestPillar: 'Education',
      scoredPillars: ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'],
      unscoredPillars: [],
      scoredTerritoryCount: 4,
      pillarContributors: { Food: 4, Energy: 4, Education: 4, Shelter: 4, Healthcare: 4, Entertainment: 4 },
    });

    expect(result.key).toBe('dashboard.headline.complete');
    expect(result.coverage.isIncomplete).toBe(false);
  });

  it('accepts aggregate presentation coverage directly without duplicating its contributor arithmetic', () => {
    const result = buildHeadline({
      index: 71.7,
      rag: 'green',
      weakestPillar: 'Food',
      scoredPillars: ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'],
      unscoredPillars: [],
      scoredTerritoryCount: 4,
      pillarCoverage: {
        Food: { contributorCount: 4 },
        Energy: { contributorCount: 4 },
        Education: { contributorCount: 2 },
      },
    });

    expect(result.key).toBe('dashboard.headline.incomplete');
    expect(result.coverage.partialPillars).toEqual(['Education']);
    expect(result.values.weakestPillar).toBe('Food');
  });

  it('deduplicates repeated pillar labels and ignores malformed contributor counts', () => {
    const result = buildHeadline({
      index: 50,
      rag: 'amber',
      weakestPillar: 'Food',
      scoredPillars: ['Food', 'Food', '', null],
      unscoredPillars: ['Education', 'Education', 4],
      scoredTerritoryCount: 4,
      pillarContributors: { Food: 4, Education: '2' },
    });

    expect(result.values.scoredPillarCount).toBe(1);
    expect(result.coverage).toEqual({
      isIncomplete: true,
      unscoredPillars: ['Education'],
      partialPillars: [],
    });
  });
});
