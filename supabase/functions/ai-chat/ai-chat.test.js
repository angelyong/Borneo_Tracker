import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateChatRequest } from './contracts.ts';
import { generateGeminiAnswer } from './geminiClient.ts';
import { createAiChatHandler, handleAiChatRequest } from './index.ts';

const validPayload = {
  message: 'Hello',
  currentPage: '/dashboard',
  region: 'Sabah',
  language: 'en',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function request(payload, init = {}) {
  return new Request('http://localhost/ai-chat', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function geminiResponse(text) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      candidates: [{
        content: {
          parts: [{ text }],
        },
      }],
    }),
  };
}

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('ai-chat request validation', () => {
  it('accepts a valid request', () => {
    expect(validateChatRequest(validPayload)).toEqual(validPayload);
  });

  it('rejects a missing message', async () => {
    const response = await handleAiChatRequest(request({ currentPage: '/' }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe('MISSING_MESSAGE');
  });

  it('rejects a blank message', async () => {
    const response = await handleAiChatRequest(request({ ...validPayload, message: '   ' }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe('EMPTY_MESSAGE');
  });
});

describe('Gemini client', () => {
  it('returns Gemini text on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiResponse('Borneo Tracker AI is connected.'));
    const answer = await generateGeminiAnswer(validPayload, {
      env: { AICHATBOTGEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.6-flash' },
      fetchImpl,
    });

    expect(answer).toBe('Borneo Tracker AI is connected.');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-goog-api-key': 'test-key' }),
      })
    );
  });

  it('rejects a missing API key before calling Gemini', async () => {
    const fetchImpl = vi.fn();
    await expect(generateGeminiAnswer(validPayload, { env: {}, fetchImpl })).rejects.toMatchObject({
      status: 500,
      code: 'MISSING_GEMINI_API_KEY',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back to GEMINI_API_KEY when the chatbot-specific key is absent', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiResponse('Fallback key worked.'));
    const answer = await generateGeminiAnswer(validPayload, {
      env: { GEMINI_API_KEY: 'fallback-key' },
      fetchImpl,
    });

    expect(answer).toBe('Fallback key worked.');
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-goog-api-key': 'fallback-key' }),
      })
    );
  });

  it('rejects an invalid timeout configuration before calling Gemini', async () => {
    const fetchImpl = vi.fn();

    await expect(generateGeminiAnswer(validPayload, {
      env: {
        AICHATBOTGEMINI_API_KEY: 'test-key',
        AI_CHAT_TIMEOUT_MS: '0',
      },
      fetchImpl,
    })).rejects.toMatchObject({
      status: 500,
      code: 'INVALID_AI_CHAT_CONFIG',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses the configured timeout from environment', async () => {
    const fetchImpl = vi.fn((_, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));

    await expect(generateGeminiAnswer(validPayload, {
      env: {
        AICHATBOTGEMINI_API_KEY: 'test-key',
        AI_CHAT_TIMEOUT_MS: '1',
      },
      fetchImpl,
    })).rejects.toMatchObject({
      status: 504,
      code: 'GEMINI_TIMEOUT',
    });
  });

  it('returns a safe timeout error', async () => {
    const fetchImpl = vi.fn((_, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));

    await expect(generateGeminiAnswer(validPayload, {
      env: { AICHATBOTGEMINI_API_KEY: 'test-key' },
      fetchImpl,
      timeoutMs: 1,
    })).rejects.toMatchObject({
      status: 504,
      code: 'GEMINI_TIMEOUT',
    });
  });

  it.each([
    [400, 502, 'GEMINI_HTTP_400'],
    [403, 502, 'GEMINI_HTTP_403'],
    [404, 502, 'GEMINI_HTTP_404'],
    [429, 429, 'GEMINI_RATE_LIMITED'],
    [500, 502, 'GEMINI_HTTP_500'],
  ])('returns a safe Gemini HTTP error for %s', async (geminiStatus, expectedStatus, code) => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: geminiStatus,
      json: () => Promise.resolve({ error: 'secret details' }),
    });

    await expect(generateGeminiAnswer(validPayload, {
      env: { AICHATBOTGEMINI_API_KEY: 'test-key' },
      fetchImpl,
    })).rejects.toMatchObject({
      status: expectedStatus,
      code,
    });
  });

  it('rejects a malformed Gemini response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(generateGeminiAnswer(validPayload, {
      env: { AICHATBOTGEMINI_API_KEY: 'test-key' },
      fetchImpl,
    })).rejects.toMatchObject({
      status: 502,
      code: 'MALFORMED_GEMINI_RESPONSE',
    });
  });

  it('rejects an empty Gemini response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiResponse(''));

    await expect(generateGeminiAnswer(validPayload, {
      env: { AICHATBOTGEMINI_API_KEY: 'test-key' },
      fetchImpl,
    })).rejects.toMatchObject({
      status: 502,
      code: 'EMPTY_GEMINI_RESPONSE',
    });
  });
});

describe('ai-chat endpoint', () => {
  it('handles CORS preflight without requiring Gemini configuration', async () => {
    const handler = createAiChatHandler({
      env: { AI_CHAT_CORS_ORIGINS: 'https://example.com' },
      logger: silentLogger,
    });

    const response = await handler(new Request('http://localhost/ai-chat', {
      method: 'OPTIONS',
      headers: { origin: 'https://example.com' },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('adds CORS headers to errors', async () => {
    const handler = createAiChatHandler({
      env: { AI_CHAT_CORS_ORIGINS: '*' },
      logger: silentLogger,
    });

    const response = await handler(new Request('http://localhost/ai-chat', {
      method: 'GET',
    }));
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(body.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('injects the Gemini dependency for handler tests', async () => {
    const geminiClient = vi.fn().mockResolvedValue('Injected response.');
    const handler = createAiChatHandler({ geminiClient, logger: silentLogger });

    const response = await handler(request(validPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(geminiClient).toHaveBeenCalledWith(validPayload);
    expect(body.answer).toBe('Injected response.');
  });

  it('logs safe error metadata without secrets', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const handler = createAiChatHandler({
      geminiClient: vi.fn().mockRejectedValue(new Error('api-key test-key leaked')),
      logger,
    });

    const response = await handler(request(validPayload));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('AI_CHAT_ERROR');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('test-key');
  });

  it('returns the final Stage 1A response contract on Gemini success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiResponse('Connected.')));
    vi.stubEnv('AICHATBOTGEMINI_API_KEY', 'test-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.6-flash');

    const response = await handleAiChatRequest(request(validPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      answer: 'Connected.',
      mode: 'gemini-test',
      sources: [],
    });

  });
});
