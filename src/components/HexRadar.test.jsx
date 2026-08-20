import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
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
});
