import {
  MAX_CHAT_MESSAGE_LENGTH,
  SUGGESTED_QUESTIONS,
  SUPPORTED_CHAT_LANGUAGES,
} from '../shared/aiChatContracts';

export { SUGGESTED_QUESTIONS };

const DEFAULT_TIMEOUT_MS = 30000;

export function createConversationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class AIChatServiceError extends Error {
  constructor(message, {
    status,
    code = 'AI_CHAT_ERROR',
    retryable = false,
  } = {}) {
    super(message);
    this.name = 'AIChatServiceError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function safeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLanguage(value) {
  const language = safeString(value).toLowerCase();
  return SUPPORTED_CHAT_LANGUAGES.includes(language) ? language : 'en';
}

function getTimeoutMs() {
  const configured = Number(import.meta.env.VITE_AI_CHAT_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function getChatEndpoint() {
  return String(import.meta.env.VITE_AI_CHAT_ENDPOINT || '').trim();
}

function createRequestBody({ message, currentPage, region, language }) {
  return {
    message: safeString(message),
    currentPage: safeString(currentPage) || '/',
    region: safeString(region),
    language: normalizeLanguage(language),
  };
}

async function createRequestHeaders(accessTokenProvider) {
  const headers = { 'Content-Type': 'application/json' };
  if (typeof accessTokenProvider !== 'function') return headers;

  const token = safeString(await accessTokenProvider());
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSource(source) {
  if (!isPlainObject(source)) return null;

  const normalized = {};
  const id = safeString(source.id);
  const title = safeString(source.title);
  const publisher = safeString(source.publisher);
  const url = safeString(source.url);
  const year = Number(source.year);

  if (id) normalized.id = id;
  if (title) normalized.title = title;
  if (publisher) normalized.publisher = publisher;
  if (Number.isInteger(year) && year > 0) normalized.year = year;
  if (url) normalized.url = url;

  if (!normalized.title && !normalized.publisher && !normalized.year && !normalized.url) return null;
  return normalized;
}

function normalizeSources(sources) {
  if (sources == null) return [];
  if (!Array.isArray(sources)) {
    throw new AIChatServiceError(
      'The AI assistant returned invalid sources.',
      { code: 'AI_CHAT_MALFORMED_RESPONSE', retryable: false }
    );
  }

  const seen = new Set();
  const normalized = [];
  for (const source of sources) {
    const item = normalizeSource(source);
    if (!item) continue;
    const key = [item.title, item.publisher, item.year, item.url].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(item);
  }
  return normalized;
}

function normalizeFallback(fallback) {
  if (fallback == null) return undefined;
  if (!isPlainObject(fallback)) {
    throw new AIChatServiceError(
      'The AI assistant returned invalid fallback metadata.',
      { code: 'AI_CHAT_MALFORMED_RESPONSE', retryable: false }
    );
  }

  return {
    used: Boolean(fallback.used),
    ...(safeString(fallback.reason) ? { reason: safeString(fallback.reason) } : {}),
    ...(typeof fallback.degraded === 'boolean' ? { degraded: fallback.degraded } : {}),
  };
}

function normalizeQuota(quota) {
  if (quota == null) return undefined;
  if (!isPlainObject(quota)) return undefined;

  const remaining = Number(quota.remaining);
  const limit = Number(quota.limit);
  const resetsAt = safeString(quota.resetsAt);
  const normalized = {};

  if (Number.isFinite(remaining)) normalized.remaining = remaining;
  if (Number.isFinite(limit)) normalized.limit = limit;
  if (resetsAt) normalized.resetsAt = resetsAt;

  return Object.keys(normalized).length ? normalized : undefined;
}

export function normalizeAIChatResponse(body) {
  if (!isPlainObject(body) || typeof body.answer !== 'string' || !body.answer.trim()) {
    throw new AIChatServiceError(
      'The AI assistant returned an invalid response.',
      { code: 'AI_CHAT_MALFORMED_RESPONSE', retryable: false }
    );
  }

  if (!['gemini-test', 'template-fallback'].includes(body.mode)) {
    throw new AIChatServiceError(
      'The AI assistant returned an unsupported response mode.',
      { code: 'AI_CHAT_MALFORMED_RESPONSE', retryable: false }
    );
  }

  const fallback = normalizeFallback(body.fallback);
  const quota = normalizeQuota(body.quota);

  return {
    answer: body.answer,
    mode: body.mode,
    sources: normalizeSources(body.sources),
    ...(fallback ? { fallback } : {}),
    ...(quota ? { quota } : {}),
  };
}

async function readErrorPayload(response) {
  try {
    const body = await response.json();
    return isPlainObject(body) ? body : {};
  } catch {
    return {};
  }
}

function errorForStatus(status, body = {}) {
  const backendCode = safeString(body.code);
  if (status === 400) {
    return new AIChatServiceError(
      'The request could not be sent.',
      { status, code: backendCode || 'AI_CHAT_INVALID_REQUEST', retryable: false }
    );
  }
  if (status === 404) {
    return new AIChatServiceError(
      'The AI assistant service is not available.',
      { status, code: 'AI_CHAT_NOT_AVAILABLE', retryable: true }
    );
  }
  if (status === 405) {
    return new AIChatServiceError(
      'The AI assistant request method is not supported.',
      { status, code: 'AI_CHAT_METHOD_NOT_ALLOWED', retryable: false }
    );
  }
  if (status === 401 || status === 403) {
    return new AIChatServiceError(
      'The AI assistant could not verify your sign-in session.',
      { status, code: safeString(body.code) || 'AI_CHAT_AUTH_FAILED', retryable: false }
    );
  }
  if (status === 413 || backendCode === 'MESSAGE_TOO_LONG') {
    return new AIChatServiceError(
      'The message is too long.',
      { status, code: 'AI_CHAT_MESSAGE_TOO_LONG', retryable: false }
    );
  }
  if (status === 429) {
    return new AIChatServiceError(
      'The AI assistant quota has been reached. Please wait and try again.',
      { status, code: 'AI_CHAT_RATE_LIMITED', retryable: false }
    );
  }
  if (status >= 500) {
    return new AIChatServiceError(
      'The AI assistant server had a problem. Please try again later.',
      { status, code: 'AI_CHAT_SERVER_ERROR', retryable: true }
    );
  }
  return new AIChatServiceError(
    'The AI assistant could not respond right now.',
    { status, code: backendCode || 'AI_CHAT_REQUEST_FAILED', retryable: false }
  );
}

function normalizeFailure(error) {
  if (error instanceof AIChatServiceError) return error;
  if (error?.name === 'AbortError') {
    return new AIChatServiceError(
      'The AI assistant timed out. Please try again.',
      { code: 'AI_CHAT_TIMEOUT', retryable: true }
    );
  }
  return new AIChatServiceError(
    'The AI assistant connection failed. Please try again later.',
    { code: 'AI_CHAT_NETWORK_FAILED', retryable: true }
  );
}

export async function sendAIChatMessage({
  message,
  currentPage,
  region,
  language = 'en',
  accessTokenProvider,
} = {}) {
  const payload = createRequestBody({ message, currentPage, region, language });
  if (!payload.message) {
    throw new AIChatServiceError(
      'Message cannot be empty.',
      { code: 'AI_CHAT_EMPTY_MESSAGE', retryable: false }
    );
  }
  if (payload.message.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new AIChatServiceError(
      'The message is too long.',
      { code: 'AI_CHAT_MESSAGE_TOO_LONG', retryable: false }
    );
  }
  const endpoint = getChatEndpoint();
  if (!endpoint) {
    throw new AIChatServiceError(
      'The AI assistant service is not configured.',
      { code: 'AI_CHAT_ENDPOINT_MISSING', retryable: false }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: await createRequestHeaders(accessTokenProvider),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw errorForStatus(response.status, await readErrorPayload(response));
    }

    const body = await response.json().catch(() => {
      throw new AIChatServiceError(
        'The AI assistant returned an unreadable response.',
        { code: 'AI_CHAT_MALFORMED_RESPONSE', retryable: false }
      );
    });
    return normalizeAIChatResponse(body);
  } catch (error) {
    throw normalizeFailure(error);
  } finally {
    clearTimeout(timeout);
  }
}
