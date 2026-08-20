// Deterministic dashboard headline selection. It receives an already-computed
// scope summary and never calculates a score, RAG band, or missing value.

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function uniqueStrings(values) {
  return Array.isArray(values)
    ? [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))]
    : [];
}

export function buildHeadline(scopeSummary) {
  if (!scopeSummary || !finiteNumber(scopeSummary.index)) {
    return { key: 'dashboard.headline.unavailable', values: {} };
  }

  const values = {
    index: scopeSummary.index,
    rag: typeof scopeSummary.rag === 'string' ? scopeSummary.rag : null,
    weakestPillar: typeof scopeSummary.weakestPillar === 'string' ? scopeSummary.weakestPillar : null,
  };
  if (!values.rag || !values.weakestPillar) {
    return { key: 'dashboard.headline.scoreOnly', values };
  }

  return {
    key: uniqueStrings(scopeSummary.unscoredPillars).length
      ? 'dashboard.headline.incomplete'
      : 'dashboard.headline.complete',
    values,
  };
}
