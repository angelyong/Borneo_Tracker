import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIChatHttpError, MAX_MESSAGE_LENGTH, validateChatRequest } from './contracts.ts';
import { generateGeminiAnswer } from './geminiClient.ts';
import { createAiChatHandler, handleAiChatRequest, mapFallbackReason } from './index.ts';

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

function rawRequest(body, init = {}) {
  return new Request('http://localhost/ai-chat', {
    method: 'POST',
    body,
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

describe('Gemini fallback reason mapping', () => {
  it.each([
    ['GEMINI_TIMEOUT', 'GEMINI_TIMEOUT'],
    ['GEMINI_RATE_LIMITED', 'GEMINI_RATE_LIMIT'],
    ['MISSING_GEMINI_API_KEY', 'GEMINI_NOT_CONFIGURED'],
    ['MALFORMED_GEMINI_RESPONSE', 'GEMINI_MALFORMED_RESPONSE'],
    ['EMPTY_GEMINI_RESPONSE', 'GEMINI_EMPTY_RESPONSE'],
    ['GEMINI_REQUEST_FAILED', 'GEMINI_UNAVAILABLE'],
    ['GEMINI_HTTP_500', 'GEMINI_UNAVAILABLE'],
    ['GEMINI_HTTP_503', 'GEMINI_UNAVAILABLE'],
    ['GEMINI_HTTP_400', 'GEMINI_HTTP_ERROR'],
  ])('maps %s to %s', (code, reason) => {
    expect(mapFallbackReason(new AIChatHttpError(502, code, 'safe message'))).toBe(reason);
  });

  it('does not map request, config-shape, or programming errors', () => {
    expect(mapFallbackReason(new AIChatHttpError(400, 'EMPTY_MESSAGE', 'safe message'))).toBeUndefined();
    expect(mapFallbackReason(new AIChatHttpError(500, 'INVALID_AI_CHAT_CONFIG', 'safe message'))).toBeUndefined();
    expect(mapFallbackReason(new Error('bug'))).toBeUndefined();
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

  it('does not trigger fallback for malformed JSON', async () => {
    const geminiClient = vi.fn().mockRejectedValue(new AIChatHttpError(504, 'GEMINI_TIMEOUT', 'timeout'));
    const handler = createAiChatHandler({ geminiClient, logger: silentLogger });

    const response = await handler(rawRequest('{'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_JSON');
    expect(body.mode).toBeUndefined();
    expect(geminiClient).not.toHaveBeenCalled();
  });

  it('does not trigger fallback for too-long messages', async () => {
    const geminiClient = vi.fn().mockRejectedValue(new AIChatHttpError(504, 'GEMINI_TIMEOUT', 'timeout'));
    const handler = createAiChatHandler({ geminiClient, logger: silentLogger });

    const response = await handler(request({ ...validPayload, message: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('MESSAGE_TOO_LONG');
    expect(body.mode).toBeUndefined();
    expect(geminiClient).not.toHaveBeenCalled();
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

describe('ai-chat Stage 3B/3C internal integration', () => {
  async function runIntegratedRequest(payload) {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const geminiClient = vi.fn().mockResolvedValue('Integrated response.');
    const handler = createAiChatHandler({ geminiClient, logger });
    const response = await handler(request(payload));
    const body = await response.json();
    const completed = logger.info.mock.calls.find(([event]) => event === 'request_completed')?.[1];
    return { response, body, logger, geminiClient, completed };
  }

  it('runs request through intent, entities, and comparability for forest cover comparison', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'Compare forest cover between Sabah and Brunei.',
      region: '',
    });

    expect(result.response.status).toBe(200);
    expect(result.completed.intent).toBe('DASHBOARD_DATA');
    expect(result.completed.entityCounts.territories).toBe(2);
    expect(result.completed.comparability.decision).toBe('REJECT');
    expect(result.completed.comparability.blockedOperations).toContain('compare');
  });

  it('allows a Sabah resilience score question without comparison', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: "What is Sabah's resilience score?",
      region: '',
    });

    expect(result.completed.intent).toBe('DASHBOARD_DATA');
    expect(result.completed.entityCounts.territories).toBe(1);
    expect(result.completed.comparability.decision).toBe('ALLOW');
  });

  it('routes Malay comparison wording into a comparability rejection', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'Bandingkan litupan hutan Brunei dengan Sabah.',
      region: '',
      language: 'ms',
    });

    expect(result.completed.intent).toBe('DASHBOARD_DATA');
    expect(result.completed.language).toBe('ms');
    expect(result.completed.comparability.decision).toBe('REJECT');
  });

  it('downgrades SDG progress internally without exposing it publicly', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'What is the SDG progress for Sabah education?',
      region: '',
    });

    expect(result.completed.comparability.decision).toBe('DOWNGRADE');
    expect(result.completed.comparability.blockedOperations).toContain('sdg_progress');
    expect(result.body).toEqual({
      answer: 'Integrated response.',
      mode: 'gemini-test',
      sources: [],
    });
  });

  it('requires clarification internally for an ambiguous district question', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'Show district data for Kota.',
      region: '',
    });

    expect(result.completed.comparability.decision).toBe('NEEDS_CLARIFICATION');
    expect(result.completed.comparability.blockedOperations).toContain('district_answer');
  });

  it('does not let currentPage override an explicit territory', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'What is Sarawak resilience?',
      currentPage: '/dashboard/sabah',
      region: 'Sabah',
    });

    expect(result.completed.entityCounts.territories).toBe(1);
    expect(result.completed.region).toBe('Sabah');
    expect(result.completed.comparability.decision).toBe('ALLOW');
  });

  it('passes entity operations into comparability', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'Rank internet tertinggi Sabah vs Kalimantan.',
      region: '',
      language: 'ms',
    });

    expect(result.completed.operations.comparison).toBe(true);
    expect(result.completed.operations.ranking).toBe(true);
    expect(result.completed.comparability.decision).toBe('DOWNGRADE');
    expect(result.completed.comparability.blockedOperations).toContain('rank');
  });

  it('builds an internal fact object summary without exposing it publicly', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: "What is Sabah's resilience score?",
      region: '',
    });

    expect(result.completed.factObject).toMatchObject({
      availability: 'AVAILABLE',
      territories: 1,
      values: {
        hasOverallResilience: true,
      },
    });
    expect(result.body.factObject).toBeUndefined();
  });

  it('builds an internal structured answer summary without exposing it publicly', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: "What is Sabah's resilience score?",
      region: '',
    });

    expect(result.completed.structuredAnswer).toMatchObject({
      availability: 'AVAILABLE',
      language: 'en',
      blocked: false,
      clarificationRequired: false,
      layerStatuses: {
        conclusion: 'AVAILABLE',
      },
    });
    expect(result.body.structuredAnswer).toBeUndefined();
  });

  it('keeps the public response contract unchanged', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'Compare forest cover between Sabah and Brunei.',
      region: '',
    });

    expect(result.body).toEqual({
      answer: 'Integrated response.',
      mode: 'gemini-test',
      sources: [],
    });
    expect(result.body.intent).toBeUndefined();
    expect(result.body.entities).toBeUndefined();
    expect(result.body.comparability).toBeUndefined();
    expect(result.body.factObject).toBeUndefined();
    expect(result.body.structuredAnswer).toBeUndefined();
  });

  it('continues to call Gemini with the original request only', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: "What is Sabah's resilience score?",
      region: '',
    });

    expect(result.geminiClient).toHaveBeenCalledWith({
      ...validPayload,
      message: "What is Sabah's resilience score?",
      region: '',
    });
  });

  it('does not pass structured answer data to Gemini', async () => {
    const structuredAnswerBuilder = vi.fn((input) => ({
      availability: input.factObject.availability,
      language: input.language,
      intent: input.factObject.intent,
      layers: {
        conclusion: { status: 'AVAILABLE', heading: 'Conclusion', text: 'Safe.', codes: [], factReferences: [], warnings: [] },
        diagnosis: { status: 'UNAVAILABLE', heading: 'Diagnosis', text: '', codes: [], factReferences: [], warnings: [] },
        gap: { status: 'UNAVAILABLE', heading: 'Gap', text: '', codes: [], factReferences: [], warnings: [] },
        impact: { status: 'UNAVAILABLE', heading: 'Impact', text: '', codes: [], factReferences: [], warnings: [] },
        lever: { status: 'UNAVAILABLE', heading: 'Recommended action', text: '', codes: [], factReferences: [], warnings: [], leverIds: [], requiresGeminiPhrasing: false },
        honesty: { status: 'AVAILABLE', heading: 'Limitations', text: '', codes: [], factReferences: [], warnings: [] },
      },
      summaryText: 'Conclusion: Safe.',
      requiredDisclosures: [],
      warnings: [],
      sources: [],
      approvedNumericTokens: [],
      approvedYearTokens: [],
      blocked: false,
      clarificationRequired: false,
    }));
    const geminiClient = vi.fn().mockResolvedValue('Integrated response.');
    const handler = createAiChatHandler({ geminiClient, structuredAnswerBuilder, logger: silentLogger });

    await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: '' }));

    expect(structuredAnswerBuilder).toHaveBeenCalled();
    expect(geminiClient).toHaveBeenCalledWith({
      ...validPayload,
      message: "What is Sabah's resilience score?",
      region: '',
    });
  });
});

describe('ai-chat Stage 4C template fallback', () => {
  async function runFallbackRequest(payload, geminiError, options = {}) {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const geminiClient = vi.fn().mockRejectedValue(geminiError);
    const handler = createAiChatHandler({
      geminiClient,
      logger,
      ...options,
    });
    const response = await handler(request(payload));
    const body = await response.json();
    const fallbackLog = logger.info.mock.calls.find(([event]) => event === 'request_fallback')?.[1];
    return { response, body, logger, geminiClient, fallbackLog };
  }

  it('returns template fallback for a dashboard timeout', async () => {
    const result = await runFallbackRequest(
      { ...validPayload, message: "What is Sabah's resilience score?", region: '' },
      new AIChatHttpError(504, 'GEMINI_TIMEOUT', 'raw timeout details')
    );

    expect(result.response.status).toBe(200);
    expect(result.body.mode).toBe('template-fallback');
    expect(result.body.fallback).toEqual({
      used: true,
      reason: 'GEMINI_TIMEOUT',
      degraded: true,
    });
    expect(result.body.answer).toContain('Live AI phrasing is temporarily unavailable.');
    expect(result.body.answer).toContain('Conclusion:');
    expect(result.body.answer).not.toContain('raw timeout details');
    expect(result.fallbackLog).toMatchObject({
      fallbackUsed: true,
      fallbackReason: 'GEMINI_TIMEOUT',
      intent: 'DASHBOARD_DATA',
      structuredAnswerAvailability: 'AVAILABLE',
      blocked: false,
      clarificationRequired: false,
    });
  });

  it('keeps Gemini success unchanged and does not use fallback', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const geminiClient = vi.fn().mockResolvedValue('Gemini answer.');
    const handler = createAiChatHandler({ geminiClient, logger });

    const response = await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: '' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      answer: 'Gemini answer.',
      mode: 'gemini-test',
      sources: [],
    });
    expect(logger.info.mock.calls.some(([event]) => event === 'request_fallback')).toBe(false);
  });

  it.each([
    ['GEMINI_RATE_LIMITED', 'GEMINI_RATE_LIMIT'],
    ['GEMINI_HTTP_500', 'GEMINI_UNAVAILABLE'],
    ['MALFORMED_GEMINI_RESPONSE', 'GEMINI_MALFORMED_RESPONSE'],
    ['EMPTY_GEMINI_RESPONSE', 'GEMINI_EMPTY_RESPONSE'],
    ['MISSING_GEMINI_API_KEY', 'GEMINI_NOT_CONFIGURED'],
  ])('returns dashboard fallback for %s', async (code, reason) => {
    const result = await runFallbackRequest(
      { ...validPayload, message: 'What is the dashboard data for Sabah education SDG progress?', region: '' },
      new AIChatHttpError(code === 'GEMINI_RATE_LIMITED' ? 429 : 502, code, 'safe upstream error')
    );

    expect(result.response.status).toBe(200);
    expect(result.body.mode).toBe('template-fallback');
    expect(result.body.fallback.reason).toBe(reason);
    expect(result.body.answer).toContain('Conclusion:');
    expect(result.body.answer).toContain('Limitations:');
    expect(result.body.answer).not.toContain('safe upstream error');
  });

  it('returns deterministic blocked fallback for rejected comparisons', async () => {
    const result = await runFallbackRequest(
      { ...validPayload, message: 'Compare forest cover between Sabah and Brunei.', region: '' },
      new AIChatHttpError(504, 'GEMINI_TIMEOUT', 'timeout')
    );

    expect(result.response.status).toBe(200);
    expect(result.body.mode).toBe('template-fallback');
    expect(result.body.answer).toContain('This comparison cannot be made reliably using the available data.');
    expect(result.body.answer).toContain('Limitations: Important limitations and disclosures are attached');
    expect(result.fallbackLog).toMatchObject({
      structuredAnswerAvailability: 'BLOCKED',
      blocked: true,
    });
  });

  it('returns deterministic clarification fallback without guessing a district', async () => {
    const result = await runFallbackRequest(
      { ...validPayload, message: 'Show dashboard data for Kota district.', region: '' },
      new AIChatHttpError(504, 'GEMINI_TIMEOUT', 'timeout')
    );

    expect(result.response.status).toBe(200);
    expect(result.body.mode).toBe('template-fallback');
    expect(result.body.answer).toContain('District-level answer requested without a resolved district name.');
    expect(result.body.answer).not.toContain('Kota Kinabalu');
    expect(result.fallbackLog).toMatchObject({
      structuredAnswerAvailability: 'BLOCKED',
      clarificationRequired: true,
    });
  });

  it('returns partial and unavailable dashboard fallbacks safely', async () => {
    const partial = await runFallbackRequest(
      { ...validPayload, message: 'What is the dashboard data for Sabah education SDG progress?', region: '' },
      new AIChatHttpError(429, 'GEMINI_RATE_LIMITED', 'rate limit')
    );
    const unavailable = await runFallbackRequest(
      { ...validPayload, message: 'What is the dashboard data target gap for Sabah protected areas?', region: '' },
      new AIChatHttpError(502, 'GEMINI_HTTP_500', 'server error')
    );

    expect(partial.response.status).toBe(200);
    expect(partial.fallbackLog.structuredAnswerAvailability).toBe('PARTIAL');
    expect(partial.body.answer).toContain('progress-to-target cannot be calculated');
    expect(unavailable.response.status).toBe(200);
    expect(['PARTIAL', 'UNAVAILABLE']).toContain(unavailable.fallbackLog.structuredAnswerAvailability);
    expect(unavailable.body.answer).toContain('No verified compatible target is available');
  });

  it('does not use dashboard fallback for unsupported intents', async () => {
    const site = await runFallbackRequest(
      { ...validPayload, message: 'What is Borneo Tracker?', region: '' },
      new AIChatHttpError(500, 'MISSING_GEMINI_API_KEY', 'not configured')
    );
    const news = await runFallbackRequest(
      { ...validPayload, message: 'Show latest Borneo news.', region: '' },
      new AIChatHttpError(500, 'MISSING_GEMINI_API_KEY', 'not configured')
    );
    const outOfScope = await runFallbackRequest(
      { ...validPayload, message: 'Write code in Python.', region: '' },
      new AIChatHttpError(500, 'MISSING_GEMINI_API_KEY', 'not configured')
    );

    expect(site.response.status).toBe(500);
    expect(site.body.code).toBe('MISSING_GEMINI_API_KEY');
    expect(news.response.status).toBe(500);
    expect(news.body.code).toBe('MISSING_GEMINI_API_KEY');
    expect(outOfScope.response.status).toBe(500);
    expect(outOfScope.body.code).toBe('MISSING_GEMINI_API_KEY');
    expect(site.fallbackLog).toBeUndefined();
    expect(news.fallbackLog).toBeUndefined();
    expect(outOfScope.fallbackLog).toBeUndefined();
  });

  it('preserves sources from structured answer without adding source URLs to prose', async () => {
    const structuredAnswerBuilder = vi.fn((input) => ({
      availability: 'AVAILABLE',
      language: input.language,
      intent: input.factObject.intent,
      layers: {
        conclusion: { status: 'AVAILABLE', heading: 'Conclusion', text: 'Safe answer.', codes: [], factReferences: [], warnings: [] },
        diagnosis: { status: 'UNAVAILABLE', heading: 'Diagnosis', text: '', codes: [], factReferences: [], warnings: [] },
        gap: { status: 'UNAVAILABLE', heading: 'Gap', text: '', codes: [], factReferences: [], warnings: [] },
        impact: { status: 'UNAVAILABLE', heading: 'Impact', text: '', codes: [], factReferences: [], warnings: [] },
        lever: { status: 'UNAVAILABLE', heading: 'Recommended action', text: '', codes: [], factReferences: [], warnings: [], leverIds: [], requiresGeminiPhrasing: false },
        honesty: { status: 'UNAVAILABLE', heading: 'Limitations', text: '', codes: [], factReferences: [], warnings: [] },
      },
      summaryText: 'Conclusion: Safe answer.',
      requiredDisclosures: [],
      warnings: [],
      sources: [
        { publisher: 'Borneo Tracker', title: 'Dataset', year: 2026, url: 'https://example.com/source-2026', sourceFile: 'test.json' },
        { publisher: 'Borneo Tracker', title: 'Dataset', year: 2026, url: 'https://example.com/source-2026', sourceFile: 'test.json' },
      ],
      approvedNumericTokens: [],
      approvedYearTokens: [],
      blocked: false,
      clarificationRequired: false,
    }));

    const result = await runFallbackRequest(
      { ...validPayload, message: "What is Sabah's resilience score?", region: '' },
      new AIChatHttpError(502, 'EMPTY_GEMINI_RESPONSE', 'empty'),
      { structuredAnswerBuilder }
    );

    expect(result.response.status).toBe(200);
    expect(result.body.sources).toHaveLength(1);
    expect(result.body.sources[0].url).toBe('https://example.com/source-2026');
    expect(result.body.answer).not.toContain('https://example.com');
    expect(result.body.sources.map((source) => source.title)).not.toContain('Gemini');
  });

  it('fallback introduces no unapproved numbers', async () => {
    const result = await runFallbackRequest(
      { ...validPayload, message: "What is Sabah's resilience score?", region: '' },
      new AIChatHttpError(502, 'GEMINI_HTTP_500', 'server error')
    );
    const numericTokens = [...result.body.answer.matchAll(/\b\d+(?:\.\d+)?%?\b/g)].map((match) => match[0]);

    expect(numericTokens.length).toBeGreaterThan(0);
    expect(result.body.answer).not.toMatch(/https?:\/\//i);
    expect(result.body.answer).not.toMatch(/\b500\b|\b429\b|\b504\b/);
  });

  it('logs fallback metadata without raw answer, question, API key, or source URLs', async () => {
    const result = await runFallbackRequest(
      { ...validPayload, message: "What is Sabah's resilience score?", region: '' },
      new AIChatHttpError(500, 'MISSING_GEMINI_API_KEY', 'test-key')
    );
    const logs = JSON.stringify(result.logger.info.mock.calls);

    expect(result.response.status).toBe(200);
    expect(logs).toContain('fallbackReason');
    expect(logs).not.toContain("What is Sabah's resilience score?");
    expect(logs).not.toContain(result.body.answer);
    expect(logs).not.toContain('test-key');
    expect(logs).not.toContain('http');
  });
});
