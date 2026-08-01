export const MAX_MESSAGE_LENGTH = 1200;

export type AIChatRequest = {
  message: string;
  currentPage: string;
  region: string;
  language: string;
};

export type AIChatResponse = {
  answer: string;
  mode: 'gemini-test';
  sources: [];
};

export type ErrorPayload = {
  error: string;
  code: string;
};

export class AIChatHttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AIChatHttpError';
    this.status = status;
    this.code = code;
  }
}

function sanitizeOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AIChatHttpError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

export function validateChatRequest(body: unknown): AIChatRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AIChatHttpError(400, 'INVALID_REQUEST', 'Request body must be a JSON object.');
  }

  const record = body as Record<string, unknown>;
  if (!Object.hasOwn(record, 'message')) {
    throw new AIChatHttpError(400, 'MISSING_MESSAGE', 'Message is required.');
  }
  if (typeof record.message !== 'string') {
    throw new AIChatHttpError(400, 'INVALID_MESSAGE', 'Message must be a string.');
  }

  const message = record.message.trim();
  if (!message) {
    throw new AIChatHttpError(400, 'EMPTY_MESSAGE', 'Message cannot be empty.');
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new AIChatHttpError(
      400,
      'MESSAGE_TOO_LONG',
      `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`
    );
  }

  return {
    message,
    currentPage: sanitizeOptionalString(record.currentPage || '/'),
    region: sanitizeOptionalString(record.region),
    language: sanitizeOptionalString(record.language || 'en') || 'en',
  };
}

export function jsonResponse(payload: AIChatResponse | ErrorPayload, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AIChatHttpError) {
    return jsonResponse({ error: error.message, code: error.code }, error.status);
  }
  return jsonResponse(
    { error: 'The AI assistant could not respond right now.', code: 'AI_CHAT_ERROR' },
    500
  );
}
