import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import MomentumBadge, { MomentumMovers, MomentumSummary } from './MomentumBadge';
import { biggestMovers, computeMomentum, movementSummary } from '../utils/momentum';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function render(ui) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(ui));
}

afterEach(async () => {
  await i18n.changeLanguage('en');
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

const point = (date, index, methodologyTag = 'v1.2', isMethodologyBreak = false) => ({
  date,
  index,
  strict: null,
  methodologyTag,
  isMethodologyBreak,
  sourceCommit: null,
});

describe('MomentumBadge', () => {
  it('renders nothing when the auxiliary history artifact is unavailable', () => {
    render(<MomentumBadge momentum={null} />);
    expect(container.textContent).toBe('');
    act(() => root.unmount());

    render(<MomentumBadge momentum={computeMomentum([])} />);
    expect(container.textContent).toBe('');
  });

  it('shows a signed delta against the previous published point', () => {
    render(<MomentumBadge momentum={computeMomentum([point('2026-08-19', 67.6), point('2026-08-20', 68.9)])} />);

    expect(container.textContent).toContain('+1.3 since 19 Aug 2026');
    expect(container.querySelector('[role="img"][aria-label="Improved"]')).not.toBeNull();
  });

  it('uses a typographic minus and the decline label when the score falls', () => {
    render(<MomentumBadge momentum={computeMomentum([point('2026-08-19', 67.6), point('2026-08-20', 66.9)])} />);

    expect(container.textContent).toContain('−0.7 since 19 Aug 2026');
    expect(container.querySelector('[role="img"][aria-label="Declined"]')).not.toBeNull();
  });

  it('states a flat run in words instead of showing +0.0', () => {
    render(
      <MomentumBadge
        momentum={computeMomentum([point('2026-08-17', 67.4), point('2026-08-18', 67.6), point('2026-08-20', 67.6)])}
      />
    );

    expect(container.textContent).toContain('No change since 18 Aug 2026');
    expect(container.textContent).not.toContain('+0');
    expect(container.querySelector('[aria-label="Improved"]')).toBeNull();
    expect(container.querySelector('[aria-label="Declined"]')).toBeNull();
  });

  it('falls back to the window start when the score never moved', () => {
    render(<MomentumBadge momentum={computeMomentum([point('2026-08-19', 67.6), point('2026-08-20', 67.6)])} />);
    expect(container.textContent).toContain('No change since 19 Aug 2026');
  });

  it('refuses to imply a trend across a methodology break', () => {
    render(
      <MomentumBadge
        momentum={computeMomentum([
          point('2026-08-16', 72.1, 'v1.1-education-loss-defect'),
          point('2026-08-17', 67.6, 'v1.2-canonical-fixed', true),
        ])}
      />
    );

    expect(container.textContent).toContain('First reading on the current method (17 Aug 2026)');
    expect(container.textContent).toContain('not comparable');
    expect(container.textContent).not.toContain('4.5');
  });

  it('labels the sparkline with the window it actually draws', () => {
    render(
      <MomentumBadge
        momentum={computeMomentum([point('2026-08-18', 67.4), point('2026-08-19', 67.6), point('2026-08-20', 68.1)])}
      />
    );

    const sparkline = container.querySelector('svg[role="img"]');
    expect(sparkline.getAttribute('aria-label')).toBe('Resilience index from 18 Aug 2026 to 20 Aug 2026');
    expect(sparkline.querySelector('path').getAttribute('d').startsWith('M0.00')).toBe(true);
  });

  it('translates every state into Bahasa Melayu', async () => {
    await act(async () => {
      await i18n.changeLanguage('ms');
    });
    render(<MomentumBadge momentum={computeMomentum([point('2026-08-19', 67.6), point('2026-08-20', 67.6)])} />);

    expect(container.textContent).toContain('Tiada perubahan sejak');
  });
});

describe('MomentumMovers', () => {
  const payload = {
    territories: {
      Sabah: [point('2026-08-19', 67.6), point('2026-08-20', 67.6)],
      Sarawak: [point('2026-08-19', 73.6), point('2026-08-20', 74.9)],
      Brunei: [point('2026-08-19', 78.0), point('2026-08-20', 77.2)],
    },
  };

  it('names only the territories that actually moved, largest first', () => {
    render(<MomentumMovers movers={biggestMovers(payload)} />);

    expect(container.textContent).toContain('Biggest movers:');
    expect(container.textContent).toContain('Sarawak +1.3');
    expect(container.textContent).toContain('Brunei −0.8');
    expect(container.textContent).not.toContain('Sabah');
    expect(container.textContent.indexOf('Sarawak')).toBeLessThan(container.textContent.indexOf('Brunei'));
  });

  it('says so plainly on a quiet day instead of listing zeroes', () => {
    render(<MomentumMovers movers={[]} />);
    expect(container.textContent).toBe('No territory moved since the last publication.');
  });

  it('renders nothing when history is unavailable', () => {
    render(<MomentumMovers movers={null} />);
    expect(container.textContent).toBe('');
  });
});

describe('MomentumSummary', () => {
  const payload = {
    territories: {
      Sabah: [point('2026-08-19', 65.1), point('2026-08-20', 67.6)],
      Sarawak: [point('2026-08-19', 73.6), point('2026-08-20', 73.6)],
      Brunei: [point('2026-08-19', 78.4), point('2026-08-20', 78.0)],
    },
  };

  it('states direction as counts, never as an aggregate delta', () => {
    render(<MomentumSummary summary={movementSummary(payload)} />);

    expect(container.textContent).toBe(
      'Since the last publication: 1 up · 1 down · 1 unchanged, of 3 territories.'
    );
  });

  it('discloses territories that have no comparable previous reading', () => {
    const withBreak = {
      territories: {
        ...payload.territories,
        Kalimantan: [point('2026-08-20', 67.7, 'v1.2-canonical-fixed', true)],
      },
    };

    render(<MomentumSummary summary={movementSummary(withBreak)} />);

    expect(container.textContent).toContain('of 4 territories');
    expect(container.textContent).toContain('1 have no comparable previous reading.');
  });

  it('renders nothing when there is no history', () => {
    render(<MomentumSummary summary={null} />);
    expect(container.textContent).toBe('');
  });
});
