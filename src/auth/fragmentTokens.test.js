import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('fragment token lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    window.history.replaceState({}, '', '/');
  });

  it('removes a sensitive token from the URL and allows explicit memory discard', async () => {
    window.history.replaceState({}, '', '/confirm-email-change#token=secure-fragment-value');
    const { consumeFragmentToken, discardFragmentToken } = await import('./fragmentTokens');
    expect(window.location.hash).toBe('');
    expect(consumeFragmentToken('/confirm-email-change')).toBe('secure-fragment-value');
    expect(discardFragmentToken('/confirm-email-change')).toBe(true);
    expect(consumeFragmentToken('/confirm-email-change')).toBeNull();
  });
});
