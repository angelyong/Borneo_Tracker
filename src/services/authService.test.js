import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService, bootstrapCsrf, subscribeSessionInvalid } from './authService';

const response = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: vi.fn().mockResolvedValue(body),
  clone() { return response(status, body); },
});

describe('authService browser contract', () => {
  beforeEach(() => {
    authService.clearMemory();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('bootstraps CSRF and sends credentials without putting tokens in storage', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, { csrfToken: 'csrf-one' }))
      .mockResolvedValueOnce(response(200, { user: { id: 'u1' }, csrfToken: 'csrf-auth' }));
    vi.stubGlobal('fetch', fetchMock);

    await bootstrapCsrf();
    await authService.login({ email: 'person@example.com', password: 'a secure password' });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/csrf', expect.objectContaining({ credentials: 'include' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/login', expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-one' }),
    }));
    const storageKeys = [...Array(localStorage.length)].map((_, index) => localStorage.key(index));
    expect(storageKeys.some((key) => /token|csrf/i.test(key || ''))).toBe(false);
  });

  it('refreshes CSRF once and retries a mutation rejected with CSRF_INVALID', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, { csrfToken: 'expired' }))
      .mockResolvedValueOnce(response(403, { error: { code: 'CSRF_INVALID', message: 'bad csrf' } }))
      .mockResolvedValueOnce(response(200, { csrfToken: 'fresh' }))
      .mockResolvedValueOnce(response(202, { message: 'accepted' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await authService.forgotPassword('person@example.com');
    expect(result).toEqual({ message: 'accepted' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][1].headers['X-CSRF-Token']).toBe('fresh');
  });

  it('notifies the app when an authenticated endpoint reports SESSION_INVALID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401, {
      error: { code: 'SESSION_INVALID', message: 'Please sign in.' },
    })));
    const listener = vi.fn();
    const unsubscribe = subscribeSessionInvalid(listener);
    await expect(authService.me()).rejects.toMatchObject({ status: 401, code: 'SESSION_INVALID' });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('clears the current tab auth state after a successful password reset', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, { csrfToken: 'reset-csrf' }))
      .mockResolvedValueOnce(response(200, { reset: true }));
    vi.stubGlobal('fetch', fetchMock);
    const listener = vi.fn();
    const unsubscribe = subscribeSessionInvalid(listener);
    await authService.resetPassword('r'.repeat(43), 'new secure password', 'new secure password');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
