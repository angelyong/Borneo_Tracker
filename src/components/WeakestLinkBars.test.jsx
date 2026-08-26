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

  // The client named this sentence as the methodology's differentiating idea,
  // so it must reach the screen as a claim, not be paraphrased away into a
  // description of the widget.
  it('states the weakest-link principle separately from the widget description', () => {
    render(
      <WeakestLinkBars
        territory={{ weakestPillar: 'Food', pillarScores: { Food: 30, Energy: 80 } }}
        principle="Resilience is only as strong as its weakest essential pillar."
        explanation="The score broken into its six essentials."
      />
    );

    const paragraphs = [...container.querySelectorAll('p')].map((node) => node.textContent);
    expect(paragraphs).toEqual([
      'Resilience is only as strong as its weakest essential pillar.',
      'The score broken into its six essentials.',
    ]);
  });

  it('omits the principle line when none is supplied', () => {
    render(<WeakestLinkBars territory={{ pillarScores: { Food: 30 } }} explanation="Only a description." />);

    expect([...container.querySelectorAll('p')].map((node) => node.textContent)).toEqual(['Only a description.']);
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
    expect(document.body.textContent).toContain('No comparable data — never imputed');
  });

  it('keeps every unscored pillar visible as no data instead of treating it as zero', () => {
    render(<WeakestLinkBars territory={{ pillarScores: {} }} />);

    expect(document.body.textContent).toContain('Food');
    expect(document.body.textContent).toContain('Entertainment');
    expect(document.body.textContent).toContain('No comparable data — never imputed');
    expect(document.querySelectorAll('div[title="No comparable data — never imputed"]')).toHaveLength(0);
  });
});
