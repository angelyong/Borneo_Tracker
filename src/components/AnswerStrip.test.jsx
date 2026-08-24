import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import AnswerStrip from './AnswerStrip';
import { translateHeadline } from '../utils/headlineText';
import { buildAnswerStrip } from '../utils/answerStrip';
import { makeSimulatorHref } from '../utils/simulatorRoute';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function render(ui) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<MemoryRouter>{ui}</MemoryRouter>));
}

afterEach(async () => {
  await i18n.changeLanguage('en');
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

const headline = {
  key: 'dashboard.headline.complete',
  values: { index: 67.6, rag: 'amber', weakestPillar: 'Education' },
  coverage: { isIncomplete: false, unscoredPillars: [], partialPillars: [] },
};

const territoryStrip = buildAnswerStrip({
  headline,
  territory: 'Sabah',
  weakestPillar: 'Education',
  pillarScores: { Education: 52 },
  makeHref: makeSimulatorHref,
});

describe('AnswerStrip', () => {
  it('renders nothing without a "what" to answer', () => {
    render(<AnswerStrip strip={null} />);
    expect(container.textContent).toBe('');
  });

  it('answers the four questions in one strip', () => {
    render(<AnswerStrip strip={territoryStrip} />);

    const section = container.querySelector('section');
    expect(section.getAttribute('aria-label')).toBe('What this means');
    expect(section.textContent).toContain('Current resilience score: 67.6');
    expect(section.textContent).toContain('In Sabah, Education is the weakest scored pillar at 52.');
    expect(section.textContent).toContain('skilled workforce');
    expect(container.querySelector('a').getAttribute('href')).toBe('/simulator?territory=Sabah&pillar=Education');
  });

  it('translates the band and pillar enums instead of interpolating raw values', () => {
    render(<AnswerStrip strip={territoryStrip} />);
    expect(container.textContent).not.toContain('amber');
    expect(container.textContent).toContain('Amber');
  });

  it('renders one question fewer rather than inventing an unanswerable slot', () => {
    render(<AnswerStrip strip={buildAnswerStrip({ headline, territory: 'Sabah', weakestPillar: null })} />);

    expect(container.textContent).toContain('Current resilience score');
    // Only the "what" row survives; no where/why/what-next placeholders.
    expect(container.querySelectorAll('section > div')).toHaveLength(1);
    expect(container.querySelector('a')).toBeNull();
  });

  it('renders in Bahasa Melayu', async () => {
    await act(async () => {
      await i18n.changeLanguage('ms');
    });
    render(<AnswerStrip strip={territoryStrip} />);

    expect(container.querySelector('section').getAttribute('aria-label')).toBe('Apa maksudnya');
    expect(container.textContent).toContain('Di Sabah');
  });
});

describe('translateHeadline', () => {
  it('returns null for a missing headline', () => {
    expect(translateHeadline(i18n.t, null)).toBeNull();
  });

  it('leaves a score-only headline free of undefined interpolation', () => {
    const text = translateHeadline(i18n.t, {
      key: 'dashboard.headline.scoreOnly',
      values: { index: 67.6, rag: null, weakestPillar: null },
    });

    expect(text).toContain('67.6');
    expect(text).not.toContain('undefined');
  });
});
