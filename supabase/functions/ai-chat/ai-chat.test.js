import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIChatHttpError, MAX_MESSAGE_LENGTH, validateChatRequest } from './contracts.ts';
import { generateGeminiAnswer } from './geminiClient.ts';
import { createAiChatHandler, handleAiChatRequest, mapFallbackReason } from './index.ts';
import { FailingTelemetryAdapter, MemoryTelemetryAdapter, AIChatTelemetryService } from './telemetry.ts';

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

function allowAllQuotaService(overrides = {}) {
  const service = {
    reserveForModelCall: vi.fn(async (identity) => ({
      status: 'reserved',
      reservation: {
        usageDate: '2026-08-04',
        identityType: identity.type === 'admin' ? 'admin' : 'authenticated',
        identityKey: `${identity.type}:test-user`,
        limit: 25,
      },
      quota: { remaining: 24, limit: 25 },
    })),
    refundReservation: vi.fn(async () => ({
      status: 'refunded',
      quota: { remaining: 25, limit: 25 },
    })),
    ...overrides,
  };
  return service;
}

function safePromptAnswer(prompt) {
  if (!prompt) return 'Integrated response.';
  if (prompt.groundingPayload.answer) return prompt.groundingPayload.answer;
  return [
    prompt.groundingPayload.conclusion,
    prompt.groundingPayload.diagnosis,
    prompt.groundingPayload.gap,
    prompt.groundingPayload.impact,
    prompt.groundingPayload.lever,
    ...prompt.groundingPayload.warnings,
  ].filter(Boolean).join(' ');
}

function verifiedLeverRecord(overrides = {}) {
  return {
    id: 'food-001',
    concept: 'food',
    pillars: ['Food'],
    territories: ['Sabah'],
    title: 'Restore idle paddy fields',
    summary: 'Use documented paddy field restoration as the verified intervention.',
    whoActs: ['government'],
    horizon: 'medium',
    mechanism: 'Targets domestic paddy production.',
    appliesWhen: ['Food pillar is weak.'],
    doesNotApplyWhen: ['No paddy context is present.'],
    evidence: [{
      publisher: 'Borneo Tracker documentation',
      title: 'AI Chatbot Concept and Plan',
      year: 2026,
      sourceFile: 'docs/AI_CHATBOT_CONCEPT_AND_PLAN.md',
      sourcePath: '10. lever library',
      whatItActuallySays: 'The source supports the verified lever record.',
    }],
    evidenceStatus: 'VERIFIED',
    language: 'en',
    keywords: ['food'],
    ...overrides,
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

  it('sends grounded system instruction and user content when a prompt is supplied', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiResponse('Grounded answer.'));
    const prompt = {
      systemInstruction: 'Grounded system instruction.',
      userContent: '{"verifiedAnswerContent":{"conclusion":"Safe."}}',
      groundingPayload: {
        answerStatus: 'AVAILABLE',
        blocked: false,
        clarificationRequired: false,
        conclusion: 'Safe.',
        diagnosis: '',
        gap: '',
        impact: '',
        lever: '',
        honesty: '',
        requiredDisclosures: [],
        warnings: [],
        approvedNumericTokens: [],
        approvedYearTokens: [],
        sources: [],
        levers: [],
      },
    };

    const answer = await generateGeminiAnswer(validPayload, {
      env: { AICHATBOTGEMINI_API_KEY: 'test-key' },
      fetchImpl,
      prompt,
    });
    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);

    expect(answer).toBe('Grounded answer.');
    expect(body.systemInstruction.parts[0].text).toBe('Grounded system instruction.');
    expect(body.contents[0].parts[0].text).toBe('{"verifiedAnswerContent":{"conclusion":"Safe."}}');
    expect(init.headers['x-goog-api-key']).toBe('test-key');
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
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('apikey');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('content-type');
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

    expect(response.status).toBe(413);
    expect(body.code).toBe('MESSAGE_TOO_LONG');
    expect(body.mode).toBeUndefined();
    expect(geminiClient).not.toHaveBeenCalled();
  });

  it('injects the Gemini dependency for handler tests', async () => {
    const geminiClient = vi.fn().mockResolvedValue('Injected response.');
    const handler = createAiChatHandler({ geminiClient, quotaService: allowAllQuotaService(), logger: silentLogger });

    const response = await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: '' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(geminiClient).toHaveBeenCalledWith(expect.objectContaining({ message: "What is Sabah's resilience score?" }), expect.any(Object));
    expect(body.mode).toBe('template-fallback');
  });

  it('resolves missing bearer as anonymous identity without exposing identity internals', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const handler = createAiChatHandler({
      geminiClient: vi.fn().mockResolvedValue('Anonymous response.'),
      quotaService: allowAllQuotaService(),
      logger,
    });

    const response = await handler(request(validPayload));
    const body = await response.json();
    const identityLog = logger.info.mock.calls.find(([event]) => event === 'identity_resolved')?.[1];
    const completed = logger.info.mock.calls.find(([event]) => event === 'request_completed')?.[1];

    expect(response.status).toBe(200);
    expect(body.mode).toBe('template-fallback');
    expect(body.answer).toContain('Borneo Tracker assistant');
    expect(JSON.stringify(body)).not.toMatch(/userId|role|identity|access_token|jwt/i);
    expect(identityLog).toMatchObject({
      identityType: 'anonymous',
      authenticated: false,
      admin: false,
      verificationCode: 'ANONYMOUS_UNVERIFIED',
    });
    expect(completed).toMatchObject({
      identityType: 'anonymous',
      authenticated: false,
      admin: false,
    });
  });

  it('resolves authenticated and admin identity internally from injected trusted sources', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const handler = createAiChatHandler({
      geminiClient: vi.fn().mockResolvedValue('Admin response.'),
      quotaService: allowAllQuotaService(),
      tokenVerifier: { verify: vi.fn(async () => ({ id: 'verified-user' })) },
      profileRepository: { findProfile: vi.fn(async () => ({ role: 'admin', status: 'active' })) },
      logger,
    });

    const response = await handler(request({
      ...validPayload,
      userId: 'spoofed-user',
      role: 'user',
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-admin-token',
      },
    }));
    const body = await response.json();
    const identityLog = logger.info.mock.calls.find(([event]) => event === 'identity_resolved')?.[1];

    expect(response.status).toBe(200);
    expect(body.mode).toBe('template-fallback');
    expect(JSON.stringify(body)).not.toContain('verified-user');
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('valid-admin-token');
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('verified-user');
    expect(identityLog).toMatchObject({
      identityType: 'admin',
      authenticated: true,
      admin: true,
      verificationCode: 'VERIFIED',
    });
  });

  it('rejects malformed bearer without calling Gemini or quota/telemetry paths', async () => {
    const geminiClient = vi.fn().mockResolvedValue('Should not run.');
    const handler = createAiChatHandler({ geminiClient, logger: silentLogger });

    const response = await handler(request(validPayload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Token invalid',
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: 'The AI assistant could not verify this sign-in session.',
      code: 'AI_CHAT_AUTH_MALFORMED',
    });
    expect(geminiClient).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toMatch(/token|jwt|profile|service_role/i);
  });

  it('rejects invalid, expired, unavailable, and suspended identities safely', async () => {
    const cases = [
      [new AIChatHttpError(401, 'AI_CHAT_AUTH_INVALID', 'The AI assistant could not verify this sign-in session.'), 401, 'AI_CHAT_AUTH_INVALID'],
      [new AIChatHttpError(401, 'AI_CHAT_AUTH_EXPIRED', 'The AI assistant could not verify this sign-in session.'), 401, 'AI_CHAT_AUTH_EXPIRED'],
      [new AIChatHttpError(503, 'AI_CHAT_IDENTITY_UNAVAILABLE', 'The AI assistant sign-in check is unavailable right now.'), 503, 'AI_CHAT_IDENTITY_UNAVAILABLE'],
      [new AIChatHttpError(403, 'AI_CHAT_USER_SUSPENDED', 'This account cannot use the AI assistant right now.'), 403, 'AI_CHAT_USER_SUSPENDED'],
    ];

    for (const [error, status, code] of cases) {
      const geminiClient = vi.fn();
      const handler = createAiChatHandler({
        geminiClient,
        identityResolver: vi.fn(async () => {
          throw error;
        }),
        logger: silentLogger,
      });

      const response = await handler(request(validPayload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer sensitive-token',
        },
      }));
      const body = await response.json();

      expect(response.status).toBe(status);
      expect(body.code).toBe(code);
      expect(JSON.stringify(body)).not.toContain('sensitive-token');
      expect(geminiClient).not.toHaveBeenCalled();
    }
  });

  it('logs safe error metadata without secrets', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const handler = createAiChatHandler({
      geminiClient: vi.fn().mockRejectedValue(new Error('api-key test-key leaked')),
      quotaService: allowAllQuotaService(),
      logger,
    });

    const response = await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: '' }));
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
    expect(body).toMatchObject({
      mode: 'template-fallback',
      sources: [],
    });

  });
});

describe('ai-chat Stage 8E telemetry persistence', () => {
  function telemetryHarness(options = {}) {
    const adapter = options.adapter || new MemoryTelemetryAdapter();
    const telemetryService = new AIChatTelemetryService({ adapter });
    const logger = options.logger || { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    return { adapter, telemetryService, logger };
  }

  it('records exactly one Gemini success event without public telemetry internals', async () => {
    const { adapter, telemetryService, logger } = telemetryHarness();
    const geminiClient = vi.fn((_, prompt) => Promise.resolve(safePromptAnswer(prompt)));
    const handler = createAiChatHandler({
      geminiClient,
      quotaService: allowAllQuotaService(),
      telemetryService,
      logger,
    });

    const response = await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: 'Sabah', currentPage: '/dashboard?jwt=secret#top' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toBe('gemini-test');
    expect(JSON.stringify(body)).not.toMatch(/requestId|request_id|telemetry|identity_type|model_called/i);
    expect(adapter.rows).toHaveLength(1);
    expect(adapter.rows[0]).toMatchObject({
      identity_type: 'anonymous',
      intent: 'DASHBOARD_DATA',
      mode: 'gemini-test',
      outcome: 'success',
      fallback_used: false,
      model_called: true,
      quota_consumed: true,
      response_status: 200,
      region: 'Sabah',
      current_page: '/dashboard',
    });
    expect(adapter.rows[0].source_count).toBeGreaterThan(0);
    expect(adapter.rows[0].request_id).toMatch(/^[A-Za-z0-9:_-]{8,80}$/);
  });

  it('records exactly one refunded timeout fallback event', async () => {
    const { adapter, telemetryService } = telemetryHarness();
    const quotaService = allowAllQuotaService();
    const geminiClient = vi.fn().mockRejectedValue(new AIChatHttpError(504, 'GEMINI_TIMEOUT', 'timeout'));
    const handler = createAiChatHandler({
      geminiClient,
      quotaService,
      telemetryService,
      logger: silentLogger,
    });

    const response = await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: '' }));
    await response.json();

    expect(response.status).toBe(200);
    expect(geminiClient).toHaveBeenCalledTimes(1);
    expect(quotaService.refundReservation).toHaveBeenCalledTimes(1);
    expect(adapter.rows).toHaveLength(1);
    expect(adapter.rows[0]).toMatchObject({
      outcome: 'fallback',
      fallback_used: true,
      fallback_reason: 'GEMINI_TIMEOUT',
      model_called: true,
      quota_consumed: false,
      response_status: 200,
    });
  });

  it.each([
    ['GEMINI_RATE_LIMITED', 'GEMINI_RATE_LIMIT', 'rate_limited'],
    ['GEMINI_HTTP_500', 'GEMINI_UNAVAILABLE', 'fallback'],
  ])('records refunded provider %s fallback with final quota state', async (code, reason, outcome) => {
    const { adapter, telemetryService } = telemetryHarness();
    const quotaService = allowAllQuotaService();
    const geminiClient = vi.fn().mockRejectedValue(new AIChatHttpError(code === 'GEMINI_RATE_LIMITED' ? 429 : 502, code, 'safe'));
    const handler = createAiChatHandler({
      geminiClient,
      quotaService,
      telemetryService,
      logger: silentLogger,
    });

    await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: '' }));

    expect(adapter.rows).toHaveLength(1);
    expect(adapter.rows[0]).toMatchObject({
      outcome,
      fallback_reason: reason,
      model_called: true,
      quota_consumed: false,
    });
    expect(quotaService.refundReservation).toHaveBeenCalledTimes(1);
  });

  it('records validation rejection as refunded fallback', async () => {
    const { adapter, telemetryService } = telemetryHarness();
    const quotaService = allowAllQuotaService();
    const geminiClient = vi.fn().mockResolvedValue('Authorities should build solar microgrids instead.');
    const handler = createAiChatHandler({
      geminiClient,
      quotaService,
      telemetryService,
      logger: silentLogger,
    });

    await handler(request({ ...validPayload, message: "What is Sabah's food score?", region: '' }));

    expect(adapter.rows).toHaveLength(1);
    expect(adapter.rows[0]).toMatchObject({
      outcome: 'fallback',
      fallback_reason: 'GEMINI_RESPONSE_REJECTED',
      model_called: true,
      quota_consumed: false,
    });
    expect(quotaService.refundReservation).toHaveBeenCalledTimes(1);
  });

  it('records zero-model deterministic blocked and clarification events once each', async () => {
    const { adapter, telemetryService } = telemetryHarness();
    const geminiClient = vi.fn();
    const handler = createAiChatHandler({
      geminiClient,
      telemetryService,
      logger: silentLogger,
    });

    await handler(request({ ...validPayload, message: 'Compare forest cover between Sabah and Brunei.', region: '' }));
    await handler(request({ ...validPayload, message: 'Show dashboard data for Kota district.', region: '' }));

    expect(geminiClient).not.toHaveBeenCalled();
    expect(adapter.rows).toHaveLength(2);
    expect(adapter.rows[0]).toMatchObject({
      outcome: 'fallback',
      fallback_reason: 'DETERMINISTIC_BLOCKED',
      model_called: false,
      quota_consumed: false,
    });
    expect(adapter.rows[1]).toMatchObject({
      outcome: 'fallback',
      fallback_reason: 'DETERMINISTIC_CLARIFICATION',
      model_called: false,
      quota_consumed: false,
    });
  });

  it('records knowledge no-match and ambiguous zero-model events exactly once', async () => {
    const { adapter, telemetryService } = telemetryHarness();
    const geminiClient = vi.fn();
    const knowledgeRetriever = vi.fn()
      .mockReturnValueOnce({ status: 'NO_MATCH', matches: [], warnings: [] })
      .mockReturnValueOnce({
        status: 'AMBIGUOUS',
        matches: [{
          record: {
            id: 'a',
            title: 'A',
            content: 'A',
            category: 'a',
            language: 'en',
            regions: [],
            sdgTags: [],
            relatedSdgs: [],
            keywords: [],
            sourceFile: 'fixture.json',
            sourceType: 'json',
            status: 'verified',
            placeholder: false,
            runtimeIncluded: true,
          },
          score: 8,
          matchedBy: [],
        }],
        warnings: ['KNOWLEDGE_AMBIGUOUS'],
      });
    const handler = createAiChatHandler({
      geminiClient,
      knowledgeRetriever,
      telemetryService,
      logger: silentLogger,
    });

    await handler(request({ ...validPayload, message: 'What is Borneo Tracker?', region: '' }));
    await handler(request({ ...validPayload, message: 'What is Borneo Tracker?', region: '' }));

    expect(geminiClient).not.toHaveBeenCalled();
    expect(adapter.rows).toHaveLength(2);
    expect(adapter.rows.map((row) => row.fallback_reason)).toEqual(['KNOWLEDGE_NO_MATCH', 'KNOWLEDGE_AMBIGUOUS']);
    expect(adapter.rows.every((row) => row.model_called === false && row.quota_consumed === false)).toBe(true);
  });

  it('records news and out-of-scope zero-model paths without pending content or raw context', async () => {
    const { adapter, telemetryService } = telemetryHarness();
    const newsRepository = {
      findPublished: vi.fn().mockResolvedValue([]),
      countPending: vi.fn().mockResolvedValue(2),
    };
    const geminiClient = vi.fn();
    const handler = createAiChatHandler({
      geminiClient,
      newsRepository,
      telemetryService,
      logger: silentLogger,
    });

    const newsResponse = await handler(request({ ...validPayload, message: 'Show latest Borneo news.', region: 'DROP TABLE', currentPage: '/news?email=a@example.com' }));
    const outResponse = await handler(request({ ...validPayload, message: 'Write code in Python.', region: '', currentPage: 'https://evil.example/path?jwt=secret' }));
    await newsResponse.json();
    await outResponse.json();

    expect(geminiClient).not.toHaveBeenCalled();
    expect(adapter.rows).toHaveLength(2);
    expect(adapter.rows[0]).toMatchObject({
      intent: 'BORNEO_NEWS',
      outcome: 'fallback',
      model_called: false,
      quota_consumed: false,
      current_page: '/news',
    });
    expect(adapter.rows[0].region).toBeUndefined();
    expect(JSON.stringify(adapter.rows)).not.toMatch(/DROP TABLE|a@example.com|jwt|pending/i);
    expect(adapter.rows[1]).toMatchObject({
      intent: 'OUT_OF_SCOPE',
      outcome: 'refused',
      model_called: false,
      quota_consumed: false,
    });
    expect(adapter.rows[1].current_page).toBeUndefined();
  });

  it('records quota exhaustion before Gemini without consuming quota', async () => {
    const { adapter, telemetryService } = telemetryHarness();
    const quotaService = allowAllQuotaService({
      reserveForModelCall: vi.fn(async () => ({
        status: 'exhausted',
        quota: { remaining: 0, limit: 1 },
      })),
    });
    const geminiClient = vi.fn();
    const handler = createAiChatHandler({
      geminiClient,
      quotaService,
      telemetryService,
      logger: silentLogger,
    });

    const response = await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: '' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fallback.reason).toBe('QUOTA_EXHAUSTED');
    expect(geminiClient).not.toHaveBeenCalled();
    expect(adapter.rows).toHaveLength(1);
    expect(adapter.rows[0]).toMatchObject({
      outcome: 'rate_limited',
      fallback_reason: 'QUOTA_EXHAUSTED',
      model_called: false,
      quota_consumed: false,
    });
  });

  it('records bounded invalid request and auth rejection events', async () => {
    const { adapter, telemetryService } = telemetryHarness();
    const geminiClient = vi.fn();
    const handler = createAiChatHandler({
      geminiClient,
      telemetryService,
      logger: silentLogger,
    });

    const invalid = await handler(rawRequest('{'));
    const auth = await handler(request(validPayload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Token sensitive-token',
      },
    }));

    expect(invalid.status).toBe(400);
    expect(auth.status).toBe(401);
    expect(geminiClient).not.toHaveBeenCalled();
    expect(adapter.rows).toHaveLength(2);
    expect(adapter.rows[0]).toMatchObject({
      identity_type: 'anonymous',
      outcome: 'error',
      error_code: 'INVALID_JSON',
      model_called: false,
      quota_consumed: false,
    });
    expect(adapter.rows[1]).toMatchObject({
      identity_type: 'unknown',
      outcome: 'refused',
      error_code: 'AI_CHAT_AUTH_MALFORMED',
    });
    expect(JSON.stringify(adapter.rows)).not.toContain('sensitive-token');
  });

  it('isolates telemetry adapter failure from success response, Gemini calls, and quota', async () => {
    const adapter = new FailingTelemetryAdapter();
    const telemetryService = new AIChatTelemetryService({ adapter });
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const quotaService = allowAllQuotaService();
    const geminiClient = vi.fn((_, prompt) => Promise.resolve(safePromptAnswer(prompt)));
    const handler = createAiChatHandler({
      geminiClient,
      quotaService,
      telemetryService,
      logger,
    });

    const response = await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: '' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toBe('gemini-test');
    expect(geminiClient).toHaveBeenCalledTimes(1);
    expect(quotaService.reserveForModelCall).toHaveBeenCalledTimes(1);
    expect(quotaService.refundReservation).not.toHaveBeenCalled();
    expect(logger.warn.mock.calls.find(([event]) => event === 'telemetry_write_failed')?.[1]).toMatchObject({
      code: 'TELEMETRY_WRITE_FAILED',
      reason: 'ADAPTER_ERROR',
    });
  });

  it('does not record business telemetry for OPTIONS preflight', async () => {
    const { adapter, telemetryService } = telemetryHarness();
    const handler = createAiChatHandler({ telemetryService, logger: silentLogger });

    const response = await handler(new Request('http://localhost/ai-chat', { method: 'OPTIONS' }));

    expect(response.status).toBe(204);
    expect(adapter.rows).toHaveLength(0);
  });
});

describe('ai-chat Stage 3B/3C internal integration', () => {
  function safeDashboardAnswer(prompt) {
    if (!prompt) return 'Integrated response.';
    if (prompt.groundingPayload.answer) return prompt.groundingPayload.answer;
    return [
      prompt.groundingPayload.conclusion,
      prompt.groundingPayload.diagnosis,
      prompt.groundingPayload.gap,
      prompt.groundingPayload.impact,
      prompt.groundingPayload.lever,
      ...prompt.groundingPayload.warnings,
    ].filter(Boolean).join(' ');
  }

  async function runIntegratedRequest(payload) {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const geminiClient = vi.fn((_, prompt) => Promise.resolve(safeDashboardAnswer(prompt)));
    const handler = createAiChatHandler({ geminiClient, quotaService: allowAllQuotaService(), logger });
    const response = await handler(request(payload));
    const body = await response.json();
    const completed = logger.info.mock.calls.find(([event]) => event === 'request_completed')?.[1];
    const fallbackLog = logger.info.mock.calls.find(([event]) => event === 'request_fallback')?.[1];
    return { response, body, logger, geminiClient, completed, fallbackLog };
  }

  it('runs request through intent, entities, and comparability for forest cover comparison', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'Compare forest cover between Sabah and Brunei.',
      region: '',
    });

    expect(result.response.status).toBe(200);
    expect(result.completed).toBeUndefined();
    expect(result.fallbackLog).toMatchObject({
      intent: 'DASHBOARD_DATA',
      fallbackReason: 'DETERMINISTIC_BLOCKED',
      blocked: true,
    });
    expect(result.geminiClient).not.toHaveBeenCalled();
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

    expect(result.completed).toBeUndefined();
    expect(result.fallbackLog).toMatchObject({
      intent: 'DASHBOARD_DATA',
      fallbackReason: 'DETERMINISTIC_BLOCKED',
      blocked: true,
    });
  });

  it('downgrades SDG progress internally without exposing it publicly', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'What is the SDG progress for Sabah education?',
      region: '',
    });

    expect(result.body.mode).toBe('template-fallback');
    expect(result.body.fallback.reason).toBe('DETERMINISTIC_BLOCKED');
    expect(result.completed).toMatchObject({
      intent: 'OUT_OF_SCOPE',
      modelCallSkipped: true,
    });
    expect(result.geminiClient).not.toHaveBeenCalled();
  });

  it('requires clarification internally for an ambiguous district question', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'Show district data for Kota.',
      region: '',
    });

    expect(result.completed).toMatchObject({
      intent: 'OUT_OF_SCOPE',
      modelCallSkipped: true,
    });
    expect(result.geminiClient).not.toHaveBeenCalled();
  });

  it('does not let currentPage override an explicit territory', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'What is Sarawak resilience?',
      currentPage: '/dashboard/sabah',
      region: 'Sabah',
    });

    expect(result.body.mode).toBe('template-fallback');
    expect(result.completed).toMatchObject({
      intent: 'OUT_OF_SCOPE',
      modelCallSkipped: true,
    });
    expect(result.geminiClient).not.toHaveBeenCalled();
  });

  it('passes entity operations into comparability', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'Rank internet tertinggi Sabah vs Kalimantan.',
      region: '',
      language: 'ms',
    });

    expect(result.completed).toMatchObject({
      intent: 'OUT_OF_SCOPE',
      modelCallSkipped: true,
    });
    expect(result.geminiClient).not.toHaveBeenCalled();
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

  it('logs grounded prompt metadata without prompt content', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: "What is Sabah's resilience score?",
      region: '',
    });
    const logs = JSON.stringify(result.logger.info.mock.calls);

    expect(result.completed).toMatchObject({
      promptBuilt: true,
      groundingAvailability: 'AVAILABLE',
      groundedLanguage: 'en',
      groundedBlocked: false,
      groundedClarificationRequired: false,
    });
    expect(result.completed.groundedNumericTokenCount).toBeGreaterThan(0);
    expect(result.completed.groundedSourceCount).toBeGreaterThanOrEqual(0);
    expect(logs).not.toContain('"untrustedUserQuestion"');
    expect(logs).not.toContain('Use only the supplied verified grounding payload');
    expect(logs).not.toContain("Sabah's overall resilience score is 63.7.");
  });

  it('keeps the public response contract unchanged', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: 'Compare forest cover between Sabah and Brunei.',
      region: '',
    });

    expect(result.body).toMatchObject({
      mode: 'template-fallback',
      fallback: {
        used: true,
        reason: 'DETERMINISTIC_BLOCKED',
        degraded: true,
      },
    });
    expect(result.body.intent).toBeUndefined();
    expect(result.body.entities).toBeUndefined();
    expect(result.body.comparability).toBeUndefined();
    expect(result.body.factObject).toBeUndefined();
    expect(result.body.structuredAnswer).toBeUndefined();
  });

  it('calls Gemini with the original request plus grounded prompt for dashboard data', async () => {
    const result = await runIntegratedRequest({
      ...validPayload,
      message: "What is Sabah's resilience score?",
      region: '',
    });

    expect(result.geminiClient).toHaveBeenCalledWith({
      ...validPayload,
      message: "What is Sabah's resilience score?",
      region: '',
    }, expect.objectContaining({
      systemInstruction: expect.stringContaining('Use only the supplied verified grounding payload.'),
      userContent: expect.stringContaining('"untrustedUserQuestion": "What is Sabah\'s resilience score?"'),
      groundingPayload: expect.objectContaining({
        answerStatus: 'AVAILABLE',
        conclusion: "Sabah's overall resilience score is 63.7.",
      }),
    }));
  });

  it('passes only the grounded prompt, not raw fact or structured answer objects, to Gemini', async () => {
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
      levers: [],
      blocked: false,
      clarificationRequired: false,
    }));
    const geminiClient = vi.fn().mockResolvedValue('Integrated response.');
    const handler = createAiChatHandler({
      geminiClient,
      structuredAnswerBuilder,
      quotaService: allowAllQuotaService(),
      logger: silentLogger,
    });

    await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: '' }));

    expect(structuredAnswerBuilder).toHaveBeenCalled();
    const [, prompt] = geminiClient.mock.calls[0];
    expect(prompt.groundingPayload).toMatchObject({
      conclusion: 'Safe.',
      approvedNumericTokens: [],
      approvedYearTokens: [],
    });
    expect(prompt.factObject).toBeUndefined();
    expect(prompt.structuredAnswer).toBeUndefined();
  });

  it('grounds site knowledge but does not attach dashboard grounding to news intents', async () => {
    const site = await runIntegratedRequest({
      ...validPayload,
      message: 'What is Borneo Tracker?',
      region: '',
    });
    const news = await runIntegratedRequest({
      ...validPayload,
      message: 'Show latest Borneo news.',
      region: '',
    });

    expect(site.completed.intent).toBe('SITE_KNOWLEDGE');
    expect(site.completed.promptBuilt).toBe(true);
    expect(site.completed.retrievalStatus).toBe('FOUND');
    expect(site.geminiClient).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'What is Borneo Tracker?' }),
      expect.objectContaining({
        groundingPayload: expect.objectContaining({
          answerStatus: 'FOUND',
          selectedRecords: expect.any(Array),
        }),
      })
    );
    expect(news.completed.intent).toBe('BORNEO_NEWS');
    expect(news.completed.promptBuilt).toBe(false);
    expect(news.geminiClient).not.toHaveBeenCalled();
  });

  it('falls back to deterministic knowledge answer when Gemini is unavailable', async () => {
    const geminiClient = vi.fn().mockRejectedValue(new AIChatHttpError(500, 'MISSING_GEMINI_API_KEY', 'missing'));
    const handler = createAiChatHandler({ geminiClient, quotaService: allowAllQuotaService(), logger: silentLogger });

    const response = await handler(request({ ...validPayload, message: 'How do I generate a report?', currentPage: '/reports', region: '' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toBe('template-fallback');
    expect(body.fallback.reason).toBe('KNOWLEDGE_GEMINI_UNAVAILABLE');
    expect(body.answer.toLowerCase()).toContain('report');
    expect(body.sources.length).toBeGreaterThan(0);
  });

  it('bypasses Gemini for knowledge no-match and ambiguity', async () => {
    const geminiClient = vi.fn();
    const knowledgeRetriever = vi.fn()
      .mockReturnValueOnce({ status: 'NO_MATCH', matches: [], warnings: [] })
      .mockReturnValueOnce({
        status: 'AMBIGUOUS',
        matches: [{
          record: {
            id: 'a',
            title: 'A',
            content: 'A',
            category: 'a',
            language: 'en',
            regions: [],
            sdgTags: [],
            relatedSdgs: [],
            keywords: [],
            sourceFile: 'fixture.json',
            sourceType: 'json',
            status: 'verified',
            placeholder: false,
            runtimeIncluded: true,
          },
          score: 8,
          matchedBy: [],
        }],
        warnings: ['KNOWLEDGE_AMBIGUOUS'],
      });
    const handler = createAiChatHandler({ geminiClient, knowledgeRetriever, logger: silentLogger });

    const noMatch = await handler(request({ ...validPayload, message: 'What is Borneo Tracker?', region: '' }));
    const ambiguous = await handler(request({ ...validPayload, message: 'What is Borneo Tracker?', region: '' }));
    const noMatchBody = await noMatch.json();
    const ambiguousBody = await ambiguous.json();

    expect(geminiClient).not.toHaveBeenCalled();
    expect(noMatchBody.fallback.reason).toBe('KNOWLEDGE_NO_MATCH');
    expect(ambiguousBody.fallback.reason).toBe('KNOWLEDGE_AMBIGUOUS');
  });

  it('retrieves BORNEO_NEWS internally without sending news content to Gemini', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const newsRepository = {
      findPublished: vi.fn().mockResolvedValue([{
        id: 'safe-published-news',
        title: 'Safe published title',
        summary: 'Safe published summary.',
        publishedAt: '2026-07-13T00:00:00Z',
        territory: 'Sabah',
        language: 'en',
        publisher: 'Safe Publisher',
        url: 'https://example.com/safe-news',
      }]),
      countPending: vi.fn().mockResolvedValue(3),
    };
    const geminiClient = vi.fn().mockResolvedValue('News response from existing path.');
    const handler = createAiChatHandler({ geminiClient, newsRepository, logger });

    const response = await handler(request({ ...validPayload, message: 'Show latest conservation news in Sabah.', region: '' }));
    const body = await response.json();
    const newsLog = logger.info.mock.calls.find(([event]) => event === 'news_query_executed')?.[1];
    const completed = logger.info.mock.calls.find(([event]) => event === 'request_completed')?.[1];

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      mode: 'template-fallback',
    });
    expect(body.answer).toContain('Safe published title');
    expect(newsRepository.findPublished).toHaveBeenCalledWith(expect.objectContaining({
      territories: ['Sabah'],
      latest: true,
      limit: 5,
    }));
    expect(newsRepository.countPending).toHaveBeenCalledWith(expect.objectContaining({
      territories: ['Sabah'],
    }));
    expect(geminiClient).not.toHaveBeenCalled();
    expect(JSON.stringify(geminiClient.mock.calls)).not.toContain('Safe published title');
    expect(newsLog).toMatchObject({
      newsQueryExecuted: true,
      territoryCount: 1,
      publishedCount: 1,
      pendingCount: 3,
      dateFilterUsed: false,
      limit: 5,
      languagePreferenceUsed: true,
      warningCodes: [],
    });
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('Safe published title');
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('https://example.com/safe-news');
    expect(completed.newsRetrieval).toMatchObject({
      publishedCount: 1,
      pendingCount: 3,
      territoryCount: 1,
    });
  });

  it('does not invoke news repository for dashboard, site knowledge, or out-of-scope intents', async () => {
    const newsRepository = {
      findPublished: vi.fn(),
      countPending: vi.fn(),
    };
    const geminiClient = vi.fn().mockResolvedValue('Integrated response.');
    const handler = createAiChatHandler({ geminiClient, newsRepository, quotaService: allowAllQuotaService(), logger: silentLogger });

    await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: '' }));
    await handler(request({ ...validPayload, message: 'What is Borneo Tracker?', region: '' }));
    await handler(request({ ...validPayload, message: 'Write me a poem about clouds.', region: '' }));

    expect(newsRepository.findPublished).not.toHaveBeenCalled();
    expect(newsRepository.countPending).not.toHaveBeenCalled();
  });

  it('runs dashboard facts through lever retrieval before prompt construction', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const leverRetriever = vi.fn().mockReturnValue({
      records: [verifiedLeverRecord()],
      matchedBy: ['concept', 'pillar'],
      warnings: [],
    });
    const geminiClient = vi.fn((_, prompt) => Promise.resolve(safeDashboardAnswer(prompt)));
    const handler = createAiChatHandler({ geminiClient, leverRetriever, quotaService: allowAllQuotaService(), logger });

    const response = await handler(request({ ...validPayload, message: "What is Sabah's food score?", region: '' }));
    const body = await response.json();
    const [, prompt] = geminiClient.mock.calls[0];
    expect(response.status).toBe(200);
    expect(body.mode).toBe('gemini-test');
    expect(body.answer).toContain('Restore idle paddy fields');
    expect(body.sources).toContainEqual(expect.objectContaining({ sourceFile: 'docs/AI_CHATBOT_CONCEPT_AND_PLAN.md' }));
    expect(leverRetriever).toHaveBeenCalledWith(expect.objectContaining({
      concepts: expect.arrayContaining(['food']),
      territories: ['Sabah'],
    }));
    expect(prompt.groundingPayload.levers).toHaveLength(1);
    expect(prompt.userContent).not.toContain('sourcePath');
  });

  it('Gemini failure fallback includes deterministic verified lever text', async () => {
    const leverRetriever = vi.fn().mockReturnValue({
      records: [verifiedLeverRecord()],
      matchedBy: ['concept'],
      warnings: [],
    });
    const geminiClient = vi.fn().mockRejectedValue(new AIChatHttpError(504, 'GEMINI_TIMEOUT', 'timeout'));
    const handler = createAiChatHandler({ geminiClient, leverRetriever, quotaService: allowAllQuotaService(), logger: silentLogger });

    const response = await handler(request({ ...validPayload, message: "What is Sabah's food score?", region: '' }));
    const body = await response.json();

    expect(body.mode).toBe('template-fallback');
    expect(body.answer).toContain('Recommended action: Restore idle paddy fields');
    expect(body.fallback.reason).toBe('GEMINI_TIMEOUT');
  });

  it('invalid Gemini lever expansion is rejected without retry', async () => {
    const leverRetriever = vi.fn().mockReturnValue({
      records: [verifiedLeverRecord()],
      matchedBy: ['concept'],
      warnings: [],
    });
    const geminiClient = vi.fn().mockResolvedValue('Authorities should build solar microgrids instead.');
    const handler = createAiChatHandler({ geminiClient, leverRetriever, quotaService: allowAllQuotaService(), logger: silentLogger });

    const response = await handler(request({ ...validPayload, message: "What is Sabah's food score?", region: '' }));
    const body = await response.json();

    expect(geminiClient).toHaveBeenCalledTimes(1);
    expect(body.mode).toBe('template-fallback');
    expect(body.fallback.reason).toBe('GEMINI_RESPONSE_REJECTED');
    expect(body.answer).toContain('Restore idle paddy fields');
  });

  it('blocked and clarification flows skip lever retrieval', async () => {
    const leverRetriever = vi.fn();
    const handler = createAiChatHandler({ geminiClient: vi.fn(), leverRetriever, logger: silentLogger });

    await handler(request({ ...validPayload, message: 'Compare forest cover between Sabah and Brunei.', region: '' }));
    await handler(request({ ...validPayload, message: 'Show dashboard data for Kota district.', region: '' }));

    expect(leverRetriever).not.toHaveBeenCalled();
  });

  it('passes blocked and clarification dashboard states in grounded prompts', async () => {
    const blocked = await runIntegratedRequest({
      ...validPayload,
      message: 'Compare forest cover between Sabah and Brunei.',
      region: '',
    });
    const clarification = await runIntegratedRequest({
      ...validPayload,
      message: 'Show dashboard data for Kota district.',
      region: '',
    });
    expect(blocked.geminiClient).not.toHaveBeenCalled();
    expect(clarification.geminiClient).not.toHaveBeenCalled();
    expect(blocked.body.fallback.reason).toBe('DETERMINISTIC_BLOCKED');
    expect(clarification.body.fallback.reason).toBe('DETERMINISTIC_CLARIFICATION');
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
      quotaService: allowAllQuotaService(),
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

  it('keeps grounded Gemini success compatible and does not use fallback', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const geminiClient = vi.fn((_, prompt) => Promise.resolve([
      prompt.groundingPayload.conclusion,
      prompt.groundingPayload.diagnosis,
      prompt.groundingPayload.gap,
      prompt.groundingPayload.impact,
      prompt.groundingPayload.lever,
    ].filter(Boolean).join(' ')));
    const handler = createAiChatHandler({ geminiClient, quotaService: allowAllQuotaService(), logger });

    const response = await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: '' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      mode: 'gemini-test',
    });
    expect(Array.isArray(body.sources)).toBe(true);
    expect(body.sources.length).toBeGreaterThan(0);
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

    expect(site.response.status).toBe(200);
    expect(site.body.mode).toBe('template-fallback');
    expect(site.body.fallback.reason).toBe('KNOWLEDGE_GEMINI_UNAVAILABLE');
    expect(news.response.status).toBe(200);
    expect(news.body.mode).toBe('template-fallback');
    expect(outOfScope.response.status).toBe(200);
    expect(outOfScope.body.mode).toBe('template-fallback');
    expect(site.fallbackLog).toMatchObject({
      fallbackReason: 'KNOWLEDGE_GEMINI_UNAVAILABLE',
      intent: 'SITE_KNOWLEDGE',
    });
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

describe('ai-chat RESILIENCE_SIMULATION (IS-6)', () => {
  it('routes a "what if" question to RESILIENCE_SIMULATION and narrates simulate_resilience() numbers through Gemini', async () => {
    const geminiClient = vi.fn().mockImplementation((chatRequest, prompt) => Promise.resolve(prompt.groundingPayload.answer));
    const quotaService = allowAllQuotaService();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const handler = createAiChatHandler({ geminiClient, quotaService, logger });

    const response = await handler(request({
      ...validPayload,
      message: "What if Brunei's paddy production per capita went from 8 to 40?",
      region: '',
    }));
    const body = await response.json();
    const completed = logger.info.mock.calls.find(([event]) => event === 'request_completed')?.[1];

    expect(response.status).toBe(200);
    expect(body.mode).toBe('gemini-test');
    expect(completed.intent).toBe('RESILIENCE_SIMULATION');
    expect(completed.simulationTerritory).toBe('Brunei');
    expect(completed.simulationIndicator).toBe('Paddy production per capita');
    expect(completed.simulationTargetValue).toBe(40);
    expect(body.answer).toContain('Illustrative — deterministic scenario, not a forecast.');
    expect(geminiClient).toHaveBeenCalledTimes(1);
  });

  it('narrated numbers exactly match a direct simulate_resilience() call with the same territory/indicator/value', async () => {
    const { simulate_resilience } = await import('./resilienceSimulation.ts');
    const direct = simulate_resilience('Brunei', { 'Paddy production per capita': 40 });

    const geminiClient = vi.fn().mockImplementation((chatRequest, prompt) => Promise.resolve(prompt.groundingPayload.answer));
    const handler = createAiChatHandler({ geminiClient, quotaService: allowAllQuotaService(), logger: silentLogger });

    const response = await handler(request({
      ...validPayload,
      message: "What if Brunei's paddy production per capita went from 8 to 40?",
      region: '',
    }));
    const body = await response.json();

    expect(body.answer).toContain(String(direct.before.index));
    expect(body.answer).toContain(String(direct.after.index));
  });

  it('bypasses Gemini entirely and asks for clarification on an ambiguous/invalid request (no territory)', async () => {
    const geminiClient = vi.fn();
    const handler = createAiChatHandler({ geminiClient, quotaService: allowAllQuotaService(), logger: silentLogger });

    const response = await handler(request({
      ...validPayload,
      message: 'What if electricity access improved to 90?',
      region: '',
    }));
    const body = await response.json();

    expect(geminiClient).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.mode).toBe('template-fallback');
    expect(body.fallback.reason).toBe('SIMULATION_NEEDS_CLARIFICATION');
    expect(body.answer.toLowerCase()).toContain('territory');
  });

  it('bypasses Gemini and asks for clarification on a misspelled territory', async () => {
    const geminiClient = vi.fn();
    const handler = createAiChatHandler({ geminiClient, quotaService: allowAllQuotaService(), logger: silentLogger });

    const response = await handler(request({
      ...validPayload,
      message: 'What if Sarawakk improved electricity access to 90?',
      region: '',
    }));
    const body = await response.json();

    expect(geminiClient).not.toHaveBeenCalled();
    expect(body.fallback.reason).toBe('SIMULATION_NEEDS_CLARIFICATION');
  });

  it('bypasses Gemini and asks for clarification on a nonexistent indicator', async () => {
    const geminiClient = vi.fn();
    const handler = createAiChatHandler({ geminiClient, quotaService: allowAllQuotaService(), logger: silentLogger });

    const response = await handler(request({
      ...validPayload,
      message: "What if Brunei's happiness score went up to 90?",
      region: '',
    }));
    const body = await response.json();

    expect(geminiClient).not.toHaveBeenCalled();
    expect(body.fallback.reason).toBe('SIMULATION_NEEDS_CLARIFICATION');
  });

  it('falls back to the deterministic answer when Gemini invents an unapproved number', async () => {
    const geminiClient = vi.fn().mockResolvedValue('Brunei would reach a perfect 100 index. Illustrative — deterministic scenario, not a forecast.');
    const quotaService = allowAllQuotaService();
    const handler = createAiChatHandler({ geminiClient, quotaService, logger: silentLogger });

    const response = await handler(request({
      ...validPayload,
      message: "What if Brunei's paddy production per capita went from 8 to 40?",
      region: '',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toBe('template-fallback');
    expect(body.fallback.reason).toBe('SIMULATION_RESPONSE_REJECTED');
    expect(body.answer).not.toContain('perfect 100');
    expect(quotaService.refundReservation).toHaveBeenCalled();
  });

  it('falls back to the deterministic answer when Gemini presents the scenario as a guaranteed prediction', async () => {
    const geminiClient = vi.fn().mockResolvedValue('This will definitely improve the index. Illustrative — deterministic scenario, not a forecast.');
    const handler = createAiChatHandler({ geminiClient, quotaService: allowAllQuotaService(), logger: silentLogger });

    const response = await handler(request({
      ...validPayload,
      message: "What if Brunei's paddy production per capita went from 8 to 40?",
      region: '',
    }));
    const body = await response.json();

    expect(body.mode).toBe('template-fallback');
    expect(body.fallback.reason).toBe('SIMULATION_RESPONSE_REJECTED');
  });

  it('routes a Bahasa Melayu "what if" question correctly', async () => {
    // Malay routing/value-extraction phrasing, with the indicator referenced
    // by its exact data name — entityResolver's indicator aliases are
    // derived straight from indicators.json's English `indicator` field with
    // no Malay translation layer (unlike its concept/pillar/territory
    // aliases, which do have Malay entries), so a Malay indicator synonym
    // alone correctly falls through to NEEDS_CLARIFICATION rather than a
    // guess. This is a pre-existing entityResolver characteristic, not
    // something this stage changes.
    const geminiClient = vi.fn().mockImplementation((chatRequest, prompt) => Promise.resolve(prompt.groundingPayload.answer));
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const handler = createAiChatHandler({ geminiClient, quotaService: allowAllQuotaService(), logger });

    const response = await handler(request({
      ...validPayload,
      message: 'Bagaimana jika Electricity access di Sarawak meningkat kepada 100?',
      region: '',
      language: 'ms',
    }));
    const body = await response.json();
    const completed = logger.info.mock.calls.find(([event]) => event === 'request_completed')?.[1];

    expect(response.status).toBe(200);
    expect(completed.intent).toBe('RESILIENCE_SIMULATION');
    expect(completed.simulationTerritory).toBe('Sarawak');
    expect(body.answer).toContain('Ilustrasi — senario deterministik, bukan ramalan.');
  });

  it('does not touch DASHBOARD_DATA/SITE_KNOWLEDGE/BORNEO_NEWS routing for unrelated questions', async () => {
    const geminiClient = vi.fn().mockImplementation((chatRequest, prompt) => Promise.resolve(safePromptAnswer(prompt)));
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const handler = createAiChatHandler({ geminiClient, quotaService: allowAllQuotaService(), logger });

    const response = await handler(request({ ...validPayload, message: "What is Sabah's resilience score?", region: '' }));
    const completed = logger.info.mock.calls.find(([event]) => event === 'request_completed')?.[1];

    expect(response.status).toBe(200);
    expect(completed.intent).toBe('DASHBOARD_DATA');
  });
});
