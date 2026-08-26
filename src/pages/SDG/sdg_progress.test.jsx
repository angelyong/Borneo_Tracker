// The SDG page is the sibling of the ESG page and carries the same load-bearing
// honesty property: the hero figure counts canonical indicators for one goal, it
// is not an SDG score. That matters more here than on the ESG page, because the
// SDG Index is a real, published composite — so a reader arriving with that
// expectation must not be able to mistake this count for one. KIV-02 stays
// parked for exactly this reason.
//
// The coverage this fixture models is real: SDG1 has an indicator for Sarawak
// and none for Brunei, which is the gap that blocks a composite score.

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import SDGProgress from './sdg_progress';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const INDICATORS = {
  generatedAt: '2026-08-23',
  rows: [
    // Sarawak / SDG1 — the page's default scope.
    { territory: 'Sarawak', indicator: 'Poverty rate (absolute)', sdg_goal: 'SDG1', value: 8.4, unit: '%', year: '2024', source: 'data.gov.my / OpenDOSM', confidence: 'high', canonical: 1 },
    // Same goal, different territory — must not leak into Sarawak's view.
    { territory: 'Sabah', indicator: 'Poverty rate (absolute)', sdg_goal: 'SDG1', value: 17.7, unit: '%', year: '2024', source: 'data.gov.my / OpenDOSM', confidence: 'high', canonical: 1 },
    // Non-canonical duplicate — excluded from the count and the list.
    { territory: 'Sarawak', indicator: 'Poverty rate (superseded)', sdg_goal: 'SDG1', value: 9.9, unit: '%', year: '2019', source: 'Other', confidence: 'low', canonical: 0 },
    // Sarawak / SDG4 — a second goal, so switching tabs changes the count.
    { territory: 'Sarawak', indicator: 'Mean years schooling (RLS)', sdg_goal: 'SDG4', value: 8.7, unit: 'years', year: '2023', source: 'Global Data Lab', confidence: 'medium', canonical: 1 },
    { territory: 'Sarawak', indicator: 'Adult literacy', sdg_goal: 'SDG4', value: 96.1, unit: '%', year: '2011', source: 'UNESCO', confidence: 'medium', canonical: 1 },
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
    // Brunei is deliberately absent, mirroring its missing SDG1 coverage.
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
        <SDGProgress />
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

describe('SDG Progress page', () => {
  it('counts canonical indicators for the goal and never presents an SDG score', async () => {
    stubData();
    await renderPage();

    expect(container.textContent).toContain('SDG1');
    // Sarawak / SDG1 has exactly one canonical row. The hero figure is that
    // count; an SDG Index-style score in its place must fail here.
    expect(heroFigure()).toBe('1');
    expect(listedIndicatorCount()).toBe(1);
    expect(heroFigure()).toBe(String(listedIndicatorCount()));
    expect(container.textContent).toContain('Snapshot Only');
    expect(container.textContent).not.toMatch(/SDG (score|index)/i);
    expect(container.textContent).not.toContain('/ 100');
  });

  it('excludes non-canonical rows and other territories', async () => {
    stubData();
    await renderPage();

    expect(container.textContent).toContain('Poverty rate (absolute)');
    expect(container.textContent).toContain('8.4 %');
    expect(container.textContent).not.toContain('Poverty rate (superseded)');
    // Sabah's row for the same goal must not appear under Sarawak.
    expect(container.textContent).not.toContain('17.7');
  });

  it('changes the scope when the goal tab or the region changes', async () => {
    stubData();
    await renderPage();

    clickText('Quality Education');
    expect(container.textContent).toContain('Mean years schooling (RLS)');
    expect(container.textContent).toContain('Adult literacy');
    expect(container.textContent).not.toContain('Poverty rate (absolute)');

    selectRegion('Brunei');
    expect(container.textContent).toContain('No canonical indicators');
  });

  it('names the region in the empty state rather than showing a bare zero', async () => {
    stubData();
    await renderPage();

    selectRegion('Kalimantan');
    const empty = container.textContent;
    expect(empty).toContain('No canonical indicators');
    expect(empty).toContain('Kalimantan');
    expect(empty).toContain('No data');
    expect(heroFigure()).toBe('0');
    expect(listedIndicatorCount()).toBe(0);
  });

  it('surfaces confidence, year and source for every listed indicator', async () => {
    stubData();
    await renderPage();

    expect(container.textContent).toContain('High');
    expect(container.textContent).toContain('2024 · data.gov.my / OpenDOSM');
  });

  it('carries the decision strip for the selected territory (BT-23)', async () => {
    stubData();
    await renderPage();

    const strip = container.querySelector('section[aria-label="What this means"]');
    expect(strip).not.toBeNull();
    expect(strip.textContent).toContain('73.6');
  });

  it('omits the decision strip for a territory with no resilience score', async () => {
    stubData();
    await renderPage();

    selectRegion('Brunei');
    expect(container.querySelector('section[aria-label="What this means"]')).toBeNull();
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
