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

export type TargetGapResult =
  | {
      ok: true;
      value: number;
      formattedValue: string;
      unit: string;
      direction: 'increase' | 'reduce' | 'at-target';
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

export function calculateTargetGap(current: FactValue, target: FactValue, bounds: TargetBounds): TargetGapResult {
  if (typeof current.value !== 'number' || typeof target.value !== 'number') {
    return { ok: false, reason: 'Current value and target must both be numeric.' };
  }
  if ((current.unit || '') !== (target.unit || '')) {
    return { ok: false, reason: `Target unit ${target.unit || 'missing'} does not match current unit ${current.unit || 'missing'}.` };
  }
  const higherIsBetter = bounds.best > bounds.worst;
  const meetsTarget = higherIsBetter
    ? current.value >= target.value
    : current.value <= target.value;
  const value = meetsTarget
    ? 0
    : roundOne(higherIsBetter ? target.value - current.value : current.value - target.value);
  return {
    ok: true,
    value,
    formattedValue: formatFactNumber(value, current.unit),
    unit: current.unit || '',
    direction: meetsTarget ? 'at-target' : higherIsBetter ? 'increase' : 'reduce',
    method: meetsTarget
      ? 'current value already meets or exceeds the committed target direction'
      : higherIsBetter
        ? 'increase by target minus current value'
        : 'reduce by current value minus target',
  };
}

export function targetForIndicator(
  indicator: string | undefined,
  unit: string | undefined,
  modelBounds: Record<string, TargetBounds>
): TargetBounds | undefined {
  if (!indicator) return undefined;
  const bounds = modelBounds[indicator];
  if (!bounds || bounds.unit !== unit) return undefined;
  return bounds;
}
