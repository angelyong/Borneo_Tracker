// Deterministic Dashboard headline selection.
//
// This module deliberately receives an already-computed scope summary. It
// never reads public data, calls a service, derives a RAG band, or aggregates
// territories: the presentation layer remains the single owner of those
// operations. Its only job is to select an honest translation key and pass
// through data-derived interpolation values.

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
}

function contributorCounts(scopeSummary) {
  if (scopeSummary?.pillarContributors) return scopeSummary.pillarContributors;
  if (!scopeSummary?.pillarCoverage) return null;

  return Object.fromEntries(
    Object.entries(scopeSummary.pillarCoverage).map(([pillar, coverage]) => [
      pillar,
      coverage?.contributorCount,
    ])
  );
}

function incompleteContributorPillars(pillarContributors, scoredTerritoryCount) {
  if (!pillarContributors || !finiteNumber(scoredTerritoryCount) || scoredTerritoryCount <= 0) return [];

  return Object.entries(pillarContributors)
    .filter(([, contributorCount]) => finiteNumber(contributorCount) && contributorCount < scoredTerritoryCount)
    .map(([pillar]) => pillar);
}

/**
 * Select the translated Dashboard headline for a precomputed scope summary.
 *
 * Expected input is a presentation-level object, for example:
 * {
 *   index, rag, weakestPillar, scoredPillars, unscoredPillars,
 *   scoredTerritoryCount, pillarContributors | pillarCoverage
 * }
 *
 * `pillarContributors` or the aggregate presentation helper's
 * `pillarCoverage` is optional and only needed for an aggregate scope. A
 * partial contributor set is treated as incomplete coverage even if each
 * pillar has an average. The returned `coverage` data is intentionally kept
 * structured so the caller can render localized detail beside the headline.
 */
export function buildHeadline(scopeSummary) {
  if (!scopeSummary || !finiteNumber(scopeSummary.index)) {
    return {
      key: 'dashboard.headline.unavailable',
      values: {},
      coverage: { isIncomplete: true, unscoredPillars: [], partialPillars: [] },
    };
  }

  const unscoredPillars = uniqueStrings(scopeSummary.unscoredPillars);
  const partialPillars = incompleteContributorPillars(
    contributorCounts(scopeSummary),
    scopeSummary.scoredTerritoryCount
  );
  const coverage = {
    isIncomplete: unscoredPillars.length > 0 || partialPillars.length > 0,
    unscoredPillars,
    partialPillars,
  };
  const values = {
    index: scopeSummary.index,
    rag: typeof scopeSummary.rag === 'string' ? scopeSummary.rag : null,
    weakestPillar: typeof scopeSummary.weakestPillar === 'string' ? scopeSummary.weakestPillar : null,
    scoredPillarCount: uniqueStrings(scopeSummary.scoredPillars).length,
    scoredTerritoryCount: finiteNumber(scopeSummary.scoredTerritoryCount)
      ? scopeSummary.scoredTerritoryCount
      : null,
  };

  // A headline must never interpolate an invented interpretation band. The
  // caller can still show the score-only state (and its separate provenance
  // or coverage presentation) while the source artifact is incomplete.
  if (!values.weakestPillar || !values.rag) {
    return { key: 'dashboard.headline.scoreOnly', values, coverage };
  }

  return {
    key: coverage.isIncomplete ? 'dashboard.headline.incomplete' : 'dashboard.headline.complete',
    values,
    coverage,
  };
}
