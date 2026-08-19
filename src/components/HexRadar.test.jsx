import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import HexRadar from './HexRadar';

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

describe('HexRadar', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    await i18n.changeLanguage('en');
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it('renders unscored pillars as no-data gaps instead of zero', () => {
    render(<HexRadar pillars={{ Food: 28.6, Energy: 0, Education: null, Shelter: undefined }} max={100} />);

    expect(document.body.textContent).toContain('28.6');
    expect(document.body.textContent).toContain('0');
    expect(document.body.textContent).toContain('No data');
    expect(document.body.textContent).toContain('No comparable data');
    expect(document.querySelectorAll('line[stroke-dasharray="3 4"]').length).toBeGreaterThan(0);
  });

  it('renders a complete polygon when all pillars are scored', () => {
    render(<HexRadar pillars={{ Food: 10, Energy: 20, Education: 30 }} max={100} />);

    expect(document.body.textContent).not.toContain('No data');
    expect(document.querySelector('polygon[fill="rgba(61,184,138,0.25)"]')).toBeTruthy();
  });
});
