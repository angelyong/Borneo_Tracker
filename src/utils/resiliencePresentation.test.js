import { describe, expect, it } from 'vitest';
import { buildAggregateResilience, RESILIENCE_PILLARS } from './resiliencePresentation';

const thresholds = { green: 70, amber: 40 };

function territory(index, pillarScores) {
  return { index, pillarScores };
}

describe('buildAggregateResilience', () => {
  it('preserves the released aggregate arithmetic and records a 4/4 denominator per pillar', () => {
    const result = buildAggregateResilience(
      {
        Sabah: territory(67.6, { Food: 28.6, Energy: 98.5, Education: 45, Shelter: 61, Healthcare: 76.5, Entertainment: 96 }),
        Sarawak: territory(73.6, { Food: 58, Energy: 98.1, Education: 45, Shelter: 67.4, Healthcare: 77, Entertainment: 96 }),
        Brunei: territory(78, { Food: 7.9, Energy: 100, Education: 90.2, Shelter: 100, Healthcare: 77.5, Entertainment: 92.6 }),
        Kalimantan: territory(67.7, { Food: 77.9, Energy: 99.3, Education: 51.3, Shelter: 66, Healthcare: 59.5, Entertainment: 52.2 }),
      },
      thresholds
    );

    expect(result.index).toBe(71.7);
    expect(result.indexStrict).toBe(69.3);
    expect(result.rag).toBe('green');
    expect(result.ragStrict).toBe('amber');
    expect(result.weakestPillar).toBe('Food');
    expect(result.scoredPillars).toEqual(RESILIENCE_PILLARS);
    expect(result.partialContributorPillars).toEqual([]);
    expect(result.aggregateCoverageStatus).toBe('aggregateCoverageFull');
    for (const pillar of RESILIENCE_PILLARS) {
      expect(result.pillarCoverage[pillar]).toMatchObject({ contributorCount: 4, denominator: 4 });
      expect(result.pillarCoverage[pillar].missingTerritories).toEqual([]);
    }
  });

  it('discloses a partial pillar contributor set without imputing it as zero', () => {
    const result = buildAggregateResilience(
      {
        Sabah: territory(60, { Food: 20, Energy: 80 }),
        Sarawak: territory(70, { Food: 40, Energy: 90, Education: 50 }),
        Brunei: territory(80, { Food: 60, Energy: 100, Education: 80 }),
        Kalimantan: territory(90, { Food: 80, Energy: 70 }),
      },
      thresholds
    );

    expect(result.pillarScores.Education).toBe(65);
    expect(result.pillarCoverage.Education).toEqual({
      contributorCount: 2,
      denominator: 4,
      contributorTerritories: ['Sarawak', 'Brunei'],
      missingTerritories: ['Sabah', 'Kalimantan'],
    });
    expect(result.pillarScores.Shelter).toBeUndefined();
    expect(result.unscoredPillars).toContain('Shelter');
    expect(result.pillarCoverage.Shelter).toMatchObject({ contributorCount: 0, denominator: 4 });
    // Education remains scored, but its 2/4 denominator must select the
    // partial-contributor disclosure instead of the full-coverage sentence.
    expect(result.partialContributorPillars).toEqual(['Education']);
    expect(result.aggregateCoverageStatus).toBe('aggregateCoveragePartialContributorsAndUnscored');
  });

  it('selects the partial-contributor wording when every pillar is scored but one is only 2/4', () => {
    const complete = { Food: 50, Energy: 80, Education: 60, Shelter: 70, Healthcare: 75, Entertainment: 65 };
    const result = buildAggregateResilience(
      {
        Sabah: territory(60, { ...complete, Education: undefined }),
        Sarawak: territory(70, { ...complete, Education: undefined }),
        Brunei: territory(80, complete),
        Kalimantan: territory(90, complete),
      },
      thresholds
    );

    expect(result.scoredPillars).toEqual(RESILIENCE_PILLARS);
    expect(result.unscoredPillars).toEqual([]);
    expect(result.partialContributorPillars).toEqual(['Education']);
    expect(result.aggregateCoverageStatus).toBe('aggregateCoveragePartialContributors');
  });

  it('excludes territories without a scored index from both scores and denominators', () => {
    const result = buildAggregateResilience(
      {
        Sabah: territory(60, { Food: 20 }),
        Sarawak: territory(null, { Food: 99 }),
      },
      thresholds
    );

    expect(result.index).toBe(60);
    expect(result.pillarScores.Food).toBe(20);
    expect(result.pillarCoverage.Food).toMatchObject({ contributorCount: 1, denominator: 1 });
  });
});
