import { describe, expect, it } from 'vitest';
import { extractTargetValue, parseResilienceSimulationRequest } from './resilienceSimulationRequest.ts';
import { resolveAiChatEntities } from './entityResolver.ts';

function entitiesFor(message, options = {}) {
  return resolveAiChatEntities(message, { language: 'en', ...options });
}

describe('extractTargetValue', () => {
  it('parses "from X to Y" and takes the target (Y), not the starting point (X)', () => {
    expect(extractTargetValue("What if Brunei's food self-sufficiency went from 8 to 40?")).toBe(40);
  });

  it('parses a plain "...to X" phrasing', () => {
    expect(extractTargetValue("What happens if healthcare access improved to 70?")).toBe(70);
  });

  it('parses a percent-suffixed target', () => {
    expect(extractTargetValue('What if electricity access went to 95%?')).toBe(95);
  });

  it('returns null when no absolute target value is present (e.g. a relative "by X" phrasing)', () => {
    expect(extractTargetValue('What if food production increased by 20?')).toBeNull();
  });

  it('returns null for a question with no numbers at all', () => {
    expect(extractTargetValue('What if food improved a lot?')).toBeNull();
  });
});

describe('parseResilienceSimulationRequest — resolved cases', () => {
  it('resolves territory + indicator + value for a clear question', () => {
    const message = "What if Brunei's paddy production per capita went from 8 to 40?";
    const result = parseResilienceSimulationRequest(message, entitiesFor(message));
    expect(result.status).toBe('RESOLVED');
    if (result.status === 'RESOLVED') {
      expect(result.territory).toBe('Brunei');
      expect(result.indicator).toBe('Paddy production per capita');
      expect(result.targetValue).toBe(40);
    }
  });

  it('resolves a different territory/indicator/value combination', () => {
    const message = "What happens to Sabah's resilience if electricity access improved to 100?";
    const result = parseResilienceSimulationRequest(message, entitiesFor(message));
    expect(result.status).toBe('RESOLVED');
    if (result.status === 'RESOLVED') {
      expect(result.territory).toBe('Sabah');
      expect(result.indicator).toBe('Electricity access');
      expect(result.targetValue).toBe(100);
    }
  });
});

describe('parseResilienceSimulationRequest — clarification cases (never guesses)', () => {
  it('asks for clarification on a misspelled/unrecognised territory', () => {
    const message = 'What if Sarawakk improved electricity access to 90?';
    const result = parseResilienceSimulationRequest(message, entitiesFor(message));
    expect(result.status).toBe('NEEDS_CLARIFICATION');
    if (result.status === 'NEEDS_CLARIFICATION') {
      expect(result.reasons.some((r) => /territory/i.test(r))).toBe(true);
      expect(result.candidateTerritories).toEqual(['Sabah', 'Sarawak', 'Brunei', 'Kalimantan']);
    }
  });

  it('asks for clarification on a nonexistent indicator', () => {
    const message = "What if Brunei's happiness score went up to 90?";
    const result = parseResilienceSimulationRequest(message, entitiesFor(message));
    expect(result.status).toBe('NEEDS_CLARIFICATION');
    if (result.status === 'NEEDS_CLARIFICATION') {
      expect(result.reasons.some((r) => /indicator/i.test(r))).toBe(true);
    }
  });

  it('asks for clarification when no territory is mentioned at all', () => {
    const message = 'What if electricity access improved to 90?';
    const result = parseResilienceSimulationRequest(message, entitiesFor(message));
    expect(result.status).toBe('NEEDS_CLARIFICATION');
  });

  it('asks for clarification when no target value is given', () => {
    const message = "What if Brunei's electricity access improved?";
    const result = parseResilienceSimulationRequest(message, entitiesFor(message));
    expect(result.status).toBe('NEEDS_CLARIFICATION');
    if (result.status === 'NEEDS_CLARIFICATION') {
      expect(result.reasons.some((r) => /target value/i.test(r))).toBe(true);
    }
  });

  it('restricts candidate indicators to the mentioned pillar when the pillar is known but the exact indicator is not', () => {
    const message = 'What if Brunei improved its food situation a lot?';
    const result = parseResilienceSimulationRequest(message, entitiesFor(message));
    expect(result.status).toBe('NEEDS_CLARIFICATION');
    if (result.status === 'NEEDS_CLARIFICATION') {
      expect(result.candidateIndicators).toContain('Paddy production per capita');
      expect(result.candidateIndicators).not.toContain('Life expectancy');
    }
  });
});
