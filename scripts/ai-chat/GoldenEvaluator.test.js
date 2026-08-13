import { describe, expect, it } from 'vitest';
import indicators from '../../public/data/indicators.json';
import resilience from '../../public/data/resilience.json';
import districts from '../../public/data/districts.json';
import knowledgeIndex from '../../knowledge/generated/knowledge-index.json';
import { evaluateComparability } from '../../supabase/functions/ai-chat/comparabilityGate.ts';
import { resolveAiChatEntities } from '../../supabase/functions/ai-chat/entityResolver.ts';
import { buildAIChatFactObject } from '../../supabase/functions/ai-chat/factObjectBuilder.ts';
import { routeAiChatIntent } from '../../supabase/functions/ai-chat/intentRouter.ts';
import { retrieveVerifiedLevers } from '../../supabase/functions/ai-chat/leverRetriever.ts';
import { LocalNewsRepository } from '../../supabase/functions/ai-chat/localNewsRepository.ts';
import { retrieveAIChatNews } from '../../supabase/functions/ai-chat/newsRetriever.ts';
import { buildKnowledgeAnswer } from '../../supabase/functions/ai-chat/knowledgeAnswerBuilder.ts';
import { KnowledgeRepository } from '../../supabase/functions/ai-chat/knowledgeRepository.ts';
import { retrieveStaticKnowledge } from '../../supabase/functions/ai-chat/knowledgeRetriever.ts';
import { buildGroundedPrompt } from '../../supabase/functions/ai-chat/promptBuilder.ts';
import { validateGeminiResponse } from '../../supabase/functions/ai-chat/responseValidator.ts';
import { buildStructuredAnswer } from '../../supabase/functions/ai-chat/structuredAnswerBuilder.ts';
import { buildTemplateFallback } from '../../supabase/functions/ai-chat/templateFallback.ts';
import {
  GoldenEvaluator,
  validateGoldenData,
} from './GoldenEvaluator.js';

const modules = {
  evaluateComparability,
  resolveAiChatEntities,
  buildAIChatFactObject,
  routeAiChatIntent,
  retrieveVerifiedLevers,
  LocalNewsRepository,
  retrieveAIChatNews,
  buildKnowledgeAnswer,
  KnowledgeRepository,
  retrieveStaticKnowledge,
  buildGroundedPrompt,
  validateGeminiResponse,
  buildStructuredAnswer,
  buildTemplateFallback,
};

const data = { indicators, resilience, districts, knowledgeIndex };

function evaluator() {
  return new GoldenEvaluator({ modules, data });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadedFixture() {
  const instance = evaluator();
  return instance.loadGoldenFiles();
}

describe('Golden data validator', () => {
  it('accepts the committed Golden files', () => {
    expect(evaluator().validateGoldenFiles()).toMatchObject({
      valid: true,
      questionCount: 97,
      englishCount: 61,
      malayCount: 36,
    });
  });

  it('rejects duplicate ids', () => {
    const loaded = loadedFixture();
    loaded.questions[1].id = loaded.questions[0].id;
    expect(validateGoldenData(loaded).join('\n')).toContain('duplicate');
  });

  it('rejects invalid language, intent, blank question, territory, decision, status, and secret sentinels', () => {
    const loaded = loadedFixture();
    Object.assign(loaded.questions[0], {
      language: 'zh',
      question: ' ',
      implementationStatus: 'DONE',
      expected: {
        ...loaded.questions[0].expected,
        intent: 'LIVE_SUPABASE',
        territories: ['Atlantis'],
        comparabilityDecision: 'MAYBE',
      },
      rationale: 'AIzaFakeSentinelKeyForValidation',
    });
    const errors = validateGoldenData(loaded).join('\n');
    expect(errors).toContain('invalid language');
    expect(errors).toContain('missing question');
    expect(errors).toContain('invalid implementation status');
    expect(errors).toContain('invalid intent');
    expect(errors).toContain('unsupported territory');
    expect(errors).toContain('invalid comparability decision');
    expect(errors).toContain('contains secret sentinel');
  });

  it('rejects contradictory clarification expectations and duplicate questions without distinct context', () => {
    const loaded = loadedFixture();
    loaded.questions[0].expected.blocked = false;
    loaded.questions[0].expected.clarificationRequired = true;
    loaded.questions[1].question = loaded.questions[0].question;
    loaded.questions[1].context = clone(loaded.questions[0].context);
    const errors = validateGoldenData(loaded).join('\n');
    expect(errors).toContain('contradictory clarification');
    expect(errors).toContain('duplicate question');
  });
});

describe('Golden evaluator', () => {
  it('runs over the complete committed set with deterministic ordering and reports', async () => {
    const report = await evaluator().evaluate();
    expect(report.totals.questions).toBe(97);
    expect(report.totals.english).toBe(61);
    expect(report.totals.malay).toBe(36);
    expect(report.records.map((record) => record.id)).toEqual([...report.records.map((record) => record.id)].sort());
    expect(report.unsupportedFeatureSummary).toMatchObject({
      staticRetrieverImplemented: true,
      staticRetrievalStatus: 'IMPLEMENTED',
      liveSupabaseRepositoryEvaluated: false,
      liveStatus: 'BLOCKED_BY_SUPABASE',
      verifiedRuntimeLeverCount: 0,
      verifiedRecommendationCoverage: 0,
    });
  });

  it('calculates routing, entity, operation, comparability, and fact metrics', async () => {
    const report = await evaluator().evaluate();
    expect(report.metrics.routingAccuracy.evaluated).toBe(93);
    expect(report.metrics.entityResolutionAccuracy.evaluated).toBeGreaterThan(0);
    expect(report.metrics.operationDetectionAccuracy.evaluated).toBe(93 * 10);
    expect(report.metrics.comparabilityAccuracy.evaluated).toBeGreaterThan(0);
    expect(report.metrics.factAvailabilityAccuracy.evaluated).toBeGreaterThan(0);
    expect(report.metrics.knowledgeTop1RetrievalAccuracy.value).toBe(1);
  });

  it('tracks skipped NOT_IMPLEMENTED, BLOCKED_BY_SUPABASE, and NO_VERIFIED_DATA records without counting them as implemented success', async () => {
    const report = await evaluator().evaluate();
    expect(report.implementationStatusCounts.NOT_IMPLEMENTED || 0).toBe(0);
    expect(report.implementationStatusCounts.BLOCKED_BY_SUPABASE).toBeGreaterThan(0);
    expect(report.implementationStatusCounts.NO_VERIFIED_DATA).toBeGreaterThan(0);
    expect(report.skippedQuestionIds).toEqual(expect.arrayContaining([
      'golden-en-028',
      'golden-en-036',
    ]));
  });

  it('passes news privacy without exposing pending sentinel content', async () => {
    const report = await evaluator().evaluate();
    expect(report.metrics.newsPrivacyPassRate.value).toBe(1);
    const newsRecords = report.records.filter((record) => record.tags.includes('news') && record.actual.news);
    expect(newsRecords.length).toBeGreaterThan(0);
    expect(newsRecords.every((record) => record.actual.news.pendingSentinelExposed === false)).toBe(true);
    expect(JSON.stringify(report)).not.toContain('PENDING_SENTINEL_TITLE_MUST_NEVER_APPEAR');
  });

  it('passes numeric/security validation fixtures and does not include raw rejected Gemini text', async () => {
    const report = await evaluator().evaluate();
    expect(report.metrics.numericSecurityValidationPassRate.value).toBe(1);
    expect(JSON.stringify(report)).not.toContain('The API key is AICHATBOTGEMINI_API_KEY');
    expect(JSON.stringify(report)).not.toContain('https://example.com/source');
  });

  it('marks safety-critical failures and exit code when a blocked comparison expectation is violated', async () => {
    const instance = evaluator();
    const originalLoad = instance.loadGoldenFiles.bind(instance);
    instance.loadGoldenFiles = () => {
      const loaded = originalLoad();
      loaded.questions = loaded.questions.filter((record) => record.id === 'golden-en-011');
      loaded.byLanguage.en = loaded.questions;
      loaded.byLanguage.ms = [];
      loaded.config = {
        ...loaded.config,
        thresholds: { ...loaded.config.thresholds, routingAccuracy: 0 },
      };
      loaded.questions[0].expected.comparabilityDecision = 'ALLOW';
      return loaded;
    };
    instance.validateGoldenFiles = () => ({ valid: true, errors: [], questionCount: 1, englishCount: 1, malayCount: 0 });

    const report = await instance.evaluate();
    expect(report.exitCode).toBe(1);
    expect(report.safetyCritical.passed).toBe(false);
    expect(report.failedQuestionIds).toEqual(['golden-en-011']);
  });
});
