import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import i18n from '../i18n';
import Sidebar from './sidebar';

vi.mock('../services/communityService', () => ({
  CURRENT_USER: 'You',
  getPosts: vi.fn(async () => [
    { id: 'community-1', author: 'Amina', createdAt: '2026-08-18T09:00:00.000Z' },
  ]),
}));

vi.mock('../services/newsService', () => ({
  getNewsArticles: vi.fn(async () => [
    { id: 'news-1', publishedAt: '2026-08-18T10:00:00.000Z' },
    { id: 'news-2', publishedAt: '2026-08-18T11:00:00.000Z' },
  ]),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function renderSidebar({ isAdmin = false, collapsed = false, initialPath = '/' } = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <AuthContext.Provider
        value={{
          isAuthenticated: true,
          isAdmin,
          signOut: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={[initialPath]}>
          <Sidebar collapsed={collapsed} />
        </MemoryRouter>
      </AuthContext.Provider>
    );
  });
}

describe('Sidebar', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it('groups primary navigation and moves About into Act', async () => {
    renderSidebar();

    const explore = document.querySelector('[role="group"][aria-label="Explore"]');
    const analyse = document.querySelector('[role="group"][aria-label="Analyse"]');
    const actGroup = document.querySelector('[role="group"][aria-label="Act"]');

    expect(explore?.textContent).toContain('Dashboard');
    expect(explore?.textContent).toContain('Regional Details');
    expect(explore?.textContent).toContain('ESG Indicators');
    expect(explore?.textContent).toContain('SDG Progress');

    expect(analyse?.textContent).toContain('Impact Simulator');
    expect(analyse?.textContent).toContain('News & Insights');
    expect(analyse?.textContent).toContain('Community');

    expect(actGroup?.textContent).toContain('Generate Report');
    expect(actGroup?.textContent).toContain('Data Sources');
    expect(actGroup?.textContent).toContain('About Borneo Tracker');
    expect(actGroup?.querySelector('a[href="/about"]')).toBeTruthy();

    await vi.waitFor(() => {
      expect(analyse?.textContent).toContain('2');
      expect(analyse?.textContent).toContain('1');
    });
  });

  it('keeps Admin Tools as an admin-only group', () => {
    renderSidebar({ isAdmin: false });
    expect(document.querySelector('[role="group"][aria-label="Admin Tools"]')).toBeFalsy();

    act(() => {
      root.unmount();
    });
    container.remove();
    root = null;
    container = null;

    renderSidebar({ isAdmin: true, initialPath: '/admin/news' });
    const adminGroup = document.querySelector('[role="group"][aria-label="Admin Tools"]');
    expect(adminGroup?.textContent).toContain('News Review');
    expect(adminGroup?.textContent).toContain('User Management');
  });

  it('keeps Malay group labels compact', async () => {
    await i18n.changeLanguage('ms');
    renderSidebar();

    expect(document.querySelector('[role="group"][aria-label="Terokai"]')).toBeTruthy();
    expect(document.querySelector('[role="group"][aria-label="Analisis"]')).toBeTruthy();
    expect(document.querySelector('[role="group"][aria-label="Tindakan"]')).toBeTruthy();
  });
});
