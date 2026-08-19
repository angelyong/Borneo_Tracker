import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
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

describe('WeakestLinkBars', () => {
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

  it('keeps real zero scores and labels unscored pillars as no data', () => {
    render(
      <WeakestLinkBars
        territory={{
          weakestPillar: 'Food',
          pillarScores: {
            Food: 0,
            Energy: 80,
            Shelter: 40,
          },
        }}
      />
    );

    expect(document.body.textContent).toContain('Food');
    expect(document.body.textContent).toContain('0');
    expect(document.body.textContent).toContain('Education');
    expect(document.body.textContent).toContain('No data');
  });

  it('does not render when no pillars are scored', () => {
    render(<WeakestLinkBars territory={{ pillarScores: {} }} />);

    expect(document.body.textContent).toBe('');
  });
});
