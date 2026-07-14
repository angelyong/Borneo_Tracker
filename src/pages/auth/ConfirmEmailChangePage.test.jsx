import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  discard: vi.fn(),
  confirm: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('../../auth/fragmentTokens', () => ({
  consumeFragmentToken: () => 'confirm-token-kept-only-on-page',
  discardFragmentToken: mocks.discard,
}));
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ status: 'anonymous', user: null, updateUser: mocks.updateUser }),
}));
vi.mock('../../services/authService', () => ({
  authService: { confirmEmailChange: mocks.confirm },
}));

import ConfirmEmailChangePage from './ConfirmEmailChangePage';

let root;
let container;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });

describe('ConfirmEmailChangePage anonymous flow', () => {
  it('discards the token and requires reopening the original email after login', async () => {
    await act(async () => root.render(<MemoryRouter><ConfirmEmailChangePage /></MemoryRouter>));
    expect(container.textContent).toMatch(/reopen the original email link/i);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/login');
    expect(mocks.discard).toHaveBeenCalledWith('/confirm-email-change');
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});
