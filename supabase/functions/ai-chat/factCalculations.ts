import type { FactValue } from './contracts.ts';

export type PillarScoreInput = {
  pillar: string;
  score: number;
};

export type ExtremumResult = {
  pillar?: string;
  value?: number;
  ties: string[];
};

export type DifferenceResult =
  | {
      ok: true;
      value: number;
      formattedValue: string;
      unit: string;
      method: string;
    }
  | {
      ok: false;
      reason: string;
    };

export type TargetBounds = {
  unit: string;
  best: number;
  worst: number;
};

export const ROUNDING_POLICY =
  'Calculations preserve raw numeric values and format display numbers to one decimal place unless the source value is an integer.';

export const TARGET_BOUNDS: Record<string, TargetBounds> = {
  'Life expectancy': { unit: 'years', best: 80, worst: 60 },
  'Hospital beds (per 1k)': { unit: '/1k', best: 4, worst: 1 },
  'Clean water access': { unit: '%', best: 100, worst: 50 },
  'Basic sanitation access': { unit: '%', best: 100, worst: 50 },
  'Electricity access': { unit: '%', best: 100, worst: 50 },
  'Electrification ratio': { unit: '%', best: 100, worst: 50 },
  'Renewable electricity (% output)': { unit: '%', best: 100, worst: 0 },
  'Adult literacy': { unit: '%', best: 100, worst: 60 },
  'Mean years schooling (RLS)': { unit: 'years', best: 12, worst: 6 },
  'School enrolment (primary, gross)': { unit: '%', best: 100, worst: 70 },
  'School enrolment (secondary, gross)': { unit: '%', best: 100, worst: 70 },
  'Agricultural land': { unit: '% land', best: 25, worst: 0 },
  'Paddy production per capita': { unit: 'kg/capita', best: 100, worst: 0 },
  'Internet use': { unit: '%', best: 100, worst: 50 },
  'Unemployment rate': { unit: '%', best: 3, worst: 15 },
  'Poverty rate (absolute)': { unit: '%', best: 0, worst: 25 },
  'Poverty rate (P0)': { unit: '%', best: 0, worst: 25 },
  'Poverty headcount <$2.15/day (SDG1)': { unit: '%', best: 0, worst: 25 },
};

export function roundOne(value: number): number {
  return Number(value.toFixed(1));
}

export function formatFactNumber(value: number, unit?: string): string {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return unit === '%' ? `${rounded}%` : rounded;
}

export function formatFactValue(value: number | string, unit?: string): string {
  if (typeof value === 'number') return formatFactNumber(value, unit);
  return value;
}

export function findMinimumPillar(scores: PillarScoreInput[]): ExtremumResult {
  return findPillarExtremum(scores, 'minimum');
}

export function findMaximumPillar(scores: PillarScoreInput[]): ExtremumResult {
  return findPillarExtremum(scores, 'maximum');
}

function findPillarExtremum(scores: PillarScoreInput[], mode: 'minimum' | 'maximum'): ExtremumResult {
  const clean = scores
    .filter((item) => item.pillar && Number.isFinite(item.score))
    .sort((a, b) => a.pillar.localeCompare(b.pillar));
  if (!clean.length) return { ties: [] };
  const extremum = mode === 'minimum'
    ? Math.min(...clean.map((item) => item.score))
    : Math.max(...clean.map((item) => item.score));
  const ties = clean.filter((item) => item.score === extremum).map((item) => item.pillar);
  return {
    pillar: ties[0],
    value: extremum,
    ties,
  };
}

export function calculateCompatibleDifference(left: FactValue, right: FactValue): DifferenceResult {
  if (typeof left.value !== 'number' || typeof right.value !== 'number') {
    return { ok: false, reason: 'Both values must be numeric.' };
  }
  if ((left.unit || '') !== (right.unit || '')) {
    return { ok: false, reason: `Incompatible units: ${left.unit || 'missing'} vs ${right.unit || 'missing'}.` };
  }
  if (left.indicator && right.indicator && left.indicator !== right.indicator) {
    return { ok: false, reason: `Incompatible indicator definitions: ${left.indicator} vs ${right.indicator}.` };
  }
  const value = roundOne(left.value - right.value);
  return {
    ok: true,
    value,
    formattedValue: formatFactNumber(value, left.unit),
    unit: left.unit || '',
    method: 'left minus right after unit and indicator compatibility checks',
  };
}

export function calculateTargetGap(current: FactValue, target: FactValue): DifferenceResult {
  if (typeof current.value !== 'number' || typeof target.value !== 'number') {
    return { ok: false, reason: 'Current value and target must both be numeric.' };
  }
  if ((current.unit || '') !== (target.unit || '')) {
    return { ok: false, reason: `Target unit ${target.unit || 'missing'} does not match current unit ${current.unit || 'missing'}.` };
  }
  const value = roundOne(target.value - current.value);
  return {
    ok: true,
    value,
    formattedValue: formatFactNumber(value, current.unit),
    unit: current.unit || '',
    method: 'target minus current value',
  };
}

export function targetForIndicator(indicator?: string, unit?: string): TargetBounds | undefined {
  if (!indicator) return undefined;
  const bounds = TARGET_BOUNDS[indicator];
  if (!bounds || bounds.unit !== unit) return undefined;
  return bounds;
}

