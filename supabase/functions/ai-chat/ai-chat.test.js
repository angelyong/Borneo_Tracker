import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateChatRequest } from './contracts.ts';
import { generateGeminiAnswer } from './geminiClient.ts';
import { handleAiChatRequest } from './index.ts';

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
