import { AIChatHttpError } from './contracts.ts';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
export const DEFAULT_GEMINI_TIMEOUT_MS = 30000;
export const MAX_GEMINI_TIMEOUT_MS = 120000;

export type EnvLike = Record<string, string | undefined>;

export type AIChatConfig = {
  apiKey: string;
  geminiModel: string;
  geminiTimeoutMs: number;
  corsAllowedOrigins: string[];
};

export function readRuntimeEnv(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env?: { get?: (key: string) => string | undefined } };
    process?: { env?: EnvLike };
  };
  return runtime.Deno?.env?.get?.(name) || runtime.process?.env?.[name];
}

export function envValue(env: EnvLike | undefined, name: string): string {
  return (env?.[name] ?? readRuntimeEnv(name) ?? '').trim();
}

function parsePositiveInteger(raw: string, name: string, fallback: number, max: number): number {
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new AIChatHttpError(
      500,
      'INVALID_AI_CHAT_CONFIG',
      `${name} must be an integer between 1 and ${max}.`
    );
  }
  return parsed;
}

function parseOrigins(raw: string): string[] {
  if (!raw) return ['*'];
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length ? origins : ['*'];
}

export function parseAiChatConfig(env?: EnvLike): AIChatConfig {
  const apiKey = envValue(env, 'AICHATBOTGEMINI_API_KEY') || envValue(env, 'GEMINI_API_KEY');
  if (!apiKey) {
    throw new AIChatHttpError(
      500,
      'MISSING_GEMINI_API_KEY',
      'The AI assistant is not configured yet.'
    );
  }

  return {
    apiKey,
    geminiModel: envValue(env, 'GEMINI_MODEL') || DEFAULT_GEMINI_MODEL,
    geminiTimeoutMs: parsePositiveInteger(
      envValue(env, 'AI_CHAT_TIMEOUT_MS'),
      'AI_CHAT_TIMEOUT_MS',
      DEFAULT_GEMINI_TIMEOUT_MS,
      MAX_GEMINI_TIMEOUT_MS
    ),
    corsAllowedOrigins: parseOrigins(envValue(env, 'AI_CHAT_CORS_ORIGINS')),
  };
}

export function parseCorsConfig(env?: EnvLike): Pick<AIChatConfig, 'corsAllowedOrigins'> {
  return {
    corsAllowedOrigins: parseOrigins(envValue(env, 'AI_CHAT_CORS_ORIGINS')),
  };
}

export function buildCorsHeaders(request: Request, config: Pick<AIChatConfig, 'corsAllowedOrigins'>): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });

  const requestOrigin = request.headers.get('origin') || '';
  if (config.corsAllowedOrigins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && config.corsAllowedOrigins.includes(requestOrigin)) {
    headers.set('Access-Control-Allow-Origin', requestOrigin);
  }

  return headers;
}
