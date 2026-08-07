// Impact Simulator engine — mirrors compute_resilience.py's scoring purely by
// applying the params public/data/resilience_model.json exports (bounds,
// pillars, rag thresholds). This file must NEVER hard-code its own bounds or
// weights — that would be a second source of truth and could silently drift
// from the real Resilience Index. See docs/IMPACT_SIMULATOR_SPEC.md §2.
//
// Guarded by src/utils/resilienceModel.test.js's golden test: recompute(territory, {})
// must reproduce the committed public/data/resilience.json for all 4
// territories (within the rounding precision resilience_model.json declares).

// Statically bundled default — same convention as importing any other committed
// public/data JSON at build time. A caller that needs the freshest possible
// data without a rebuild (e.g. a page that already fetched the model via a
// hook) can pass its own `model` as the 3rd argument instead.
import defaultModel from '../../public/data/resilience_model.json';

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

// Same linear-normalization rule as compute_resilience.score_value(): value is
// only scored if BOUNDS has this indicator AND the row's unit matches exactly.
function scoreValue(indicator, unit, value, bounds) {
  const spec = bounds?.[indicator];
  if (!spec || value === null || value === undefined || !Number.isFinite(Number(value))) {
    return null;
  }
  if ((unit || '').trim() !== spec.unit) {
    return null; // same indicator name, non-comparable unit — never scored
  }
  const { best, worst } = spec;
  if (best === worst) return null;
  const ratio = (Number(value) - worst) / (best - worst);
  return round1(Math.max(0, Math.min(1, ratio)) * 100);
}

// Geometric mean of already-rounded pillar scores — collapses to exactly 0 if
// any scored pillar is <= 0 ("no food = no resilience, however good the rest").
function geometricMean(scores) {
  if (!scores.length) return null;
  if (scores.some((score) => score <= 0)) return 0;
  const product = scores.reduce((acc, score) => acc * score, 1);
  return round1(product ** (1 / scores.length));
}

// RAG band from the ROUNDED index value (matches compute_resilience.rag_band).
// `thresholds` must come from the loaded model — never a local default, or a
// stale copy could silently disagree with RAG_GREEN/RAG_AMBER in
// compute_resilience.py (the same "second source of truth" risk as bounds).
function ragBand(value, thresholds) {
  if (value === null || value === undefined || !thresholds) return null;
  if (value >= thresholds.green) return 'green';
  if (value >= thresholds.amber) return 'amber';
  return 'red';
}

const EMPTY_RESULT = Object.freeze({
  pillarScores: {},
  index: null,
  indexStrict: null,
  rag: null,
  ragStrict: null,
  weakestPillar: null,
  deltas: { index: null, indexStrict: null, pillarScores: {} },
});

// recompute(territory, overrides) -> { pillarScores, index, indexStrict, rag,
// weakestPillar, deltas } — the contract from IMPACT_SIMULATOR_SPEC.md §2.
// `overrides` is { indicatorName: newRawValue }, applied on top of the
// territory's baseline.inputs; anything not overridden keeps its baseline value.
export function recompute(territory, overrides = {}, model = defaultModel) {
  const baseline = model?.baseline?.[territory];
  if (!baseline) return EMPTY_RESULT;

  const pillars = model.pillars || [];
  const thresholds = model.index?.ragThresholds; // no fallback — see ragBand()

  const scoresByPillar = {};
  for (const [indicator, input] of Object.entries(baseline.inputs || {})) {
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, indicator);
    const rawValue = hasOverride ? overrides[indicator] : input.value;
    const score = scoreValue(indicator, input.unit, rawValue, model.bounds);
    if (score === null) continue;
    (scoresByPillar[input.pillar] ||= []).push(score);
  }

  const pillarScores = {};
  for (const pillar of pillars) {
    const scores = scoresByPillar[pillar];
    if (scores && scores.length) {
      pillarScores[pillar] = round1(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
  }

  const scoredValues = Object.values(pillarScores);
  const index = scoredValues.length ? round1(scoredValues.reduce((a, b) => a + b, 0) / scoredValues.length) : null;
  const indexStrict = scoredValues.length ? geometricMean(scoredValues) : null;
  const weakestPillar = Object.keys(pillarScores).length
    ? Object.keys(pillarScores).reduce((min, p) => (pillarScores[p] < pillarScores[min] ? p : min))
    : null;

  const deltas = {
    index: index !== null && baseline.index !== null && baseline.index !== undefined ? round1(index - baseline.index) : null,
    indexStrict:
      indexStrict !== null && baseline.indexStrict !== null && baseline.indexStrict !== undefined
        ? round1(indexStrict - baseline.indexStrict)
        : null,
    pillarScores: {},
  };
  for (const pillar of pillars) {
    const before = baseline.pillarScores?.[pillar];
    const after = pillarScores[pillar];
    if (before !== undefined && after !== undefined) {
      deltas.pillarScores[pillar] = round1(after - before);
    }
  }

  return {
    pillarScores,
    index,
    indexStrict,
    rag: ragBand(index, thresholds),
    ragStrict: ragBand(indexStrict, thresholds),
    weakestPillar,
    deltas,
  };
}

// simulate_resilience(territory, changes) -> { before, after, deltas } — the
// chatbot tool seam (IMPACT_SIMULATOR_SPEC.md §4, Stage IS-5). Pure
// shaping/wrapping around two recompute() calls — no independent scoring
// logic lives here. Kept in this file (rather than a separate module) since
// it has no state or dependencies of its own beyond recompute() and round1(),
// both already local to this module.
//
// indexStrict is included in before/after even though the spec's example
// contract only lists `index`: it's cheap (already computed by recompute())
// and every other Simulator surface (the UI panels, the golden test) already
// treats it as a first-class sibling of index, not an optional extra.
export function simulate_resilience(territory, changes = {}, model = defaultModel) {
  const before = recompute(territory, {}, model);
  const after = recompute(territory, changes, model);

  const pillarDeltas = {};
  for (const pillar of model?.pillars || []) {
    const b = before.pillarScores[pillar];
    const a = after.pillarScores[pillar];
    if (b !== undefined && a !== undefined) {
      pillarDeltas[pillar] = round1(a - b);
    }
  }

  return {
    before: { index: before.index, indexStrict: before.indexStrict, pillarScores: before.pillarScores, weakest: before.weakestPillar },
    after: { index: after.index, indexStrict: after.indexStrict, pillarScores: after.pillarScores, weakest: after.weakestPillar },
    deltas: {
      index: before.index !== null && after.index !== null ? round1(after.index - before.index) : null,
      indexStrict:
        before.indexStrict !== null && after.indexStrict !== null ? round1(after.indexStrict - before.indexStrict) : null,
      pillarScores: pillarDeltas,
    },
  };
}
