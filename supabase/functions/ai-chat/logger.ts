import { AIChatHttpError } from './contracts.ts';

export type SafeLogger = {
  info: (event: string, fields?: Record<string, unknown>) => void;
  warn: (event: string, fields?: Record<string, unknown>) => void;
  error: (event: string, fields?: Record<string, unknown>) => void;
};

const SECRET_FIELD_PATTERN = /key|secret|token|authorization|password|cookie/i;

function sanitizeFields(fields: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      SECRET_FIELD_PATTERN.test(key) ? '[redacted]' : value,
    ])
  );
}

function log(level: 'info' | 'warn' | 'error', event: string, fields?: Record<string, unknown>): void {
  const payload = {
    event,
    ...sanitizeFields(fields),
  };

  console[level](`[ai-chat] ${JSON.stringify(payload)}`);
}

export const consoleSafeLogger: SafeLogger = {
  info: (event, fields) => log('info', event, fields),
  warn: (event, fields) => log('warn', event, fields),
  error: (event, fields) => log('error', event, fields),
};

export function errorLogFields(error: unknown): Record<string, unknown> {
  if (error instanceof AIChatHttpError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
    };
  }

  return {
    status: 500,
    code: 'AI_CHAT_ERROR',
    message: 'Unexpected AI chat error.',
  };
}
