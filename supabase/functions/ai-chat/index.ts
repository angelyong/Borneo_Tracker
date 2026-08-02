import {
  type AIChatRequest,
  AIChatHttpError,
  type AIChatPrompt,
  type AIChatNewsResult,
  type AIChatStructuredAnswer,
  type FallbackReason,
  type LeverRetrievalResult,
  errorResponse,
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
import { LeverRepository } from './leverRepository.ts';
import { retrieveVerifiedLevers } from './leverRetriever.ts';
import { LocalNewsRepository } from './localNewsRepository.ts';
import type { AIChatNewsRepository } from './newsRepository.ts';
import { retrieveAIChatNews } from './newsRetriever.ts';
import { routeAiChatIntent } from './intentRouter.ts';
import { consoleSafeLogger, errorLogFields, type SafeLogger } from './logger.ts';
import { buildGroundedPrompt } from './promptBuilder.ts';
import { validateGeminiResponse } from './responseValidator.ts';
import { buildStructuredAnswer } from './structuredAnswerBuilder.ts';
import {
  buildTemplateFallback,
  canBuildTemplateFallback,
  fallbackPublicMetadata,
} from './templateFallback.ts';

declare const Deno:
  | { serve?: (handler: (request: Request) => Response | Promise<Response>) => void }
  | undefined;

type GeminiAnswerClient = (request: AIChatRequest, prompt?: AIChatPrompt) => Promise<string>;
type StructuredAnswerClient = (input: Parameters<typeof buildStructuredAnswer>[0]) => AIChatStructuredAnswer;
type PromptBuilderClient = (input: Parameters<typeof buildGroundedPrompt>[0]) => AIChatPrompt;
type LeverRetrieverClient = (input: Parameters<typeof retrieveVerifiedLevers>[0]) => LeverRetrievalResult;
type NewsRetrieverClient = (input: Parameters<typeof retrieveAIChatNews>[0]) => Promise<AIChatNewsResult>;

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
  const newsRepository = options.newsRepository || new LocalNewsRepository();
  const newsRetriever = options.newsRetriever || retrieveAIChatNews;

  return async function handleAiChatRequest(request: Request): Promise<Response> {
    const corsHeaders = buildCorsHeaders(request, parseCorsConfig(options.env));

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method !== 'POST') {
      logger.warn('request_rejected', { code: 'METHOD_NOT_ALLOWED', method: request.method });
      return jsonResponse(
        { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' },
        405,
        corsHeaders
      );
    }

    let route: ReturnType<typeof routeAiChatIntent> | undefined;
    let structuredAnswer: AIChatStructuredAnswer | undefined;
    let groundedPrompt: AIChatPrompt | undefined;
    let newsResult: AIChatNewsResult | undefined;

    try {
      const body = await parseJsonBody(request);
      const chatRequest = validateChatRequest(body);
      route = routeAiChatIntent(chatRequest.message, {
        currentPage: chatRequest.currentPage,
        region: chatRequest.region,
        language: chatRequest.language,
      });
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
        return jsonResponse({
          answer: fallback.answer,
          mode: fallback.mode,
          sources: fallback.sources,
          fallback: fallbackPublicMetadata(fallback.fallback),
        }, 200, corsHeaders);
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
      const answer = groundedPrompt
        ? await geminiClient(chatRequest, groundedPrompt)
        : await geminiClient(chatRequest);
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
          return jsonResponse({
            answer: fallback.answer,
            mode: fallback.mode,
            sources: fallback.sources,
            fallback: fallbackPublicMetadata(fallback.fallback),
          }, 200, corsHeaders);
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
        });
        return jsonResponse({
          answer: validation.normalizedAnswer,
          mode: 'gemini-test',
          sources: structuredAnswer.sources,
        }, 200, corsHeaders);
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
      });
      return jsonResponse({
        answer,
        mode: 'gemini-test',
        sources: structuredAnswer?.sources || [],
      }, 200, corsHeaders);
    } catch (error) {
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
          return jsonResponse({
            answer: fallback.answer,
            mode: fallback.mode,
            sources: fallback.sources,
            fallback: fallbackPublicMetadata(fallback.fallback),
          }, 200, corsHeaders);
        } catch (fallbackError) {
          logger.error('request_failed', errorLogFields(fallbackError));
          return errorResponse(fallbackError, corsHeaders);
        }
      }
      logger.error('request_failed', errorLogFields(error));
      return errorResponse(error, corsHeaders);
    }
  };
}

export function mapFallbackReason(error: unknown): FallbackReason | undefined {
  if (!(error instanceof AIChatHttpError)) return undefined;
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
