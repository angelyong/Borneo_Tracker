let csrfToken = null;
const REQUEST_TIMEOUT_MS = 10_000;
const SESSION_INVALID_EVENT = 'borneo-tracker:session-invalid';
const AUTH_RECHECK_CHANNEL = 'borneo-tracker:auth-recheck';
const AUTH_RECHECK_STORAGE_KEY = 'borneo-tracker:auth-recheck';
let authChannel;

const getAuthChannel = () => {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!authChannel) authChannel = new window.BroadcastChannel(AUTH_RECHECK_CHANNEL);
  return authChannel;
};

const notifySessionInvalid = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_INVALID_EVENT));
};

export const broadcastAuthRecheck = () => {
  if (typeof window === 'undefined') return;
  getAuthChannel()?.postMessage({ type: 'recheck' });
  try {
    window.localStorage.setItem(AUTH_RECHECK_STORAGE_KEY, `${Date.now()}:${Math.random()}`);
  } catch {
    // Cross-tab notification is best-effort; authentication never depends on storage.
  }
};

export const subscribeSessionInvalid = (listener) => {
  window.addEventListener(SESSION_INVALID_EVENT, listener);
  return () => window.removeEventListener(SESSION_INVALID_EVENT, listener);
};

export const subscribeAuthRecheck = (listener) => {
  const channel = getAuthChannel();
  const onMessage = (event) => { if (event.data?.type === 'recheck') listener(); };
  const onStorage = (event) => { if (event.key === AUTH_RECHECK_STORAGE_KEY) listener(); };
  channel?.addEventListener('message', onMessage);
  window.addEventListener('storage', onStorage);
  return () => {
    channel?.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
  };
};

const fetchWithTimeout = async (input, init = {}) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
};

export class ApiClientError extends Error {
  constructor(status, payload) {
    super(payload?.error?.message || 'The request could not be completed.');
    this.status = status;
    this.code = payload?.error?.code || 'REQUEST_FAILED';
    this.fieldErrors = payload?.error?.fieldErrors || {};
    this.requestId = payload?.error?.requestId;
  }
}

const parseResponse = async (response) => {
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new ApiClientError(response.status, payload);
    if (error.status === 401 && error.code === 'SESSION_INVALID') notifySessionInvalid();
    throw error;
  }
  return payload;
};

export const bootstrapCsrf = async () => {
  const response = await fetchWithTimeout('/api/auth/csrf', { credentials: 'include', headers: { Accept: 'application/json' } });
  const payload = await parseResponse(response);
  csrfToken = payload.csrfToken;
  return csrfToken;
};

const mutate = async (path, body = {}, retried = false) => {
  if (!csrfToken) await bootstrapCsrf();
  const response = await fetchWithTimeout(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(body),
  });
  if (response.status === 403 && !retried) {
    const payload = await response.clone().json().catch(() => ({}));
    if (payload?.error?.code === 'CSRF_INVALID') {
      await bootstrapCsrf();
      return mutate(path, body, true);
    }
  }
  const payload = await parseResponse(response);
  if (payload?.csrfToken) csrfToken = payload.csrfToken;
  return payload;
};

const get = async (path) => parseResponse(await fetchWithTimeout(path, { credentials: 'include', headers: { Accept: 'application/json' } }));
const patch = async (path, body, retried = false) => {
  if (!csrfToken) await bootstrapCsrf();
  const response = await fetchWithTimeout(path, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(body) });
  if (response.status === 403 && !retried) {
    const payload = await response.clone().json().catch(() => ({}));
    if (payload?.error?.code === 'CSRF_INVALID') { await bootstrapCsrf(); return patch(path, body, true); }
  }
  return parseResponse(response);
};

export const authService = {
  me: () => get('/api/auth/me'),
  register: (input) => mutate('/api/auth/register', input),
  resendVerification: (email) => mutate('/api/auth/resend-verification', { email }),
  verifyEmail: (token) => mutate('/api/auth/verify-email', { token }),
  login: async (input) => { const result = await mutate('/api/auth/login', input); broadcastAuthRecheck(); return result; },
  logout: async () => { const result = await mutate('/api/auth/logout'); broadcastAuthRecheck(); return result; },
  logoutAll: async (currentPassword) => { const result = await mutate('/api/auth/logout-all', { currentPassword }); broadcastAuthRecheck(); return result; },
  forgotPassword: (email) => mutate('/api/auth/forgot-password', { email }),
  resetPassword: async (token, password, confirmPassword) => { const result = await mutate('/api/auth/reset-password', { token, password, confirmPassword }); notifySessionInvalid(); broadcastAuthRecheck(); return result; },
  changePassword: async (currentPassword, password, confirmPassword) => { const result = await mutate('/api/auth/change-password', { currentPassword, password, confirmPassword }); broadcastAuthRecheck(); return result; },
  getProfile: () => get('/api/users/me'),
  updateProfile: (input) => patch('/api/users/me', input),
  changeEmail: (newEmail, currentPassword) => mutate('/api/users/me/change-email', { newEmail, currentPassword }),
  confirmEmailChange: async (token) => { const result = await mutate('/api/users/me/confirm-email-change', { token }); broadcastAuthRecheck(); return result; },
  clearMemory: () => { csrfToken = null; },
};
