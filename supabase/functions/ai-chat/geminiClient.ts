import { AIChatHttpError, type AIChatRequest } from './contracts.ts';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.6-flash';
const DEFAULT_TIMEOUT_MS = 30000;

type GeminiClientOptions = {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function readRuntimeEnv(name: string): string | undefined {
  const deno = globalThis as typeof globalThis & {
    Deno?: { env?: { get?: (key: string) => string | undefined } };
    process?: { env?: Record<string, string | undefined> };
  };
  return deno.Deno?.env?.get?.(name) || deno.process?.env?.[name];
}

function envValue(env: Record<string, string | undefined> | undefined, name: string): string {
  return (env?.[name] ?? readRuntimeEnv(name) ?? '').trim();
}

function timeoutFromEnv(env: Record<string, string | undefined> | undefined): number {
  const raw = envValue(env, 'AI_CHAT_TIMEOUT_MS');
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function modelFromEnv(env: Record<string, string | undefined> | undefined): string {
  return envValue(env, 'GEMINI_MODEL') || DEFAULT_MODEL;
}

function apiKeyFromEnv(env: Record<string, string | undefined> | undefined): string {
  return envValue(env, 'AICHATBOTGEMINI_API_KEY') || envValue(env, 'GEMINI_API_KEY');
}

function buildPrompt(request: AIChatRequest): string {
  return [
    `User language: ${request.language}`,
    `Current page: ${request.currentPage || '/'}`,
    `Selected region: ${request.region || 'none'}`,
    `User message: ${request.message}`,
  ].join('\n');
}

function extractText(payload: GeminiGenerateContentResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || '').join('').trim();
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
  const env = options.env;
  const apiKey = apiKeyFromEnv(env);
  if (!apiKey) {
    throw new AIChatHttpError(
      500,
      'MISSING_GEMINI_API_KEY',
      'The AI assistant is not configured yet.'
    );
  }

  const fetchImpl = options.fetchImpl || fetch;
  const model = modelFromEnv(env);
  const timeoutMs = options.timeoutMs ?? timeoutFromEnv(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: [
              'You are Borneo Tracker AI.',
              'Answer in the same language as the user.',
              'This is a connection test only.',
              'Return a short response confirming the chatbot backend is connected to Gemini.',
              'Do not provide RAG, dashboard data, news, advice, or resilience calculations yet.',
            ].join(' '),
          }],
        },
        contents: [{
          role: 'user',
          parts: [{ text: buildPrompt(request) }],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 128,
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
