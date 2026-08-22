import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import '../i18n';
import AnswerStrip from './AnswerStrip';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function render(ui) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter>{ui}</MemoryRouter>);
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

// BT-22/23: purely presentational — every slot is caller-supplied, so these
// tests only cover layout/suppression behaviour, never data derivation
// (that lives in each page's own memoized computation, tested separately).
describe('AnswerStrip', () => {
  it('renders all 4 slots when all 4 are supplied', () => {
    render(
      <AnswerStrip
        what="Sabah's Resilience Index is 67.6 (amber)."
        where="Sabah has the lowest Resilience Index, weakest at Food."
        why="Low food self-sufficiency means the territory depends heavily on imports."
        whatNext={{ text: 'Explore an illustrative Sabah scenario for Food', href: '/simulator?territory=Sabah&pillar=Food' }}
      />
    );

    expect(container.textContent).toContain('67.6');
    expect(container.textContent).toContain('lowest Resilience Index');
    expect(container.textContent).toContain('depends heavily on imports');
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/simulator?territory=Sabah&pillar=Food');
    expect(link.textContent).toBe('Explore an illustrative Sabah scenario for Food');
  });

  it('suppresses omitted slots instead of padding them with filler (ESG-page style: What only)', () => {
    render(<AnswerStrip what="6 Environmental indicators tracked, 13 Social, 1 Governance." />);

    const slots = container.querySelectorAll('.answer-strip-slot');
    expect(slots).toHaveLength(1);
    expect(container.textContent).toContain('6 Environmental indicators tracked');
  });

  it('renders whatNext as plain text (no link) when no href is supplied, e.g. a dead-lever annotation', () => {
    render(<AnswerStrip what="something" whatNext={{ text: "Illustrative scenario for Education isn't available yet for Sabah." }} />);

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain("isn't available yet");
  });

  it('renders nothing at all when every slot is omitted', () => {
    render(<AnswerStrip />);
    expect(container.querySelector('.answer-strip')).toBeNull();
  });
});
