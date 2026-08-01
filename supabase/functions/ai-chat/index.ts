import {
  errorResponse,
  jsonResponse,
  parseJsonBody,
  validateChatRequest,
} from './contracts.ts';
import { generateGeminiAnswer } from './geminiClient.ts';

declare const Deno:
  | { serve?: (handler: (request: Request) => Response | Promise<Response>) => void }
  | undefined;

export async function handleAiChatRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  try {
    const body = await parseJsonBody(request);
    const chatRequest = validateChatRequest(body);
    const answer = await generateGeminiAnswer(chatRequest);
    return jsonResponse({
      answer,
      mode: 'gemini-test',
      sources: [],
    });
  } catch (error) {
    return errorResponse(error);
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleAiChatRequest);
}
