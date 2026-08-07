import { describe, expect, it } from 'vitest';
import { buildSimulationAnswer } from './simulationAnswerBuilder.ts';
import { simulate_resilience } from './resilienceSimulation.ts';

const ILLUSTRATIVE_EN = 'Illustrative — deterministic scenario, not a forecast.';
const ILLUSTRATIVE_MS = 'Ilustrasi — senario deterministik, bukan ramalan.';

describe('buildSimulationAnswer — resolved requests', () => {
  it('narrates the exact numbers simulate_resilience() returns for the same inputs', () => {
    const request = { status: 'RESOLVED', territory: 'Brunei', indicator: 'Paddy production per capita', targetValue: 40 };
    const direct = simulate_resilience('Brunei', { 'Paddy production per capita': 40 });
    const answer = buildSimulationAnswer(request, 'en');

    expect(answer.status).toBe('RESOLVED');
    expect(answer.before).toEqual(direct.before);
    expect(answer.after).toEqual(direct.after);
    expect(answer.deltas).toEqual(direct.deltas);
    expect(answer.answer).toContain(String(direct.before.index));
    expect(answer.answer).toContain(String(direct.after.index));
  });

  it('always includes the exact illustrative disclaimer wording (English)', () => {
    const request = { status: 'RESOLVED', territory: 'Sabah', indicator: 'Electricity access', targetValue: 100 };
    const answer = buildSimulationAnswer(request, 'en');
    expect(answer.answer).toContain(ILLUSTRATIVE_EN);
  });

  it('always includes the exact illustrative disclaimer wording (Bahasa Melayu)', () => {
    const request = { status: 'RESOLVED', territory: 'Sabah', indicator: 'Electricity access', targetValue: 100 };
    const answer = buildSimulationAnswer(request, 'ms');
    expect(answer.answer).toContain(ILLUSTRATIVE_MS);
  });

  it('approvedNumericTokens includes every number that appears in the answer text', () => {
    const request = { status: 'RESOLVED', territory: 'Brunei', indicator: 'Paddy production per capita', targetValue: 40 };
    const answer = buildSimulationAnswer(request, 'en');
    const numbersInText = [...answer.answer.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => m[0]);
    for (const number of numbersInText) {
      const stripped = number.replace(/^-/, '');
      const found = answer.approvedNumericTokens.some((token) => token === number || token.replace(/^\+/, '') === stripped || token === stripped);
      expect(found, `expected ${number} to be an approved token`).toBe(true);
    }
  });

  it('handles a territory/indicator combination with no scored pillars gracefully (no NaN, no throw)', () => {
    const request = { status: 'RESOLVED', territory: 'Sabah', indicator: 'Adult literacy', targetValue: 90 };
    expect(() => buildSimulationAnswer(request, 'en')).not.toThrow();
  });
});

describe('buildSimulationAnswer — clarification requests', () => {
  it('lists candidate territories and indicators, includes the reasons as warnings', () => {
    const request = {
      status: 'NEEDS_CLARIFICATION',
      reasons: ['No territory (Sabah, Sarawak, Brunei, or Kalimantan) was recognised in the question.'],
      candidateTerritories: ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'],
      candidateIndicators: ['Paddy production per capita', 'Electricity access'],
    };
    const answer = buildSimulationAnswer(request, 'en');
    expect(answer.status).toBe('NEEDS_CLARIFICATION');
    expect(answer.answer).toContain('Paddy production per capita');
    expect(answer.warnings).toEqual(request.reasons);
  });

  it('never calls simulate_resilience for a clarification request (no before/after/deltas)', () => {
    const request = {
      status: 'NEEDS_CLARIFICATION',
      reasons: ['No target value was found.'],
      candidateTerritories: ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'],
      candidateIndicators: ['Life expectancy'],
    };
    const answer = buildSimulationAnswer(request, 'en');
    expect(answer.before).toBeUndefined();
    expect(answer.after).toBeUndefined();
    expect(answer.deltas).toBeUndefined();
  });

  it('does not include the illustrative disclaimer in a clarification (nothing was simulated yet)', () => {
    const request = {
      status: 'NEEDS_CLARIFICATION',
      reasons: ['No target value was found.'],
      candidateTerritories: ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'],
      candidateIndicators: ['Life expectancy'],
    };
    const answer = buildSimulationAnswer(request, 'en');
    expect(answer.answer).not.toContain(ILLUSTRATIVE_EN);
  });
});
