import { describe, expect, it, vi } from 'vitest';
import { AIChatHttpError } from './contracts.ts';
import { parseAuthorizationHeader, resolveAIChatIdentity } from './identity.ts';

function requestWithAuthorization(authorization) {
  return new Request('https://example.test/ai-chat', {
    method: 'POST',
    headers: authorization ? { Authorization: authorization } : {},
    body: JSON.stringify({
      message: 'Hi',
      currentPage: '/',
      region: '',
      language: 'en',
      userId: 'spoofed-user',
      role: 'admin',
    }),
  });
}

function verifier(result) {
  return {
    verify: vi.fn(async () => result),
  };
}

function profiles(profile) {
  return {
    findProfile: vi.fn(async () => profile),
  };
}

describe('AI chat identity resolution', () => {
  it('classifies missing bearer as anonymous and unverified', async () => {
    await expect(resolveAIChatIdentity(requestWithAuthorization())).resolves.toEqual({
      type: 'anonymous',
      verified: false,
    });
  });

  it('resolves valid authenticated users from trusted verifier and profile repository', async () => {
    const tokenVerifier = verifier({ id: 'user-1' });
    const profileRepository = profiles({ role: 'user', status: 'active' });

    await expect(resolveAIChatIdentity(requestWithAuthorization('Bearer valid-token'), {
      tokenVerifier,
      profileRepository,
    })).resolves.toEqual({
      type: 'authenticated',
      userId: 'user-1',
      role: 'user',
      status: 'active',
      verified: true,
    });

    expect(tokenVerifier.verify).toHaveBeenCalledWith('valid-token');
    expect(profileRepository.findProfile).toHaveBeenCalledWith('user-1', 'valid-token');
  });

  it('resolves admin only from the trusted profile repository', async () => {
    await expect(resolveAIChatIdentity(requestWithAuthorization('Bearer valid-token'), {
      tokenVerifier: verifier({ id: 'user-1' }),
      profileRepository: profiles({ role: 'admin', status: 'active' }),
    })).resolves.toMatchObject({
      type: 'admin',
      role: 'admin',
      verified: true,
    });
  });

  it('ignores request-body userId and role spoofing', async () => {
    await expect(resolveAIChatIdentity(requestWithAuthorization('Bearer valid-token'), {
      tokenVerifier: verifier({ id: 'verified-user' }),
      profileRepository: profiles({ role: 'user', status: 'active' }),
    })).resolves.toMatchObject({
      type: 'authenticated',
      userId: 'verified-user',
      role: 'user',
    });
  });

  it('rejects malformed authorization safely', () => {
    expect(() => parseAuthorizationHeader(new Headers({ Authorization: 'Token abc' }))).toThrow(AIChatHttpError);
    expect(() => parseAuthorizationHeader(new Headers({ Authorization: 'Bearer   ' }))).toThrow(AIChatHttpError);
  });

  it('propagates invalid and expired token failures without downgrading to anonymous', async () => {
    await expect(resolveAIChatIdentity(requestWithAuthorization('Bearer invalid-token'), {
      tokenVerifier: {
        verify: async () => {
          throw new AIChatHttpError(401, 'AI_CHAT_AUTH_INVALID', 'The AI assistant could not verify this sign-in session.');
        },
      },
      profileRepository: profiles({ role: 'user', status: 'active' }),
    })).rejects.toMatchObject({ status: 401, code: 'AI_CHAT_AUTH_INVALID' });

    await expect(resolveAIChatIdentity(requestWithAuthorization('Bearer expired-token'), {
      tokenVerifier: {
        verify: async () => {
          throw new AIChatHttpError(401, 'AI_CHAT_AUTH_EXPIRED', 'The AI assistant could not verify this sign-in session.');
        },
      },
      profileRepository: profiles({ role: 'user', status: 'active' }),
    })).rejects.toMatchObject({ status: 401, code: 'AI_CHAT_AUTH_EXPIRED' });
  });

  it('fails suspended users safely instead of treating them as active users or admins', async () => {
    await expect(resolveAIChatIdentity(requestWithAuthorization('Bearer valid-token'), {
      tokenVerifier: verifier({ id: 'user-1' }),
      profileRepository: profiles({ role: 'admin', status: 'suspended' }),
    })).rejects.toMatchObject({
      status: 403,
      code: 'AI_CHAT_USER_SUSPENDED',
    });
  });

  it('supports injected verifier and profile repository without live Supabase calls', async () => {
    const fetchSpy = vi.fn();

    await resolveAIChatIdentity(requestWithAuthorization('Bearer valid-token'), {
      fetchImpl: fetchSpy,
      tokenVerifier: verifier({ id: 'user-1' }),
      profileRepository: profiles(null),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
