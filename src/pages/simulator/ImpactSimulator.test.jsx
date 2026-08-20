import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';

const { useResilienceModel } = vi.hoisted(() => ({ useResilienceModel: vi.fn() }));
vi.mock('../../data/useIndicators', () => ({ TERRITORIES: ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'], useResilienceModel }));
vi.mock('../../utils/resilienceModel', () => ({ recompute: (territory) => ({ index: territory === 'Sarawak' ? 73.6 : 67.6, rag: 'green', weakestPillar: 'Education', pillarScores: { Food: 70, Education: 60 } }) }));
vi.mock('../../components/HexRadar', () => ({ default: () => null }));
vi.mock('../../components/RagGauge', () => ({ default: () => null }));
vi.mock('../../components/WeakestLinkBars', () => ({ default: () => null }));
vi.mock('../../components/ProvenanceChip', () => ({ default: () => null }));
vi.mock('../../components/IntegrityChip', () => ({ default: () => null }));
import ImpactSimulator from './ImpactSimulator';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const input = (value, unit = '%') => ({ value, unit, confidence: 'high', source: 'DOSM', year: '2024' });
const model = {
  pillars: ['Food', 'Education'], index: { ragThresholds: { green: 70, amber: 40 } },
  bounds: { 'Paddy production per capita': { best: 100, worst: 0 }, 'Adult literacy': { best: 100, worst: 0 } },
  baseline: Object.fromEntries(['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'].map((territory, index) => [territory, { inputs: { 'Paddy production per capita': input(10 + index * 10, 'kg'), 'Adult literacy': input(80 - index * 5) } }])),
};
let container;
let root;

function render(entry) {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  act(() => root.render(<MemoryRouter initialEntries={[entry]}><ImpactSimulator /></MemoryRouter>));
  act(() => vi.runAllTimers()); act(() => vi.runAllTimers());
}

describe('Impact Simulator deep-link UI', () => {
  beforeEach(() => { vi.useFakeTimers(); HTMLElement.prototype.scrollIntoView = vi.fn(); useResilienceModel.mockReturnValue({ data: model, loading: false, error: null }); });
  afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.useRealTimers(); });

  it('selects and focuses a valid route without changing its baseline input', () => {
    render('/simulator?territory=Sarawak&pillar=Education');
    expect(container.querySelector('select').value).toBe('Sarawak');
    expect(container.querySelector('input[aria-label*="Education"]').value).toBe('75');
    expect(document.activeElement.textContent).toContain('Education');
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('ignores invalid values and does not overwrite a later manual territory selection', () => {
    render('/simulator?territory=All-Borneo&pillar=Unknown');
    const select = container.querySelector('select');
    expect(select.value).toBe('Sabah');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    act(() => { setter.call(select, 'Brunei'); select.dispatchEvent(new Event('change', { bubbles: true })); vi.runAllTimers(); });
    expect(select.value).toBe('Brunei');
  });
});
