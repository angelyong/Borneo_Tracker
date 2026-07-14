import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class ApiClientError extends Error {
    constructor(status, code) { super(code); this.status = status; this.code = code; }
  }
  return {
    ApiClientError,
    bootstrapCsrf: vi.fn(),
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    clearMemory: vi.fn(),
    invalidListener: null,
    recheckListener: null,
  };
});

vi.mock('../services/authService', () => ({
  ApiClientError: mocks.ApiClientError,
  bootstrapCsrf: mocks.bootstrapCsrf,
  authService: { me: mocks.me, login: mocks.login, logout: mocks.logout, clearMemory: mocks.clearMemory },
  subscribeSessionInvalid: (listener) => { mocks.invalidListener = listener; return () => { mocks.invalidListener = null; }; },
  subscribeAuthRecheck: (listener) => { mocks.recheckListener = listener; return () => { mocks.recheckListener = null; }; },
}));

import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

let root;
let container;
let latest;

function Probe() {
  const auth = useAuth();
  useEffect(() => { latest = auth; }, [auth]);
  return <div>{auth.status}:{auth.user?.email || 'none'}</div>;
}

const renderProvider = async () => {
  container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root.render(<AuthProvider><Probe /></AuthProvider>));
  await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 5)); });
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  for (const mock of [mocks.bootstrapCsrf, mocks.me, mocks.login, mocks.logout, mocks.clearMemory]) mock.mockReset();
  mocks.invalidListener = null;
  mocks.recheckListener = null;
  latest = null;
  mocks.bootstrapCsrf.mockResolvedValue('csrf');
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null; container = null;
});

describe('AuthProvider state model', () => {
  it('distinguishes an anonymous 401 from an unavailable backend', async () => {
    mocks.me.mockRejectedValueOnce(new mocks.ApiClientError(401, 'SESSION_INVALID'));
    await renderProvider();
    expect(container.textContent).toBe('anonymous:none');

    mocks.me.mockRejectedValueOnce(new Error('network down'));
    await act(async () => latest.refresh());
    expect(container.textContent).toBe('unavailable:none');
  });

  it('keeps the known user and marks auth unavailable when logout fails', async () => {
    mocks.me.mockResolvedValue({ user: { id: 'u1', email: 'person@example.com' } });
    mocks.logout.mockRejectedValue(new Error('network down'));
    await renderProvider();
    let failure;
    await act(async () => { try { await latest.logout(); } catch (error) { failure = error; } });
    expect(failure).toMatchObject({ message: 'network down' });
    expect(container.textContent).toBe('unavailable:person@example.com');
    expect(mocks.clearMemory).not.toHaveBeenCalled();
  });

  it('clears stale UI state on a global SESSION_INVALID notification', async () => {
    mocks.me.mockResolvedValue({ user: { id: 'u1', email: 'person@example.com' } });
    await renderProvider();
    act(() => mocks.invalidListener());
    expect(container.textContent).toBe('anonymous:none');
    expect(mocks.clearMemory).toHaveBeenCalled();
  });

  it('rechecks the server session after a cross-tab auth notification', async () => {
    mocks.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'person@example.com' } })
      .mockRejectedValueOnce(new mocks.ApiClientError(401, 'SESSION_INVALID'));
    await renderProvider();
    await act(async () => mocks.recheckListener());
    expect(container.textContent).toBe('anonymous:none');
    expect(mocks.me).toHaveBeenCalledTimes(2);
  });
});
