const captured = new Map();
const captureCurrentFragment = () => {
  if (typeof window !== 'undefined') {
  const supported = new Set(['/verify-email', '/reset-password', '/confirm-email-change']);
  if (supported.has(window.location.pathname)) {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (token) captured.set(window.location.pathname, token);
    if (window.location.hash) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
  }
  }
};
captureCurrentFragment();

export const consumeFragmentToken = (path) => {
  captureCurrentFragment();
  return captured.get(path) || null;
};

export const discardFragmentToken = (path) => captured.delete(path);
