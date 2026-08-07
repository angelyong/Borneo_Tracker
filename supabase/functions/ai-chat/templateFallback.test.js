import { describe, expect, it } from 'vitest';
import {
  buildTemplateFallback,
  buildKnowledgeTemplateFallback,
  buildSimulationTemplateFallback,
  canBuildTemplateFallback,
  canBuildKnowledgeTemplateFallback,
  canBuildSimulationTemplateFallback,
  extractFallbackNumericTokens,
} from './templateFallback.ts';

const route = {
  intent: 'DASHBOARD_DATA',
  confidence: 0.99,
  reasons: [],
  matchedTerms: [],
  language: 'en',
};

function structuredAnswer(overrides = {}) {
  return {
    availability: 'AVAILABLE',
    language: 'en',
    intent: 'DASHBOARD_DATA',
    layers: {
      conclusion: { status: 'AVAILABLE', heading: 'Conclusion', text: 'Sabah score is 63.7.', codes: [], factReferences: [], warnings: [] },
      diagnosis: { status: 'UNAVAILABLE', heading: 'Diagnosis', text: '', codes: [], factReferences: [], warnings: [] },
      gap: { status: 'UNAVAILABLE', heading: 'Gap', text: '', codes: [], factReferences: [], warnings: [] },
      impact: { status: 'UNAVAILABLE', heading: 'Impact', text: '', codes: [], factReferences: [], warnings: [] },
      lever: { status: 'UNAVAILABLE', heading: 'Recommended action', text: '', codes: [], factReferences: [], warnings: [], leverIds: [], requiresGeminiPhrasing: false },
      honesty: { status: 'PARTIAL', heading: 'Limitations', text: 'Limitations are attached.', codes: [], factReferences: [], warnings: [] },
    },
    summaryText: 'Conclusion: Sabah score is 63.7.',
    requiredDisclosures: [],
    warnings: [],
    sources: [
      { sourceFile: 'resilience.json', sourcePath: 'territories.Sabah.index', publisher: 'Borneo Tracker', title: 'Resilience Index' },
      { sourceFile: 'resilience.json', sourcePath: 'territories.Sabah.index', publisher: 'Borneo Tracker', title: 'Resilience Index' },
    ],
    approvedNumericTokens: ['63.7'],
    approvedYearTokens: [],
    blocked: false,
    clarificationRequired: false,
    ...overrides,
  };
}

describe('template fallback builder', () => {
  it('builds an English fallback from structured summary text only', () => {
    const result = buildTemplateFallback({
      structuredAnswer: structuredAnswer(),
      reason: 'GEMINI_TIMEOUT',
      language: 'en',
      intent: route,
    });

    expect(result.mode).toBe('template-fallback');
    expect(result.answer).toContain('Live AI phrasing is temporarily unavailable.');
    expect(result.answer).toContain('Conclusion: Sabah score is 63.7.');
    expect(result.fallback).toMatchObject({
      used: true,
      reason: 'GEMINI_TIMEOUT',
      generatedFrom: 'structured-answer',
      degraded: true,
    });
  });

  it('builds a Malay notice without adding numeric tokens', () => {
    const result = buildTemplateFallback({
      structuredAnswer: structuredAnswer({ language: 'ms' }),
      reason: 'GEMINI_RATE_LIMIT',
      language: 'ms',
      intent: { ...route, language: 'ms' },
    });

    expect(result.answer).toContain('Penyusunan jawapan AI secara langsung tidak tersedia');
    expect(extractFallbackNumericTokens(result.answer)).toEqual(['63.7']);
  });

  it('preserves and deduplicates structured answer sources', () => {
    const result = buildTemplateFallback({
      structuredAnswer: structuredAnswer(),
      reason: 'GEMINI_UNAVAILABLE',
      language: 'en',
      intent: route,
    });

    expect(result.sources).toEqual([
      { sourceFile: 'resilience.json', sourcePath: 'territories.Sabah.index', publisher: 'Borneo Tracker', title: 'Resilience Index' },
    ]);
    expect(result.sources.map((source) => source.title)).not.toContain('Gemini');
  });

  it('rejects fallback prose that would introduce unapproved numbers or URLs', () => {
    expect(() => buildTemplateFallback({
      structuredAnswer: structuredAnswer({ summaryText: 'Conclusion: See https://example.com/2026.' }),
      reason: 'GEMINI_EMPTY_RESPONSE',
      language: 'en',
      intent: route,
    })).toThrow(/URLs|unapproved numeric/i);
  });

  it('allows only dashboard structured answers with non-empty summaries', () => {
    expect(canBuildTemplateFallback(structuredAnswer(), route)).toBe(true);
    expect(canBuildTemplateFallback(structuredAnswer({ summaryText: '' }), route)).toBe(false);
    expect(canBuildTemplateFallback(structuredAnswer({ intent: 'SITE_KNOWLEDGE' }), route)).toBe(false);
    expect(canBuildTemplateFallback(structuredAnswer(), { ...route, intent: 'BORNEO_NEWS' })).toBe(false);
  });
});

describe('knowledge template fallback builder', () => {
  function knowledgeAnswer(overrides = {}) {
    return {
      answer: 'Borneo Tracker Overview: Verified site knowledge from 2026.',
      language: 'en',
      status: 'FOUND',
      recordIds: ['about'],
      sources: [
        { id: 'about', sourceFile: 'src/i18n/locales/en.json', sourcePath: 'about.overview', publisher: 'Borneo Tracker', title: 'Borneo Tracker Overview' },
      ],
      approvedNumericTokens: [],
      approvedYearTokens: ['2026'],
      warnings: [],
      ...overrides,
    };
  }

  it('uses deterministic knowledge answer text directly', () => {
    const result = buildKnowledgeTemplateFallback({
      knowledgeAnswer: knowledgeAnswer(),
      reason: 'KNOWLEDGE_GEMINI_UNAVAILABLE',
      language: 'en',
    });

    expect(result.mode).toBe('template-fallback');
    expect(result.answer).toBe('Borneo Tracker Overview: Verified site knowledge from 2026.');
    expect(result.fallback).toMatchObject({
      used: true,
      reason: 'KNOWLEDGE_GEMINI_UNAVAILABLE',
      generatedFrom: 'knowledge-answer',
      degraded: true,
    });
    expect(result.sources).toHaveLength(1);
  });

  it('detects buildable knowledge fallback answers', () => {
    expect(canBuildKnowledgeTemplateFallback(knowledgeAnswer())).toBe(true);
    expect(canBuildKnowledgeTemplateFallback(knowledgeAnswer({ answer: ' ' }))).toBe(false);
  });

  it('rejects unsafe knowledge fallback prose', () => {
    expect(() => buildKnowledgeTemplateFallback({
      knowledgeAnswer: knowledgeAnswer({ answer: 'See https://example.com/2026.' }),
      reason: 'KNOWLEDGE_RESPONSE_REJECTED',
      language: 'en',
    })).toThrow(/URLs|paths|unapproved numeric/i);
  });
});

describe('simulation template fallback builder', () => {
  function simulationAnswer(overrides = {}) {
    return {
      answer: 'Scenario: Brunei — Paddy production per capita set to 40. Resilience Index: 78 → 83.4 (+5.4). Illustrative — deterministic scenario, not a forecast.',
      language: 'en',
      status: 'RESOLVED',
      territory: 'Brunei',
      indicator: 'Paddy production per capita',
      targetValue: 40,
      approvedNumericTokens: ['78', '83.4', '5.4', '40', '+5.4'],
      approvedYearTokens: [],
      warnings: [],
      ...overrides,
    };
  }

  it('uses the deterministic simulation answer text directly, unmodified by Gemini', () => {
    const result = buildSimulationTemplateFallback({
      simulationAnswer: simulationAnswer(),
      reason: 'SIMULATION_GEMINI_UNAVAILABLE',
      language: 'en',
    });

    expect(result.mode).toBe('template-fallback');
    expect(result.answer).toBe(simulationAnswer().answer);
    expect(result.answer).toContain('Illustrative — deterministic scenario, not a forecast.');
    expect(result.fallback).toMatchObject({
      used: true,
      reason: 'SIMULATION_GEMINI_UNAVAILABLE',
      generatedFrom: 'simulation-answer',
      degraded: true,
    });
  });

  it('works for a clarification (NEEDS_CLARIFICATION) simulation answer too', () => {
    const result = buildSimulationTemplateFallback({
      simulationAnswer: simulationAnswer({
        status: 'NEEDS_CLARIFICATION',
        answer: 'I can simulate a what-if change, but I need a territory, an indicator, and a target value.',
        territory: undefined,
        indicator: undefined,
        targetValue: undefined,
        approvedNumericTokens: [],
      }),
      reason: 'SIMULATION_NEEDS_CLARIFICATION',
      language: 'en',
    });
    expect(result.answer).toContain('territory');
    expect(result.fallback.reason).toBe('SIMULATION_NEEDS_CLARIFICATION');
  });

  it('detects buildable simulation fallback answers', () => {
    expect(canBuildSimulationTemplateFallback(simulationAnswer())).toBe(true);
    expect(canBuildSimulationTemplateFallback(simulationAnswer({ answer: ' ' }))).toBe(false);
    expect(canBuildSimulationTemplateFallback(undefined)).toBe(false);
  });

  it('rejects unsafe simulation fallback prose', () => {
    expect(() => buildSimulationTemplateFallback({
      simulationAnswer: simulationAnswer({ answer: 'See https://example.com for the scenario.' }),
      reason: 'SIMULATION_RESPONSE_REJECTED',
      language: 'en',
    })).toThrow(/URLs|paths/i);
  });
});
