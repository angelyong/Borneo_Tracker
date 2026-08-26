import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HexRadar from './HexRadar';
import { HEXAGON_PILLARS } from './hexagonPillars';
import WeakestLinkBars from './WeakestLinkBars';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function render(ui) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(ui);
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

describe('truthful hexagon score rendering', () => {
  it('keeps six axes and distinguishes an actual zero from a missing score', () => {
    render(
      <HexRadar
        pillars={{ Food: 0, Energy: 44, Education: null, Shelter: 71 }}
        max={100}
        missingLabel="Missing — never imputed"
        incompleteLabel="2/6 scored"
      />
    );

    const text = container.textContent;
    HEXAGON_PILLARS.forEach((pillar) => expect(text).toContain(pillar));
    expect(text).toContain('0');
    expect(text).toContain('Missing — never imputed');
    expect(text).toContain('2/6 scored');
    expect(container.querySelector('polygon[fill="rgba(61,184,138,0.25)"]')).toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(3);
  });

  // The district scope plots indicator counts on score geometry. A pillar with
  // zero indicators is missing data, not a measured zero: if it arrives as 0
  // the radar treats every axis as scored, fills the polygon, and (with the
  // scale auto-fitting the largest count) draws a single indicator at the same
  // full radius as a score of 100.
  it('does not draw a complete polygon when a coverage axis has no data', () => {
    render(
      <HexRadar
        pillars={{ Food: null, Energy: null, Education: 1, Shelter: null, Healthcare: 1, Entertainment: null }}
        max={1}
        missingLabel="No comparable data"
      />
    );

    expect(container.querySelector('polygon[fill^="rgba(61,184,138"]')).toBeNull();
    expect(container.querySelectorAll('circle[fill="#3db88a"]')).toHaveLength(2);
    const labels = [...container.querySelectorAll('text')].map((node) => node.textContent);
    expect(labels.filter((text) => text === 'No comparable data')).toHaveLength(4);
    expect(labels).not.toContain('0');
  });

  it('would misrepresent the same coverage if zeros were passed instead of nulls', () => {
    render(
      <HexRadar
        pillars={{ Food: 0, Energy: 0, Education: 1, Shelter: 0, Healthcare: 1, Entertainment: 0 }}
        missingLabel="No comparable data"
      />
    );

    // Pinned as the defect this guards against: all six axes read as scored,
    // so a filled polygon is drawn and nothing is labelled as missing.
    expect(container.querySelector('polygon[fill^="rgba(61,184,138"]')).not.toBeNull();
    const labels = [...container.querySelectorAll('text')].map((node) => node.textContent);
    expect(labels).not.toContain('No comparable data');
  });

  it('draws one score polygon only when all six pillar scores are present', () => {
    render(
      <HexRadar
        pillars={{ Food: 0, Energy: 44, Education: 55, Shelter: 71, Healthcare: 88, Entertainment: 63 }}
        max={100}
      />
    );

    expect(container.querySelectorAll('polygon[fill="rgba(61,184,138,0.25)"]')).toHaveLength(1);
    expect(container.textContent).not.toContain('Incomplete scores');
  });

  it('uses the caller-provided Malay accessible label instead of the English fallback', () => {
    render(
      <HexRadar
        pillars={{ Food: 0, Energy: 44 }}
        max={100}
        missingLabel="Tiada data setanding — tidak pernah dianggarkan"
        incompleteLabel="2/6 tunjang heksagon berskor"
        ariaLabel="2/6 tunjang heksagon berskor"
      />
    );

    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('2/6 tunjang heksagon berskor');
    expect(container.querySelector('title')?.textContent).toBe('2/6 tunjang heksagon berskor');
    expect(container.textContent).toContain('Tiada data setanding — tidak pernah dianggarkan');
  });

  it('keeps missing pillars visible but outside the weakest-link ranking', () => {
    render(
      <WeakestLinkBars
        territory={{
          pillarScores: { Food: 0, Energy: 44, Education: null, Shelter: 71 },
          weakestPillar: 'Food',
        }}
        missingLabel="No comparable data — never imputed"
      />
    );

    const text = container.textContent;
    HEXAGON_PILLARS.forEach((pillar) => expect(text).toContain(pillar));
    expect(text).toContain('No comparable data — never imputed');
    expect(container.querySelectorAll('[title="No comparable data — never imputed"]')).toHaveLength(3);
    expect(text.indexOf('Food')).toBeLessThan(text.indexOf('Energy'));
    expect(text.indexOf('Energy')).toBeLessThan(text.indexOf('Education'));
  });

  it('opens the selected axis with mouse and keyboard while retaining missing-score honesty', () => {
    const onPillarSelect = vi.fn();
    render(
      <HexRadar
        pillars={{ Food: 0, Energy: null }}
        max={100}
        onPillarSelect={onPillarSelect}
        pillarActionLabel="Open {{pillar}} details"
      />
    );

    const food = container.querySelector('[aria-label="Open Food details"]');
    const energy = container.querySelector('[aria-label="Open Energy details"]');
    expect(food?.getAttribute('role')).toBe('button');
    expect(food?.getAttribute('tabindex')).toBe('0');
    expect(food?.classList.contains('hex-radar-axis')).toBe(true);
    expect(food?.querySelector('.hex-radar-focus-ring')).toBeTruthy();
    act(() => food.focus());
    expect(document.activeElement).toBe(food);

    act(() => food.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => energy.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onPillarSelect).toHaveBeenNthCalledWith(1, 'Food', 0);
    expect(onPillarSelect).toHaveBeenNthCalledWith(2, 'Energy', null);
  });
});
