import {
  CHAT_ENDPOINT,
  MAX_HISTORY_MESSAGES,
  SUGGESTED_QUESTIONS,
} from '../shared/aiChatContracts';

export { SUGGESTED_QUESTIONS };

export function createConversationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class AIChatServiceError extends Error {
  constructor(message, { status = 0, code = 'AI_CHAT_ERROR' } = {}) {
    super(message);
    this.name = 'AIChatServiceError';
    this.status = status;
    this.code = code;
  }
}

function isDevelopmentMockEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_AI_CHAT_CLIENT_MOCK_FALLBACK === 'true';
}

function compactHistory(messages) {
  return messages
    .filter((message) => ['user', 'assistant'].includes(message.role))
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({ role: message.role, content: message.content }));
}

function mockClientResponse(message, conversationId) {
  const lower = message.toLowerCase();
  const isDynamic = ['latest', 'current', 'value', 'compare', 'trend', 'highest', 'lowest', 'news', 'progress'].some((term) => lower.includes(term));
  const isMixed = isDynamic && ['explain', 'what is', 'define'].some((term) => lower.includes(term));
  const known = ['borneo', 'esg', 'sdg', 'forest', 'source', 'report', 'region', 'data'].some((term) => lower.includes(term));

  if (!known) {
    return {
      answer: 'I can only assist with Borneo Tracker, ESG and SDG indicators, regional data, data sources, news, reports and website usage.',
      mode: 'unknown',
      sources: [],
      conversationId,
    };
  }

  if (isDynamic) {
    return {
      answer: `${isMixed ? 'Placeholder knowledge can explain the topic. ' : ''}Dynamic data connection is not configured yet, so I cannot provide live values, rankings, trends or news here.`,
      mode: isMixed ? 'mixed' : 'dynamic',
      sources: isMixed ? [{ title: 'Borneo Tracker placeholder knowledge', type: 'static', url: '/esg' }] : [],
      conversationId,
    };
  }

  return {
    answer: 'Placeholder content: Borneo Tracker helps users explore Borneo regional sustainability indicators, ESG pillars, SDG progress, data sources, news and report generation. Replace placeholder knowledge with approved production content before treating answers as authoritative.',
    mode: 'static',
    sources: [{ title: 'Borneo Tracker Overview', type: 'static', url: '/about' }],
    conversationId,
  };
}

function safeErrorForStatus(status, fallback = '') {
  if (status === 404) {
    return new AIChatServiceError(
      'The AI assistant service is not available yet.',
      { status, code: 'AI_CHAT_NOT_AVAILABLE' }
    );
  }
  if (status === 429) {
    return new AIChatServiceError(
      'The AI assistant quota has been reached. Please wait and try again.',
      { status, code: 'AI_CHAT_RATE_LIMITED' }
    );
  }
  if (status >= 500) {
    return new AIChatServiceError(
      'The AI assistant server had a problem. Please try again later.',
      { status, code: 'AI_CHAT_SERVER_ERROR' }
    );
  }
  return new AIChatServiceError(
    fallback || 'The AI assistant could not respond right now.',
    { status, code: 'AI_CHAT_REQUEST_FAILED' }
  );
}

function normalizeFailure(error) {
  if (error instanceof AIChatServiceError) return error;
  return new AIChatServiceError(
    'The AI assistant connection failed. Please try again later.',
    { code: 'AI_CHAT_CONNECTION_FAILED' }
  );
}

export async function sendAIChatMessage({
  message,
  conversationId,
  currentPage,
  region,
  language = 'en',
  history = [],
}) {
  const payload = {
    message,
    conversationId,
    currentPage,
    region,
    language,
    history: compactHistory(history),
  };

  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw safeErrorForStatus(response.status, body.error);
    }
    const body = await response.json().catch(() => {
      throw new AIChatServiceError(
        'The AI assistant returned an unreadable response. Please try again later.',
        { code: 'AI_CHAT_MALFORMED_RESPONSE' }
      );
    });
    if (!body || typeof body.answer !== 'string') {
      throw new AIChatServiceError(
        'The AI assistant returned an invalid response. Please try again later.',
        { code: 'AI_CHAT_MALFORMED_RESPONSE' }
      );
    }
    return body;
  } catch (error) {
    if (isDevelopmentMockEnabled()) {
      return mockClientResponse(message, conversationId || createConversationId());
    }
    throw normalizeFailure(error);
  }
}
