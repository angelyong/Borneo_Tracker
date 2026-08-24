// BT-19's data path. The history artifact is auxiliary (Option A) and is built
// by the refresh workflow, not committed with feature code, so "the file is not
// there" is a normal state that must degrade to silence — never to an error
// banner on the Dashboard and never to a fabricated flat line.

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResilienceHistory } from './useIndicators';
import { computeMomentum } from '../utils/momentum';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
const seen = [];

function Probe() {
  const state = useResilienceHistory();
  seen.push(state);
  return null;
}

async function renderProbe() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<Probe />);
  });
  return seen[seen.length - 1];
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  seen.length = 0;
  vi.unstubAllGlobals();
});

const payload = {
  schemaVersion: 1,
  generatedAt: '2026-08-20',
  territories: {
    Sabah: [
      { date: '2026-08-19', index: 67.6, strict: 62.0, methodologyTag: 'v1.2', isMethodologyBreak: false, sourceCommit: null },
      { date: '2026-08-20', index: 68.4, strict: 62.4, methodologyTag: 'v1.2', isMethodologyBreak: false, sourceCommit: null },
    ],
  },
};

describe('useResilienceHistory', () => {
  it('treats a missing artifact as unavailable, not as an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const state = await renderProbe();

    expect(state).toMatchObject({ data: null, loading: false, error: null, unavailable: true });
  });

  it('exposes the series so momentum can be computed from it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }));

    const state = await renderProbe();

    expect(state.unavailable).toBe(false);
    expect(state.generatedAt).toBe('2026-08-20');
    expect(computeMomentum(state.data.territories.Sabah).delta).toBe(0.8);
  });

  it('reports a real transport failure while still degrading to unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const state = await renderProbe();

    expect(state.error).toContain('500');
    expect(state.unavailable).toBe(true);
    expect(state.data).toBeNull();
  });

  it('does not accept an envelope without territories', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ schemaVersion: 1 }) }));

    const state = await renderProbe();

    expect(state.unavailable).toBe(true);
  });
});
