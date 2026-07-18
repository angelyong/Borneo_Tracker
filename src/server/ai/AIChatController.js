import { validateChatRequest } from './ChatRequestValidator.js';
import { AIChatService } from './AIChatService.js';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const buckets = new Map();

function getClientKey(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'local';
}

function rateLimit(req) {
  const key = getClientKey(req);
  const now = Date.now();
  const bucket = buckets.get(key) || { count: 0, resetAt: now + WINDOW_MS };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count <= MAX_REQUESTS;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export class AIChatController {
  constructor(service = new AIChatService()) {
    this.service = service;
  }

  async handleNodeRequest(req, res) {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }
    if (!rateLimit(req)) {
      sendJson(res, 429, { error: 'Too many chat requests. Please wait and try again.' });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const validation = validateChatRequest(body);
      if (!validation.ok) {
        sendJson(res, validation.status, { error: validation.error });
        return;
      }
      const response = await this.service.answer(validation.value);
      sendJson(res, 200, response);
    } catch {
      sendJson(res, 500, { error: 'The AI assistant could not respond right now.' });
    }
  }
}

export const aiChatController = new AIChatController();
