// BT-23's shared wiring. ESG, SDG and Regional Details all render the strip
// through this hook, so the rules that keep it honest belong here rather than
// three times over in the pages.

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTerritoryAnswerStrip } from './useAnswerStrip';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
const seen = [];

function Probe({ territory }) {
  seen.push(useTerritoryAnswerStrip(territory));
  return null;
}

async function renderProbe(territory) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<Probe territory={territory} />);
  });
  return seen[seen.length - 1];
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  seen.length = 0;
  vi.unstubAllGlobals();
});

const resilience = {
  generatedAt: '2026-08-20',
  territories: {
    Sabah: {
      index: 67.6,
      rag: 'amber',
      weakestPillar: 'Education',
      pillarScores: { Education: 52, Food: 61 },
      scoredPillars: ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'],
      unscoredPillars: [],
    },
    Brunei: { index: null, rag: null, weakestPillar: null, pillarScores: null },
  },
};

function stubResilience(payload = resilience) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }));
}

describe('useTerritoryAnswerStrip', () => {
  it('builds the full four-question strip for a scored territory', async () => {
    stubResilience();

    const strip = await renderProbe('Sabah');

    expect(strip.what.key).toBe('dashboard.headline.complete');
    expect(strip.where.values).toEqual({ territory: 'Sabah', pillar: 'Education', score: 52 });
    expect(strip.why.key).toBe('answerStrip.why.Education');
    expect(strip.next.href).toBe('/simulator?territory=Sabah&pillar=Education');
  });

  it('returns null for a territory with no finite index instead of an empty frame', async () => {
    stubResilience();
    expect(await renderProbe('Brunei')).toBeNull();
  });

  it('returns null for a territory the artifact does not contain', async () => {
    stubResilience();
    expect(await renderProbe('Atlantis')).toBeNull();
  });

  it('returns null while resilience.json is still loading or failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    expect(await renderProbe('Sabah')).toBeNull();
  });
});
