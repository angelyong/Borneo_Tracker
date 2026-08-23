import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import SourceRegistryTable from './SourceRegistryTable';
import { registrySources, safeOfficialUrl } from '../utils/sourceRegistry';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function render(ui) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(ui));
}

afterEach(async () => {
  await i18n.changeLanguage('en');
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe('SourceRegistryTable', () => {
  it('renders loading, failure with retry, and an honest empty state', () => {
    render(<SourceRegistryTable loading />);
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Loading source registry');
    act(() => root.unmount());
    const retry = vi.fn();
    render(<SourceRegistryTable error="404" onRetry={retry} />);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
    act(() => document.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(retry).toHaveBeenCalledOnce();
    act(() => root.unmount());
    render(<SourceRegistryTable payload={{ sources: [] }} generatedAt="2026-08-24" />);
    expect(document.body.textContent).toContain('No source records are available yet');
    expect(document.body.textContent).toContain('Registry generated Aug 24, 2026');
  });

  it('uses safe official links and shows cadence, coverage and licence', () => {
    render(<SourceRegistryTable payload={{ sources: [
      { source_id: 'b', display_name: 'Zeta Source', publisher: 'Publisher', official_url: 'http://unsafe.example', cadence: 'annual', expected_interval_days: 365, territories: ['Sabah'], pillars: ['Food'], licence: 'Open licence' },
      { source_id: 'a', display_name: 'Alpha Source', publisher: 'Publisher', official_url: 'https://official.example/path', cadence: 'daily', expected_interval_days: 1, territories: ['Brunei'], pillars: ['Energy'], licence: 'Public domain' },
    ] }} generatedAt="2026-08-24" />);
    const link = document.querySelector('a');
    expect(link.textContent).toContain('Alpha Source');
    expect(link.getAttribute('href')).toBe('https://official.example/path');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(document.body.textContent).toContain('Zeta Source');
    expect(document.body.textContent).toContain('Daily');
    expect(document.body.textContent).toContain('Open licence');
    expect(document.body.textContent).toContain('Registry generated Aug 24, 2026');
  });

  it('localises registry freshness and labels an unavailable build date honestly', async () => {
    await i18n.changeLanguage('ms');
    render(<SourceRegistryTable payload={{ sources: [] }} generatedAt="not-a-date" />);
    expect(document.body.textContent).toContain('Tarikh binaan daftar tidak tersedia');
    act(() => root.unmount());
    render(<SourceRegistryTable payload={{ sources: [] }} generatedAt="2026-02-30" />);
    expect(document.body.textContent).toContain('Tarikh binaan daftar tidak tersedia');
    act(() => root.unmount());
    render(<SourceRegistryTable payload={{ sources: [] }} generatedAt="2026-08-24" />);
    expect(document.body.textContent).toContain('Daftar dijana 24 Ogo 2026');
  });

  it('normalises malformed registry entries without creating unsafe links', () => {
    expect(safeOfficialUrl('javascript:alert(1)')).toBeNull();
    expect(safeOfficialUrl('https://official.example')).toBe('https://official.example/');
    expect(registrySources({ sources: [{ source_id: 'x', display_name: 'X' }, null, {}] })).toHaveLength(1);
  });
});
