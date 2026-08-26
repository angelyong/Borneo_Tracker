// The ESG page reports how many canonical indicators exist, NOT a weighted
// score. That distinction is load-bearing: KIV-02 (ESG/SDG composite map
// layers) is parked precisely because no defensible ESG composite exists, and
// the client's §1.2 objection was to metrics a reader cannot account for. The
// hero number's style key is literally `scoreNumber`, so nothing but a test
// stops a future change from swapping a count for a score while the caption
// still reads "canonical indicators available".

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import ESGIndicator from './esg_indicator';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const INDICATORS = {
  generatedAt: '2026-08-23',
  rows: [
    // Sarawak / Environment — the page's default scope.
    { territory: 'Sarawak', indicator: 'Forest cover', esg_pillar: 'E', value: 62.3, unit: '% land', year: '2024', source: 'Global Forest Watch', confidence: 'high', canonical: 1 },
    { territory: 'Sarawak', indicator: 'Tree cover loss (cumulative)', esg_pillar: 'E', value: 3183066, unit: 'ha', year: '2001-2023', source: 'Global Forest Watch', confidence: 'high', canonical: 1 },
    // Non-canonical: a second reading of the same concept that lost the
    // canonical contest. It must not be counted or listed.
    { territory: 'Sarawak', indicator: 'Forest cover (alternate source)', esg_pillar: 'E', value: 58.0, unit: '% land', year: '2019', source: 'Other', confidence: 'low', canonical: 0 },
    // Another territory, same pillar — must not leak into Sarawak's view.
    { territory: 'Sabah', indicator: 'Forest cover', esg_pillar: 'E', value: 51.2, unit: '% land', year: '2024', source: 'Global Forest Watch', confidence: 'high', canonical: 1 },
    // Sarawak / Governance — one row, so switching category changes the count.
    { territory: 'Sarawak', indicator: 'Control of Corruption (WGI)', esg_pillar: 'G', value: 57.9, unit: 'score/100', year: '2024', source: 'World Bank WGI', confidence: 'medium', canonical: 1 },
  ],
};

const RESILIENCE = {
  generatedAt: '2026-08-23',
  territories: {
    Sarawak: {
      index: 73.6,
      rag: 'green',
      weakestPillar: 'Education',
      pillarScores: { Education: 45 },
      scoredPillars: ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'],
      unscoredPillars: [],
    },
  },
};

function stubData({ indicators = INDICATORS, resilience = RESILIENCE } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url);
      if (path.includes('resilience.json')) return { ok: true, status: 200, json: async () => resilience };
      if (path.includes('indicators.json')) return { ok: true, status: 200, json: async () => indicators };
      return { ok: false, status: 404 };
    })
  );
}

async function renderPage() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ESGIndicator />
      </MemoryRouter>
    );
  });
}

function clickText(text) {
  const node = [...container.querySelectorAll('button')].find((el) => el.textContent.trim() === text);
  if (!node) throw new Error(`no button labelled ${text}`);
  act(() => node.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function selectRegion(value) {
  const select = container.querySelector('select');
  act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

// The hero figure carries no test hook, so it is located structurally: it is the
// element immediately before the caption that describes it. Asserting its exact
// text is the point — `toContain('2')` would happily pass against a score of
// "62.3", which is precisely the substitution this file exists to prevent.
function heroFigure() {
  const caption = [...container.querySelectorAll('div')].find(
    (node) => node.textContent.trim() === 'canonical indicators available'
  );
  if (!caption) throw new Error('caption "canonical indicators available" not rendered');
  return caption.previousElementSibling.textContent.trim();
}

// One card per listed indicator. A card header is the only structure on the
// page with exactly two spans whose second is a confidence word, so counting
// those cannot be fooled by a confidence word appearing elsewhere (the
// confidence-mix summary renders "High 2", not "High").
function listedIndicatorCount() {
  // "Unknown" is deliberately absent: the "Latest data year" row is also two
  // spans, and renders esg.unknown ("Unknown") when a scope is empty, which
  // would otherwise be counted as a card.
  const CONFIDENCE = ['High', 'Medium', 'Low', 'Manual'];
  return [...container.querySelectorAll('div')].filter((node) => {
    const spans = [...node.children].filter((child) => child.tagName === 'SPAN');
    return spans.length === 2 && CONFIDENCE.includes(spans[1].textContent.trim());
  }).length;
}

afterEach(async () => {
  await i18n.changeLanguage('en');
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.unstubAllGlobals();
});

describe('ESG Indicators page', () => {
  it('presents a count of available indicators, not a score', async () => {
    stubData();
    await renderPage();

    // Sarawak / Environment has exactly two canonical rows, and the hero
    // figure must be that count -- not a score derived from them.
    expect(heroFigure()).toBe('2');
    expect(listedIndicatorCount()).toBe(2);
    expect(heroFigure()).toBe(String(listedIndicatorCount()));
    // The page must never claim to hold a composite ESG figure.
    expect(container.textContent).toContain('Snapshot Only');
    expect(container.textContent).not.toMatch(/ESG (score|index)/i);
    expect(container.textContent).not.toContain('/ 100');
  });

  it('excludes non-canonical rows and other territories from both the count and the list', async () => {
    stubData();
    await renderPage();

    expect(container.textContent).toContain('Forest cover');
    // The losing duplicate reading and Sabah's row must not appear.
    expect(container.textContent).not.toContain('Forest cover (alternate source)');
    expect(container.textContent).not.toContain('51.2');
  });

  it('shows each indicator with its confidence, year and source', async () => {
    stubData();
    await renderPage();

    const cards = [...container.querySelectorAll('div')].filter((node) =>
      node.textContent.startsWith('Forest cover') && node.textContent.includes('Global Forest Watch')
    );
    expect(cards.length).toBeGreaterThan(0);
    expect(container.textContent).toContain('High');
    expect(container.textContent).toContain('2024 · Global Forest Watch');
  });

  it('changes the scope when the category tab or the region changes', async () => {
    stubData();
    await renderPage();

    clickText('Governance');
    expect(container.textContent).toContain('Control of Corruption (WGI)');
    expect(container.textContent).not.toContain('Tree cover loss');

    selectRegion('Sabah');
    // Sabah has no Governance row in the fixture — the honest empty state.
    expect(container.textContent).toContain('No canonical indicators');
  });

  it('states an empty scope in words rather than showing a bare zero', async () => {
    stubData({ indicators: { generatedAt: '2026-08-23', rows: [] } });
    await renderPage();

    expect(container.textContent).toContain('No canonical indicators');
    expect(container.textContent).toContain('No data');
    expect(heroFigure()).toBe('0');
  });

  it('carries the decision strip for the selected territory (BT-23)', async () => {
    stubData();
    await renderPage();

    const strip = container.querySelector('section[aria-label="What this means"]');
    expect(strip).not.toBeNull();
    expect(strip.textContent).toContain('73.6');
  });

  it('omits the decision strip when the territory has no resilience score', async () => {
    stubData({ resilience: { generatedAt: '2026-08-23', territories: {} } });
    await renderPage();

    expect(container.querySelector('section[aria-label="What this means"]')).toBeNull();
    // The indicator content still renders — the strip is additive, not a gate.
    expect(container.textContent).toContain('Forest cover');
  });

  it('renders in Bahasa Melayu', async () => {
    stubData();
    await act(async () => {
      await i18n.changeLanguage('ms');
    });
    await renderPage();

    expect(container.textContent).toContain('penunjuk kanonik tersedia');
  });
});
