import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendAIChatMessage } from './AIChatService';

const okResponse = (body) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const errorResponse = (status, body = {}) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

describe('AIChatService Stage 7 contract', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AI_CHAT_ENDPOINT', 'https://example.test/ai-chat');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okResponse({
      answer: 'Verified answer',
      mode: 'gemini-test',
      sources: [],
    }))));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sends the normalized request body only', async () => {
    await sendAIChatMessage({
      message: '  What is Borneo Tracker?  ',
      currentPage: '/regions',
      region: 'Sabah',
      language: 'ms',
      history: [{ role: 'user', content: 'old' }],
      conversationId: 'old-id',
    });

    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      message: 'What is Borneo Tracker?',
      currentPage: '/regions',
      region: 'Sabah',
      language: 'ms',
    });
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('sends a bearer token from the injected provider without changing the request body', async () => {
    await sendAIChatMessage({
      message: 'Hi',
      currentPage: '/',
      language: 'en',
      accessTokenProvider: () => 'supabase-access-token',
      userId: 'spoofed-user',
      role: 'admin',
    });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer supabase-access-token',
    });
    expect(JSON.parse(options.body)).toEqual({
      message: 'Hi',
      currentPage: '/',
      region: '',
      language: 'en',
    });
    expect(options.body).not.toContain('supabase-access-token');
    expect(options.body).not.toContain('spoofed-user');
    expect(options.body).not.toContain('admin');
  });

  it('sends no bearer token when the injected provider has no session token', async () => {
    await sendAIChatMessage({
      message: 'Hi',
      accessTokenProvider: () => '',
    });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('does not expose tokens in safe auth errors', async () => {
    fetch.mockResolvedValueOnce(errorResponse(401, {
      code: 'AI_CHAT_AUTH_INVALID',
      error: 'token supabase-access-token leaked by backend',
    }));

    await expect(sendAIChatMessage({
      message: 'Hi',
      accessTokenProvider: () => 'supabase-access-token',
    })).rejects.toMatchObject({
      code: 'AI_CHAT_AUTH_INVALID',
      retryable: false,
      message: 'The AI assistant could not verify your sign-in session.',
    });
  });

  it('rejects empty messages before fetch', async () => {
    await expect(sendAIChatMessage({ message: '   ' })).rejects.toMatchObject({
      code: 'AI_CHAT_EMPTY_MESSAGE',
      retryable: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('normalizes unsupported language to English', async () => {
    await sendAIChatMessage({ message: 'Hi', currentPage: '/', language: 'fr' });

    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body).language).toBe('en');
  });

  it('handles missing endpoint safely', async () => {
    vi.stubEnv('VITE_AI_CHAT_ENDPOINT', '');
    await expect(sendAIChatMessage({ message: 'Hi' })).rejects.toMatchObject({
      code: 'AI_CHAT_ENDPOINT_MISSING',
      retryable: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('treats whitespace endpoint as missing before fetch', async () => {
    vi.stubEnv('VITE_AI_CHAT_ENDPOINT', '   ');
    await expect(sendAIChatMessage({ message: 'Hi' })).rejects.toMatchObject({
      code: 'AI_CHAT_ENDPOINT_MISSING',
      retryable: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts gemini-test success', async () => {
    const result = await sendAIChatMessage({ message: 'Hi' });
    expect(result).toEqual({
      answer: 'Verified answer',
      mode: 'gemini-test',
      sources: [],
    });
  });

  it('accepts template-fallback and preserves fallback metadata', async () => {
    fetch.mockResolvedValueOnce(okResponse({
      answer: 'Deterministic answer',
      mode: 'template-fallback',
      sources: [],
      fallback: { used: true, reason: 'GEMINI_TIMEOUT', degraded: true },
    }));

    await expect(sendAIChatMessage({ message: 'Hi' })).resolves.toMatchObject({
      mode: 'template-fallback',
      fallback: { used: true, reason: 'GEMINI_TIMEOUT', degraded: true },
    });
  });

  it('normalizes and deduplicates sources while ignoring internal-only fields', async () => {
    fetch.mockResolvedValueOnce(okResponse({
      answer: 'Answer',
      mode: 'gemini-test',
      sources: [
        { id: 'internal-1', title: 'Forest', publisher: 'GFW', year: '2024', url: 'https://example.test', sourceFile: 'secret.json' },
        { title: 'Forest', publisher: 'GFW', year: 2024, url: 'https://example.test', sourcePath: '/internal' },
      ],
      extra: 'ignored',
    }));

    await expect(sendAIChatMessage({ message: 'Hi' })).resolves.toMatchObject({
      sources: [{ id: 'internal-1', title: 'Forest', publisher: 'GFW', year: 2024, url: 'https://example.test' }],
    });
  });

  it('rejects malformed answer and malformed sources', async () => {
    fetch.mockResolvedValueOnce(okResponse({ mode: 'gemini-test', sources: [] }));
    await expect(sendAIChatMessage({ message: 'Hi' })).rejects.toMatchObject({
      code: 'AI_CHAT_MALFORMED_RESPONSE',
    });

    fetch.mockResolvedValueOnce(okResponse({ answer: 'Answer', mode: 'gemini-test', sources: {} }));
    await expect(sendAIChatMessage({ message: 'Hi' })).rejects.toMatchObject({
      code: 'AI_CHAT_MALFORMED_RESPONSE',
    });
  });

  it('maps safe error statuses and retryable flags', async () => {
    fetch.mockResolvedValueOnce(errorResponse(400, { error: 'debug', code: 'INVALID_REQUEST' }));
    await expect(sendAIChatMessage({ message: 'Hi' })).rejects.toMatchObject({ code: 'INVALID_REQUEST', retryable: false });

    fetch.mockResolvedValueOnce(errorResponse(404));
    await expect(sendAIChatMessage({ message: 'Hi' })).rejects.toMatchObject({ code: 'AI_CHAT_NOT_AVAILABLE', retryable: true });

    fetch.mockResolvedValueOnce(errorResponse(405));
    await expect(sendAIChatMessage({ message: 'Hi' })).rejects.toMatchObject({ code: 'AI_CHAT_METHOD_NOT_ALLOWED', retryable: false });

    fetch.mockResolvedValueOnce(errorResponse(429));
    await expect(sendAIChatMessage({ message: 'Hi' })).rejects.toMatchObject({ code: 'AI_CHAT_RATE_LIMITED', retryable: false });

    fetch.mockResolvedValueOnce(errorResponse(500, { error: 'stack trace' }));
    await expect(sendAIChatMessage({ message: 'Hi' })).rejects.toMatchObject({ code: 'AI_CHAT_SERVER_ERROR', retryable: true });
  });

  it('maps timeout and network failures without mock fallback', async () => {
    vi.stubEnv('VITE_AI_CHAT_TIMEOUT_MS', '1');
    fetch.mockImplementationOnce((url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    await expect(sendAIChatMessage({ message: 'Hi' })).rejects.toMatchObject({
      code: 'AI_CHAT_TIMEOUT',
      retryable: true,
    });

    fetch.mockRejectedValueOnce(new Error('Network failed'));
    await expect(sendAIChatMessage({ message: 'What is Borneo Tracker?' })).rejects.toMatchObject({
      code: 'AI_CHAT_NETWORK_FAILED',
      retryable: true,
    });
  });
});
