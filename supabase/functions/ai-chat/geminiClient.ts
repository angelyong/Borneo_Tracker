import { AIChatHttpError, type AIChatPrompt, type AIChatRequest, type AIChatSiteKnowledgePrompt } from './contracts.ts';
import { type EnvLike, parseAiChatConfig } from './config.ts';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
export const GEMINI_MAX_OUTPUT_TOKENS = 512;

type GeminiClientOptions = {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  prompt?: AIChatPrompt | AIChatSiteKnowledgePrompt;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
};

function buildPrompt(request: AIChatRequest): string {
  return [
    `User language: ${request.language}`,
    `Current page: ${request.currentPage || '/'}`,
    `Selected region: ${request.region || 'none'}`,
    `User message: ${request.message}`,
  ].join('\n');
}

function connectionTestSystemInstruction(): string {
  return [
    'You are Borneo Tracker AI.',
    'Answer in the same language as the user.',
    'This is a connection test only.',
    'Return a short response confirming the chatbot backend is connected to Gemini.',
    'Do not provide RAG, dashboard data, news, advice, or resilience calculations yet.',
  ].join(' ');
}

function extractText(payload: GeminiGenerateContentResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || '').join('').trim();
}

function assertCompleteGeminiCandidate(payload: GeminiGenerateContentResponse): void {
  const candidate = payload.candidates?.[0];
  if (!candidate) {
    throw new AIChatHttpError(
      502,
      'EMPTY_GEMINI_RESPONSE',
      'The AI assistant provider returned no candidate response.'
    );
  }
  const finishReason = candidate.finishReason || '';
  if (finishReason === 'STOP') return;
  if (finishReason === 'MAX_TOKENS') {
    throw new AIChatHttpError(
      502,
      'GEMINI_TRUNCATED',
      'The AI assistant provider stopped before completing the answer.'
    );
  }
  throw new AIChatHttpError(
    502,
    finishReason ? `GEMINI_INCOMPLETE_${finishReason}` : 'GEMINI_INCOMPLETE_RESPONSE',
    'The AI assistant provider returned an incomplete response.'
  );
}

function geminiHttpError(status: number): AIChatHttpError {
  if (status === 429) {
    return new AIChatHttpError(
      429,
      'GEMINI_RATE_LIMITED',
      'The AI assistant quota has been reached. Please wait and try again.'
    );
  }
  if ([400, 403, 404].includes(status)) {
    return new AIChatHttpError(
      502,
      `GEMINI_HTTP_${status}`,
      'The AI assistant provider rejected the request.'
    );
  }
  if (status >= 500) {
    return new AIChatHttpError(
      502,
      `GEMINI_HTTP_${status}`,
      'The AI assistant provider is temporarily unavailable.'
    );
  }
  return new AIChatHttpError(
    502,
    `GEMINI_HTTP_${status}`,
    'The AI assistant provider returned an unexpected error.'
  );
}

export async function generateGeminiAnswer(
  request: AIChatRequest,
  options: GeminiClientOptions = {}
): Promise<string> {
  const config = parseAiChatConfig(options.env);
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? config.geminiTimeoutMs;
  const systemInstruction = options.prompt?.systemInstruction || connectionTestSystemInstruction();
  const userContent = options.prompt?.userContent || buildPrompt(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${GEMINI_BASE_URL}/${encodeURIComponent(config.geminiModel)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: systemInstruction,
          }],
        },
        contents: [{
          role: 'user',
          parts: [{ text: userContent }],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw geminiHttpError(response.status);
    }

    let payload: GeminiGenerateContentResponse;
    try {
      payload = await response.json();
    } catch {
      throw new AIChatHttpError(
        502,
        'MALFORMED_GEMINI_RESPONSE',
        'The AI assistant provider returned an unreadable response.'
      );
    }

    assertCompleteGeminiCandidate(payload);
    const answer = extractText(payload);
    if (!answer) {
      throw new AIChatHttpError(
        502,
        'EMPTY_GEMINI_RESPONSE',
        'The AI assistant provider returned an empty response.'
      );
    }
    return answer;
  } catch (error) {
    if (error instanceof AIChatHttpError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AIChatHttpError(
        504,
        'GEMINI_TIMEOUT',
        'The AI assistant request timed out. Please try again.'
      );
    }
    throw new AIChatHttpError(
      502,
      'GEMINI_REQUEST_FAILED',
      'The AI assistant provider could not be reached.'
    );
  } finally {
    clearTimeout(timeout);
  }
}
