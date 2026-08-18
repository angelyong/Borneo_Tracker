// Presentation-only helpers for the All-Borneo view. These mirror the existing
// dashboard aggregate arithmetic while retaining the contributor denominator for
// every pillar. A missing score is deliberately omitted, never converted to zero.

export const RESILIENCE_PILLARS = [
  'Food',
  'Energy',
  'Education',
  'Shelter',
  'Healthcare',
  'Entertainment',
];

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function ragFor(score, thresholds) {
  if (!Number.isFinite(score)) return null;
  if (score >= thresholds.green) return 'green';
  if (score >= thresholds.amber) return 'amber';
  return 'red';
}

/**
 * Builds the frontend's All-Borneo aggregate from territory entries in
 * resilience.json. It intentionally uses the same arithmetic as the previous
 * inline dashboard implementation: mean territory index; mean available score
 * per pillar; geometric mean of the available aggregated pillars.
 *
 * The extra `pillarCoverage` field is essential presentation evidence: it makes
 * a partial contributor set visible without changing, filling, or weighting it.
 */
export function buildAggregateResilience(territories, ragThresholds = {}) {
  const thresholds = {
    green: Number.isFinite(ragThresholds.green) ? ragThresholds.green : 70,
    amber: Number.isFinite(ragThresholds.amber) ? ragThresholds.amber : 40,
  };
  const scoredTerritories = Object.entries(territories || {}).filter(([, territory]) =>
    Number.isFinite(territory?.index)
  );

  if (!scoredTerritories.length) return null;

  const denominator = scoredTerritories.length;
  const index = roundOne(
    scoredTerritories.reduce((sum, [, territory]) => sum + territory.index, 0) / denominator
  );
  const pillarScores = {};
  const pillarCoverage = {};

  RESILIENCE_PILLARS.forEach((pillar) => {
    const contributors = scoredTerritories.filter(([, territory]) =>
      Number.isFinite(territory.pillarScores?.[pillar])
    );
    const contributorCount = contributors.length;
    const missingTerritories = scoredTerritories
      .filter(([, territory]) => !Number.isFinite(territory.pillarScores?.[pillar]))
      .map(([territory]) => territory);

    pillarCoverage[pillar] = {
      contributorCount,
      denominator,
      contributorTerritories: contributors.map(([territory]) => territory),
      missingTerritories,
    };

    if (contributorCount) {
      pillarScores[pillar] = roundOne(
        contributors.reduce((sum, [, territory]) => sum + territory.pillarScores[pillar], 0) /
          contributorCount
      );
    }
  });

  const scoredPillars = RESILIENCE_PILLARS.filter((pillar) => Number.isFinite(pillarScores[pillar]));
  const unscoredPillars = RESILIENCE_PILLARS.filter((pillar) => !Number.isFinite(pillarScores[pillar]));
  const partialContributorPillars = scoredPillars.filter(
    (pillar) => pillarCoverage[pillar].contributorCount < denominator
  );
  const aggregateCoverageStatus = unscoredPillars.length
    ? partialContributorPillars.length
      ? 'aggregateCoveragePartialContributorsAndUnscored'
      : 'aggregateCoverageUnscored'
    : partialContributorPillars.length
      ? 'aggregateCoveragePartialContributors'
      : 'aggregateCoverageFull';
  const values = scoredPillars.map((pillar) => pillarScores[pillar]);
  const indexStrict = values.length
    ? roundOne(Math.pow(values.reduce((product, value) => product * value, 1), 1 / values.length))
    : null;
  const weakestPillar = scoredPillars.length
    ? scoredPillars.reduce((weakest, pillar) =>
        pillarScores[pillar] < pillarScores[weakest] ? pillar : weakest
      )
    : null;

  return {
    index,
    rag: ragFor(index, thresholds),
    indexStrict,
    ragStrict: ragFor(indexStrict, thresholds),
    weakestPillar,
    pillarScores,
    scoredPillars,
    unscoredPillars,
    partialContributorPillars,
    aggregateCoverageStatus,
    pillarCoverage,
    scoredTerritoryCount: denominator,
    thresholds,
    isAggregate: true,
  };
}
