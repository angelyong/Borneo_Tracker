import { MAX_CHAT_MESSAGE_LENGTH, MAX_HISTORY_MESSAGES } from '../../shared/aiChatContracts.js';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(value) {
  return String(value || '').replace(CONTROL_CHARS, '').trim();
}

export function validateChatRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: 'Request body must be a JSON object.' };
  }

  const message = sanitizeText(body.message);
  if (!message) {
    return { ok: false, status: 400, error: 'Message is required.' };
  }
  if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
    return { ok: false, status: 400, error: `Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer.` };
  }

  const history = Array.isArray(body.history)
    ? body.history
        .slice(-MAX_HISTORY_MESSAGES)
        .filter((entry) => entry && ['user', 'assistant'].includes(entry.role))
        .map((entry) => ({
          role: entry.role,
          content: sanitizeText(entry.content).slice(0, MAX_CHAT_MESSAGE_LENGTH),
        }))
        .filter((entry) => entry.content)
    : [];

  return {
    ok: true,
    value: {
      message,
      conversationId: sanitizeText(body.conversationId),
      currentPage: sanitizeText(body.currentPage || '/'),
      region: sanitizeText(body.region),
      language: sanitizeText(body.language || 'en') || 'en',
      history,
    },
  };
}
