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

// BT-12: opt-in pillar drill-down interactivity.
describe('HexRadar pillar drill-down interactivity', () => {
  it('is purely decorative (no button role, no tabIndex) when onPillarClick is omitted', () => {
    render(<HexRadar pillars={{ Food: 28.6, Energy: 98.5 }} max={100} />);
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
  });

  it('makes every axis clickable and keyboard-operable when onPillarClick is supplied', () => {
    const onPillarClick = vi.fn();
    render(
      <HexRadar
        pillars={{ Food: 28.6, Energy: 98.5, Education: 51.3, Shelter: 66, Healthcare: 59.5, Entertainment: 52.2 }}
        max={100}
        onPillarClick={onPillarClick}
      />
    );

    const buttons = container.querySelectorAll('[role="button"]');
    expect(buttons).toHaveLength(HEXAGON_PILLARS.length);

    const foodButton = [...buttons].find((el) => el.getAttribute('aria-label') === 'Food');
    expect(foodButton).toBeTruthy();
    expect(foodButton.tabIndex).toBe(0);

    act(() => {
      foodButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onPillarClick).toHaveBeenCalledWith('Food');

    onPillarClick.mockClear();
    act(() => {
      foodButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onPillarClick).toHaveBeenCalledWith('Food');

    onPillarClick.mockClear();
    act(() => {
      foodButton.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    expect(onPillarClick).toHaveBeenCalledWith('Food');
  });

  it('does not invoke onPillarClick for an unrelated key press', () => {
    const onPillarClick = vi.fn();
    render(<HexRadar pillars={{ Food: 28.6 }} max={100} onPillarClick={onPillarClick} />);
    const button = container.querySelector('[role="button"][aria-label="Food"]');
    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(onPillarClick).not.toHaveBeenCalled();
  });
});
