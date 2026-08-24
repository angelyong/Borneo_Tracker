// BT-22 decision framing: turn an already-computed scope summary into the four
// questions a reader actually has — what, where, why, what next.
//
// Like src/utils/headline.js this module only *selects* translation keys and
// passes through data-derived values. It never fetches, never translates, never
// recomputes a score and never invents a place or a pillar that the resilience
// artifact did not score. If a slot cannot be answered from the data it returns
// null and the strip renders one question fewer, which is the honest outcome.

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function roundScore(value) {
  return finiteNumber(value) ? Math.round(value * 10) / 10 : null;
}

/**
 * The weakest scored territory in an aggregate scope.
 *
 * Territories without a finite index are skipped rather than treated as zero —
 * an unscored territory is not the worst-performing one.
 */
export function weakestTerritory(territories) {
  const scored = Object.entries(territories || {}).filter(([, entry]) => finiteNumber(entry?.index));
  if (!scored.length) return null;

  const [territory, entry] = scored.reduce((worst, candidate) =>
    candidate[1].index < worst[1].index ? candidate : worst
  );
  return { territory, index: entry.index, rag: entry.rag ?? null, weakestPillar: entry.weakestPillar ?? null };
}

/**
 * Resolve the single place+pillar the strip talks about, so "where", "why" and
 * "what next" describe one chain rather than three unrelated facts.
 */
function resolveFocus({ isAggregate, territory, territories, weakestPillar }) {
  if (!isAggregate) {
    return territory ? { territory, pillar: weakestPillar || null, index: null } : null;
  }

  const weakest = weakestTerritory(territories);
  if (!weakest) return null;
  return {
    territory: weakest.territory,
    // The aggregate's own weakest pillar is a Borneo-wide average; the pillar
    // to act on in the weakest territory is that territory's own.
    pillar: weakest.weakestPillar || weakestPillar || null,
    index: weakest.index,
  };
}

/**
 * Build the four answer slots.
 *
 * @param {object} input
 * @param {{key: string, values: object}|null} input.headline  BT-07 output, used verbatim as "what".
 * @param {boolean} input.isAggregate     true for the all-Borneo scope.
 * @param {string|null} input.territory   the selected territory when not aggregate.
 * @param {object|null} input.territories raw `resilience.territories`, needed only for the aggregate scope.
 * @param {string|null} input.weakestPillar the scope's weakest scored pillar.
 * @param {object|null} input.pillarScores  the scope's per-pillar scores.
 * @param {(territory: string, pillar: string) => (string|null)} [input.makeHref] BT-21 deep-link builder.
 */
export function buildAnswerStrip({
  headline,
  isAggregate = false,
  territory = null,
  territories = null,
  weakestPillar = null,
  pillarScores = null,
  makeHref = null,
} = {}) {
  if (!headline?.key) return null;

  const focus = resolveFocus({ isAggregate, territory, territories, weakestPillar });
  const empty = { what: headline, where: null, why: null, next: null, focus: null };
  if (!focus) return empty;

  let where = null;
  if (isAggregate) {
    where = { key: 'answerStrip.whereTerritory', values: { territory: focus.territory, index: roundScore(focus.index) } };
  } else {
    const score = roundScore(pillarScores?.[focus.pillar]);
    if (focus.pillar) {
      where = score === null
        ? { key: 'answerStrip.wherePillarNoScore', values: { territory: focus.territory, pillar: focus.pillar } }
        : { key: 'answerStrip.wherePillar', values: { territory: focus.territory, pillar: focus.pillar, score } };
    }
  }

  // "Why" is a fixed, reviewed consequence statement per pillar. There is no
  // generated prose here and no key is invented for a pillar we did not score.
  const why = focus.pillar ? { key: `answerStrip.why.${focus.pillar}`, values: { pillar: focus.pillar } } : null;

  const href = focus.pillar && typeof makeHref === 'function' ? makeHref(focus.territory, focus.pillar) : null;
  // Reuses BT-21's existing CTA string rather than adding a second copy of it.
  const next = href
    ? { key: 'dashboard.whatNextCta', values: { territory: focus.territory, pillar: focus.pillar }, href }
    : null;

  return { what: headline, where, why, next, focus };
}
