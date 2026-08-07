// Deno port of src/utils/resilienceModel.js's recompute()/simulate_resilience()
// for the ai-chat edge function (IS-6). The edge function runs on Deno, which
// cannot resolve the browser bundle's plain JSON import
// (`import x from '...json'` needs Deno's `with { type: 'json' }` clause), so
// a literal `import` of the original file is not possible — this is a
// deliberate, logically-identical port, not a rewrite. Every function body
// below is copied line-for-line from src/utils/resilienceModel.js; only the
// import syntax and TypeScript types were added. If the original ever
// changes, this file must be updated to match — see
// resilienceSimulation.test.js, which cross-checks this port's output
// against the same committed resilience_model.json the original engine uses.
import resilienceModel from '../../../public/data/resilience_model.json' with { type: 'json' };

export type ResilienceBounds = Record<string, { unit: string; best: number; worst: number }>;

export type ResilienceModel = {
  schemaVersion: number;
  generatedAt: string;
  pillars: string[];
  bounds: ResilienceBounds;
  indicatorToPillar: Record<string, string>;
  scoring: Record<string, unknown>;
  index: {
    ragThresholds?: { green: number; amber: number };
    [key: string]: unknown;
  };
  baseline: Record<
    string,
    {
      inputs: Record<
        string,
        {
          value: number;
          unit: string;
          score: number;
          year?: number | string;
          source?: string;
          confidence?: string;
          pillar: string;
        }
      >;
      pillarScores: Record<string, number>;
      index: number | null;
      indexStrict: number | null;
      rag: string | null;
      ragStrict: string | null;
      weakestPillar: string | null;
      scoredPillars: string[];
      unscoredPillars: string[];
    }
  >;
};

export type RecomputeResult = {
  pillarScores: Record<string, number>;
  index: number | null;
  indexStrict: number | null;
  rag: string | null;
  ragStrict: string | null;
  weakestPillar: string | null;
  deltas: {
    index: number | null;
    indexStrict: number | null;
    pillarScores: Record<string, number>;
  };
};

export type SimulationResult = {
  before: { index: number | null; indexStrict: number | null; pillarScores: Record<string, number>; weakest: string | null };
  after: { index: number | null; indexStrict: number | null; pillarScores: Record<string, number>; weakest: string | null };
  deltas: {
    index: number | null;
    indexStrict: number | null;
    pillarScores: Record<string, number>;
  };
};

const defaultModel = resilienceModel as unknown as ResilienceModel;

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

// Same linear-normalization rule as compute_resilience.score_value(): value is
// only scored if BOUNDS has this indicator AND the row's unit matches exactly.
function scoreValue(indicator: string, unit: string | undefined, value: number | null | undefined, bounds: ResilienceBounds): number | null {
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
function geometricMean(scores: number[]): number | null {
  if (!scores.length) return null;
  if (scores.some((score) => score <= 0)) return 0;
  const product = scores.reduce((acc, score) => acc * score, 1);
  return round1(product ** (1 / scores.length));
}

// RAG band from the ROUNDED index value (matches compute_resilience.rag_band).
// `thresholds` must come from the loaded model — never a local default, or a
// stale copy could silently disagree with RAG_GREEN/RAG_AMBER in
// compute_resilience.py (the same "second source of truth" risk as bounds).
function ragBand(value: number | null, thresholds: { green: number; amber: number } | undefined): string | null {
  if (value === null || value === undefined || !thresholds) return null;
  if (value >= thresholds.green) return 'green';
  if (value >= thresholds.amber) return 'amber';
  return 'red';
}

const EMPTY_RESULT: RecomputeResult = Object.freeze({
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
export function recompute(
  territory: string,
  overrides: Record<string, number> = {},
  model: ResilienceModel = defaultModel
): RecomputeResult {
  const baseline = model?.baseline?.[territory];
  if (!baseline) return EMPTY_RESULT;

  const pillars = model.pillars || [];
  const thresholds = model.index?.ragThresholds; // no fallback — see ragBand()

  const scoresByPillar: Record<string, number[]> = {};
  for (const [indicator, input] of Object.entries(baseline.inputs || {})) {
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, indicator);
    const rawValue = hasOverride ? overrides[indicator] : input.value;
    const score = scoreValue(indicator, input.unit, rawValue, model.bounds);
    if (score === null) continue;
    (scoresByPillar[input.pillar] ||= []).push(score);
  }

  const pillarScores: Record<string, number> = {};
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
    pillarScores: {} as Record<string, number>,
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
// chatbot tool seam (IMPACT_SIMULATOR_SPEC.md §4). Pure shaping/wrapping
// around two recompute() calls — no independent scoring logic lives here.
export function simulate_resilience(
  territory: string,
  changes: Record<string, number> = {},
  model: ResilienceModel = defaultModel
): SimulationResult {
  const before = recompute(territory, {}, model);
  const after = recompute(territory, changes, model);

  const pillarDeltas: Record<string, number> = {};
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

export function getResilienceModel(): ResilienceModel {
  return defaultModel;
}
