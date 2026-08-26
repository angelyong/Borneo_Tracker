import { describe, expect, it } from 'vitest';
import { buildAnswerStrip, weakestTerritory } from './answerStrip';
import { makeSimulatorHref } from './simulatorRoute';

const headline = {
  key: 'dashboard.headline.complete',
  values: { index: 67.6, rag: 'amber', weakestPillar: 'Education' },
  coverage: { isIncomplete: false, unscoredPillars: [], partialPillars: [] },
};

const territories = {
  Sabah: { index: 67.6, rag: 'amber', weakestPillar: 'Education' },
  Sarawak: { index: 73.6, rag: 'green', weakestPillar: 'Food' },
  Brunei: { index: 78.0, rag: 'green', weakestPillar: 'Food' },
  Kalimantan: { index: null, rag: null, weakestPillar: null },
};

describe('weakestTerritory', () => {
  it('picks the lowest scored territory and ignores unscored ones', () => {
    expect(weakestTerritory(territories)).toEqual({
      territory: 'Sabah',
      index: 67.6,
      rag: 'amber',
      weakestPillar: 'Education',
    });
  });

  it('returns null when nothing is scored', () => {
    expect(weakestTerritory({ Sabah: { index: null } })).toBeNull();
    expect(weakestTerritory(null)).toBeNull();
  });
});

describe('buildAnswerStrip', () => {
  it('returns null without a headline to answer "what"', () => {
    expect(buildAnswerStrip({ headline: null })).toBeNull();
    expect(buildAnswerStrip()).toBeNull();
  });

  it('answers all four questions for a single territory', () => {
    const strip = buildAnswerStrip({
      headline,
      territory: 'Sabah',
      weakestPillar: 'Education',
      pillarScores: { Education: 52.04, Food: 61 },
      makeHref: makeSimulatorHref,
    });

    expect(strip.what).toBe(headline);
    expect(strip.where).toEqual({
      key: 'answerStrip.wherePillar',
      values: { territory: 'Sabah', pillar: 'Education', score: 52 },
    });
    expect(strip.why).toEqual({ key: 'answerStrip.why.Education', values: { pillar: 'Education' } });
    expect(strip.next.href).toBe('/simulator?territory=Sabah&pillar=Education');
    expect(strip.focus).toEqual({ territory: 'Sabah', pillar: 'Education', index: null });
  });

  it('points the aggregate scope at the weakest territory and that territory\'s own pillar', () => {
    const strip = buildAnswerStrip({
      headline,
      isAggregate: true,
      territories,
      weakestPillar: 'Food',
      makeHref: makeSimulatorHref,
    });

    expect(strip.where).toEqual({
      key: 'answerStrip.whereTerritory',
      values: { territory: 'Sabah', index: 67.6 },
    });
    // The Borneo-wide weakest pillar is an average; the pillar to act on in
    // Sabah is Sabah's own.
    expect(strip.why.key).toBe('answerStrip.why.Education');
    expect(strip.next.href).toBe('/simulator?territory=Sabah&pillar=Education');
  });

  it('keeps "what" and drops the rest when no place can be resolved', () => {
    const strip = buildAnswerStrip({ headline, isAggregate: true, territories: { Sabah: { index: null } } });

    expect(strip.what).toBe(headline);
    expect(strip.where).toBeNull();
    expect(strip.why).toBeNull();
    expect(strip.next).toBeNull();
    expect(strip.focus).toBeNull();
  });

  it('states the weakest pillar without a score rather than inventing one', () => {
    const strip = buildAnswerStrip({
      headline,
      territory: 'Sabah',
      weakestPillar: 'Education',
      pillarScores: { Education: null },
    });

    expect(strip.where.key).toBe('answerStrip.wherePillarNoScore');
    expect(strip.where.values).toEqual({ territory: 'Sabah', pillar: 'Education' });
  });

  it('omits "what next" when no deep link can be built', () => {
    const noBuilder = buildAnswerStrip({ headline, territory: 'Sabah', weakestPillar: 'Education' });
    expect(noBuilder.next).toBeNull();

    // An unroutable territory must not produce a dead CTA.
    const unknownTerritory = buildAnswerStrip({
      headline,
      territory: 'Atlantis',
      weakestPillar: 'Education',
      makeHref: makeSimulatorHref,
    });
    expect(unknownTerritory.next).toBeNull();
    expect(unknownTerritory.where.values.territory).toBe('Atlantis');
  });

  it('omits "why" and "what next" when the scope has no weakest pillar', () => {
    const strip = buildAnswerStrip({
      headline,
      territory: 'Sabah',
      weakestPillar: null,
      makeHref: makeSimulatorHref,
    });

    expect(strip.where).toBeNull();
    expect(strip.why).toBeNull();
    expect(strip.next).toBeNull();
  });
});
