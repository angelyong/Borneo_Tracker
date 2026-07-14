import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from './authContext';
import { AdminRoute, ProtectedRoute } from './ProtectedRoute';

let root;
let container;

const renderRoutes = async (value, element) => {
  container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root.render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/login" element={<div>Login screen</div>} />
          <Route path="/private" element={element} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  ));
};

beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });

describe('route access matrix', () => {
  it('redirects an anonymous visitor from a protected route to login', async () => {
    await renderRoutes({ status: 'anonymous', user: null, refresh: vi.fn() }, <ProtectedRoute><div>Private</div></ProtectedRoute>);
    expect(container.textContent).toBe('Login screen');
  });

  it('denies a signed-in non-admin and allows an ADMIN', async () => {
    await renderRoutes({ status: 'authenticated', user: { role: 'USER' }, refresh: vi.fn() }, <AdminRoute><div>Admin news</div></AdminRoute>);
    expect(container.textContent).toMatch(/do not have permission/i);
    await act(async () => root.unmount()); root = null;
    await renderRoutes({ status: 'authenticated', user: { role: 'ADMIN' }, refresh: vi.fn() }, <AdminRoute><div>Admin news</div></AdminRoute>);
    expect(container.textContent).toBe('Admin news');
  });
});
