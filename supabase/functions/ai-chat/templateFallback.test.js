import { describe, expect, it } from 'vitest';
import {
  buildTemplateFallback,
  buildKnowledgeTemplateFallback,
  canBuildTemplateFallback,
  canBuildKnowledgeTemplateFallback,
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

  it('uses a comparison-specific deterministic fallback summary', () => {
    const result = buildTemplateFallback({
      structuredAnswer: structuredAnswer({
        layers: {
          ...structuredAnswer().layers,
          conclusion: {
            status: 'AVAILABLE',
            heading: 'Conclusion',
            text: "Sabah's resilience score is 63.7 and Sarawak's is 72.5. Sarawak is higher than Sabah by 8.8 points. The comparison uses the Resilience Index score.",
            codes: [],
            factReferences: [],
            warnings: [],
          },
          diagnosis: { ...structuredAnswer().layers.diagnosis, status: 'NOT_APPLICABLE' },
          gap: { ...structuredAnswer().layers.gap, status: 'NOT_APPLICABLE' },
          impact: { ...structuredAnswer().layers.impact, status: 'NOT_APPLICABLE' },
          lever: { ...structuredAnswer().layers.lever, status: 'NOT_APPLICABLE' },
        },
        summaryText: "Conclusion: Sabah's resilience score is 63.7 and Sarawak's is 72.5. Sarawak is higher than Sabah by 8.8 points. The comparison uses the Resilience Index score.",
        approvedNumericTokens: ['63.7', '72.5', '8.8'],
      }),
      reason: 'GEMINI_TRUNCATED',
      language: 'en',
      intent: route,
    });

    expect(result.answer).toContain('Sarawak is higher than Sabah by 8.8 points');
    expect(result.answer).not.toContain('Diagnosis:');
    expect(result.answer).not.toContain('Gap:');
    expect(result.answer).not.toContain('Impact:');
    expect(result.answer).not.toContain('Recommended action:');
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
