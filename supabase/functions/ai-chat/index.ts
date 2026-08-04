import {
  type AIChatRequest,
  AIChatHttpError,
  type AIChatKnowledgeAnswer,
  type AIChatKnowledgeRetrievalResult,
  type AIChatIdentity,
  type AIChatPrompt,
  type AIChatSuccessResponse,
  type AIChatSiteKnowledgePrompt,
  type ErrorPayload,
  type AIChatNewsResult,
  type AIChatQuotaMetadata,
  type AIChatStructuredAnswer,
  type AIChatTelemetryOutcome,
  type FallbackReason,
  type LeverRetrievalResult,
  jsonResponse,
  parseJsonBody,
  validateChatRequest,
} from './contracts.ts';
import indicatorsData from '../../../public/data/indicators.json';
import districtsData from '../../../public/data/districts.json';
import { evaluateComparability } from './comparabilityGate.ts';
import { buildCorsHeaders, type EnvLike, parseCorsConfig } from './config.ts';
import { resolveAiChatEntities } from './entityResolver.ts';
import { buildAIChatFactObject } from './factObjectBuilder.ts';
import { FactDataRepository } from './factDataRepository.ts';
import { generateGeminiAnswer } from './geminiClient.ts';
import { resolveAIChatIdentity, type ProfileRepository, type TokenVerifier } from './identity.ts';
import { buildKnowledgeAnswer } from './knowledgeAnswerBuilder.ts';
import { KnowledgeRepository } from './knowledgeRepository.ts';
import { retrieveStaticKnowledge } from './knowledgeRetriever.ts';
import { LeverRepository } from './leverRepository.ts';
import { retrieveVerifiedLevers } from './leverRetriever.ts';
import type { AIChatNewsRepository } from './newsRepository.ts';
import { createAIChatNewsRepository } from './newsRepositoryFactory.ts';
import { retrieveAIChatNews } from './newsRetriever.ts';
import { routeAiChatIntent } from './intentRouter.ts';
import { consoleSafeLogger, errorLogFields, type SafeLogger } from './logger.ts';
import { buildGroundedPrompt, buildSiteKnowledgeGroundedPrompt } from './promptBuilder.ts';
import {
  createAIChatQuotaService,
  type AIChatQuotaReservation,
  type AIChatQuotaServiceLike,
} from './quota.ts';
import { validateGeminiResponse, validateSiteKnowledgeGeminiResponse } from './responseValidator.ts';
import { buildStructuredAnswer } from './structuredAnswerBuilder.ts';
import {
  buildKnowledgeTemplateFallback,
  buildTemplateFallback,
  canBuildKnowledgeTemplateFallback,
  canBuildTemplateFallback,
  fallbackPublicMetadata,
} from './templateFallback.ts';
import {
  createAIChatTelemetryService,
  generateAIChatRequestId,
  telemetryElapsedMs,
  type AIChatTelemetryEvent,
  type AIChatTelemetryService,
} from './telemetry.ts';

declare const Deno:
  | { serve?: (handler: (request: Request) => Response | Promise<Response>) => void }
  | undefined;

type GeminiAnswerClient = (request: AIChatRequest, prompt?: AIChatPrompt | AIChatSiteKnowledgePrompt) => Promise<string>;
type StructuredAnswerClient = (input: Parameters<typeof buildStructuredAnswer>[0]) => AIChatStructuredAnswer;
type PromptBuilderClient = (input: Parameters<typeof buildGroundedPrompt>[0]) => AIChatPrompt;
type LeverRetrieverClient = (input: Parameters<typeof retrieveVerifiedLevers>[0]) => LeverRetrievalResult;
type NewsRetrieverClient = (input: Parameters<typeof retrieveAIChatNews>[0]) => Promise<AIChatNewsResult>;
type KnowledgeRetrieverClient = (input: Parameters<typeof retrieveStaticKnowledge>[0], repository?: KnowledgeRepository) => AIChatKnowledgeRetrievalResult;
type IdentityResolverClient = (request: Request) => Promise<AIChatIdentity>;
type QuotaReservationResult = Awaited<ReturnType<AIChatQuotaServiceLike['reserveForModelCall']>>;
type TelemetryState = {
  requestId: string;
  startedAtMs: number;
  recorded: boolean;
  identityType: AIChatTelemetryEvent['identityType'];
  intent?: AIChatTelemetryEvent['intent'];
  mode?: AIChatTelemetryEvent['mode'];
  fallbackUsed: boolean;
  fallbackReason?: FallbackReason;
  errorCode?: string;
  modelCalled: boolean;
  quotaConsumed: boolean;
  sourceCount?: number;
  language?: string;
  region?: string;
  currentPage?: string;
};

type HandlerOptions = {
  env?: EnvLike;
  geminiClient?: GeminiAnswerClient;
  factRepository?: FactDataRepository;
  structuredAnswerBuilder?: StructuredAnswerClient;
  promptBuilder?: PromptBuilderClient;
  leverRepository?: LeverRepository;
  leverRetriever?: LeverRetrieverClient;
  newsRepository?: AIChatNewsRepository;
  newsRetriever?: NewsRetrieverClient;
  knowledgeRepository?: KnowledgeRepository;
  knowledgeRetriever?: KnowledgeRetrieverClient;
  identityResolver?: IdentityResolverClient;
  quotaService?: AIChatQuotaServiceLike;
  telemetryService?: AIChatTelemetryService;
  tokenVerifier?: TokenVerifier;
  profileRepository?: ProfileRepository;
  logger?: SafeLogger;
};

export function createAiChatHandler(options: HandlerOptions = {}) {
  const logger = options.logger || consoleSafeLogger;
  const geminiClient =
    options.geminiClient ||
    ((chatRequest: AIChatRequest, prompt?: AIChatPrompt) => generateGeminiAnswer(chatRequest, { env: options.env, prompt }));
  const structuredAnswerBuilder = options.structuredAnswerBuilder || buildStructuredAnswer;
  const promptBuilder = options.promptBuilder || buildGroundedPrompt;
  const leverRepository = options.leverRepository || new LeverRepository();
  const leverRetriever =
    options.leverRetriever ||
    ((query: Parameters<typeof retrieveVerifiedLevers>[0]) => retrieveVerifiedLevers(query, leverRepository));
  const newsRepository = options.newsRepository || createAIChatNewsRepository({ env: options.env });
  const newsRetriever = options.newsRetriever || retrieveAIChatNews;
  const knowledgeRepository = options.knowledgeRepository || new KnowledgeRepository();
  const knowledgeRetriever = options.knowledgeRetriever || retrieveStaticKnowledge;
  const identityResolver =
    options.identityResolver ||
    ((request: Request) => resolveAIChatIdentity(request, {
      env: options.env,
      tokenVerifier: options.tokenVerifier,
      profileRepository: options.profileRepository,
    }));
  const quotaService = options.quotaService || createAIChatQuotaService({ env: options.env });
  const telemetryService = options.telemetryService || createAIChatTelemetryService({ env: options.env });

  async function callGeminiWithQuota(
    chatRequest: AIChatRequest,
    identity: AIChatIdentity,
    telemetry: TelemetryState,
    prompt?: AIChatPrompt | AIChatSiteKnowledgePrompt
  ): Promise<{ answer: string; reservation: AIChatQuotaReservation; quota: AIChatQuotaMetadata }> {
    const quotaGate = await quotaService.reserveForModelCall(identity);
    logQuotaGate(logger, quotaGate);
    if (quotaGate.status === 'exhausted') {
      throw new AIChatHttpError(429, 'AI_CHAT_QUOTA_EXHAUSTED', 'The AI assistant daily model-call limit has been reached.');
    }
    if (quotaGate.status !== 'reserved') {
      throw new AIChatHttpError(503, 'AI_CHAT_QUOTA_UNAVAILABLE', 'The AI assistant quota check is unavailable right now.');
    }
    try {
      telemetry.modelCalled = true;
      telemetry.quotaConsumed = true;
      const answer = await geminiClient(chatRequest, prompt);
      return { answer, reservation: quotaGate.reservation, quota: quotaGate.quota };
    } catch (error) {
      await refundQuotaReservation(quotaService, logger, quotaGate.reservation, 'MODEL_CALL_FAILED');
      telemetry.quotaConsumed = false;
      throw error;
    }
  }

  return async function handleAiChatRequest(request: Request): Promise<Response> {
    const corsHeaders = buildCorsHeaders(request, parseCorsConfig(options.env));

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const telemetry: TelemetryState = {
      requestId: generateAIChatRequestId(),
      startedAtMs: performanceStartMs(),
      recorded: false,
      identityType: 'unknown',
      fallbackUsed: false,
      modelCalled: false,
      quotaConsumed: false,
    };

    async function recordTelemetryOnce(fields: Partial<AIChatTelemetryEvent> & { outcome: AIChatTelemetryOutcome; responseStatus: number }): Promise<void> {
      if (telemetry.recorded) return;
      telemetry.recorded = true;
      const event: AIChatTelemetryEvent = {
        requestId: telemetry.requestId,
        identityType: telemetry.identityType,
        intent: telemetry.intent,
        mode: telemetry.mode,
        outcome: fields.outcome,
        fallbackUsed: fields.fallbackUsed ?? telemetry.fallbackUsed,
        fallbackReason: fields.fallbackReason ?? telemetry.fallbackReason,
        errorCode: fields.errorCode ?? telemetry.errorCode,
        modelCalled: fields.modelCalled ?? telemetry.modelCalled,
        quotaConsumed: fields.quotaConsumed ?? telemetry.quotaConsumed,
        responseStatus: fields.responseStatus,
        latencyMs: telemetryElapsedMs(telemetry.startedAtMs),
        sourceCount: fields.sourceCount ?? telemetry.sourceCount,
        language: fields.language ?? telemetry.language,
        region: fields.region ?? telemetry.region,
        currentPage: fields.currentPage ?? telemetry.currentPage,
      };
      const result = await telemetryService.record(event);
      if (result.status === 'failed') {
        logger.warn('telemetry_write_failed', {
          code: 'TELEMETRY_WRITE_FAILED',
          requestId: telemetry.requestId,
          reason: result.reason,
        });
      }
    }

    async function respondWithTelemetry(
      payload: Parameters<typeof jsonResponse>[0],
      status: number,
      fields: Partial<AIChatTelemetryEvent> & { outcome: AIChatTelemetryOutcome }
    ): Promise<Response> {
      await recordTelemetryOnce({
        ...fields,
        responseStatus: status,
      });
      return jsonResponse(payload, status, corsHeaders);
    }

    if (request.method !== 'POST') {
      logger.warn('request_rejected', { code: 'METHOD_NOT_ALLOWED', method: request.method, requestId: telemetry.requestId });
      return respondWithTelemetry(
        { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' },
        405,
        { outcome: 'error', errorCode: 'METHOD_NOT_ALLOWED' }
      );
    }

    let route: ReturnType<typeof routeAiChatIntent> | undefined;
    let structuredAnswer: AIChatStructuredAnswer | undefined;
    let groundedPrompt: AIChatPrompt | undefined;
    let knowledgeAnswer: AIChatKnowledgeAnswer | undefined;
    let knowledgePrompt: AIChatSiteKnowledgePrompt | undefined;
    let newsResult: AIChatNewsResult | undefined;
    let identity: AIChatIdentity | undefined;

    try {
      identity = await identityResolver(request);
      telemetry.identityType = identity.type;
      logger.info('identity_resolved', {
        requestId: telemetry.requestId,
        identityType: identity.type,
        authenticated: identity.verified,
        admin: identity.type === 'admin',
        verificationCode: identity.verified ? 'VERIFIED' : 'ANONYMOUS_UNVERIFIED',
      });
      const body = await parseJsonBody(request);
      const chatRequest = validateChatRequest(body);
      telemetry.language = chatRequest.language;
      telemetry.region = chatRequest.region;
      telemetry.currentPage = chatRequest.currentPage;
      route = routeAiChatIntent(chatRequest.message, {
        currentPage: chatRequest.currentPage,
        region: chatRequest.region,
        language: chatRequest.language,
      });
      telemetry.intent = route.intent;
      const entities = resolveAiChatEntities(chatRequest.message, {
        region: chatRequest.region,
        language: chatRequest.language,
      });
      const comparability = evaluateComparability({
        intent: route,
        entities,
        metadata: {
          rows: indicatorsData.rows,
          series: indicatorsData.series,
          districts: districtsData,
        },
        freshness: {
          districtsGeneratedAt: districtsData.generatedAt,
        },
      });
      const factObject = route.intent === 'DASHBOARD_DATA'
        ? buildAIChatFactObject({
            intent: route,
            entities,
            comparability,
          }, {
            repository: options.factRepository,
          })
        : undefined;
      if (route.intent === 'BORNEO_NEWS') {
        newsResult = await newsRetriever({
          intent: route,
          entities,
          language: entities.language || route.language || chatRequest.language,
          repository: newsRepository,
        });
        logger.info('news_query_executed', {
          newsQueryExecuted: true,
          territoryCount: newsResult.queryApplied.territories.length,
          publishedCount: newsResult.published.length,
          pendingCount: newsResult.pending.count,
          dateFilterUsed: Boolean(newsResult.queryApplied.fromDate || newsResult.queryApplied.toDate),
          limit: newsResult.queryApplied.limit,
          languagePreferenceUsed: Boolean(entities.language || route.language || chatRequest.language),
          warningCodes: newsResult.warnings,
        });
      }
      if (route.intent === 'SITE_KNOWLEDGE') {
        const retrieval = knowledgeRetriever({
          question: chatRequest.message,
          language: entities.language || route.language || chatRequest.language,
          currentPage: chatRequest.currentPage,
          territories: entities.territories,
          concepts: entities.concepts,
          limit: 3,
        }, knowledgeRepository);
        logger.info('knowledge_query_executed', {
          knowledgeQueryExecuted: true,
          retrievalStatus: retrieval.status,
          matchCount: retrieval.matches.length,
          topScoreBucket: scoreBucket(retrieval.matches[0]?.score),
          languageFallback: retrieval.status === 'LANGUAGE_FALLBACK',
          categoryCount: new Set(retrieval.matches.map((match) => match.record.category)).size,
          sourceCount: retrieval.matches.length,
          warningCodes: retrieval.warnings,
        });
        knowledgeAnswer = buildKnowledgeAnswer(retrieval, entities.language || route.language || chatRequest.language);
        if (retrieval.status === 'NO_MATCH' || retrieval.status === 'AMBIGUOUS') {
          const reason: FallbackReason = retrieval.status === 'NO_MATCH' ? 'KNOWLEDGE_NO_MATCH' : 'KNOWLEDGE_AMBIGUOUS';
          const fallback = buildKnowledgeTemplateFallback({
            knowledgeAnswer,
            reason,
            language: knowledgeAnswer.language,
          });
          logger.info('request_fallback', {
            fallbackUsed: true,
            fallbackReason: reason,
            intent: route.intent,
            retrievalStatus: retrieval.status,
            sourceCount: fallback.sources.length,
          });
          telemetry.mode = fallback.mode;
          telemetry.fallbackUsed = true;
          telemetry.fallbackReason = reason;
          telemetry.sourceCount = fallback.sources.length;
          return respondWithTelemetry({
            answer: fallback.answer,
            mode: fallback.mode,
            sources: fallback.sources,
            fallback: fallbackPublicMetadata(fallback.fallback),
          }, 200, {
            outcome: 'fallback',
            fallbackUsed: true,
            fallbackReason: reason,
            sourceCount: fallback.sources.length,
          });
        }
        knowledgePrompt = buildSiteKnowledgeGroundedPrompt({
          userQuestion: chatRequest.message,
          language: knowledgeAnswer.language,
          knowledgeAnswer,
          matches: retrieval.matches,
        });
        const quotaResult = await callGeminiWithQuota(chatRequest, identity, telemetry, knowledgePrompt);
        const answer = quotaResult.answer;
        const validation = validateSiteKnowledgeGeminiResponse({
          answer,
          knowledgeAnswer,
          prompt: knowledgePrompt,
        });
        logger.info('response_validation', {
          responseValidated: true,
          valid: validation.valid,
          issueCodes: validation.issues.map((issue) => issue.code),
          issueCount: validation.issues.length,
          numericTokenCount: validation.detectedNumericTokens.length,
          yearTokenCount: validation.detectedYearTokens.length,
          urlCount: validation.detectedUrls.length,
          intent: route.intent,
          fallbackUsed: !validation.valid,
        });
        if (!validation.valid) {
          await refundQuotaReservation(quotaService, logger, quotaResult.reservation, 'RESPONSE_VALIDATION_REJECTED');
          telemetry.quotaConsumed = false;
          const fallback = buildKnowledgeTemplateFallback({
            knowledgeAnswer,
            reason: 'KNOWLEDGE_RESPONSE_REJECTED',
            language: knowledgeAnswer.language,
          });
          logger.info('request_fallback', {
            fallbackUsed: true,
            fallbackReason: 'KNOWLEDGE_RESPONSE_REJECTED',
            intent: route.intent,
            validationIssueCodes: validation.issues.map((issue) => issue.code),
            validationIssueCount: validation.issues.length,
            retrievalStatus: retrieval.status,
            sourceCount: fallback.sources.length,
          });
          telemetry.mode = fallback.mode;
          telemetry.fallbackUsed = true;
          telemetry.fallbackReason = 'KNOWLEDGE_RESPONSE_REJECTED';
          telemetry.sourceCount = fallback.sources.length;
          return respondWithTelemetry({
            answer: fallback.answer,
            mode: fallback.mode,
            sources: fallback.sources,
            fallback: fallbackPublicMetadata(fallback.fallback),
          }, 200, {
            outcome: 'fallback',
            fallbackUsed: true,
            fallbackReason: 'KNOWLEDGE_RESPONSE_REJECTED',
            sourceCount: fallback.sources.length,
          });
        }
        logger.info('request_completed', {
          mode: 'gemini-test',
          intent: route.intent,
          promptBuilt: true,
          retrievalStatus: retrieval.status,
          matchCount: retrieval.matches.length,
          selectedRecordCount: knowledgeAnswer.recordIds.length,
          groundedLanguage: knowledgeAnswer.language,
          groundedNumericTokenCount: knowledgeAnswer.approvedNumericTokens.length,
          groundedYearTokenCount: knowledgeAnswer.approvedYearTokens.length,
          groundedSourceCount: knowledgeAnswer.sources.length,
          intentConfidence: route.confidence,
          page: chatRequest.currentPage,
          region: chatRequest.region,
          language: chatRequest.language,
          identityType: identity.type,
          authenticated: identity.verified,
          admin: identity.type === 'admin',
        });
        telemetry.mode = 'gemini-test';
        telemetry.sourceCount = knowledgeAnswer.sources.length;
        return respondWithTelemetry({
          answer: validation.normalizedAnswer,
          mode: 'gemini-test',
          sources: knowledgeAnswer.sources,
          quota: quotaResult.quota,
        }, 200, {
          outcome: 'success',
          sourceCount: knowledgeAnswer.sources.length,
        });
      }
      const levers = factObject && factObject.availability !== 'BLOCKED' && comparability.decision !== 'NEEDS_CLARIFICATION'
        ? leverRetriever({
            concepts: factObject.concepts,
            pillars: factObject.pillars,
            territories: factObject.territories,
            language: entities.language || route.language || chatRequest.language,
            factObject,
            limit: 2,
          })
        : undefined;
      structuredAnswer = factObject
        ? structuredAnswerBuilder({
            language: entities.language || route.language || chatRequest.language,
            factObject,
            entities,
            comparability,
            levers,
          })
        : undefined;
      if (structuredAnswer?.blocked || structuredAnswer?.clarificationRequired) {
        const reason: FallbackReason = structuredAnswer.clarificationRequired
          ? 'DETERMINISTIC_CLARIFICATION'
          : 'DETERMINISTIC_BLOCKED';
        const fallback = buildTemplateFallback({
          structuredAnswer,
          reason,
          language: structuredAnswer.language,
          intent: route,
        });
        logger.info('request_fallback', {
          fallbackUsed: true,
          fallbackReason: reason,
          intent: route.intent,
          structuredAnswerAvailability: structuredAnswer.availability,
          blocked: structuredAnswer.blocked,
          clarificationRequired: structuredAnswer.clarificationRequired,
          leverRetrieved: false,
          sourceCount: fallback.sources.length,
        });
        telemetry.mode = fallback.mode;
        telemetry.fallbackUsed = true;
        telemetry.fallbackReason = reason;
        telemetry.sourceCount = fallback.sources.length;
        return respondWithTelemetry({
          answer: fallback.answer,
          mode: fallback.mode,
          sources: fallback.sources,
          fallback: fallbackPublicMetadata(fallback.fallback),
        }, 200, {
          outcome: 'fallback',
          fallbackUsed: true,
          fallbackReason: reason,
          sourceCount: fallback.sources.length,
        });
      }
      groundedPrompt = factObject && structuredAnswer
        ? promptBuilder({
            userQuestion: chatRequest.message,
            language: structuredAnswer.language,
            intent: route.intent,
            entities,
            comparability,
            factObject,
            structuredAnswer,
            levers,
          })
        : undefined;
      if (!groundedPrompt) {
        if (route.intent === 'BORNEO_NEWS') {
          const deterministicNews = buildDeterministicNewsResponse(newsResult);
          logger.info('request_completed', {
            mode: deterministicNews.mode,
            intent: route.intent,
            promptBuilt: false,
            modelCallSkipped: true,
            newsRetrieval: newsResult ? {
              publishedCount: newsResult.published.length,
              pendingCount: newsResult.pending.count,
              territoryCount: newsResult.queryApplied.territories.length,
              dateFilterUsed: Boolean(newsResult.queryApplied.fromDate || newsResult.queryApplied.toDate),
              limit: newsResult.queryApplied.limit,
              warningCodes: newsResult.warnings,
            } : undefined,
            identityType: identity.type,
            authenticated: identity.verified,
            admin: identity.type === 'admin',
          });
          telemetry.mode = deterministicNews.mode;
          telemetry.sourceCount = deterministicNews.sources.length;
          return respondWithTelemetry(deterministicNews, 200, {
            outcome: 'fallback',
            sourceCount: deterministicNews.sources.length,
          });
        }
        logger.info('request_completed', {
          mode: 'template-fallback',
          intent: route.intent,
          promptBuilt: false,
          modelCallSkipped: true,
          identityType: identity.type,
          authenticated: identity.verified,
          admin: identity.type === 'admin',
        });
        telemetry.mode = 'template-fallback';
        telemetry.fallbackUsed = true;
        telemetry.fallbackReason = 'DETERMINISTIC_BLOCKED';
        telemetry.sourceCount = 0;
        return respondWithTelemetry({
          answer: 'The Borneo Tracker assistant can answer verified questions about Borneo Tracker, dashboard data, and published Borneo news.',
          mode: 'template-fallback',
          sources: [],
          fallback: {
            used: true,
            reason: 'DETERMINISTIC_BLOCKED',
            degraded: true,
          },
        }, 200, {
          outcome: 'refused',
          fallbackUsed: true,
          fallbackReason: 'DETERMINISTIC_BLOCKED',
          sourceCount: 0,
        });
      }
      const quotaResult = await callGeminiWithQuota(chatRequest, identity, telemetry, groundedPrompt);
      const answer = quotaResult.answer;
      if (groundedPrompt && factObject && structuredAnswer) {
        const validation = validateGeminiResponse({
          answer,
          factObject,
          structuredAnswer,
          comparability,
          prompt: groundedPrompt,
        });
        logger.info('response_validation', {
          responseValidated: true,
          valid: validation.valid,
          issueCodes: validation.issues.map((issue) => issue.code),
          issueCount: validation.issues.length,
          numericTokenCount: validation.detectedNumericTokens.length,
          yearTokenCount: validation.detectedYearTokens.length,
          urlCount: validation.detectedUrls.length,
          intent: route.intent,
          fallbackUsed: !validation.valid,
          blocked: structuredAnswer.blocked,
          clarificationRequired: structuredAnswer.clarificationRequired,
          leverCount: levers?.records.length || 0,
        });
        if (!validation.valid) {
          await refundQuotaReservation(quotaService, logger, quotaResult.reservation, 'RESPONSE_VALIDATION_REJECTED');
          telemetry.quotaConsumed = false;
          const fallback = buildTemplateFallback({
            structuredAnswer,
            reason: 'GEMINI_RESPONSE_REJECTED',
            language: structuredAnswer.language,
            intent: route,
          });
          logger.info('request_fallback', {
            fallbackUsed: true,
            fallbackReason: 'GEMINI_RESPONSE_REJECTED',
            intent: route.intent,
            validationIssueCodes: validation.issues.map((issue) => issue.code),
            validationIssueCount: validation.issues.length,
            structuredAnswerAvailability: structuredAnswer.availability,
            blocked: structuredAnswer.blocked,
            clarificationRequired: structuredAnswer.clarificationRequired,
            leverCount: levers?.records.length || 0,
            sourceCount: fallback.sources.length,
          });
          telemetry.mode = fallback.mode;
          telemetry.fallbackUsed = true;
          telemetry.fallbackReason = 'GEMINI_RESPONSE_REJECTED';
          telemetry.sourceCount = fallback.sources.length;
          return respondWithTelemetry({
            answer: fallback.answer,
            mode: fallback.mode,
            sources: fallback.sources,
            fallback: fallbackPublicMetadata(fallback.fallback),
          }, 200, {
            outcome: 'fallback',
            fallbackUsed: true,
            fallbackReason: 'GEMINI_RESPONSE_REJECTED',
            sourceCount: fallback.sources.length,
          });
        }
        logger.info('request_completed', {
          mode: 'gemini-test',
          intent: route.intent,
          promptBuilt: true,
          groundingAvailability: groundedPrompt.groundingPayload.answerStatus,
          groundedLanguage: structuredAnswer.language,
          groundedBlocked: groundedPrompt.groundingPayload.blocked,
          groundedClarificationRequired: groundedPrompt.groundingPayload.clarificationRequired,
          groundedNumericTokenCount: groundedPrompt.groundingPayload.approvedNumericTokens.length,
          groundedYearTokenCount: groundedPrompt.groundingPayload.approvedYearTokens.length,
          groundedSourceCount: groundedPrompt.groundingPayload.sources.length,
          intentConfidence: route.confidence,
          entityCounts: {
            territories: entities.territories.length,
            concepts: entities.concepts.length,
            indicators: entities.indicators.length,
            pillars: entities.pillars.length,
            districts: entities.districts.length,
            years: entities.years.length,
            ambiguities: entities.ambiguities.length,
          },
          operations: entities.operations,
          comparability: {
            decision: comparability.decision,
            blockedOperations: comparability.blockedOperations,
            allowedOperations: comparability.allowedOperations,
            disclosureCount: comparability.requiredDisclosures.length,
          },
          factObject: {
            availability: factObject.availability,
            territories: factObject.territories.length,
            concepts: factObject.concepts.length,
            indicators: factObject.indicators.length,
            pillars: factObject.pillars.length,
            districts: factObject.districts.length,
            values: {
              rawValues: factObject.values.rawValues.length,
              indicatorScores: factObject.values.indicatorScores.length,
              pillarScores: factObject.values.pillarScores.length,
              hasOverallResilience: Boolean(factObject.values.overallResilience),
              hasTarget: Boolean(factObject.values.target),
              hasGap: Boolean(factObject.values.gap),
              trends: factObject.values.trends?.length || 0,
              districtValues: factObject.values.districtValues?.length || 0,
            },
            warningCount: factObject.warnings.length,
            sourceCount: factObject.sources.length,
            approvedNumericTokenCount: factObject.approvedNumericTokens.length,
            approvedYearTokenCount: factObject.approvedYearTokens.length,
          },
          structuredAnswer: {
            availability: structuredAnswer.availability,
            language: structuredAnswer.language,
            blocked: structuredAnswer.blocked,
            clarificationRequired: structuredAnswer.clarificationRequired,
            layerStatuses: Object.fromEntries(
              Object.entries(structuredAnswer.layers).map(([name, layer]) => [name, layer.status])
            ),
            warningCount: structuredAnswer.warnings.length,
            sourceCount: structuredAnswer.sources.length,
            approvedNumericTokenCount: structuredAnswer.approvedNumericTokens.length,
            approvedYearTokenCount: structuredAnswer.approvedYearTokens.length,
            leverIds: structuredAnswer.layers.lever.leverIds,
          },
          leverRetrieval: levers ? {
            recordCount: levers.records.length,
            matchedBy: levers.matchedBy,
            warningCount: levers.warnings.length,
            emptyReason: levers.emptyReason,
          } : undefined,
          page: chatRequest.currentPage,
          region: chatRequest.region,
          language: chatRequest.language,
          identityType: identity.type,
          authenticated: identity.verified,
          admin: identity.type === 'admin',
        });
        telemetry.mode = 'gemini-test';
        telemetry.sourceCount = structuredAnswer.sources.length;
        return respondWithTelemetry({
          answer: validation.normalizedAnswer,
          mode: 'gemini-test',
          sources: structuredAnswer.sources,
          quota: quotaResult.quota,
        }, 200, {
          outcome: 'success',
          sourceCount: structuredAnswer.sources.length,
        });
      }
      logger.info('request_completed', {
        mode: 'gemini-test',
        intent: route.intent,
        promptBuilt: Boolean(groundedPrompt),
        groundingAvailability: groundedPrompt?.groundingPayload.answerStatus,
        groundedLanguage: groundedPrompt ? structuredAnswer?.language : undefined,
        groundedBlocked: groundedPrompt?.groundingPayload.blocked,
        groundedClarificationRequired: groundedPrompt?.groundingPayload.clarificationRequired,
        groundedNumericTokenCount: groundedPrompt?.groundingPayload.approvedNumericTokens.length,
        groundedYearTokenCount: groundedPrompt?.groundingPayload.approvedYearTokens.length,
        groundedSourceCount: groundedPrompt?.groundingPayload.sources.length,
        intentConfidence: route.confidence,
        entityCounts: {
          territories: entities.territories.length,
          concepts: entities.concepts.length,
          indicators: entities.indicators.length,
          pillars: entities.pillars.length,
          districts: entities.districts.length,
          years: entities.years.length,
          ambiguities: entities.ambiguities.length,
        },
        operations: entities.operations,
        comparability: {
          decision: comparability.decision,
          blockedOperations: comparability.blockedOperations,
          allowedOperations: comparability.allowedOperations,
          disclosureCount: comparability.requiredDisclosures.length,
        },
        factObject: factObject ? {
          availability: factObject.availability,
          territories: factObject.territories.length,
          concepts: factObject.concepts.length,
          indicators: factObject.indicators.length,
          pillars: factObject.pillars.length,
          districts: factObject.districts.length,
          values: {
            rawValues: factObject.values.rawValues.length,
            indicatorScores: factObject.values.indicatorScores.length,
            pillarScores: factObject.values.pillarScores.length,
            hasOverallResilience: Boolean(factObject.values.overallResilience),
            hasTarget: Boolean(factObject.values.target),
            hasGap: Boolean(factObject.values.gap),
            trends: factObject.values.trends?.length || 0,
            districtValues: factObject.values.districtValues?.length || 0,
          },
          warningCount: factObject.warnings.length,
          sourceCount: factObject.sources.length,
          approvedNumericTokenCount: factObject.approvedNumericTokens.length,
          approvedYearTokenCount: factObject.approvedYearTokens.length,
        } : undefined,
        structuredAnswer: structuredAnswer ? {
          availability: structuredAnswer.availability,
          language: structuredAnswer.language,
          blocked: structuredAnswer.blocked,
          clarificationRequired: structuredAnswer.clarificationRequired,
          layerStatuses: Object.fromEntries(
            Object.entries(structuredAnswer.layers).map(([name, layer]) => [name, layer.status])
          ),
          warningCount: structuredAnswer.warnings.length,
          sourceCount: structuredAnswer.sources.length,
          approvedNumericTokenCount: structuredAnswer.approvedNumericTokens.length,
          approvedYearTokenCount: structuredAnswer.approvedYearTokens.length,
          leverIds: structuredAnswer.layers.lever.leverIds,
        } : undefined,
        leverRetrieval: levers ? {
          recordCount: levers.records.length,
          matchedBy: levers.matchedBy,
          warningCount: levers.warnings.length,
          emptyReason: levers.emptyReason,
        } : undefined,
        newsRetrieval: newsResult ? {
          publishedCount: newsResult.published.length,
          pendingCount: newsResult.pending.count,
          territoryCount: newsResult.queryApplied.territories.length,
          dateFilterUsed: Boolean(newsResult.queryApplied.fromDate || newsResult.queryApplied.toDate),
          limit: newsResult.queryApplied.limit,
          warningCodes: newsResult.warnings,
        } : undefined,
        page: chatRequest.currentPage,
        region: chatRequest.region,
        language: chatRequest.language,
        identityType: identity.type,
        authenticated: identity.verified,
        admin: identity.type === 'admin',
      });
      telemetry.mode = 'gemini-test';
      telemetry.sourceCount = structuredAnswer?.sources.length || 0;
      return respondWithTelemetry({
        answer,
        mode: 'gemini-test',
        sources: structuredAnswer?.sources || [],
        quota: quotaResult.quota,
      }, 200, {
        outcome: 'success',
        sourceCount: structuredAnswer?.sources.length || 0,
      });
    } catch (error) {
      telemetry.errorCode = error instanceof AIChatHttpError ? error.code : 'AI_CHAT_ERROR';
      const fallbackReason = mapFallbackReason(error);
      if (fallbackReason && canBuildTemplateFallback(structuredAnswer, route)) {
        try {
          const fallback = buildTemplateFallback({
            structuredAnswer,
            reason: fallbackReason,
            language: structuredAnswer.language,
            intent: route,
            safeErrorContext: error instanceof AIChatHttpError
              ? { code: error.code, status: error.status }
              : undefined,
          });
          logger.info('request_fallback', {
            fallbackUsed: true,
            fallbackReason,
            intent: route.intent,
            structuredAnswerAvailability: structuredAnswer.availability,
            blocked: structuredAnswer.blocked,
            clarificationRequired: structuredAnswer.clarificationRequired,
            sourceCount: fallback.sources.length,
          });
          telemetry.mode = fallback.mode;
          telemetry.fallbackUsed = true;
          telemetry.fallbackReason = fallbackReason;
          telemetry.sourceCount = fallback.sources.length;
          return respondWithTelemetry({
            answer: fallback.answer,
            mode: fallback.mode,
            sources: fallback.sources,
            fallback: fallbackPublicMetadata(fallback.fallback),
          }, 200, {
            outcome: outcomeForFallbackReason(fallbackReason),
            fallbackUsed: true,
            fallbackReason,
            sourceCount: fallback.sources.length,
          });
        } catch (fallbackError) {
          logger.error('request_failed', errorLogFields(fallbackError));
          const payload = errorPayload(fallbackError);
          return respondWithTelemetry(payload.body, payload.status, {
            outcome: 'error',
            errorCode: payload.body.code,
          });
        }
      }
      if (fallbackReason && canBuildKnowledgeTemplateFallback(knowledgeAnswer)) {
        try {
          const knowledgeFallbackReason = fallbackReason === 'GEMINI_RESPONSE_REJECTED' ? 'KNOWLEDGE_RESPONSE_REJECTED' : 'KNOWLEDGE_GEMINI_UNAVAILABLE';
          const fallback = buildKnowledgeTemplateFallback({
            knowledgeAnswer,
            reason: knowledgeFallbackReason,
            language: knowledgeAnswer.language,
          });
          logger.info('request_fallback', {
            fallbackUsed: true,
            fallbackReason: fallback.fallback.reason,
            intent: route?.intent,
            retrievalStatus: knowledgeAnswer.status,
            sourceCount: fallback.sources.length,
          });
          telemetry.mode = fallback.mode;
          telemetry.fallbackUsed = true;
          telemetry.fallbackReason = fallback.fallback.reason;
          telemetry.sourceCount = fallback.sources.length;
          return respondWithTelemetry({
            answer: fallback.answer,
            mode: fallback.mode,
            sources: fallback.sources,
            fallback: fallbackPublicMetadata(fallback.fallback),
          }, 200, {
            outcome: outcomeForFallbackReason(fallbackReason),
            fallbackUsed: true,
            fallbackReason: fallback.fallback.reason,
            sourceCount: fallback.sources.length,
          });
        } catch (fallbackError) {
          logger.error('request_failed', errorLogFields(fallbackError));
          const payload = errorPayload(fallbackError);
          return respondWithTelemetry(payload.body, payload.status, {
            outcome: 'error',
            errorCode: payload.body.code,
          });
        }
      }
      logger.error('request_failed', errorLogFields(error));
      const payload = errorPayload(error);
      return respondWithTelemetry(payload.body, payload.status, {
        outcome: outcomeForErrorCode(payload.body.code),
        errorCode: payload.body.code,
      });
    }
  };
}

function scoreBucket(score?: number): string | undefined {
  if (typeof score !== 'number') return undefined;
  if (score >= 20) return 'high';
  if (score >= 12) return 'medium';
  if (score >= 8) return 'low';
  return 'below-threshold';
}

function performanceStartMs(): number {
  const value = globalThis.performance?.now?.();
  return typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
}

function errorPayload(error: unknown): { body: ErrorPayload; status: number } {
  if (error instanceof AIChatHttpError) {
    return {
      status: error.status,
      body: { error: error.message, code: error.code },
    };
  }
  return {
    status: 500,
    body: { error: 'The AI assistant could not respond right now.', code: 'AI_CHAT_ERROR' },
  };
}

function outcomeForFallbackReason(reason: FallbackReason): AIChatTelemetryOutcome {
  if (reason === 'GEMINI_RATE_LIMIT' || reason === 'QUOTA_EXHAUSTED') return 'rate_limited';
  if (reason === 'DETERMINISTIC_BLOCKED') return 'refused';
  return 'fallback';
}

function outcomeForErrorCode(code: string): AIChatTelemetryOutcome {
  if (code === 'AI_CHAT_QUOTA_EXHAUSTED' || code === 'GEMINI_RATE_LIMITED') return 'rate_limited';
  if (code.startsWith('AI_CHAT_AUTH_') || code === 'AI_CHAT_USER_SUSPENDED' || code === 'METHOD_NOT_ALLOWED') return 'refused';
  return 'error';
}

async function refundQuotaReservation(
  quotaService: AIChatQuotaServiceLike,
  logger: SafeLogger,
  reservation: AIChatQuotaReservation,
  reason: 'MODEL_CALL_FAILED' | 'RESPONSE_VALIDATION_REJECTED'
): Promise<void> {
  const result = await quotaService.refundReservation(reservation);
  logger.info('quota_refund', {
    refunded: result.status === 'refunded',
    refundStatus: result.status,
    reason,
    identityType: reservation.identityType,
    quotaRemaining: result.quota?.remaining,
    quotaLimit: result.quota?.limit,
  });
}

function logQuotaGate(logger: SafeLogger, result: QuotaReservationResult): void {
  logger.info('quota_reservation', {
    quotaStatus: result.status,
    identityType: result.status === 'reserved'
      ? result.reservation.identityType
      : undefined,
    unavailableReason: result.status === 'unavailable' ? result.reason : undefined,
    quotaRemaining: result.status === 'reserved' || result.status === 'exhausted' ? result.quota.remaining : undefined,
    quotaLimit: result.status === 'reserved' || result.status === 'exhausted' ? result.quota.limit : result.limit,
  });
}

function buildDeterministicNewsResponse(newsResult: AIChatNewsResult | undefined): AIChatSuccessResponse {
  const published = newsResult?.published || [];
  const pendingCount = newsResult?.pending.count || 0;
  const lead = published.length
    ? `Found ${published.length} published Borneo Tracker news item(s) matching this request.`
    : 'No published Borneo Tracker news items matched this request.';
  const pendingNote = pendingCount
    ? `${pendingCount} news item(s) are still pending review and are not shown.`
    : 'No pending review items are included.';
  const titles = published
    .slice(0, 3)
    .map((item) => item.title.trim())
    .filter(Boolean)
    .join('; ');
  return {
    answer: titles ? `${lead} Published titles: ${titles}. ${pendingNote}` : `${lead} ${pendingNote}`,
    mode: 'template-fallback',
    sources: published.map((item) => ({
      id: item.id,
      publisher: item.publisher,
      title: item.title,
      url: item.url,
      sourceFile: item.sourceFile || 'public/data/ai-chat-news.json',
    })),
  };
}

export function mapFallbackReason(error: unknown): FallbackReason | undefined {
  if (!(error instanceof AIChatHttpError)) return undefined;
  if (error.code === 'AI_CHAT_QUOTA_UNAVAILABLE') return 'QUOTA_UNAVAILABLE';
  if (error.code === 'AI_CHAT_QUOTA_EXHAUSTED') return 'QUOTA_EXHAUSTED';
  if (error.code === 'GEMINI_TIMEOUT') return 'GEMINI_TIMEOUT';
  if (error.code === 'GEMINI_RATE_LIMITED') return 'GEMINI_RATE_LIMIT';
  if (error.code === 'MISSING_GEMINI_API_KEY') return 'GEMINI_NOT_CONFIGURED';
  if (error.code === 'MALFORMED_GEMINI_RESPONSE') return 'GEMINI_MALFORMED_RESPONSE';
  if (error.code === 'EMPTY_GEMINI_RESPONSE') return 'GEMINI_EMPTY_RESPONSE';
  if (error.code === 'GEMINI_REQUEST_FAILED') return 'GEMINI_UNAVAILABLE';
  const httpStatus = error.code.match(/^GEMINI_HTTP_(\d+)$/)?.[1];
  if (!httpStatus) return undefined;
  const status = Number(httpStatus);
  if ([500, 502, 503, 504].includes(status)) return 'GEMINI_UNAVAILABLE';
  return 'GEMINI_HTTP_ERROR';
}

export const handleAiChatRequest = createAiChatHandler();

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleAiChatRequest);
}
