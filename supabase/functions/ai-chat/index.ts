import {
  type AIChatRequest,
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

declare const Deno:
  | { serve?: (handler: (request: Request) => Response | Promise<Response>) => void }
  | undefined;

type GeminiAnswerClient = (request: AIChatRequest) => Promise<string>;

type HandlerOptions = {
  env?: EnvLike;
  geminiClient?: GeminiAnswerClient;
  factRepository?: FactDataRepository;
  logger?: SafeLogger;
};

export function createAiChatHandler(options: HandlerOptions = {}) {
  const logger = options.logger || consoleSafeLogger;
  const geminiClient =
    options.geminiClient ||
    ((chatRequest: AIChatRequest) => generateGeminiAnswer(chatRequest, { env: options.env }));

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

    try {
      const body = await parseJsonBody(request);
      const chatRequest = validateChatRequest(body);
      const route = routeAiChatIntent(chatRequest.message, {
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
      logger.error('request_failed', errorLogFields(error));
      return errorResponse(error, corsHeaders);
    }
  };
}

export const handleAiChatRequest = createAiChatHandler();

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleAiChatRequest);
}
