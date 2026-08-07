import { describe, expect, it, vi } from 'vitest';
import {
  AIChatQuotaService,
  DEFAULT_AI_CHAT_DAILY_LIMITS,
  MemoryQuotaAdapter,
  SupabaseQuotaAdapter,
} from './quota.ts';

const authenticatedIdentity = {
  type: 'authenticated',
  userId: 'user-123',
  role: 'user',
  status: 'active',
  verified: true,
};

describe('ai-chat quota service', () => {
  it('keeps committed default daily model-call limits stable', () => {
    expect(DEFAULT_AI_CHAT_DAILY_LIMITS).toEqual({
      anonymous: 5,
      authenticated: 25,
      admin: 50,
    });
  });

  it('reserves quota for verified authenticated users with a stable server-side identity key', async () => {
    const adapter = new MemoryQuotaAdapter();
    const service = new AIChatQuotaService({
      adapter,
      now: () => new Date('2026-08-04T12:00:00Z'),
    });

    const result = await service.reserveForModelCall(authenticatedIdentity);

    expect(result.status).toBe('reserved');
    expect(result.reservation).toMatchObject({
      usageDate: '2026-08-04',
      identityType: 'authenticated',
      identityKey: 'authenticated:user-123',
      limit: 25,
    });
    expect(result.quota).toEqual({ remaining: 24, limit: 25 });
  });

  it('blocks exhausted quota without reserving another model call', async () => {
    const service = new AIChatQuotaService({
      adapter: new MemoryQuotaAdapter(),
      limits: { authenticated: 1 },
      now: () => new Date('2026-08-04T12:00:00Z'),
    });

    await service.reserveForModelCall(authenticatedIdentity);
    const exhausted = await service.reserveForModelCall(authenticatedIdentity);

    expect(exhausted).toEqual({
      status: 'exhausted',
      quota: { remaining: 0, limit: 1 },
    });
  });

  it('refunds a reserved model call after provider or validation failure', async () => {
    const service = new AIChatQuotaService({
      adapter: new MemoryQuotaAdapter(),
      now: () => new Date('2026-08-04T12:00:00Z'),
    });

    const reserved = await service.reserveForModelCall(authenticatedIdentity);
    const refund = await service.refundReservation(reserved.reservation);
    const secondReserve = await service.reserveForModelCall(authenticatedIdentity);

    expect(refund).toEqual({
      status: 'refunded',
      quota: { remaining: 25, limit: 25 },
    });
    expect(secondReserve.status).toBe('reserved');
    expect(secondReserve.quota).toEqual({ remaining: 24, limit: 25 });
  });

  it('defers anonymous runtime quota until a trusted anonymous key exists', async () => {
    const service = new AIChatQuotaService({
      adapter: new MemoryQuotaAdapter(),
      now: () => new Date('2026-08-04T12:00:00Z'),
    });

    await expect(service.reserveForModelCall({ type: 'anonymous', verified: false })).resolves.toEqual({
      status: 'unavailable',
      reason: 'ANONYMOUS_IDENTITY_DEFERRED',
      limit: 5,
    });
  });

  it('treats missing Supabase service credentials as quota unavailable', async () => {
    const service = new AIChatQuotaService({ env: {} });

    await expect(service.reserveForModelCall(authenticatedIdentity)).resolves.toEqual({
      status: 'unavailable',
      reason: 'ADAPTER_UNAVAILABLE',
      limit: 25,
    });
  });

  it('calls the quota RPCs with service-role headers and no client-exposed identity fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([{
        allowed: true,
        usage_date: '2026-08-04',
        identity_type: 'authenticated',
        identity_key_hash: 'authenticated:user-123',
        daily_limit: 25,
        model_calls_reserved: 1,
        model_calls_used: 0,
        remaining: 24,
      }]),
    });
    const adapter = new SupabaseQuotaAdapter({
      env: {
        SUPABASE_URL: 'https://example.supabase.co/',
        SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
      },
      fetchImpl,
    });

    const result = await adapter.reserve({
      usageDate: '2026-08-04',
      identityType: 'authenticated',
      identityKey: 'authenticated:user-123',
      dailyLimit: 25,
    });

    expect(result.allowed).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/rpc/reserve_ai_chat_quota',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'service-secret',
          authorization: 'Bearer service-secret',
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          p_usage_date: '2026-08-04',
          p_identity_type: 'authenticated',
          p_identity_key_hash: 'authenticated:user-123',
          p_daily_limit: 25,
        }),
      })
    );
  });
});
