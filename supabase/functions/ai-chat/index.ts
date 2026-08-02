import {
  type AIChatRequest,
  errorResponse,
  jsonResponse,
  parseJsonBody,
  validateChatRequest,
} from './contracts.ts';
<<<<<<< Updated upstream
import { evaluateComparability, inferComparabilityInputFromRequest } from './comparabilityGate.ts';
=======
import { buildCorsHeaders, type EnvLike, parseCorsConfig } from './config.ts';
import { resolveAiChatEntities } from './entityResolver.ts';
>>>>>>> Stashed changes
import { generateGeminiAnswer } from './geminiClient.ts';
import { routeAiChatIntent } from './intentRouter.ts';
import { consoleSafeLogger, errorLogFields, type SafeLogger } from './logger.ts';

declare const Deno:
  | { serve?: (handler: (request: Request) => Response | Promise<Response>) => void }
  | undefined;

type GeminiAnswerClient = (request: AIChatRequest) => Promise<string>;

<<<<<<< Updated upstream
  try {
    const body = await parseJsonBody(request);
    const chatRequest = validateChatRequest(body);
    const comparability = evaluateComparability(inferComparabilityInputFromRequest(chatRequest));
    console.info('ai-chat comparability', {
      decision: comparability.decision,
      blockedOperations: comparability.blockedOperations,
      allowedOperations: comparability.allowedOperations,
      disclosureCount: comparability.requiredDisclosures.length,
    });
    const answer = await generateGeminiAnswer(chatRequest);
    return jsonResponse({
      answer,
      mode: 'gemini-test',
      sources: [],
    });
  } catch (error) {
    return errorResponse(error);
  }
=======
type HandlerOptions = {
  env?: EnvLike;
  geminiClient?: GeminiAnswerClient;
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
>>>>>>> Stashed changes
}

export const handleAiChatRequest = createAiChatHandler();

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleAiChatRequest);
}
