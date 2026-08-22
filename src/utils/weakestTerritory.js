// BT-22: which of the 4 territories has the lowest Resilience Index right
// now, and that territory's own weakest pillar — the "Where" slot of the
// AnswerStrip. Deliberately separate from buildAggregateResilience (which
// averages ACROSS territories): this picks the single worst-off territory,
// not a Borneo-wide mean.
export function findWeakestTerritory(territories) {
  const entries = Object.entries(territories || {}).filter(([, data]) => Number.isFinite(data?.index));
  if (!entries.length) return null;

  const [territory, data] = entries.reduce((weakest, entry) =>
    entry[1].index < weakest[1].index ? entry : weakest
  );

  return {
    territory,
    index: data.index,
    weakestPillar: data.weakestPillar || null,
  };
}
