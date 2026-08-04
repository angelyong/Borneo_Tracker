import { describe, expect, it, vi } from 'vitest';
import {
  AIChatTelemetryService,
  FailingTelemetryAdapter,
  MemoryTelemetryAdapter,
  SupabaseTelemetryAdapter,
  generateAIChatRequestId,
  normalizeTelemetryCurrentPage,
  normalizeTelemetryEvent,
  normalizeTelemetryRegion,
} from './telemetry.ts';

describe('ai-chat telemetry service', () => {
  it('records success, fallback, deterministic/refused, and error events through memory adapter', async () => {
    const adapter = new MemoryTelemetryAdapter();
    const service = new AIChatTelemetryService({ adapter });

    await service.record({
      requestId: 'req_success_123',
      identityType: 'authenticated',
      intent: 'DASHBOARD_DATA',
      mode: 'gemini-test',
      outcome: 'success',
      modelCalled: true,
      quotaConsumed: true,
      responseStatus: 200,
      sourceCount: 2,
      language: 'en',
      region: 'Sabah',
      currentPage: '/dashboard?token=secret#frag',
    });
    await service.record({
      requestId: 'req_fallback_123',
      identityType: 'anonymous',
      intent: 'SITE_KNOWLEDGE',
      mode: 'template-fallback',
      outcome: 'fallback',
      fallbackUsed: true,
      fallbackReason: 'KNOWLEDGE_NO_MATCH',
      modelCalled: false,
      quotaConsumed: false,
      responseStatus: 200,
    });
    await service.record({
      requestId: 'req_refused_123',
      identityType: 'unknown',
      intent: 'OUT_OF_SCOPE',
      mode: 'template-fallback',
      outcome: 'refused',
      fallbackUsed: true,
      fallbackReason: 'DETERMINISTIC_BLOCKED',
      modelCalled: false,
      quotaConsumed: false,
      responseStatus: 200,
    });
    await service.record({
      requestId: 'req_error_123',
      identityType: 'unknown',
      outcome: 'error',
      errorCode: 'INVALID_JSON',
      responseStatus: 400,
    });

    expect(adapter.rows).toHaveLength(4);
    expect(adapter.rows[0]).toMatchObject({
      request_id: 'req_success_123',
      identity_type: 'authenticated',
      intent: 'DASHBOARD_DATA',
      mode: 'gemini-test',
      outcome: 'success',
      model_called: true,
      quota_consumed: true,
      region: 'Sabah',
      current_page: '/dashboard',
    });
    expect(adapter.rows[1]).toMatchObject({
      outcome: 'fallback',
      fallback_used: true,
      fallback_reason: 'KNOWLEDGE_NO_MATCH',
      model_called: false,
      quota_consumed: false,
    });
    expect(adapter.rows[2]).toMatchObject({
      outcome: 'refused',
      identity_type: 'unknown',
    });
    expect(adapter.rows[3]).toMatchObject({
      outcome: 'error',
      error_code: 'INVALID_JSON',
    });
  });

  it('fails safely when the adapter throws', async () => {
    const service = new AIChatTelemetryService({ adapter: new FailingTelemetryAdapter() });

    await expect(service.record({
      requestId: 'req_failure_123',
      identityType: 'anonymous',
      outcome: 'error',
      responseStatus: 500,
    })).resolves.toEqual({ status: 'failed', reason: 'ADAPTER_ERROR' });
  });

  it('skips safely when production adapter credentials are absent', async () => {
    const service = new AIChatTelemetryService({ env: {} });

    await expect(service.record({
      requestId: 'req_skip_123',
      identityType: 'anonymous',
      outcome: 'fallback',
      responseStatus: 200,
    })).resolves.toEqual({ status: 'skipped', reason: 'ADAPTER_UNAVAILABLE' });
  });

  it('normalizes privacy-sensitive context fields', () => {
    expect(normalizeTelemetryRegion('Sabah')).toBe('Sabah');
    expect(normalizeTelemetryRegion('Sabah; DROP TABLE')).toBeUndefined();
    expect(normalizeTelemetryCurrentPage('/dashboard/sabah?access_token=secret#frag')).toBe('/dashboard/sabah');
    expect(normalizeTelemetryCurrentPage('https://evil.example/dashboard')).toBeUndefined();
  });

  it('drops malformed or sensitive-looking fields from insert rows', () => {
    const row = normalizeTelemetryEvent({
      requestId: 'bad bearer jwt token',
      identityType: 'authenticated',
      identityKeyHash: 'short-user-id',
      outcome: 'error',
      errorCode: 'Error: stack trace at handler',
      modelCalled: false,
      quotaConsumed: false,
      responseStatus: 400,
      language: 'zh',
      region: 'free text region',
      currentPage: '/dashboard?email=a@example.com',
    });

    expect(row).toMatchObject({
      identity_type: 'authenticated',
      outcome: 'error',
      response_status: 400,
      current_page: '/dashboard',
    });
    expect(row.request_id).toBeUndefined();
    expect(row.identity_key_hash).toBeUndefined();
    expect(row.error_code).toBeUndefined();
    expect(row.language).toBeUndefined();
    expect(row.region).toBeUndefined();
  });

  it('calls Supabase insert endpoint with service-role headers only from server adapter', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const adapter = new SupabaseTelemetryAdapter({
      env: {
        SUPABASE_URL: 'https://example.supabase.co/',
        SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
      },
      fetchImpl,
    });

    await adapter.insert({
      request_id: 'req_insert_123',
      identity_type: 'anonymous',
      outcome: 'fallback',
      fallback_used: true,
      model_called: false,
      quota_consumed: false,
      response_status: 200,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/ai_chat_events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'service-secret',
          authorization: 'Bearer service-secret',
          prefer: 'return=minimal',
        }),
      })
    );
  });

  it('generates bounded server-side request ids', () => {
    expect(generateAIChatRequestId()).toMatch(/^[A-Za-z0-9:_-]{8,80}$/);
  });
});
