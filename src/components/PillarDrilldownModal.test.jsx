import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import PillarDrilldownModal from './PillarDrilldownModal';

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

describe('PillarDrilldownModal', () => {
  it('does not represent an unscored pillar as zero and points to data completion', () => {
    render(
      <MemoryRouter>
        <PillarDrilldownModal open onClose={() => {}} territory="Sabah" pillar="Food" score={null} indicators={[]} />
      </MemoryRouter>
    );

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('No comparable data for this pillar');
    expect(document.body.textContent).toContain('A score of zero is not assumed');
    expect(document.querySelector('a')?.getAttribute('href')).toBe('/data-sources');
  });

  it('shows the exact scored input, provenance, and source confidence', () => {
    render(
      <MemoryRouter>
        <PillarDrilldownModal
          open
          onClose={() => {}}
          territory="Sabah"
          pillar="Food"
          score={28.6}
          indicators={[{ indicator: 'Paddy production per capita', value: 28.6, unit: 'kg/capita', score: 28.6, source: 'OpenDOSM', year: '2022', confidence: 'medium' }]}
        />
      </MemoryRouter>
    );

    expect(document.body.textContent).toContain('Resilience pillar score: 28.6 / 100');
    expect(document.body.textContent).toContain('Paddy production per capita');
    expect(document.body.textContent).toContain('OpenDOSM');
    expect(document.body.textContent).toContain('Medium');
    expect(document.body.textContent).toContain('2022');
  });

  // BT-34. On the all-Borneo scope the drill-down flattens four territories'
  // rows into one list, so each row has to say which territory it came from —
  // and the same indicator and year legitimately repeat across territories.
  it('labels each row by territory and keeps duplicate indicator/year pairs distinct', () => {
    render(
      <MemoryRouter>
        <PillarDrilldownModal
          open
          onClose={() => {}}
          territory="Overall Borneo"
          pillar="Shelter"
          score={73.6}
          indicators={[
            { territory: 'Sabah', indicator: 'Clean water access', value: 80.5, unit: '%', score: 61, source: 'OpenDOSM', year: '2022', confidence: 'high' },
            { territory: 'Sarawak', indicator: 'Clean water access', value: 83.7, unit: '%', score: 67.4, source: 'OpenDOSM', year: '2022', confidence: 'high' },
          ]}
          contributors={['Sabah 61', 'Sarawak 67.4']}
        />
      </MemoryRouter>
    );

    const rows = [...document.querySelectorAll('.pillar-drilldown-list li')];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Sabah · Clean water access');
    expect(rows[1].textContent).toContain('Sarawak · Clean water access');
  });

  it('states the arithmetic behind an averaged score', () => {
    render(
      <MemoryRouter>
        <PillarDrilldownModal
          open
          onClose={() => {}}
          territory="Overall Borneo"
          pillar="Shelter"
          score={73.6}
          indicators={[
            { territory: 'Sabah', indicator: 'Clean water access', value: 80.5, unit: '%', score: 61, source: 'OpenDOSM', year: '2022', confidence: 'high' },
          ]}
          contributors={['Sabah 61', 'Sarawak 67.4', 'Brunei 100', 'Kalimantan 66']}
        />
      </MemoryRouter>
    );

    const method = document.querySelector('.pillar-drilldown-method');
    expect(method.textContent).toBe(
      'All-Borneo 73.6 is the mean of the 4 scored territories: Sabah 61 · Sarawak 67.4 · Brunei 100 · Kalimantan 66.'
    );
  });

  it('omits the territory label and the method line for a single territory', () => {
    render(
      <MemoryRouter>
        <PillarDrilldownModal
          open
          onClose={() => {}}
          territory="Sabah"
          pillar="Food"
          score={28.6}
          indicators={[
            { indicator: 'Paddy production per capita', value: 28.6, unit: 'kg/capita', score: 28.6, source: 'OpenDOSM', year: '2022', confidence: 'medium' },
          ]}
        />
      </MemoryRouter>
    );

    expect(document.querySelector('.pillar-drilldown-method')).toBeNull();
    expect(document.querySelector('.pillar-drilldown-list li').textContent).not.toContain(' · Paddy');
  });

  // BT-35. A district has real indicators behind a pillar but no pillar score,
  // and must not be handed one. This is the third state: indicators present,
  // score deliberately absent.
  it('lists district indicators without inventing a score for them', () => {
    render(
      <MemoryRouter>
        <PillarDrilldownModal
          open
          onClose={() => {}}
          territory="Sambas"
          pillar="Education"
          score={undefined}
          unscoredWithIndicators
          indicators={[
            { indicator: 'Mean years schooling (RLS)', value: 7.0, unit: 'years', year: '2025', source: 'BPS Indonesia', confidence: 'high' },
          ]}
        />
      </MemoryRouter>
    );

    expect(document.body.textContent).toContain('Mean years schooling (RLS)');
    expect(document.body.textContent).toContain('BPS Indonesia');
    expect(document.body.textContent).toContain('No resilience score is computed at district level');
    // No score anywhere: not the pillar score line, not a per-indicator one,
    // and above all not a fabricated zero.
    expect(document.body.textContent).not.toContain('/ 100');
    expect(document.body.textContent).not.toContain('Scored contribution');
    expect(document.body.textContent).not.toContain('undefined');
  });

  it('falls back to the honest empty card when a district pillar has no indicators', () => {
    render(
      <MemoryRouter>
        <PillarDrilldownModal
          open
          onClose={() => {}}
          territory="Kota Kinabalu"
          pillar="Food"
          score={undefined}
          unscoredWithIndicators
          indicators={[]}
        />
      </MemoryRouter>
    );

    expect(document.body.textContent).toContain('No comparable data for this pillar');
    expect(document.body.textContent).toContain('A score of zero is not assumed');
  });

  it('traps Tab and Shift+Tab within its modal focusable elements', () => {
    render(
      <MemoryRouter>
        <PillarDrilldownModal open onClose={() => {}} territory="Sabah" pillar="Food" score={null} indicators={[]} />
      </MemoryRouter>
    );

    const dialog = document.querySelector('[role="dialog"]');
    const closeButton = dialog.querySelector('button');
    const link = dialog.querySelector('a');
    expect(document.activeElement).toBe(closeButton);

    act(() => link.focus());
    act(() => link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    expect(document.activeElement).toBe(closeButton);

    act(() => closeButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })));
    expect(document.activeElement).toBe(link);
  });
});
