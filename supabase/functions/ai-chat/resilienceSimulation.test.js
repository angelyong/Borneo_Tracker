import { describe, expect, it } from 'vitest';
import { recompute, simulate_resilience, getResilienceModel } from './resilienceSimulation.ts';
import { recompute as jsRecompute, simulate_resilience as jsSimulateResilience } from '../../../src/utils/resilienceModel.js';
import resilience from '../../../public/data/resilience.json' with { type: 'json' };

const TERRITORIES = ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];

// IS-6: this port must be logically identical to src/utils/resilienceModel.js
// (the browser-bundle original) — Deno can't import that file directly (see
// resilienceSimulation.ts's header comment), so this test is the guarantee
// that copying the logic here didn't introduce drift.
describe('resilienceSimulation.ts port — identical output to src/utils/resilienceModel.js', () => {
  for (const territory of TERRITORIES) {
    it(`recompute('${territory}', {}) matches the original engine exactly`, () => {
      const ported = recompute(territory, {});
      const original = jsRecompute(territory, {});
      expect(ported).toEqual(original);
    });
  }

  it('recompute with overrides matches the original engine exactly', () => {
    const overrides = { 'Paddy production per capita': 40, 'Life expectancy': 78 };
    expect(recompute('Brunei', overrides)).toEqual(jsRecompute('Brunei', overrides));
  });

  it('recompute clamps extreme values identically to the original engine', () => {
    const overrides = { 'Paddy production per capita': 999999 };
    expect(recompute('Sabah', overrides)).toEqual(jsRecompute('Sabah', overrides));
    const negOverrides = { 'Paddy production per capita': -999999 };
    expect(recompute('Sabah', negOverrides)).toEqual(jsRecompute('Sabah', negOverrides));
  });

  for (const territory of TERRITORIES) {
    it(`simulate_resilience('${territory}', {}) matches the original engine exactly`, () => {
      expect(simulate_resilience(territory, {})).toEqual(jsSimulateResilience(territory, {}));
    });
  }

  it('simulate_resilience with changes matches the original engine exactly', () => {
    const changes = { 'Paddy production per capita': 40 };
    expect(simulate_resilience('Brunei', changes)).toEqual(jsSimulateResilience('Brunei', changes));
  });
});

describe('resilienceSimulation.ts port — golden parity with committed resilience.json', () => {
  const committed = resilience.territories;
  for (const territory of TERRITORIES) {
    it(`recompute('${territory}', {}) reproduces the committed baseline`, () => {
      const actual = recompute(territory, {});
      const expected = committed[territory];
      expect(actual.index).toBeCloseTo(expected.index, 1);
      expect(actual.indexStrict).toBeCloseTo(expected.indexStrict, 1);
      expect(actual.rag).toBe(expected.rag);
      expect(actual.weakestPillar).toBe(expected.weakestPillar);
    });
  }
});

describe('getResilienceModel', () => {
  it('exposes the loaded model (pillars, bounds, baseline) for callers that need to parse a request', () => {
    const model = getResilienceModel();
    expect(model.pillars).toEqual(['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment']);
    expect(model.bounds['Paddy production per capita']).toEqual({ unit: 'kg/capita', best: 100, worst: 0 });
    expect(Object.keys(model.baseline).sort()).toEqual(TERRITORIES.sort());
  });
});
