import {
  type AIChatRequest,
  AIChatHttpError,
  type AIChatStructuredAnswer,
  type FallbackReason,
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
import { routeAiChatIntent } from './intentRouter.ts';
import { consoleSafeLogger, errorLogFields, type SafeLogger } from './logger.ts';
import { buildStructuredAnswer } from './structuredAnswerBuilder.ts';
import {
  buildTemplateFallback,
  canBuildTemplateFallback,
  fallbackPublicMetadata,
} from './templateFallback.ts';

declare const Deno:
  | { serve?: (handler: (request: Request) => Response | Promise<Response>) => void }
  | undefined;

type GeminiAnswerClient = (request: AIChatRequest) => Promise<string>;
type StructuredAnswerClient = (input: Parameters<typeof buildStructuredAnswer>[0]) => AIChatStructuredAnswer;

type HandlerOptions = {
  env?: EnvLike;
  geminiClient?: GeminiAnswerClient;
  factRepository?: FactDataRepository;
  structuredAnswerBuilder?: StructuredAnswerClient;
  logger?: SafeLogger;
};

export function createAiChatHandler(options: HandlerOptions = {}) {
  const logger = options.logger || consoleSafeLogger;
  const geminiClient =
    options.geminiClient ||
    ((chatRequest: AIChatRequest) => generateGeminiAnswer(chatRequest, { env: options.env }));
  const structuredAnswerBuilder = options.structuredAnswerBuilder || buildStructuredAnswer;

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
      structuredAnswer = factObject
        ? structuredAnswerBuilder({
            language: entities.language || route.language || chatRequest.language,
            factObject,
            entities,
            comparability,
          })
        : undefined;
      const answer = await geminiClient(chatRequest);
      logger.info('request_completed', {
        mode: 'gemini-test',
        intent: route.intent,
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
        } : undefined,
        page: chatRequest.currentPage,
        region: chatRequest.region,
        language: chatRequest.language,
      });
      return jsonResponse({
        answer,
        mode: 'gemini-test',
        sources: [],
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
