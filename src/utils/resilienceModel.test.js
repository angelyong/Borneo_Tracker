import { describe, expect, it } from 'vitest';
import { recompute, simulate_resilience } from './resilienceModel';
import model from '../../public/data/resilience_model.json';
import resilience from '../../public/data/resilience.json';

const PILLARS = model.pillars;
const TERRITORIES = ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];
// Read from the model's own declared precision — never invent a tolerance.
// toBeCloseTo's 2nd arg is "digits after the decimal point", which is exactly
// what resilience_model.json's scoring.roundingPrecision means here.
const PRECISION_DIGITS = model.scoring.roundingPrecision;

// ─── IS-2A: sanity tests — shape, range, no NaN/Infinity (not a value check) ───

describe('recompute — sanity (shape, range, determinism)', () => {
  it('returns the full contract shape for every territory, no NaN/Infinity/undefined', () => {
    for (const territory of TERRITORIES) {
      const result = recompute(territory, {});
      expect(result).toHaveProperty('pillarScores');
      expect(result).toHaveProperty('index');
      expect(result).toHaveProperty('indexStrict');
      expect(result).toHaveProperty('rag');
      expect(result).toHaveProperty('weakestPillar');
      expect(result).toHaveProperty('deltas');

      for (const [pillar, score] of Object.entries(result.pillarScores)) {
        expect(PILLARS).toContain(pillar);
        expect(Number.isFinite(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
      if (result.index !== null) {
        expect(Number.isFinite(result.index)).toBe(true);
      }
      if (result.indexStrict !== null) {
        expect(Number.isFinite(result.indexStrict)).toBe(true);
      }
    }
  });

  it('is deterministic for the same input', () => {
    for (const territory of TERRITORIES) {
      expect(recompute(territory, {})).toEqual(recompute(territory, {}));
    }
  });

  it('a territory absent from the model returns the null/empty shape, not a throw', () => {
    const result = recompute('Atlantis', {});
    expect(result.index).toBeNull();
    expect(result.pillarScores).toEqual({});
    expect(result.weakestPillar).toBeNull();
  });

  it('clamps an out-of-range override instead of producing an absurd or NaN score', () => {
    for (const territory of TERRITORIES) {
      const [indicator] = Object.keys(model.baseline[territory].inputs);
      if (!indicator) continue; // territory has zero scored indicators
      const pillar = model.baseline[territory].inputs[indicator].pillar;

      const tooHigh = recompute(territory, { [indicator]: 999999 });
      const tooLow = recompute(territory, { [indicator]: -999999 });
      expect(tooHigh.pillarScores[pillar]).toBeLessThanOrEqual(100);
      expect(tooLow.pillarScores[pillar]).toBeGreaterThanOrEqual(0);
    }
  });

  it('raising a scored indicator toward its best bound never lowers that pillar score', () => {
    for (const territory of TERRITORIES) {
      const [indicator, input] = Object.entries(model.baseline[territory].inputs)[0] || [];
      if (!indicator) continue;

      const spec = model.bounds[indicator];
      const before = recompute(territory, {});
      const after = recompute(territory, { [indicator]: spec.best });
      expect(after.pillarScores[input.pillar]).toBeGreaterThanOrEqual(before.pillarScores[input.pillar]);
    }
  });

  it('an override on an unknown indicator is ignored, not injected as a new score', () => {
    const baseline = recompute('Sabah', {});
    const withJunk = recompute('Sabah', { 'Not a real indicator': 999 });
    expect(withJunk).toEqual(baseline);
  });
});

// ─── IS-2B: golden drift test — the anti-lie gate ──────────────────────────
// Expected values are read from the COMMITTED resilience.json at test-run
// time (imported above), never typed into this file as literals. This is
// what lets the test stay green across routine daily data refreshes (both
// resilience.json and resilience_model.json regenerate together from the
// same pipeline run, per IS-1B) while still catching real drift between the
// JS and Python math.

describe('recompute — golden drift test vs committed resilience.json', () => {
  const committed = resilience.territories;

  for (const territory of TERRITORIES) {
    const expected = committed[territory];
    const actual = recompute(territory, {});

    describe(territory, () => {
      it('index matches the committed value', () => {
        if (expected.index === null) {
          expect(actual.index).toBeNull();
        } else {
          expect(actual.index).toBeCloseTo(expected.index, PRECISION_DIGITS);
        }
      });

      it('indexStrict matches the committed value', () => {
        if (expected.indexStrict === null) {
          expect(actual.indexStrict).toBeNull();
        } else {
          expect(actual.indexStrict).toBeCloseTo(expected.indexStrict, PRECISION_DIGITS);
        }
      });

      it('rag matches the committed classification', () => {
        expect(actual.rag).toBe(expected.rag);
      });

      it('ragStrict matches the committed classification', () => {
        expect(actual.ragStrict).toBe(expected.ragStrict);
      });

      it('weakestPillar matches the committed value', () => {
        expect(actual.weakestPillar).toBe(expected.weakestPillar);
      });

      it('has exactly the same set of scored pillars as committed', () => {
        expect(Object.keys(actual.pillarScores).sort()).toEqual(Object.keys(expected.pillarScores).sort());
      });

      // One assertion per pillar (not one big loop) so a single mismatch names
      // the exact pillar in the failure output, e.g. "Brunei > pillarScore: Food".
      for (const pillar of PILLARS) {
        it(`pillarScore: ${pillar}`, () => {
          const expectedScore = expected.pillarScores[pillar];
          const actualScore = actual.pillarScores[pillar];
          if (expectedScore === undefined) {
            expect(actualScore).toBeUndefined();
          } else {
            expect(actualScore).toBeCloseTo(expectedScore, PRECISION_DIGITS);
          }
        });
      }
    });
  }

  it('covers all 4 territories', () => {
    expect(TERRITORIES.sort()).toEqual(['Brunei', 'Kalimantan', 'Sabah', 'Sarawak']);
  });
});

// ─── IS-5: simulate_resilience — the chatbot tool seam ─────────────────────
// This function is a thin wrapper around recompute(), so it deliberately
// does NOT re-assert golden values here — `before` is proven correct by the
// golden test above, and `after`/`deltas` are proven correct by resilienceModel's
// own override/clamping tests. These tests only check the wrapping/shaping.

describe('simulate_resilience — shape and wiring', () => {
  it('returns before/after/deltas with index, indexStrict, pillarScores, weakest for all 4 territories', () => {
    for (const territory of TERRITORIES) {
      const result = simulate_resilience(territory, {});
      for (const side of [result.before, result.after]) {
        expect(side).toHaveProperty('index');
        expect(side).toHaveProperty('indexStrict');
        expect(side).toHaveProperty('pillarScores');
        expect(side).toHaveProperty('weakest');
      }
      expect(result.deltas).toHaveProperty('index');
      expect(result.deltas).toHaveProperty('indexStrict');
      expect(result.deltas).toHaveProperty('pillarScores');
    }
  });

  it('"before" exactly matches recompute(territory, {}) — no separate golden check needed', () => {
    for (const territory of TERRITORIES) {
      const direct = recompute(territory, {});
      const wrapped = simulate_resilience(territory, {}).before;
      expect(wrapped.index).toBe(direct.index);
      expect(wrapped.indexStrict).toBe(direct.indexStrict);
      expect(wrapped.pillarScores).toEqual(direct.pillarScores);
      expect(wrapped.weakest).toBe(direct.weakestPillar);
    }
  });

  it('"after" exactly matches recompute(territory, changes) for the same changes', () => {
    const changes = { 'Paddy production per capita': 40 };
    const direct = recompute('Brunei', changes);
    const wrapped = simulate_resilience('Brunei', changes).after;
    expect(wrapped.index).toBe(direct.index);
    expect(wrapped.pillarScores).toEqual(direct.pillarScores);
    expect(wrapped.weakest).toBe(direct.weakestPillar);
  });

  it('empty changes: before and after are identical, all deltas zero/null', () => {
    for (const territory of TERRITORIES) {
      const result = simulate_resilience(territory, {});
      expect(result.after).toEqual(result.before);
      if (result.deltas.index !== null) {
        expect(result.deltas.index).toBe(0);
      }
      for (const delta of Object.values(result.deltas.pillarScores)) {
        expect(delta).toBe(0);
      }
    }
  });

  it('deltas arithmetic is exactly after minus before, for index and every pillar', () => {
    const result = simulate_resilience('Sabah', { 'Paddy production per capita': 80 });
    expect(result.deltas.index).toBeCloseTo(result.after.index - result.before.index, 5);
    expect(result.deltas.indexStrict).toBeCloseTo(result.after.indexStrict - result.before.indexStrict, 5);
    for (const pillar of Object.keys(result.deltas.pillarScores)) {
      expect(result.deltas.pillarScores[pillar]).toBeCloseTo(
        result.after.pillarScores[pillar] - result.before.pillarScores[pillar],
        5
      );
    }
  });

  it('multiple simultaneous changes are all reflected in "after" and its deltas', () => {
    const result = simulate_resilience('Brunei', {
      'Paddy production per capita': 40,
      'Clean water access': 60,
      'Life expectancy': 78,
    });
    expect(result.deltas.pillarScores.Food).not.toBe(0);
    expect(result.deltas.pillarScores.Shelter).not.toBe(0);
    expect(result.deltas.pillarScores.Healthcare).not.toBe(0);
    // Untouched pillars must show exactly zero movement, not just "small".
    expect(result.deltas.pillarScores.Energy).toBe(0);
    expect(result.deltas.pillarScores.Entertainment).toBe(0);
  });

  it('a territory absent from the model returns the null/empty shape, not a throw', () => {
    const result = simulate_resilience('Atlantis', {});
    expect(result.before.index).toBeNull();
    expect(result.after.index).toBeNull();
    expect(result.deltas.index).toBeNull();
  });
});
